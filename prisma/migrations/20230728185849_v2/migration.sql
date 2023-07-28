/*
  Warnings:

  - The `area_total` column on the `pl_propriedade` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `distancia_sede` column on the `pl_propriedade` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "pl_propriedade" DROP COLUMN "area_total",
ADD COLUMN     "area_total" DOUBLE PRECISION,
DROP COLUMN "distancia_sede",
ADD COLUMN     "distancia_sede" DOUBLE PRECISION;
