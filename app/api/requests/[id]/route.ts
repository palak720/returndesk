import { NextResponse } from "next/server";
import { handle, methodNotAllowed, readJson } from "@/lib/http";
import { getRequest, removeRequest, updateRequest } from "@/lib/requests";
import { updateRequestSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (_req, { params }) => {
  return NextResponse.json(await getRequest((await params).id));
});

export const PATCH = handle<Ctx>(async (req, { params }) => {
  const input = updateRequestSchema.parse(await readJson(req));
  return NextResponse.json(await updateRequest((await params).id, input));
});

export const DELETE = handle<Ctx>(async (_req, { params }) => {
  await removeRequest((await params).id);
  return new Response(null, { status: 204 });
});

export const PUT = methodNotAllowed(["GET", "PATCH", "DELETE"]);
export const POST = methodNotAllowed(["GET", "PATCH", "DELETE"]);