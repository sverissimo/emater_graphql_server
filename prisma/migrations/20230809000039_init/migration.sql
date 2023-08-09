--Manually create UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateTable
CREATE TABLE "at_acao" (
    "id_at_acao" BIGSERIAL NOT NULL,
    "descricao" VARCHAR(100) NOT NULL,
    "data_atualizacao" DATE NOT NULL,
    "ativo" BOOLEAN NOT NULL,
    "indice_propriedade" SMALLINT NOT NULL DEFAULT 0,
    "indice_periodo" SMALLINT NOT NULL DEFAULT 0,
    "dt_update_record" TIMESTAMP(6),
    "quant_max_clientes" SMALLINT,

    CONSTRAINT "pk_at_acao" PRIMARY KEY ("id_at_acao")
);

-- CreateTable
CREATE TABLE "at_arquivo" (
    "id_at_arquivo" BIGSERIAL NOT NULL,
    "nome_arquivo" VARCHAR(100) NOT NULL,
    "arquivo" TEXT NOT NULL,
    "id_at_atendimento" BIGINT NOT NULL,
    "ativo" BOOLEAN NOT NULL,
    "tipo_arquivo" VARCHAR(100) NOT NULL,
    "dt_update_record" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "id_sincronismo" VARCHAR(36) DEFAULT (uuid_generate_v4())::character varying(36),
    "id_sincronismo_atendimento" VARCHAR(36),
    "id_und_empresa" VARCHAR(5),

    CONSTRAINT "pk_at_arquivo" PRIMARY KEY ("id_at_arquivo")
);

-- CreateTable
CREATE TABLE "at_atendimento" (
    "id_at_atendimento" BIGSERIAL NOT NULL,
    "descricao" VARCHAR(60),
    "data_inicio_atendimento" DATE NOT NULL,
    "data_fim_atendimento" DATE,
    "data_validacao" DATE,
    "usuario_validacao" BIGINT,
    "data_atualizacao" DATE NOT NULL,
    "id_at_status" SMALLINT NOT NULL,
    "ativo" BOOLEAN NOT NULL,
    "id_at_acao" BIGINT NOT NULL,
    "id_und_empresa" CHAR(5) NOT NULL,
    "qtd_alunos" INTEGER,
    "data_criacao" DATE NOT NULL,
    "id_sincronismo" VARCHAR(36) DEFAULT (uuid_generate_v4())::character varying(36),
    "orientacao_tecnica" TEXT,
    "dt_update_record" TIMESTAMP(6),
    --"geo_ponto" geometry,
    "geo_ponto_texto" VARCHAR(255),
    "sincroniza" SMALLINT DEFAULT 0,
    "processamento" SMALLINT DEFAULT 0,
    "login_usuario" TEXT,
    "id_at_anterior" BIGINT,
    "fk_und_empresa" CHAR(5),
    "auto_atendimento" SMALLINT,
    "data_sei" DATE,

    CONSTRAINT "pk_at_atendimento" PRIMARY KEY ("id_at_atendimento")
);

-- CreateTable
CREATE TABLE "at_atendimento_indicador" (
    "id_at_atendimento_indicador" BIGSERIAL NOT NULL,
    "id_at_atendimento" BIGINT NOT NULL,
    "id_at_indicador" BIGINT NOT NULL,
    "id_und_empresa" VARCHAR(5),
    "id_sincronismo" VARCHAR(36) DEFAULT (uuid_generate_v4())::character varying(36),
    "id_sincronismo_atendimento" VARCHAR(36),
    "dt_update_record" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_at_atendimento_indicador" PRIMARY KEY ("id_at_atendimento_indicador")
);

-- CreateTable
CREATE TABLE "at_atendimento_usuario" (
    "id_at_atendimento" BIGINT NOT NULL,
    "id_usuario" BIGINT NOT NULL,
    "id_und_empresa" VARCHAR(5),
    "id_sincronismo" VARCHAR(36) DEFAULT (uuid_generate_v4())::character varying(36),
    "id_sincronismo_atendimento" VARCHAR(36),
    "dt_update_record" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_at_atendimento_usuario" PRIMARY KEY ("id_at_atendimento","id_usuario")
);

