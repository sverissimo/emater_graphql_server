// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import proprietarios from "../data/ger_pessoa.json" assert { type: "json" };
import propriedades from "../data/public_pl_propriedade_subset.json" assert { type: "json" };

const prisma = new PrismaClient();

async function main() {
  await prisma.proprietario.createMany({
    data: proprietarios,
  });

  await prisma.propriedade.createMany({
    data: propriedades.map((item) => ({
      ...item,
      dt_update_record: new Date(item.dt_update_record),
      area_condominio: Boolean(item.area_condominio),
      ativo: Boolean(item.ativo),
      sn_ctd: Boolean(item.sn_ctd),
    })),
  });

  /* // Insert visitas
  await prisma.visita.createMany({
    data: data.visitas,
  });

  // Insert pictureFiles
  await prisma.pictureFile.createMany({
    data: data.pictureFiles,
  }); */

  /*   // Insert tecnicos
  await prisma.tecnico.createMany({
    data: data.tecnicos,
  });
} */
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/*   const sanitizeData = (data: any[]) => {
    const proprietarios = data.map((proprietario) => {
      const sanitizedProprietario = { ...proprietario };
      for (const key in sanitizedProprietario) {
        if (sanitizedProprietario[key] === null) {
          delete sanitizedProprietario[key];
        }
      }
      return sanitizedProprietario;
    });
    return proprietarios;
  };
   */
