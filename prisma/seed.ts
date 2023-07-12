import { PrismaClient } from "@prisma/client";
import proprietarios from "../data/ger_pessoa.json" assert { type: "json" };
import propriedades from "../data/public_pl_propriedade_subset.json" assert { type: "json" };
import produtorPropriedades from "../data/linkedTableInput.json" assert { type: "json" };
import perfis from "../data/public_at_prf_see_export_2023-07-07_002028.json" assert { type: "json" };
import dadosProducao from "../data/public_at_prf_see_dados_producao_export_2023-07-07_002104.json" assert { type: "json" };
import propriedadeVisitaLink from "../data/public_at_prf_see_propriedade_export_2023-07-07_002120.json" assert { type: "json" };

const prisma = new PrismaClient();

async function main() {
  await prisma.propriedade.createMany({
    data: propriedades.map((item) => ({
      ...item,
      id_pl_propriedade: Number(item.id_pl_propriedade),
      area_total: Number(item.area_total),
      dt_update_record: new Date(item.dt_update_record),
      area_condominio: Boolean(item.area_condominio),
      ativo: Boolean(item.ativo),
      distancia_sede: Number(item.distancia_sede),
    })),
  });

  await prisma.atividade.createMany({
    data: propriedadeVisitaLink.map((p) => {
      const result = {
        ...p,
        id_propriedade: parseInt(p.id_propriedade),
      };
      return result;
    }),
  });

  await prisma.dadosProducao.createMany({
    data: dadosProducao,
  });
  await prisma.perfil.createMany({
    data: perfis.map((p) => ({
      ...p,
      data_preenchimento: new Date(p.data_preenchimento),
      data_atualizacao: new Date(p.data_atualizacao)
        .toISOString()
        .slice(0, "yyyy-mm-dd".length),
    })),
  });

  await prisma.produtor.createMany({
    data: proprietarios.map((item) => ({
      ...item,
      id_pessoa_demeter: BigInt(item.id_pessoa_demeter), // convert to BigInt
      dt_nascimento: new Date(item.dt_nascimento),
      dt_update_record: new Date(item.dt_update_record),
    })),
  });

  await prisma.produtorPropriedades.createMany({ data: produtorPropriedades });

  /*
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