-- CreateTable
CREATE TABLE "at_cli_atend_prop" (
    "id_at_atendimento" BIGINT NOT NULL,
    "id_pessoa_demeter" BIGINT NOT NULL,
    "id_pl_propriedade" BIGINT,
    "id_at_cli_atend_prop" BIGSERIAL NOT NULL,
    "id_und_empresa" VARCHAR(5),
    "id_sincronismo_atendimento" VARCHAR(36),
    "id_sincronismo_ger_pessoa" VARCHAR(36),
    "id_sincronismo_pl_propriedade" VARCHAR(36),
    "id_sincronismo" VARCHAR(36) DEFAULT (uuid_generate_v4())::character varying(36),
    "dt_update_record" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "fk_cat_pessoa" INTEGER,

    CONSTRAINT "at_atendimento_cliente_propriedade_pkey" PRIMARY KEY ("id_at_cli_atend_prop")
);

-- CreateTable
CREATE TABLE "at_grupo_indicador" (
    "id_at_grupo_indicador" BIGSERIAL NOT NULL,
    "descricao" VARCHAR(100) NOT NULL,
    "data_atualizacao" DATE NOT NULL,
    "ativo" BOOLEAN NOT NULL,
    "validar" BOOLEAN NOT NULL DEFAULT false,
    "data_max_validacao" DATE,
    "dt_update_record" TIMESTAMP(6),
    "permitir_unica_meta_atendimento" BOOLEAN DEFAULT false,
    "sn_super_grupo" SMALLINT,
    "tp_chamada" SMALLINT,

    CONSTRAINT "pk_at_grupo_indicador" PRIMARY KEY ("id_at_grupo_indicador")
);

-- CreateTable
CREATE TABLE "at_indicador" (
    "id_at_indicador" BIGSERIAL NOT NULL,
    "id_at_grupo_indicador" BIGINT NOT NULL,
    "data_atualizacao" DATE NOT NULL,
    "ativo" BOOLEAN NOT NULL,
    "id_at_produto" BIGINT NOT NULL,
    "dt_update_record" TIMESTAMP(6),
    "anexo_obrigatorio" BOOLEAN DEFAULT false,
    "foto_obrigatoria" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pk_at_indicador" PRIMARY KEY ("id_at_indicador")
);

