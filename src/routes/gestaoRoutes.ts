import { Request, Response, Router } from "express";
import { GraphQLError } from "graphql";
import { gestaoRepository } from "./dependencies.js";

const router = Router();

function parseCodigos(raw: unknown): bigint[] {
  if (!Array.isArray(raw)) {
    throw new GraphQLError("Os códigos devem ser enviados em um array.", {
      extensions: { code: "BAD_REQUEST" },
    });
  }

  const codigos = new Set<bigint>();
  for (const codigo of raw) {
    if (
      (typeof codigo !== "string" &&
        !(typeof codigo === "number" && Number.isSafeInteger(codigo))) ||
      !/^\d+$/.test(String(codigo))
    ) {
      throw new GraphQLError(
        "Código inválido. Envie apenas strings de dígitos ou inteiros seguros.",
        { extensions: { code: "BAD_REQUEST" } },
      );
    }

    codigos.add(BigInt(codigo));
  }

  return [...codigos];
}

router.post(
  "/gestao/contagemPorPrograma",
  async (req: Request, res: Response) => {
    if (
      req.body !== undefined &&
      (req.body === null ||
        typeof req.body !== "object" ||
        Array.isArray(req.body))
    ) {
      throw new GraphQLError("O corpo deve ser um objeto JSON.", {
        extensions: { code: "BAD_REQUEST" },
      });
    }

    const excluirCodigos = parseCodigos(
      req.body?.excluirCodigos === undefined ? [] : req.body.excluirCodigos,
    );
    const result = await gestaoRepository.getContagemPorPrograma(excluirCodigos);
    return res.json(result);
  },
);

router.post(
  "/gestao/atendimentosPorPrograma",
  async (req: Request, res: Response) => {
    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body)
    ) {
      throw new GraphQLError("O corpo deve ser um objeto JSON.", {
        extensions: { code: "BAD_REQUEST" },
      });
    }

    const raw = req.body.codigos;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) {
      throw new GraphQLError("codigos deve conter de 1 a 20 códigos.", {
        extensions: { code: "BAD_REQUEST" },
      });
    }

    const codigos = parseCodigos(raw);
    const result = await gestaoRepository.getAtendimentosPorPrograma(codigos);
    return res.json(result);
  },
);

export const gestaoRoutes = router;
