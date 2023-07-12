-- CreateTable
CREATE TABLE "ger_pessoa" (
    "id_pessoa" VARCHAR(36) NOT NULL,
    "id_pessoa_demeter" BIGSERIAL NOT NULL,
    "nm_pessoa" VARCHAR(100),
    "ds_apelido" VARCHAR(80),
    "sn_pronaf" SMALLINT,
    "sn_ativo" SMALLINT NOT NULL DEFAULT 1,
    "tp_sexo" CHAR(1),
    "nr_cpf_cnpj" VARCHAR(14),
    "dt_nascimento" DATE,
    "nr_identidade" VARCHAR(15),
    "ds_orgao_expedidor" VARCHAR(10),
    "fk_uf_emissor" INTEGER,
    "tp_desativacao" SMALLINT,
    "dt_desativacao" TIMESTAMP(0),
    "nm_nacionalidade" VARCHAR(100),
    "fk_est_civil" INTEGER,
    "nm_mae" VARCHAR(100),
    "nm_pai" VARCHAR(100),
    "nm_profissao" VARCHAR(100),
    "nr_ins_produtor_rural" VARCHAR(40),
    "dap" VARCHAR(40),
    "tp_pessoa" CHAR(1),
    "id_und_empresa" CHAR(5),
    "sn_principal_provedor" SMALLINT,
    "ds_email" VARCHAR(80),
    "dt_update_record" TIMESTAMP(0) NOT NULL,
    "id_sincronismo" VARCHAR(36),
    "sn_ctd" INTEGER,
    "caf" VARCHAR(24),

    CONSTRAINT "ger_pessoa_pkey" PRIMARY KEY ("id_pessoa")
);

-- CreateTable
CREATE TABLE "pl_propriedade" (
    "id_pl_propriedade" BIGSERIAL NOT NULL,
    "nome_propriedade" TEXT NOT NULL,
    "logradouro" VARCHAR(80),
    "bairro" VARCHAR(80),
    "complemento" VARCHAR(80),
    "cep" VARCHAR(8),
    "numero" VARCHAR(15),
    "area_total" DOUBLE PRECISION,
    "geo_ponto" TEXT,
    "geo_ponto_texto" VARCHAR(255),
    "area_condominio" BOOLEAN DEFAULT false,
    "origem_ocupacao" VARCHAR(100),
    "atividade_principal" VARCHAR(100),
    "numero_registro_imovel" VARCHAR(50),
    "nirf" VARCHAR(100),
    "car" VARCHAR(100),
    "ccir" VARCHAR(100),
    "numero_instalacao_cemig" VARCHAR(15),
    "distancia_sede" DOUBLE PRECISION,
    "tempo_ocupacao_imovel" DOUBLE PRECISION,
    "id_emater" VARCHAR(36),
    "id_distrito" INTEGER,
    "id_municipio" INTEGER,
    "id_und_empresa" CHAR(5),
    "id_sincronismo" VARCHAR(36),
    "id_tipo_logradouro" INTEGER,
    "dt_update_record" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN,
    "ds_roteiro_acesso" VARCHAR(500),
    "sn_ctd" INTEGER,

    CONSTRAINT "pl_propriedade_pkey" PRIMARY KEY ("id_pl_propriedade")
);

-- CreateTable
CREATE TABLE "ProdutorPropriedades" (
    "id" BIGSERIAL NOT NULL,
    "produtor_id" BIGINT NOT NULL,
    "propriedade_id" BIGINT NOT NULL,

    CONSTRAINT "ProdutorPropriedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "at_prf_see" (
    "id" TEXT NOT NULL,
    "tipo_perfil" TEXT NOT NULL,
    "id_tecnico" TEXT NOT NULL,
    "id_cliente" TEXT NOT NULL,
    "data_preenchimento" TIMESTAMP(3) NOT NULL,
    "data_atualizacao" TIMESTAMP(3) NOT NULL,
    "participa_organizacao" BOOLEAN NOT NULL,
    "grau_interesse_pnae" TEXT NOT NULL,
    "nivel_tecnologico_cultivo" TEXT,
    "sistema_producao" TEXT,
    "condicao_posse" TEXT,
    "dap_caf_vigente" BOOLEAN,
    "credito_rural" BOOLEAN,
    "fonte_captacao_agua" TEXT,
    "forma_esgotamento_sanitario" TEXT,
    "atividades_usam_recursos_hidricos" TEXT,
    "atividades_com_regularizacao_ambiental" TEXT,
    "possui_cadastro_car" BOOLEAN,
    "aderiu_pra" BOOLEAN,
    "id_dados_producao_in_natura" TEXT,
    "ciente_iniciativas_regularizacao_pra" BOOLEAN,
    "realiza_escalonamento_producao" BOOLEAN,
    "procedimento_pos_colheita" TEXT,
    "id_dados_producao_agro_industria" TEXT,
    "tipo_gestao_unidade" TEXT,
    "pessoas_processamento_alimentos" INTEGER,
    "tipo_estabelecimento" TEXT,
    "tipo_pessoa_juridica" TEXT,
    "agroindustria_precisa_adaptacao_reforma" BOOLEAN,
    "possui_registro_orgao_fiscalizacao_sanitaria" BOOLEAN,
    "orgao_fiscalizacao_sanitaria" TEXT,
    "possui_agroindustria_propria" BOOLEAN,

    CONSTRAINT "at_prf_see_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "at_prf_dados_producao" (
    "id" TEXT NOT NULL,
    "tipo_regularizacao_uso_recursos_hidricos" TEXT NOT NULL,
    "tipo_regularizacao_ambiental" TEXT NOT NULL,
    "controla_custos_producao" BOOLEAN NOT NULL,
    "local_comercializacao" TEXT NOT NULL,
    "valor_total_obtido_pnae" TEXT NOT NULL,
    "valor_total_obtido_outros" TEXT NOT NULL,
    "forma_entrega_produtos" TEXT NOT NULL,
    "dificuldade_fornecimento" TEXT NOT NULL,
    "informacoes_adicionais" TEXT,

    CONSTRAINT "at_prf_dados_producao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ger_pessoa_id_pessoa_demeter_key" ON "ger_pessoa"("id_pessoa_demeter");

-- CreateIndex
CREATE UNIQUE INDEX "at_prf_see_id_dados_producao_agro_industria_key" ON "at_prf_see"("id_dados_producao_agro_industria");

-- AddForeignKey
ALTER TABLE "ProdutorPropriedades" ADD CONSTRAINT "ProdutorPropriedades_produtor_id_fkey" FOREIGN KEY ("produtor_id") REFERENCES "ger_pessoa"("id_pessoa_demeter") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutorPropriedades" ADD CONSTRAINT "ProdutorPropriedades_propriedade_id_fkey" FOREIGN KEY ("propriedade_id") REFERENCES "pl_propriedade"("id_pl_propriedade") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "at_prf_see" ADD CONSTRAINT "at_prf_see_id_dados_producao_agro_industria_fkey" FOREIGN KEY ("id_dados_producao_agro_industria") REFERENCES "at_prf_dados_producao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
