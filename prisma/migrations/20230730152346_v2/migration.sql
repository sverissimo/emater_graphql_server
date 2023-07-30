-- AlterTable
ALTER TABLE "at_prf_see" ALTER COLUMN "data_preenchimento" DROP NOT NULL,
ALTER COLUMN "data_preenchimento" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "data_atualizacao" DROP NOT NULL;
