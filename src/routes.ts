import { Router } from "express";
import { PrismaClient } from "@prisma/client";

import { AtendimentoRepository } from "./repositories/prisma/AtendimentoRepository.js";
import { EnumPropsRepository } from "./repositories/prisma/EnumPropsRepository.js";
import { UsuarioRepository } from "./repositories/prisma/UsuarioRepository.js";
import { serializeBigInts } from "./shared/utils/serializeBigInt.js";
import { LoginService } from "./auth/LoginService.js";
import { logger } from "./shared/utils/logger.js";

const router = Router();

const prismaClient = new PrismaClient({ log: ["info", "warn", "error"] });
const atendimentoRepository = new AtendimentoRepository(prismaClient);
const enumPropsRepository = new EnumPropsRepository(prismaClient);
const usuarioRepository = new UsuarioRepository(prismaClient);
const loginService = new LoginService(usuarioRepository);

router.get("/getPerfilOptions", async (req, res) => {
  try {
    const perfilOptions = await enumPropsRepository.getPerfilOptions();
    return res.send(perfilOptions);
  } catch (error) {
    console.log("🚀 ~ file: routes.ts:19 ~ router.get ~ error:", error);
  }
});

router.get("/getPerfilOptionsRaw", async (req, res) => {
  const perfilOptions = await enumPropsRepository.getPerfilOptionsRaw();
  return res.send(perfilOptions);
});

router.get("/getGruposProdutos", async (req, res) => {
  try {
    const perfilOptions = await enumPropsRepository.getGruposProdutos();
    return res.send(perfilOptions);
  } catch (error) {
    console.log("🚀 ~ file: routes.ts:28 ~ router.get ~ error:", error);
  }
});

router.get("/getReadOnlyRelatorios/:ids", async (req, res) => {
  try {
    const { ids } = req.params;
    const readOnlyIds = await atendimentoRepository.getReadOnlyRelatorioIds(
      ids.split(",")
    );
    return res.send(readOnlyIds);
  } catch (error) {
    console.log("🚀 ~ file: routes.ts:49 ~ router.get ~ error:", error);
    logger.error(`Error fetching read-only relatorios: ${error}`);
  }
});

router.get("/getContractInfo", async (_, res) => {
  try {
    const contractInfo = await enumPropsRepository.getContractInfo();
    return res.send(contractInfo);
  } catch (error) {
    console.log("🚀 ~ file: routes.ts:58 ~ router.get ~ error:", error);
  }
});

router.get("/getAtendimentosWithoutDataSEI", async (_, res) => {
  try {
    const atendimentosWithoutDataSEI =
      await atendimentoRepository.getAtendimentosWithoutDataSEI();
    if (!atendimentosWithoutDataSEI) {
      return res.send([]);
    }

    return res.send(atendimentosWithoutDataSEI);
  } catch (error) {
    console.log("🚀 ~ file: routes.ts:72 ~ router.get ~ error:", error);
    logger.error(`Error fetching atendimentos without data SEI: ${error}`);
  }
});

router.get("/getTemasAtendimento", async (_, res) => {
  try {
    const temasAtendimento = await enumPropsRepository.getTemasAtendimento();
    return res.send(temasAtendimento);
  } catch (error) {
    console.log("🚀 ~ file: routes.ts:81 ~ router.get ~ error:", error);
    logger.error(`Error fetching temas atendimento: ${error}`);
  }
});

router.get("/getRegionaisEmater", async (_, res) => {
  try {
    const regionais = await enumPropsRepository.getRegionaisEmater();
    return res.send(regionais);
  } catch (error) {
    console.log("🚀 ~ file: routes.ts:90 ~ router.get ~ error:", error);
  }
});

router.patch(
  "/updateTemasAndVisitaAtendimento/:atendimentoId",
  async (req, res) => {
    const { atendimentoId } = req.params;
    const { temasAtendimento, numeroVisita } = req.body;
    try {
      await atendimentoRepository.updateTemasAndNumeroVisita({
        idAtendimento: BigInt(atendimentoId),
        temasAtendimento,
        numeroVisita,
      });
      return res.status(204).send();
    } catch (error) {
      console.log("🚀 ~ file: routes.ts:107 ~ router.patch ~ error:", error);
      logger.error(
        `Error updating temas and numero visita for atendimento ${atendimentoId}: ${error}`
      );
    }
  }
);

router.post("/login", async (req, res) => {
  const { matricula_usuario, password } = req.body;
  try {
    const usuarioLoginOutput = await loginService.login({
      matricula_usuario,
      password,
    });

    if (!usuarioLoginOutput) {
      throw new Error("Usuário não encontrado");
    }

    const serializedUsuario = serializeBigInts(usuarioLoginOutput);
    return res.send(serializedUsuario);
  } catch (error) {
    console.log("🚀 - RestAPIRoutes - login - error:", error);
    if (error instanceof Error) {
      return res.status(403).send({
        error: error.message,
      });
    }
    return res.status(403).send({
      error: "Usuário ou senha inválidos.",
    });
  }
});

router.get("/getReplacedAtendimentos", async (_, res) => {
  try {
    const replacedAtendimentos =
      await atendimentoRepository.getReplacedAtendimentos();

    return res.send(replacedAtendimentos);
  } catch (error) {
    console.log("🚀 ~ file: routes.ts:16 ~ router.get ~ error:", error);
    logger.error(`Error fetching replaced atendimentos: ${error}`);
  }
});

export const RESTAPIRoutes = router;
