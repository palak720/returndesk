import { NextResponse } from "next/server";
import { handle, methodNotAllowed, readJson } from "@/lib/http";
import { transitionRequest } from "@/lib/requests";
import { transitionSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req, { params }) => {
  const input = transitionSchema.parse(await readJson(req));
  return NextResponse.json(await transitionRequest((await params).id, input));
});

export const GET = methodNotAllowed(["POST"]);
export const PUT = methodNotAllowed(["POST"]);
export const PATCH = methodNotAllowed(["POST"]);
export const DELETE = methodNotAllowed(["POST"]);