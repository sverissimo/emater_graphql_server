import { Router } from "express";

import { PrismaClient } from "@prisma/client";

import { AtendimentoRepository } from "./modules/atendimento/AtendimentoRepository.js";
import { EnumPropsRepository } from "./shared/repositories/EnumPropsRepository.js";

const router = Router();

const prismaClient = new PrismaClient({ log: ["info", "warn", "error"] });
const atendimentoRepository = new AtendimentoRepository(prismaClient);
const enumPropsRepository = new EnumPropsRepository(prismaClient);

router.get("/getPerfilOptions", async (req, res) => {
  try {
    const perfilOptions = await enumPropsRepository.getPerfilOptions();
    return res.send(perfilOptions);
  } catch (error) {
    console.log("🚀 ~ file: routes.ts:16 ~ router.get ~ error:", error);
  }
});

router.get("/getReadOnlyRelatorios/:ids", async (req, res) => {
  try {
    const { ids } = req.params;
    const readOnlyIds = await atendimentoRepository.getReadOnlyRelatorioIds(ids.split(","));
    return res.send(readOnlyIds);
  } catch (error) {
    console.log("🚀 ~ file: routes.ts:16 ~ router.get ~ error:", error);
  }
});

export const RESTAPIRoutes = router;
