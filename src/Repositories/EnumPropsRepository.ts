import { PrismaRepository } from "./PrismaRepository.js";
import humps from "humps";

type enumKeys = {
  tipo: string;
};

type optionRow = {
  tipo: string;
  id: number;
  descricao: string;
};

export class EnumPropsRepository extends PrismaRepository {
  async getEnumKeys() {
    const enumKeys: enumKeys[] = await this.prisma.$queryRaw`SELECT DISTINCT tipo FROM ger_enum_descricao`;
    return enumKeys.map(({ tipo }) => tipo);
  }

  async getPerfilProps(perfil: any): Promise<Object> {
    const enumKeys = await this.getEnumKeys();

    const updatedProps = {};
    for (let column in perfil) {
      if (column === "dados_producao_agro_industria" || column === "dados_producao_in_natura") {
        perfil[column] = this.getPerfilProps(perfil[column]);
        continue;
      }

      let key = humps.pascalize(column);
      key = key.replace("ProcedimentoPosColheita", "ProcedimentosPosColheita");
      if (!enumKeys.includes(key)) {
        continue;
      }

      const value = parseInt(perfil[column]);

      if (value) {
        const [result] = (await this.prisma.$queryRaw`SELECT multiploprimotolistenum(${key}, ${value})`) as any[];
        const data = result?.multiploprimotolistenum;
        column = column.replace("procedimentos_pos_colheita", "procedimento_pos_colheita");
        if (data) Object.assign(updatedProps, { [column]: data });
      }
    }

    return {
      ...perfil,
      ...updatedProps,
    };
  }

  async getPerfilOptions() {
    const optionsRows: optionRow[] = await this.prisma.$queryRaw`SELECT * FROM ger_enum_descricao`;

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
}

const all_ger_enum_keys = [
  "TipoPessoaJuridica",
  "FormaEsgotamentoSanitario",
  "TipoProducao",
  "ProcedimentosPosColheita",
  "LocalComercializacao",
  "TipoPerfil",
  "SistemaProducao",
  "TipoRegularizacaoUsoRecursosHidricos",
  "TipoOrganizacaoEstabelecimento",
  "CondicaoPosse",
  "GrauInteresse",
  "PerfilSeeAtividade",
  "TipoGestaoUnidade",
  "TipoRegularizacaoAmbiental",
  "FonteCaptacaoAgua",
  "OrgaoFiscalizacaoSanitaria",
  "NivelTecnologicoCultivo",
  "AtividadesComRegularizacaoAmbiental",
  "DificuldadeFornecimento",
  "AtividadesUsamRecursosHidricos",
  "FormaEntregaProdutos",
];
