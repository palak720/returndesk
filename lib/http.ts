import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, badRequest } from "./errors";

type PgError = { code?: string; constraint?: string };

function errorBody(code: string, message: string, details?: unknown) {
  return { error: { code, message, ...(details !== undefined && { details }) } };
}

export function toErrorResponse(e: unknown) {
  if (e instanceof AppError) {
    return NextResponse.json(errorBody(e.code, e.message, e.details), { status: e.status });
  }
  if (e instanceof ZodError) {
    const details = e.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
    return NextResponse.json(errorBody("VALIDATION_ERROR", "Request validation failed", details), { status: 422 });
  }
  const pg = e as PgError;
  if (pg?.code === "23505" && pg.constraint === "one_live_request_per_item") {
    return NextResponse.json(
      errorBody("DUPLICATE_LIVE_REQUEST", "A live request already exists for this order and item"),
      { status: 409 }
    );
  }
  if (pg?.code === "22P02") {
    return NextResponse.json(errorBody("INVALID_ID", "Identifier is not valid"), { status: 400 });
  }
  console.error(e);
  return NextResponse.json(errorBody("INTERNAL_ERROR", "Something went wrong"), { status: 500 });
}

export function handle<C = unknown>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest("INVALID_JSON", "Request body must be valid JSON");
  }
}