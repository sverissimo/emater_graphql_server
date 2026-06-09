import { serializeBigInts } from "../shared/utils/serializeBigInt.js";
import { PrismaRepository } from "./PrismaRepository.js";
import type { MunicipioEmater } from "./types/MunicipioEmater.js";
import humps from "humps";

type enumKeys = {
  tipo: string;
};

type optionRow = {
  tipo: string;
  id: number;
  descricao: string;
  id_contrato: number;
};

export class EnumPropsRepository extends PrismaRepository {
  async getEnumKeys() {
    const enumKeys: enumKeys[] = await this.prisma
      .$queryRaw`SELECT DISTINCT tipo FROM ger_enum_descricao`;
    return enumKeys.map(({ tipo }) => tipo);
  }

  async getPerfilProps(perfil: any, id_contrato?: number): Promise<Object> {
    const updatedProps = {};
    let enumKeys: string[] = [];

    for (let column in perfil) {
      if (!enumKeys.length) enumKeys = await this.getEnumKeys();
      if (
        (column === "dados_producao_agro_industria" && perfil[column]) ||
        (column === "dados_producao_in_natura" && perfil[column])
      ) {
        perfil[column] = this.getPerfilProps(
          perfil[column],
          perfil.id_contrato,
        );
        continue;
      }

      let key = humps.pascalize(column);

      key = key
        .replace("ProcedimentoPosColheita", "ProcedimentosPosColheita")
        .replace("ValorTotalObtidoPNAE", "ValorPnae")
        .replace("ValorTotalObtidoPnae", "ValorPnae")
        .replace("ValorTotalObtidoOutros", "ValorDemais");

      if (!enumKeys.includes(key)) {
        continue;
      }

      const numeroContrato = id_contrato || perfil.id_contrato || 1;
      const value = parseInt(perfil[column]);

      if (isNaN(value)) continue;

      const [result] = (await this.prisma.$queryRaw`
          SELECT multiploprimotolistenum(${key}, ${value}, ${numeroContrato}::integer)
          `) as any[];
      const data = result?.multiploprimotolistenum;
      column = column
        .replace("procedimentos_pos_colheita", "procedimento_pos_colheita")
        .replace("valor_total_obtido_pnae", "valor_total_obtido_pnae")
        .replace("valor_total_obtido_pnae", "valor_total_obtido_pnae");
      if (data) Object.assign(updatedProps, { [column]: data });
    }

    return {
      ...perfil,
      ...updatedProps,
    };
  }

  async getPerfilOptions() {
    const optionsRows: optionRow[] = await this.prisma.$queryRaw`
      SELECT * FROM ger_enum_descricao
      WHERE id_contrato = 2;
      `;

    const perfilOptions = optionsRows.reduce((prev, curr) => {
      const { tipo, descricao } = curr;
      if (!prev[tipo]) {
        prev[tipo] = [descricao];
      } else {
        prev[tipo].push(descricao);
      }
      return prev;
    }, {} as any);
    return perfilOptions;
  }

  getPerfilOptionsRaw() {
    const optionsRows: Promise<optionRow[]> = this.prisma.$queryRaw`
      SELECT * FROM ger_enum_descricao;
      `;
    return optionsRows;
  }

  async getGruposProdutos() {
    const queryResultGrupos = await this.prisma
      .$queryRaw`SELECT * FROM at_prf_grupo_produto`;
    const queryResultProdutos = await this.prisma
      .$queryRaw`SELECT * FROM at_prf_produto`;

    const grupos = serializeBigInts(queryResultGrupos);
    const produtos = serializeBigInts(queryResultProdutos);
    return { grupos, produtos };
  }

  async getContractInfo() {
    const queryResult = await this.prisma
      .$queryRaw`SELECT * FROM at_prf_config`;
    return queryResult;
  }

  async getRegionaisEmater() {
    const regionais: any[] = await this.prisma.$queryRaw`
           SELECT * from ger_und_empresa
          where id_und_empresa like '%G%'
          `;

    return regionais;
  }

  async getMunicipiosEmater(): Promise<MunicipioEmater[]> {
    return this.prisma.$queryRaw<MunicipioEmater[]>`
      SELECT
        h.id_und_empresa,
        m.nm_municipio AS nome_municipio,
        h.fk_municipio AS municipio_id,
        h.fk_und_empresa AS regional_id,
        g.nm_und_empresa AS nome_regional
      FROM ger_und_empresa h
      JOIN sep_municipio m
        ON m.id_municipio = h.fk_municipio
      JOIN ger_und_empresa g
        ON g.id_und_empresa = h.fk_und_empresa
        AND g.id_und_empresa LIKE 'G%'
      WHERE h.id_und_empresa LIKE 'H%'
        AND h.fk_municipio IS NOT NULL
        AND h.sn_ativa = 1
        AND g.sn_ativa = 1
        AND m.nm_municipio IS NOT NULL
        AND g.nm_und_empresa IS NOT NULL
      ORDER BY m.nm_municipio
    `;
  }
}
