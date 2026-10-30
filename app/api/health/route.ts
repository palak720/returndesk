import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { handle } from "@/lib/http";

export const GET = handle(async () => {
  await pool.query("SELECT 1");
  return NextResponse.json({ status: "ok" });
});
