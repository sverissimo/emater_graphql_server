import { NextFunction, Request, Response } from "express";
import { GraphQLError } from "graphql";
import { logger } from "../shared/utils/logger.js";

export function routeParam(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

// Route handlers may throw / reject freely: Express 5 forwards rejected async
// handlers to the error middleware (restErrorHandler) automatically, so no
// per-route try/catch or wrapper is needed.
const CODE_TO_STATUS: Record<string, number> = {
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
};

// REST-only error sink, mounted last on the /api router. Repositories throw
// GraphQLError with an extensions.code; we map that code to an HTTP status.
// Anything without a known code is an unexpected failure -> 500.
export function restErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const code =
    error instanceof GraphQLError
      ? String(error.extensions?.code ?? "")
      : "";
  const status = CODE_TO_STATUS[code] ?? 500;
  const message =
    error instanceof Error ? error.message : "Erro interno do servidor.";

  if (status >= 500) {
    logger.error(`REST handler error: ${message}`);
  }

  return res.status(status).send({ error: message });
}
