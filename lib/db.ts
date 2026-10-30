import { Pool } from "pg";

// Dev mein hot reload se pool dobara na bane
const g = globalThis as unknown as { pgPool?: Pool };

export const pool = g.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

if (process.env.NODE_ENV !== "production") g.pgPool = pool;