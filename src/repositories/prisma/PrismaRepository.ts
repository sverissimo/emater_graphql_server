import { Prisma, PrismaClient } from "@prisma/client";
import { ErrorHandlerImpl } from "../../shared/utils/ErrorHandlerImpl.js";
import { CustomError, DefaultError, ErrorHandler } from "../../shared/utils/ErrorHandler.js";
import { prismaClient } from "../../config/prismaClient.js";

export class PrismaRepository {
  errorHandler: ErrorHandler = new ErrorHandlerImpl();
  constructor(protected prisma: PrismaClient = prismaClient) {}

  throwError(error: DefaultError | CustomError | any): void {
    this.errorHandler.throwError(error);
  }

  handleRecordNotFound(error: Error | any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      this.errorHandler.throwError("NOT_FOUND");
    } else {
      this.errorHandler.throwError(error);
    }
  }
}
