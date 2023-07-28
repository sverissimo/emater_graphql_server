/*
  Warnings:

  - The primary key for the `at_prf_dados_producao` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `at_prf_see` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `at_prf_see` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `nivel_tecnologico_cultivo` column on the `at_prf_see` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `sistema_producao` column on the `at_prf_see` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `condicao_posse` column on the `at_prf_see` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `fonte_captacao_agua` column on the `at_prf_see` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `forma_esgotamento_sanitario` column on the `at_prf_see` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `atividades_usam_recursos_hidricos` column on the `at_prf_see` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `atividades_com_regularizacao_ambiental` column on the `at_prf_see` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `id_dados_producao_in_natura` column on the `at_prf_see` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `procedimento_pos_colheita` column on the `at_prf_see` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `id_dados_producao_agro_industria` column on the `at_prf_see` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `at_prf_see_propriedade` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `id` on the `at_prf_dados_producao` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `local_comercializacao` on the `at_prf_dados_producao` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `valor_total_obtido_pnae` on the `at_prf_dados_producao` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `valor_total_obtido_outros` on the `at_prf_dados_producao` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `forma_entrega_produtos` on the `at_prf_dados_producao` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `dificuldade_fornecimento` on the `at_prf_dados_producao` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id_tecnico` on the `at_prf_see` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `at_prf_see_propriedade` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id_perfil_see` on the `at_prf_see_propriedade` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "at_prf_see" DROP CONSTRAINT "at_prf_see_id_dados_producao_agro_industria_fkey";

-- DropForeignKey
ALTER TABLE "at_prf_see_propriedade" DROP CONSTRAINT "at_prf_see_propriedade_id_perfil_see_fkey";

-- AlterTable
ALTER TABLE "at_prf_dados_producao" DROP CONSTRAINT "at_prf_dados_producao_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" INTEGER NOT NULL,
DROP COLUMN "local_comercializacao",
ADD COLUMN     "local_comercializacao" INTEGER NOT NULL,
DROP COLUMN "valor_total_obtido_pnae",
ADD COLUMN     "valor_total_obtido_pnae" INTEGER NOT NULL,
DROP COLUMN "valor_total_obtido_outros",
ADD COLUMN     "valor_total_obtido_outros" INTEGER NOT NULL,
DROP COLUMN "forma_entrega_produtos",
ADD COLUMN     "forma_entrega_produtos" INTEGER NOT NULL,
DROP COLUMN "dificuldade_fornecimento",
ADD COLUMN     "dificuldade_fornecimento" INTEGER NOT NULL,
ADD CONSTRAINT "at_prf_dados_producao_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "at_prf_see" DROP CONSTRAINT "at_prf_see_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "id_tecnico",
ADD COLUMN     "id_tecnico" INTEGER NOT NULL,
DROP COLUMN "nivel_tecnologico_cultivo",
ADD COLUMN     "nivel_tecnologico_cultivo" INTEGER,
DROP COLUMN "sistema_producao",
ADD COLUMN     "sistema_producao" INTEGER,
DROP COLUMN "condicao_posse",
ADD COLUMN     "condicao_posse" INTEGER,
DROP COLUMN "fonte_captacao_agua",
ADD COLUMN     "fonte_captacao_agua" INTEGER,
DROP COLUMN "forma_esgotamento_sanitario",
ADD COLUMN     "forma_esgotamento_sanitario" INTEGER,
DROP COLUMN "atividades_usam_recursos_hidricos",
ADD COLUMN     "atividades_usam_recursos_hidricos" INTEGER,
DROP COLUMN "atividades_com_regularizacao_ambiental",
ADD COLUMN     "atividades_com_regularizacao_ambiental" INTEGER,
DROP COLUMN "id_dados_producao_in_natura",
ADD COLUMN     "id_dados_producao_in_natura" INTEGER,
DROP COLUMN "procedimento_pos_colheita",
ADD COLUMN     "procedimento_pos_colheita" INTEGER,
DROP COLUMN "id_dados_producao_agro_industria",
ADD COLUMN     "id_dados_producao_agro_industria" INTEGER,
ADD CONSTRAINT "at_prf_see_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "at_prf_see_propriedade" DROP CONSTRAINT "at_prf_see_propriedade_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" INTEGER NOT NULL,
DROP COLUMN "id_perfil_see",
ADD COLUMN     "id_perfil_see" INTEGER NOT NULL,
ADD CONSTRAINT "at_prf_see_propriedade_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "pl_propriedade" ALTER COLUMN "area_total" SET DATA TYPE TEXT,
ALTER COLUMN "distancia_sede" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "at_prf_see_id_dados_producao_agro_industria_key" ON "at_prf_see"("id_dados_producao_agro_industria");

-- CreateIndex
CREATE UNIQUE INDEX "at_prf_see_propriedade_id_perfil_see_key" ON "at_prf_see_propriedade"("id_perfil_see");

-- AddForeignKey
ALTER TABLE "at_prf_see" ADD CONSTRAINT "at_prf_see_id_dados_producao_agro_industria_fkey" FOREIGN KEY ("id_dados_producao_agro_industria") REFERENCES "at_prf_dados_producao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "at_prf_see_propriedade" ADD CONSTRAINT "at_prf_see_propriedade_id_perfil_see_fkey" FOREIGN KEY ("id_perfil_see") REFERENCES "at_prf_see"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
