/*
  Warnings:

  - Changed the type of `id_cliente` on the `at_prf_see` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "at_prf_see" DROP COLUMN "id_cliente",
ADD COLUMN     "id_cliente" BIGINT NOT NULL;

-- AddForeignKey
ALTER TABLE "at_prf_see" ADD CONSTRAINT "at_prf_see_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "ger_pessoa"("id_pessoa_demeter") ON DELETE RESTRICT ON UPDATE CASCADE;
