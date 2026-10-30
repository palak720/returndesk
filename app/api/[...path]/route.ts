import { NextResponse } from "next/server";

// Unknown API paths answer in the same JSON error shape instead of an HTML page.
const notFound = () =>
  NextResponse.json({ error: { code: "NOT_FOUND", message: "No such API route" } }, { status: 404 });

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
