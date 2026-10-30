import { NextResponse } from "next/server";
import { handle, methodNotAllowed, readJson } from "@/lib/http";
import { addNote } from "@/lib/requests";
import { noteSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req, { params }) => {
  const { body } = noteSchema.parse(await readJson(req));
  return NextResponse.json(await addNote((await params).id, body), { status: 201 });
});

export const GET = methodNotAllowed(["POST"]);
export const PUT = methodNotAllowed(["POST"]);
export const PATCH = methodNotAllowed(["POST"]);
export const DELETE = methodNotAllowed(["POST"]);