import { PrismaClient } from "@prisma/client";
import { ErrorHandlerImpl } from "../utils/ErrorHandlerImpl.js";
import { CustomError, DefaultError, ErrorHandler } from "../utils/ErrorHandler";

export class PrismaRepository {
  errorHandler: ErrorHandler = new ErrorHandlerImpl();
  constructor(protected prisma: PrismaClient) {}

  throwError(error: DefaultError | CustomError): void {
    this.errorHandler.throwError(error);
  }
}
