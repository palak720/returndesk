import type { PoolClient } from "pg";
import { pool } from "./db";
import { canEdit, canRemove, canTransition, TRANSITIONS } from "./domain";
import { conflict, notFound } from "./errors";
import type { RequestNote, RequestWithNotes, ReturnRequest } from "./types";
import type { CreateRequestInput, ListQuery, TransitionInput, UpdateRequestInput } from "./validation";

const COLUMNS = `id, reference, customer_name, customer_email, customer_phone, order_number, item_sku,
  item_name, quantity, reason, status, resolution, refund_amount, created_at, updated_at`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function toRequest(r: any): ReturnRequest {
  return {
    id: r.id,
    reference: r.reference,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    orderNumber: r.order_number,
    itemSku: r.item_sku,
    itemName: r.item_name,
    quantity: r.quantity,
    reason: r.reason,
    status: r.status,
    resolution: r.resolution,
    refundAmount: r.refund_amount === null ? null : Number(r.refund_amount),
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

function toNote(r: any): RequestNote {
  return { id: r.id, requestId: r.request_id, body: r.body, createdAt: r.created_at.toISOString() };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A malformed id can never match a record, so it is a 404 rather than a server error.
function assertId(id: string) {
  if (!UUID.test(id)) throw notFound();
}

async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Locks the row so two agents cannot move the same request at the same time.
async function lockLive(c: PoolClient, id: string): Promise<ReturnRequest> {
  const { rows } = await c.query(
    `SELECT ${COLUMNS} FROM return_requests WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
    [id]
  );
  if (!rows[0]) throw notFound();
  return toRequest(rows[0]);
}

export async function createRequest(input: CreateRequestInput): Promise<ReturnRequest> {
  const { rows } = await pool.query(
    `INSERT INTO return_requests
       (customer_name, customer_email, customer_phone, order_number, item_sku, item_name, quantity, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${COLUMNS}`,
    [
      input.customerName,
      input.customerEmail,
      input.customerPhone || null,
      input.orderNumber,
      input.itemSku,
      input.itemName,
      input.quantity,
      input.reason,
    ]
  );
  return toRequest(rows[0]);
}

const SORT_COLUMNS = {
  createdAt: "created_at",
  customerName: "lower(customer_name)",
  status: "status", // enum order follows the lifecycle
  reference: "reference",
} as const;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export async function listRequests(q: ListQuery) {
  const where = ["deleted_at IS NULL"];
  const params: unknown[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (q.status) where.push(`status = ${add(q.status)}`);
  if (q.reason) where.push(`reason = ${add(q.reason)}`);
  if (q.q) {
    const p = add(`%${escapeLike(q.q)}%`);
    where.push(
      `(customer_name ILIKE ${p} OR customer_email ILIKE ${p} OR order_number ILIKE ${p} OR reference ILIKE ${p})`
    );
  }
  const whereSql = where.join(" AND ");
  const dir = q.order === "asc" ? "ASC" : "DESC";
  const limit = add(q.pageSize);
  const offset = add((q.page - 1) * q.pageSize);

  const [data, count] = await Promise.all([
    pool.query(
      `SELECT ${COLUMNS} FROM return_requests WHERE ${whereSql}
       ORDER BY ${SORT_COLUMNS[q.sort]} ${dir}, id ASC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    ),
    pool.query(`SELECT count(*)::int AS total FROM return_requests WHERE ${whereSql}`, params.slice(0, -2)),
  ]);

  const total: number = count.rows[0].total;
  return {
    data: data.rows.map(toRequest),
    meta: { total, page: q.page, pageSize: q.pageSize, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) },
  };
}

export async function getRequest(id: string): Promise<RequestWithNotes> {
  assertId(id);
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM return_requests WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) throw notFound();
  const notes = await pool.query(
    `SELECT id, request_id, body, created_at FROM request_notes
     WHERE request_id = $1 ORDER BY created_at ASC, id ASC`,
    [id]
  );
  return { ...toRequest(rows[0]), notes: notes.rows.map(toNote) };
}

const UPDATE_COLUMNS: Record<keyof UpdateRequestInput, string> = {
  customerName: "customer_name",
  customerEmail: "customer_email",
  customerPhone: "customer_phone",
  orderNumber: "order_number",
  itemSku: "item_sku",
  itemName: "item_name",
  quantity: "quantity",
  reason: "reason",
};

// Rule 4: details are locked once a request is decided.
export async function updateRequest(id: string, input: UpdateRequestInput): Promise<ReturnRequest> {
  assertId(id);
  return withTx(async (c) => {
    const current = await lockLive(c, id);
    if (!canEdit(current.status)) {
      throw conflict("REQUEST_LOCKED", `A ${current.status} request can no longer be edited`, {
        status: current.status,
      });
    }
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, column] of Object.entries(UPDATE_COLUMNS)) {
      const value = input[key as keyof UpdateRequestInput];
      if (value === undefined) continue;
      params.push(key === "customerPhone" ? value || null : value);
      sets.push(`${column} = $${params.length}`);
    }
    params.push(id);
    const { rows } = await c.query(
      `UPDATE return_requests SET ${sets.join(", ")}, updated_at = now()
       WHERE id = $${params.length} RETURNING ${COLUMNS}`,
      params
    );
    return toRequest(rows[0]);
  });
}

// Rules 1 and 2: legal transitions only, and approval carries its resolution.
export async function transitionRequest(id: string, input: TransitionInput): Promise<ReturnRequest> {
  assertId(id);
  return withTx(async (c) => {
    const current = await lockLive(c, id);
    if (!canTransition(current.status, input.status)) {
      throw conflict(
        "INVALID_TRANSITION",
        current.status === input.status
          ? `This request is already ${current.status}`
          : `Cannot move a request from ${current.status} to ${input.status}`,
        { from: current.status, to: input.status, allowed: TRANSITIONS[current.status] }
      );
    }
    const approving = input.status === "APPROVED";
    const { rows } = await c.query(
      `UPDATE return_requests
       SET status = $1,
           resolution = CASE WHEN $4 THEN $2::resolution_type ELSE resolution END,
           refund_amount = CASE WHEN $4 THEN $3::numeric ELSE refund_amount END,
           updated_at = now()
       WHERE id = $5 RETURNING ${COLUMNS}`,
      [input.status, input.resolution ?? null, input.refundAmount ?? null, approving, id]
    );
    return toRequest(rows[0]);
  });
}

// Rule 5: soft delete. The row stays in the database.
export async function removeRequest(id: string): Promise<void> {
  assertId(id);
  await withTx(async (c) => {
    const current = await lockLive(c, id);
    if (!canRemove(current.status)) {
      throw conflict("NOT_REMOVABLE", `A ${current.status} request cannot be removed`, {
        status: current.status,
      });
    }
    await c.query("UPDATE return_requests SET deleted_at = now(), updated_at = now() WHERE id = $1", [id]);
  });
}

// Notes are append-only and allowed in every status.
export async function addNote(requestId: string, body: string): Promise<RequestNote> {
  assertId(requestId);
  const { rows } = await pool.query(
    `INSERT INTO request_notes (request_id, body)
     SELECT id, $2 FROM return_requests WHERE id = $1 AND deleted_at IS NULL
     RETURNING id, request_id, body, created_at`,
    [requestId, body]
  );
  if (!rows[0]) throw notFound();
  return toNote(rows[0]);
}