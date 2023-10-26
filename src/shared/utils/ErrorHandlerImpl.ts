import { GraphQLError } from "graphql/error/GraphQLError.js";
import { CustomError, DefaultError, ErrorHandler } from "./ErrorHandler";

export class ErrorHandlerImpl implements ErrorHandler {
  throwError(error: DefaultError | CustomError): void {
    if (typeof error !== "string" && !this.isCustomError(error)) {
      throw new Error("Invalid graphQLError input: should be a DefaultError enum or {message, error} type.");
    }

    if (typeof error === "string") {
      error = this.createError(error);
    }

    const { message, code } = error;
    throw new GraphQLError(message, { extensions: { code } });
  }

  private isCustomError(object: any): object is CustomError {
    return "message" in object && "code" in object;
  }

  private createError(error: DefaultError) {
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
        return { message: "Internal server error.", code: "INTERNAL_SERVER_ERROR" };
    }
  }
}
