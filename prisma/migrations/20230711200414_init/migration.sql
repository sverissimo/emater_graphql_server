/*
  Warnings:

  - A unique constraint covering the columns `[propriedade_id]` on the table `ProdutorPropriedades` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ProdutorPropriedades_propriedade_id_key" ON "ProdutorPropriedades"("propriedade_id");
