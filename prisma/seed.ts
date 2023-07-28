import { PrismaClient } from "@prisma/client";
import produtores from "../data/ger_pessoa.json" assert { type: "json" };
import propriedades from "../data/public_pl_propriedade_subset.json" assert { type: "json" };
import produtorPropriedades from "../data/linkedTableInput.json" assert { type: "json" };
import perfis from "../data/perfis.json" assert { type: "json" };
import dadosProducao from "../data/dadosProducao.json" assert { type: "json" };
import propriedadeVisitaLink from "../data/public_at_prf_see_propriedade_export_2023-07-07_002120.json" assert { type: "json" };

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.propriedade.createMany({
      data: propriedades.map((item) => ({
        ...item,
        id_pl_propriedade: BigInt(item.id_pl_propriedade),
        dt_update_record: new Date(item.dt_update_record),
        area_condominio: Boolean(item.area_condominio),
        ativo: Boolean(item.ativo),
        area_total: Number(item.area_total),
        distancia_sede: Number(item.distancia_sede),
      })),
    });
  } catch (error) {
    console.log("🚀 ~ file: seed.ts:27 ~ main ~ error:", error);
    //throw new Error(error);
  }

  await prisma.produtor.createMany({
    data: produtores.map((item) => ({
      ...item,
      id_pessoa_demeter: BigInt(item.id_pessoa_demeter), // convert to BigInt
      dt_nascimento: new Date(item.dt_nascimento),
      dt_update_record: new Date(item.dt_update_record),
    })),
  });

  await prisma.perfil.createMany({
    data: perfis.map((p) => ({
      ...p,
      data_preenchimento: new Date(p.data_preenchimento),
      data_atualizacao: new Date(p.data_atualizacao),
      id_dados_producao_agro_industria: undefined,
    })),
  });

  await prisma.produtorPropriedades.createMany({
    data: produtorPropriedades.map((p) => ({
      ...p,
      produtor_id: BigInt(p.produtor_id),
      propriedade_id: BigInt(p.propriedade_id),
    })),
  });

  await prisma.dadosProducao.createMany({
    data: dadosProducao,
  });
  for (const perfil of perfis) {
    await prisma.perfil.update({
      where: { id: perfil.id },
      data: {
        id: perfil.id,
        id_dados_producao_agro_industria: perfil.id_dados_producao_agro_industria,
      },
    });
  }

  await prisma.atividade.createMany({
    data: propriedadeVisitaLink.map((p) => {
      const result = {
        ...p,
        id_propriedade: BigInt(p.id_propriedade),
      };
      return result;
    }),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
