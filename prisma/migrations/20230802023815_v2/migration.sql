-- CreateEnum
CREATE TYPE "PictureDescription" AS ENUM ('FOTO_RELATORIO', 'ASSINATURA_PRODUTOR');

-- CreateTable
CREATE TABLE "Relatorio" (
    "id" SERIAL NOT NULL,
    "nr_relatorio" INTEGER NOT NULL,
    "assunto" TEXT NOT NULL,
    "orientacao" TEXT NOT NULL,
    "produtor_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Relatorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PictureFile" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "mimeType" TEXT NOT NULL,
    "description" "PictureDescription" NOT NULL,
    "relatorio_id" INTEGER NOT NULL,
    "upload_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PictureFile_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Relatorio" ADD CONSTRAINT "Relatorio_produtor_id_fkey" FOREIGN KEY ("produtor_id") REFERENCES "ger_pessoa"("id_pessoa_demeter") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PictureFile" ADD CONSTRAINT "PictureFile_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "Relatorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
