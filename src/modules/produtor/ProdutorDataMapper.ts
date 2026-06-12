import type {
  CreateProdutorDTO,
  EnderecoInput,
  PropriedadeInput,
} from "./dto/CreateProdutorDTO.js";
import { TIPO_CONTATO, TIPO_LOGRADOURO_IDS } from "./produtorConstants.js";

// Pure mapping + derivation for createProdutor: domain input -> Prisma column names, plus the
// fk_tpo_logradouro / id_tipo_contato_pessoa derivations. No DB, no side effects, no throwing
// (boundary validation/normalization, including telefone, lives in produtorValidation).

export class ProdutorDataMapper {
  /** ger_pessoa scalar columns from the domain input (relations / fixed / repo-set fields excluded). */
  static mapProdutorInput(input: CreateProdutorDTO) {
    return {
      nm_pessoa: input.nome,
      nr_cpf_cnpj: input.cpf,
      ds_email: input.email ?? null,
      dt_nascimento: input.dataNascimento ?? null,
      tp_sexo: input.tpSexo ?? null,
      nr_identidade: input.identidade ?? null,
    };
  }

  /** ger_end_pessoa street-level columns (tp_endereco / fk_municipio / fk_tpo_logradouro set by the repo). */
  static mapEndereco(endereco: EnderecoInput) {
    return {
      ds_logradouro: endereco.logradouro ?? null,
      nr_logradouro: endereco.numero ?? null,
      ds_complemento: endereco.complemento ?? null,
      nm_bairro: endereco.bairro ?? null,
      nr_cep: endereco.cep ?? null,
    };
  }

  /** pl_propriedade columns from the domain input (dt_update_record set by the repo). */
  static mapPropriedade(propriedade: PropriedadeInput) {
    return {
      nome_propriedade: propriedade.nome,
      area_total: propriedade.areaTotal ?? null,
      geo_ponto_texto: propriedade.geoPontoTexto ?? null,
      id_municipio: propriedade.municipioId,
      id_und_empresa: propriedade.unidadeEmpresa,
      ativo: true,
    };
  }

  /**
   * fk_tpo_logradouro derived from the logradouro string (case-insensitive), null if no match.
   * Full word | abbrev (R. Av/Av. Rod. Pç) | highway (BR/MG/LMG/AMG + opt sep + digit -> Rodovia).
   */
  static tipoLogradouro(logradouro?: string | null): number | null {
    if (!logradouro) return null;
    const s = logradouro.trim().toLowerCase();
    if (!s) return null;

    // highway: BR/MG/LMG/AMG followed by optional - / space then a digit
    if (/^(br|mg|lmg|amg)[\s-]*\d/.test(s))
      return TIPO_LOGRADOURO_IDS["Rodovia"];

    const head = s.split(/\s+/)[0];
    const fullWords: Record<string, number> = {
      rua: TIPO_LOGRADOURO_IDS["Rua"],
      avenida: TIPO_LOGRADOURO_IDS["Avenida"],
      praça: TIPO_LOGRADOURO_IDS["Praça"],
      praca: TIPO_LOGRADOURO_IDS["Praça"],
      rodovia: TIPO_LOGRADOURO_IDS["Rodovia"],
      alameda: TIPO_LOGRADOURO_IDS["Alameda"],
      beco: TIPO_LOGRADOURO_IDS["Beco"],
      travessa: TIPO_LOGRADOURO_IDS["Travessa"],
      sítio: TIPO_LOGRADOURO_IDS["Sítio"],
      sitio: TIPO_LOGRADOURO_IDS["Sítio"],
    };
    if (fullWords[head] != null) return fullWords[head];

    const abbrevs: Record<string, number> = {
      "r.": TIPO_LOGRADOURO_IDS["Rua"],
      av: TIPO_LOGRADOURO_IDS["Avenida"],
      "av.": TIPO_LOGRADOURO_IDS["Avenida"],
      "rod.": TIPO_LOGRADOURO_IDS["Rodovia"],
      pç: TIPO_LOGRADOURO_IDS["Praça"],
      pc: TIPO_LOGRADOURO_IDS["Praça"],
    };
    return abbrevs[head] ?? null;
  }

  /** id_tipo_contato_pessoa: mobility digit (1st after the 2-digit DDD) 7/8/9 -> Celular, else Comercial. */
  static tipoContato(digits: string): number {
    const mobility = digits[2];
    return mobility === "7" || mobility === "8" || mobility === "9"
      ? TIPO_CONTATO.CELULAR
      : TIPO_CONTATO.COMERCIAL;
  }
}
