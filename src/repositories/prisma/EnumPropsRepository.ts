import { serializeBigInts } from "../../shared/utils/serializeBigInt.js";
import { PrismaRepository } from "./PrismaRepository.js";
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
        perfil[column] = this.getPerfilProps(perfil[column], perfil.id_contrato);
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
    const queryResultProdutos = await this.prisma.$queryRaw`SELECT * FROM at_prf_produto`;

    const grupos = serializeBigInts(queryResultGrupos);
    const produtos = serializeBigInts(queryResultProdutos);
    return { grupos, produtos };
  }

  async getContractInfo() {
    const queryResult = await this.prisma.$queryRaw`SELECT * FROM at_prf_config`;
    return queryResult;
  }

  async getTemasAtendimento() {
    const queryResult = await this.prisma.$queryRaw`
    SELECT * FROM at_indicador_campo_acessorio_lista
    WHERE fk_at_indicador_camp_acessorio = 14033
    ORDER BY valor;
    `;
    const temas = serializeBigInts(queryResult);
    return temas;
  }
}
