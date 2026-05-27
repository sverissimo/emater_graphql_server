import { Request, Response, Router } from "express";
import { loginService } from "./dependencies.js";
import { serializeBigInts } from "../shared/utils/serializeBigInt.js";
import { logger } from "../shared/utils/logger.js";

const router = Router();

// Login keeps its own 403 contract: any auth failure is a 403 with { error },
// not the generic 500 error sink. Kept as an inline try/catch for that reason.
router.post("/login", async (req: Request, res: Response) => {
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
    if (error instanceof Error) {
      logger.error(`Login error for user ${matricula_usuario}: ${error.message}`);
      return res.status(403).send({ error: error.message });
    }

    return res.status(403).send({ error: "Usuário ou senha inválidos." });
  }
});

export const authRoutes = router;
