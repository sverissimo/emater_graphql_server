import { Router } from "express";
import { PerfilRepository } from "./Repositories/PerfilRepository.js";
import { PrismaClient } from "@prisma/client";
import { EnumPropsRepository } from "./Repositories/EnumPropsRepository.js";

const router = Router();

const prismaClient = new PrismaClient({ log: ["info", "warn", "error"] });
const enumPropsRepository = new EnumPropsRepository(prismaClient);

router.get("/getPerfilOptions", async (req, res) => {
  try {
    const perfilOptions = await enumPropsRepository.getPerfilOptions();
    return res.send(perfilOptions);
  } catch (error) {
    console.log("🚀 ~ file: routes.ts:16 ~ router.get ~ error:", error);
  }
});

export const RESTAPIRoutes = router;
