-- CreateTable
CREATE TABLE "Proprietario" (
    "id_pessoa" TEXT NOT NULL,
    "id_pessoa_demeter" TEXT,
    "nm_pessoa" TEXT NOT NULL,
    "ds_apelido" TEXT,
    "sn_pronaf" INTEGER,
    "sn_ativo" INTEGER,
    "tp_sexo" TEXT,
    "nr_cpf_cnpj" TEXT,
    "dt_nascimento" TEXT,
    "nr_identidade" TEXT,
    "ds_orgao_expedidor" TEXT,
    "fk_uf_emissor" INTEGER,
    "tp_desativacao" TEXT,
    "dt_desativacao" TEXT,
    "nm_nacionalidade" TEXT,
    "fk_est_civil" INTEGER,
    "nm_mae" TEXT,
    "nm_pai" TEXT,
    "nm_profissao" TEXT,
    "nr_ins_produtor_rural" TEXT,
    "dap" TEXT,
    "tp_pessoa" TEXT,
    "id_und_empresa" TEXT,
    "sn_principal_provedor" INTEGER,
    "ds_email" TEXT,
    "dt_update_record" TEXT,
    "id_sincronismo" TEXT,
    "sn_ctd" BOOLEAN,
    "caf" TEXT,

    CONSTRAINT "Proprietario_pkey" PRIMARY KEY ("id_pessoa")
);

-- CreateTable
CREATE TABLE "Propriedade" (
    "id_pl_propriedade" TEXT NOT NULL,
    "nome_propriedade" TEXT NOT NULL,
    "logradouro" TEXT,
    "bairro" TEXT,
    "complemento" TEXT,
    "cep" TEXT,
    "numero" TEXT,
    "area_total" TEXT NOT NULL,
    "geo_ponto" TEXT,
    "geo_ponto_texto" TEXT,
    "area_condominio" BOOLEAN,
    "origem_ocupacao" TEXT,
    "atividade_principal" TEXT,
    "numero_registro_imovel" TEXT,
    "nirf" TEXT,
    "car" TEXT,
    "ccir" TEXT,
    "numero_instalacao_cemig" TEXT,
    "distancia_sede" TEXT,
    "tempo_ocupacao_imovel" INTEGER,
    "id_emater" TEXT,
    "id_distrito" TEXT,
    "id_municipio" INTEGER,
    "id_und_empresa" TEXT,
    "id_sincronismo" TEXT,
    "id_tipo_logradouro" INTEGER,
    "dt_update_record" TIMESTAMP(3) NOT NULL,
    "ativo" BOOLEAN NOT NULL,
    "ds_roteiro_acesso" TEXT,
    "sn_ctd" BOOLEAN,

    CONSTRAINT "Propriedade_pkey" PRIMARY KEY ("id_pl_propriedade")
);
