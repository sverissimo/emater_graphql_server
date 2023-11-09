import { Prisma, PrismaClient } from "@prisma/client";
import { ErrorHandlerImpl } from "../../shared/utils/ErrorHandlerImpl.js";
import { CustomError, DefaultError, ErrorHandler } from "../../shared/utils/ErrorHandler.js";
import { prismaClient } from "../../config/prismaClient.js";

export class PrismaRepository {
  errorHandler: ErrorHandler = new ErrorHandlerImpl();
  constructor(protected prisma: PrismaClient = prismaClient) {}

  throwError(error: DefaultError | CustomError): void {
    this.errorHandler.throwError(error);
  }

  handleRecordNotFound(error: Error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      const { meta, code } = error;
      console.log("🚀 ~ file: PerfilRepository.ts:82 ~ PerfilRepository ~ update ~ { meta, name, code  }:", {
        meta,
        code,
      });
      this.throwError("NOT_FOUND");
    }
    this.throwError({ ...error, code: "INTERNAL_SERVER_ERROR" });
  }
}
