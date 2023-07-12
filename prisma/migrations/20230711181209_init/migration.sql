-- CreateTable
CREATE TABLE "at_prf_see_propriedade" (
    "id" TEXT NOT NULL,
    "id_perfil_see" TEXT NOT NULL,
    "id_propriedade" BIGINT NOT NULL,
    "atividade" TEXT NOT NULL,
    "producao_dedicada_pnae" BOOLEAN,

    CONSTRAINT "at_prf_see_propriedade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "at_prf_see_propriedade_id_perfil_see_key" ON "at_prf_see_propriedade"("id_perfil_see");

-- CreateIndex
CREATE UNIQUE INDEX "at_prf_see_propriedade_id_propriedade_key" ON "at_prf_see_propriedade"("id_propriedade");

-- AddForeignKey
ALTER TABLE "at_prf_see_propriedade" ADD CONSTRAINT "at_prf_see_propriedade_id_perfil_see_fkey" FOREIGN KEY ("id_perfil_see") REFERENCES "at_prf_see"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "at_prf_see_propriedade" ADD CONSTRAINT "at_prf_see_propriedade_id_propriedade_fkey" FOREIGN KEY ("id_propriedade") REFERENCES "pl_propriedade"("id_pl_propriedade") ON DELETE RESTRICT ON UPDATE CASCADE;
