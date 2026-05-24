import { GraphQLError } from "graphql/error/GraphQLError.js";
import { CustomError, DefaultError, ErrorHandler } from "./ErrorHandler";
import { logger } from "./logger.js";
import { Prisma } from "../../generated/prisma/client.js";

export class ErrorHandlerImpl implements ErrorHandler {
  throwError(error: DefaultError | CustomError | any): void {
    logger.error(error?.message || String(error));
    if (typeof error === "string" || this.isCustomError(error)) {
      error = typeof error === "string" ? this.createError(error) : error;

      const { message, code } = error;

      logger.info(message);
      throw new GraphQLError(message, { extensions: { code } });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      this.handlePrismaError(error);
    }

    throw new Error(error?.message || String(error));
  }

  private isCustomError(object: any): object is CustomError {
    return "message" in object && "code" in object;
  }

  private createError(error: string) {
    switch (error) {
      case "NO_ID_PROVIDED":
        return {
          message: "Id inválido. Verifique o id enviado.",
          code: "BAD_REQUEST",
        };
      case "NOT_FOUND":
        return {
          message: "Não encontrado. Verifique se foi enviado um ID válido.",
          code: "NOT_FOUND",
        };
      case "FORBIDDEN":
        return {
          message: "Não autorizado.",
          code: "FORBIDDEN",
        };
      default:
        return { message: error, code: "INTERNAL_SERVER_ERROR" };
    }
  }

  private handlePrismaError(error: Error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const { meta, code, message } = error;
      logger.info("🚀 ~ Prisma error: errorHandler.ts:53 { meta, code } %o:", { meta, code, message });
      logger.error("Prisma error {meta, code, message}: %o", { meta, code, message });
      throw new Error(error?.message);
    }
  }
}
