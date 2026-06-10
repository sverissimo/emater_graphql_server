// Fixed lookup ids written on every createProdutor, plus the derivation id maps. These ids are
// stable but not guaranteed identical across dev/hmg/prod — verify with the deployment-time SQL
// assertion before first write (see docs/plans/produtor-create-mutation-plan.md "Lookup ID verification").
//
// Expected (id, label) pairs to assert:
//   ger_cat_pessoa        39 -> "Agricultor Familiar"   (alt under review: 35 -> "Clientes")
//   sub_categoria_pessoa   1 -> "Típico(a)"
//   tipo_contato_pessoa    1 -> "Comercial", 3 -> "Celular"

/** ger_pes_cat_ramo_relacao.fk_cat_pessoa — 39 = "Agricultor Familiar". */
export const FK_CAT_PESSOA = 39;

/** sub_categoria_pessoa_relacao.fk_sub_cat_pessoa — 1 = "Típico(a)". */
export const FK_SUB_CAT_PESSOA = 1;

/** ger_end_pessoa.tp_endereco — fixed; never client input. */
export const TP_ENDERECO = 1;

/** contato_pessoa.id_tipo_contato_pessoa, derived from the phone number. */
export const TIPO_CONTATO = {
  COMERCIAL: 1,
  CELULAR: 3,
} as const;

/** sep_tpo_logradouro.id_tpo_logradouro by canonical label — source for the fk_tpo_logradouro derivation. */
export const TIPO_LOGRADOURO_IDS = {
  Rua: 1,
  Avenida: 2,
  Praça: 3,
  Rodovia: 4,
  Alameda: 5,
  Beco: 6,
  Travessa: 7,
  Sítio: 8,
} as const;
