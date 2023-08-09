-- AlterTable
ALTER TABLE "at_atendimento" ADD COLUMN     "geo_ponto" TEXT;

-- AlterTable
ALTER TABLE "ger_pessoa" ALTER COLUMN "dt_update_record" SET DEFAULT '2023-03-29 17:22:54.641-03'::timestamp with time zone;

-- AlterTable
ALTER TABLE "pl_propriedade" ADD COLUMN     "geo_ponto" TEXT;
