import { NextResponse } from "next/server";
import { handle, methodNotAllowed, readJson } from "@/lib/http";
import { createRequest, listRequests } from "@/lib/requests";
import { createRequestSchema, listQuerySchema } from "@/lib/validation";

export const GET = handle(async (req) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return NextResponse.json(await listRequests(listQuerySchema.parse(params)));
});

export const POST = handle(async (req) => {
  const created = await createRequest(createRequestSchema.parse(await readJson(req)));
  return NextResponse.json(created, { status: 201, headers: { Location: `/api/requests/${created.id}` } });
});

export const PUT = methodNotAllowed(["GET", "POST"]);
export const PATCH = methodNotAllowed(["GET", "POST"]);
export const DELETE = methodNotAllowed(["GET", "POST"]);