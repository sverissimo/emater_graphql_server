export type DefaultError = "NO_ID_PROVIDED" | "NOT_FOUND" | "FORBIDDEN" | "INTERNAL_SERVER_ERROR";

export type CustomError = {
  message: string;
  code: string | number;
};

export interface ErrorHandler {
  throwError: (error: DefaultError | CustomError) => void;
}
