export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);
export const notFound = (message = "Return request not found") =>
  new AppError(404, "NOT_FOUND", message);
export const conflict = (code: string, message: string, details?: unknown) =>
  new AppError(409, code, message, details);
export const validationError = (details: unknown) =>
  new AppError(422, "VALIDATION_ERROR", "Request validation failed", details);