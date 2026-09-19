import { ZodError } from "zod";

export type ApiError =
  | { code: string; message: string; details?: unknown };

export class AppError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export function fail(code: string, message: string, status = 400): ApiError {
  return { code, message };
}

export function ok<T>(data: T) {
  return { success: true, data };
}

export function zodMessage(error: ZodError): string {
  return error.errors[0]?.message ?? "Dados inválidos.";
}

export function toZodErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of error.errors) {
    const key = e.path.join(".") || "form";
    if (!out[key]) out[key] = e.message;
  }
  return out;
}

export function handleAction<T>(fn: () => Promise<T>): Promise<
  { success: true; data: T } | { success: false; error: ApiError; fields?: Record<string, string> }
> {
  return (async () => {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (err) {
      if (err instanceof ZodError) {
        return {
          success: false,
          error: { code: "VALIDATION", message: zodMessage(err) },
          fields: toZodErrors(err),
        };
      }
      if (err instanceof AppError) {
        return { success: false, error: { code: err.code, message: err.message } };
      }
      if (err instanceof Error) {
        console.error("[action]", err);
        return {
          success: false,
          error: { code: "INTERNAL", message: "Algo deu errado. Tente novamente." },
        };
      }
      return { success: false, error: { code: "INTERNAL", message: "Algo deu errado." } };
    }
  })();
}