-- CreateTable
CREATE TABLE "at_prf_see" (
    "id" BIGSERIAL NOT NULL,
    "data_preenchimento" DATE NOT NULL,
    "data_atualizacao" DATE NOT NULL,
    "tipo_perfil" VARCHAR(8) NOT NULL,
    "id_cliente" BIGINT NOT NULL,
    "participa_organizacao" BOOLEAN,
    "id_dados_producao_in_natura" BIGINT,
    "nivel_tecnologico_cultivo" BIGINT,
    "sistema_producao" BIGINT,
    "condicao_posse" BIGINT,
    "dap_caf_vigente" BOOLEAN,
    "credito_rural" BOOLEAN,
    "fonte_captacao_agua" BIGINT,
    "forma_esgotamento_sanitario" BIGINT,
    "possui_cadastro_car" BOOLEAN,
    "aderiu_pra" BOOLEAN,
    "ciente_iniciativas_regularizacao_pra" BOOLEAN,
    "realiza_escalonamento_producao" BOOLEAN,
    "procedimento_pos_colheita" BIGINT,
    "id_dados_producao_agro_industria" BIGINT,
    "tipo_gestao_unidade" VARCHAR(8),
    "pessoas_processamento_alimentos" INTEGER,
    "tipo_estabelecimento" VARCHAR(16),
    "tipo_pessoa_juridica" VARCHAR(16),
    "agroindustria_precisa_adaptacao_reforma" BOOLEAN,
    "possui_registro_orgao_fiscalizacao_sanitaria" BOOLEAN,
    "orgao_fiscalizacao_sanitaria" VARCHAR(64),
    "id_tecnico" BIGINT,
    "atividades_usam_recursos_hidricos" BIGINT,
    "atividades_com_regularizacao_ambiental" BIGINT,
    "possui_agroindustria_propria" BOOLEAN,
    "grau_interesse_pnae" VARCHAR(64),

    CONSTRAINT "pk_at_prf_see" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "at_prf_see_dados_producao" (
    "id" BIGSERIAL NOT NULL,
    "controla_custos_producao" BOOLEAN,
    "local_comercializacao" BIGINT,
    "valor_total_obtido_pnae" BIGINT,
    "forma_entrega_produtos" BIGINT,
    "dificuldade_fornecimento" BIGINT,
    "informacoes_adicionais" VARCHAR(2048),
    "tipo_regularizacao_uso_recursos_hidricos" VARCHAR(32),
    "tipo_regularizacao_ambiental" VARCHAR(64),
    "valor_total_obtido_outros" BIGINT,

    CONSTRAINT "pk_at_prf_see_dados_producao" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "at_prf_see_grupos_produtos" (
    "id" BIGSERIAL NOT NULL,
    "id_dados_producao" BIGINT NOT NULL,
    "id_grupo_produtos" BIGINT NOT NULL,
    "producao_aproximada_ultimo_ano_pnae" BIGINT,
    "area_utilizada" DOUBLE PRECISION,
    "producao_aproximada_ultimo_ano_total" BIGINT,

    CONSTRAINT "pk_at_prf_see_grupos_produtos" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "at_prf_see_produto" (
    "id" BIGSERIAL NOT NULL,
    "id_perfil_grupo" BIGINT NOT NULL,
    "id_produto" BIGINT NOT NULL,
    "area_utilizada" DOUBLE PRECISION,
    "producao_aproximada_ultimo_ano_pnae" BIGINT,
    "producao_aproximada_ultimo_ano_total" BIGINT,

    CONSTRAINT "pk_at_prf_see_produto" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "at_prf_see_propriedade" (
    "id" BIGSERIAL NOT NULL,
    "id_perfil_see" BIGINT NOT NULL,
    "id_propriedade" BIGINT NOT NULL,
    "atividade" VARCHAR(64),
    "producao_dedicada_pnae" BOOLEAN,

    CONSTRAINT "pk_at_prf_see_propriedade" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "at_produto" (
    "id_at_produto" BIGSERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "dt_update_record" TIMESTAMP(6),

    CONSTRAINT "pk_at_produto" PRIMARY KEY ("id_at_produto")
);

-- CreateTable
CREATE TABLE "ger_cargo" (
    "id_cargo" CHAR(4) NOT NULL,
    "nm_cargo" VARCHAR(100) NOT NULL,
    "dt_update_record" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ger_cargo_pkey" PRIMARY KEY ("id_cargo")
);

-- CreateTable
CREATE TABLE "ger_pessoa" (
    "id_pessoa_demeter" BIGSERIAL NOT NULL,
    "nm_pessoa" VARCHAR(255),
    "tp_sexo" VARCHAR(255),
    "nr_cpf_cnpj" VARCHAR(255),
    "dt_nascimento" TIMESTAMPTZ(6),
    "id_und_empresa" VARCHAR(255),
    "ds_email" VARCHAR(255),
    "dt_update_record" TIMESTAMPTZ(6) NOT NULL DEFAULT '2023-03-29 17:22:54.641-03'::timestamp with time zone,
    "senha" VARCHAR(255),
    "telefone" VARCHAR(255),
    "status_account" VARCHAR(255),
    "ds_apelido" VARCHAR(80),
    "sn_ativo" SMALLINT NOT NULL DEFAULT 1,
    "dap" VARCHAR(40),
    "dt_desativacao" TIMESTAMP(6),
    "nr_identidade" VARCHAR(15),
    "nr_ins_produtor_rural" VARCHAR(40),
    "nm_mae" VARCHAR(100),
    "nm_nacionalidade" VARCHAR(100),
    "ds_orgao_expedidor" VARCHAR(10),
    "nm_pai" VARCHAR(100),
    "sn_principal_provedor" SMALLINT,
    "nm_profissao" VARCHAR(100),
    "sn_pronaf" SMALLINT,
    "tp_desativacao" SMALLINT,
    "tp_pessoa" CHAR(1),
    "fk_est_civil" INTEGER,
    "fk_uf_emissor" INTEGER,
    "id_pessoa" CHAR(36),
    "id_sincronismo" VARCHAR(36),
    "caf" VARCHAR(24),

    CONSTRAINT "ger_pessoa_pkey" PRIMARY KEY ("id_pessoa_demeter")
);

-- CreateTable
CREATE TABLE "pl_propriedade" (
    "id_pl_propriedade" BIGSERIAL NOT NULL,
    "nome_propriedade" VARCHAR(100) NOT NULL,
    "logradouro" VARCHAR(80),
    "bairro" VARCHAR(80),
    "complemento" VARCHAR(80),
    "cep" VARCHAR(8),
    "numero" VARCHAR(15),
    "area_total" DECIMAL(13,4),
    --"geo_ponto" geometry,
    "geo_ponto_texto" VARCHAR(255),
    "area_condominio" BOOLEAN DEFAULT false,
    "origem_ocupacao" VARCHAR(100),
    "atividade_principal" VARCHAR(100),
    "numero_registro_imovel" VARCHAR(50),
    "nirf" VARCHAR(100),
    "car" VARCHAR(100),
    "ccir" VARCHAR(100),
    "numero_instalacao_cemig" VARCHAR(15),
    "distancia_sede" DECIMAL(15,2),
    "tempo_ocupacao_imovel" DOUBLE PRECISION,
    "id_emater" VARCHAR(36),
    "id_distrito" INTEGER,
    "id_municipio" INTEGER,
    "id_und_empresa" CHAR(5),
    "id_sincronismo" VARCHAR(36) DEFAULT (uuid_generate_v4())::character varying(36),
    "id_tipo_logradouro" INTEGER,
    "dt_update_record" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN,
    "ds_roteiro_acesso" VARCHAR(500),
    "sn_ctd" INTEGER,

    CONSTRAINT "pk_pl_propiedade" PRIMARY KEY ("id_pl_propriedade")
);

-- CreateTable
CREATE TABLE "pl_propriedade_ger_pessoa" (
    "id_pl_propriedade" BIGINT NOT NULL,
    "id_pessoa_demeter" BIGINT NOT NULL,
    "id_und_empresa" CHAR(5),
    "id_pl_tipo_posse" SMALLINT,
    "id_sincronismo_cliente" VARCHAR(36),
    "id_sincronismo_propriedade" VARCHAR(36),
    "dt_update_record" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "dt_inicio_contrato" TIMESTAMP(6),
    "dt_termino_contrato" TIMESTAMP(6),

    CONSTRAINT "pk_propriedade_ger_pessoa" PRIMARY KEY ("id_pl_propriedade","id_pessoa_demeter")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" BIGSERIAL NOT NULL,
    "login_usuario" VARCHAR(255) NOT NULL,
    "nome_usuario" VARCHAR(255),
    "email_usuario" VARCHAR(255),
    "celular_usuario" VARCHAR(255),
    "token_demeter" VARCHAR(255) NOT NULL,
    "data_cadastro" DATE NOT NULL,
    "data_expiracao_token_demeter" DATE NOT NULL,
    "ativo" BOOLEAN NOT NULL,
    "cpf_usuario" VARCHAR(14),
    "matricula_usuario" CHAR(5),
    "digito_matricula" CHAR(1),
    "situacao_emater" CHAR(1),
    "id_und_empresa" CHAR(5),
    "id_cargo" CHAR(4),
    "orgao_classe" VARCHAR(30),
    "sexo_usuario" CHAR(1),
    "dt_update_record" DATE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_usuario" PRIMARY KEY ("id_usuario")
);

-- CreateIndex
CREATE UNIQUE INDEX "ix_at_atendimento_indicador" ON "at_atendimento_indicador"("id_at_atendimento", "id_at_indicador");

-- CreateIndex
CREATE UNIQUE INDEX "ger_pessoa_nr_cpf_cnpj_key" ON "ger_pessoa"("nr_cpf_cnpj");

-- CreateIndex
CREATE INDEX "ix_ger_pessoa_dt_update_record" ON "ger_pessoa"("dt_update_record");

-- CreateIndex
CREATE INDEX "ix_ger_pessoa_nm_pessoa" ON "ger_pessoa"("nm_pessoa");

-- CreateIndex
CREATE INDEX "pl_propriedade_nome_propriedade_logradouro_idx" ON "pl_propriedade"("nome_propriedade", "logradouro");

-- CreateIndex
CREATE UNIQUE INDEX "uq_usuario_login" ON "usuario"("login_usuario");

-- AddForeignKey
ALTER TABLE "at_arquivo" ADD CONSTRAINT "fk_at_arquivo_atendimento" FOREIGN KEY ("id_at_atendimento") REFERENCES "at_atendimento"("id_at_atendimento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_atendimento" ADD CONSTRAINT "fk2wy9cxuwsh3cyhmip358l0l6c" FOREIGN KEY ("usuario_validacao") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_atendimento" ADD CONSTRAINT "fk8q4s39wy7we2slstaxkbxd737" FOREIGN KEY ("id_at_acao") REFERENCES "at_acao"("id_at_acao") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_atendimento_indicador" ADD CONSTRAINT "fk1xax2r08665xreflnwtecl0t4" FOREIGN KEY ("id_at_indicador") REFERENCES "at_indicador"("id_at_indicador") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_atendimento_indicador" ADD CONSTRAINT "fk_at_atendimento_indicador" FOREIGN KEY ("id_at_atendimento") REFERENCES "at_atendimento"("id_at_atendimento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_atendimento_usuario" ADD CONSTRAINT "fk_at_atendimento_usuario" FOREIGN KEY ("id_at_atendimento") REFERENCES "at_atendimento"("id_at_atendimento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_atendimento_usuario" ADD CONSTRAINT "fk_usuario_atendimento" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_cli_atend_prop" ADD CONSTRAINT "fk29teh4plu2duhojqqnnf3j8cu" FOREIGN KEY ("id_pessoa_demeter") REFERENCES "ger_pessoa"("id_pessoa_demeter") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_cli_atend_prop" ADD CONSTRAINT "fk2hbjbvci9gd4tw04o1t2xrcku" FOREIGN KEY ("id_pl_propriedade") REFERENCES "pl_propriedade"("id_pl_propriedade") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_cli_atend_prop" ADD CONSTRAINT "fk_at_atendimento_cliente" FOREIGN KEY ("id_at_atendimento") REFERENCES "at_atendimento"("id_at_atendimento") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_grupo_indicador" ADD CONSTRAINT "fkpbyyndup2h4mhwv3q5x6ovj55" FOREIGN KEY ("id_at_grupo_indicador") REFERENCES "at_grupo_indicador"("id_at_grupo_indicador") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_indicador" ADD CONSTRAINT "fk3qnbwkkgwfu9fdtgl1gtry1bp" FOREIGN KEY ("id_at_grupo_indicador") REFERENCES "at_grupo_indicador"("id_at_grupo_indicador") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_indicador" ADD CONSTRAINT "fk_at_produto" FOREIGN KEY ("id_at_produto") REFERENCES "at_produto"("id_at_produto") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_prf_see" ADD CONSTRAINT "at_prf_see_fk" FOREIGN KEY ("id_tecnico") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_prf_see" ADD CONSTRAINT "fk_cliente" FOREIGN KEY ("id_cliente") REFERENCES "ger_pessoa"("id_pessoa_demeter") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_prf_see" ADD CONSTRAINT "fk_dados_agroindustria" FOREIGN KEY ("id_dados_producao_agro_industria") REFERENCES "at_prf_see_dados_producao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_prf_see" ADD CONSTRAINT "fk_dados_in_natura" FOREIGN KEY ("id_dados_producao_in_natura") REFERENCES "at_prf_see_dados_producao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_prf_see_grupos_produtos" ADD CONSTRAINT "fk_dados" FOREIGN KEY ("id_dados_producao") REFERENCES "at_prf_see_dados_producao"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_prf_see_produto" ADD CONSTRAINT "fk_perfil_see" FOREIGN KEY ("id_perfil_grupo") REFERENCES "at_prf_see_grupos_produtos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_prf_see_propriedade" ADD CONSTRAINT "fk_prf_see" FOREIGN KEY ("id_perfil_see") REFERENCES "at_prf_see"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "at_prf_see_propriedade" ADD CONSTRAINT "fk_propriedade" FOREIGN KEY ("id_propriedade") REFERENCES "pl_propriedade"("id_pl_propriedade") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pl_propriedade_ger_pessoa" ADD CONSTRAINT "fk_ger_pessoa_propriedade" FOREIGN KEY ("id_pessoa_demeter") REFERENCES "ger_pessoa"("id_pessoa_demeter") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pl_propriedade_ger_pessoa" ADD CONSTRAINT "fk_propriedade_ger_pessoa" FOREIGN KEY ("id_pl_propriedade") REFERENCES "pl_propriedade"("id_pl_propriedade") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "fk5j2oxae47ac7gxtfitkc7jwlg" FOREIGN KEY ("id_cargo") REFERENCES "ger_cargo"("id_cargo") ON DELETE NO ACTION ON UPDATE NO ACTION;
