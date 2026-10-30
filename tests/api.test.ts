// Black-box tests for the business rules. Run the app first (npm run dev), then: npm test
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

async function call(method: string, path: string, body?: unknown, raw?: string) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await res.text();
  return { status: res.status, type: res.headers.get("content-type") ?? "", json: text ? JSON.parse(text) : null };
}

const run = randomUUID().slice(0, 8);
const fresh = (n: number, extra: object = {}) => ({
  customerName: "Test Customer",
  customerEmail: "test@example.com",
  orderNumber: `T-${run}-${n}`,
  itemSku: "SKU-1",
  itemName: "Test item",
  quantity: 1,
  reason: "DAMAGED",
  ...extra,
});

async function make(n: number, extra: object = {}) {
  const r = await call("POST", "/api/requests", fresh(n, extra));
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json as { id: string; reference: string; status: string };
}
const move = (id: string, body: object) => call("POST", `/api/requests/${id}/transition`, body);
const code = (r: { json: { error?: { code: string } } }) => r.json.error?.code;

describe("creating", () => {
  it("generates a reference and starts Open", async () => {
    const r = await make(1);
    assert.match(r.reference, /^RD-\d{6}$/);
    assert.equal(r.status, "OPEN");
  });
  it("rejects bad input with 422 and a field list", async () => {
    const r = await call("POST", "/api/requests", fresh(2, { quantity: 0, reason: "NOPE" }));
    assert.equal(r.status, 422);
    assert.equal(code(r), "VALIDATION_ERROR");
  });
  it("ignores a client supplied reference by refusing unknown fields", async () => {
    const r = await call("POST", "/api/requests", fresh(3, { reference: "RD-999999" }));
    assert.equal(r.status, 422);
  });
  it("answers invalid JSON with 400", async () => {
    const r = await call("POST", "/api/requests", undefined, "{oops");
    assert.equal(r.status, 400);
    assert.equal(code(r), "INVALID_JSON");
  });
});

describe("rule 1: status flow", () => {
  it("refuses Open -> Completed and Open -> Approved", async () => {
    const r = await make(10);
    const a = await move(r.id, { status: "COMPLETED" });
    assert.equal(a.status, 409);
    assert.equal(code(a), "INVALID_TRANSITION");
    const b = await move(r.id, { status: "APPROVED", resolution: "REPLACEMENT" });
    assert.equal(b.status, 409);
  });
  it("walks Open -> In Review -> Approved -> Completed, then is final", async () => {
    const r = await make(11);
    assert.equal((await move(r.id, { status: "IN_REVIEW" })).status, 200);
    assert.equal((await move(r.id, { status: "APPROVED", resolution: "STORE_CREDIT" })).status, 200);
    assert.equal((await move(r.id, { status: "COMPLETED" })).status, 200);
    assert.equal((await move(r.id, { status: "IN_REVIEW" })).status, 409);
  });
  it("makes Rejected final", async () => {
    const r = await make(12);
    assert.equal((await move(r.id, { status: "REJECTED" })).status, 200);
    assert.equal((await move(r.id, { status: "OPEN" })).status, 409);
  });
});

describe("rule 2: approval needs a resolution", () => {
  it("refuses approval without a resolution", async () => {
    const r = await make(20);
    await move(r.id, { status: "IN_REVIEW" });
    assert.equal((await move(r.id, { status: "APPROVED" })).status, 422);
  });
  it("needs a refund amount above zero for a refund", async () => {
    const r = await make(21);
    await move(r.id, { status: "IN_REVIEW" });
    assert.equal((await move(r.id, { status: "APPROVED", resolution: "REFUND" })).status, 422);
    assert.equal((await move(r.id, { status: "APPROVED", resolution: "REFUND", refundAmount: 0 })).status, 422);
    const ok = await move(r.id, { status: "APPROVED", resolution: "REFUND", refundAmount: 499.5 });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.refundAmount, 499.5);
  });
  it("refuses a refund amount on a replacement", async () => {
    const r = await make(22);
    await move(r.id, { status: "IN_REVIEW" });
    const bad = await move(r.id, { status: "APPROVED", resolution: "REPLACEMENT", refundAmount: 10 });
    assert.equal(bad.status, 422);
  });
});

describe("rule 3: one live request per item", () => {
  it("refuses a duplicate until the first is closed", async () => {
    const first = await make(30);
    const dup = await call("POST", "/api/requests", fresh(30));
    assert.equal(dup.status, 409);
    assert.equal(code(dup), "DUPLICATE_LIVE_REQUEST");
    await move(first.id, { status: "REJECTED" });
    assert.equal((await call("POST", "/api/requests", fresh(30))).status, 201);
  });
  it("allows the same order with a different item", async () => {
    await make(31);
    assert.equal((await call("POST", "/api/requests", fresh(31, { itemSku: "SKU-2" }))).status, 201);
  });
});

describe("rule 4: locked once decided", () => {
  it("allows edits while open and refuses them once approved", async () => {
    const r = await make(40);
    const ok = await call("PATCH", `/api/requests/${r.id}`, { customerName: "Renamed" });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.customerName, "Renamed");
    await move(r.id, { status: "IN_REVIEW" });
    await move(r.id, { status: "APPROVED", resolution: "REPLACEMENT" });
    const locked = await call("PATCH", `/api/requests/${r.id}`, { quantity: 3 });
    assert.equal(locked.status, 409);
    assert.equal(code(locked), "REQUEST_LOCKED");
  });
  it("still accepts notes after approval", async () => {
    const r = await make(41);
    await move(r.id, { status: "IN_REVIEW" });
    await move(r.id, { status: "APPROVED", resolution: "REPLACEMENT" });
    assert.equal((await call("POST", `/api/requests/${r.id}/notes`, { body: "Shipped" })).status, 201);
  });
});

describe("rule 5: removal", () => {
  it("soft deletes an Open request: gone from list and fetch", async () => {
    const r = await make(50);
    assert.equal((await call("DELETE", `/api/requests/${r.id}`)).status, 204);
    assert.equal((await call("GET", `/api/requests/${r.id}`)).status, 404);
    const list = await call("GET", `/api/requests?q=${r.reference}`);
    assert.equal(list.json.meta.total, 0);
    assert.equal((await call("POST", `/api/requests/${r.id}/notes`, { body: "x" })).status, 404);
  });
  it("refuses removing an In Review request", async () => {
    const r = await make(51);
    await move(r.id, { status: "IN_REVIEW" });
    const res = await call("DELETE", `/api/requests/${r.id}`);
    assert.equal(res.status, 409);
    assert.equal(code(res), "NOT_REMOVABLE");
  });
  it("frees the item for a new request after removal", async () => {
    const r = await make(52);
    await call("DELETE", `/api/requests/${r.id}`);
    assert.equal((await call("POST", "/api/requests", fresh(52))).status, 201);
  });
});

describe("notes", () => {
  it("returns notes in order on the detail view and has no edit or delete", async () => {
    const r = await make(60);
    await call("POST", `/api/requests/${r.id}/notes`, { body: "first" });
    await call("POST", `/api/requests/${r.id}/notes`, { body: "second" });
    const d = await call("GET", `/api/requests/${r.id}`);
    assert.deepEqual(d.json.notes.map((n: { body: string }) => n.body), ["first", "second"]);
    const note = d.json.notes[0];
    assert.notEqual((await call("DELETE", `/api/requests/${r.id}/notes/${note.id}`)).status, 204);
  });
  it("refuses empty notes", async () => {
    const r = await make(61);
    assert.equal((await call("POST", `/api/requests/${r.id}/notes`, { body: "   " })).status, 422);
  });
});

describe("listing", () => {
  it("searches, filters, sorts and pages together on the server", async () => {
    await make(70, { customerName: `Zed ${run}`, reason: "SIZE_ISSUE" });
    await make(71, { customerName: `Amy ${run}`, reason: "SIZE_ISSUE" });
    await make(72, { customerName: `Bob ${run}`, reason: "DAMAGED" });
    const q = `/api/requests?q=${run}&reason=SIZE_ISSUE&status=OPEN&sort=customerName&order=asc&pageSize=1&page=2`;
    const r = await call("GET", q);
    assert.equal(r.status, 200);
    assert.equal(r.json.meta.total, 2);
    assert.equal(r.json.meta.totalPages, 2);
    assert.equal(r.json.data.length, 1);
    assert.equal(r.json.data[0].customerName, `Zed ${run}`);
  });
  it("finds a request by reference and treats % literally", async () => {
    const r = await make(73);
    assert.equal((await call("GET", `/api/requests?q=${r.reference}`)).json.meta.total, 1);
    assert.equal((await call("GET", "/api/requests?q=%25")).json.meta.total, 0);
  });
  it("refuses bad sort and oversized pages instead of crashing", async () => {
    assert.equal((await call("GET", "/api/requests?sort=password")).status, 422);
    assert.equal((await call("GET", "/api/requests?pageSize=100000")).status, 422);
  });
});

describe("errors are always JSON", () => {
  it("answers unsupported methods with a JSON 405 and an Allow header", async () => {
    const res = await fetch(`${BASE}/api/requests`, { method: "DELETE" });
    assert.equal(res.status, 405);
    assert.equal(res.headers.get("allow"), "GET, POST");
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, "METHOD_NOT_ALLOWED");
  });
  it("returns 404 JSON for unknown ids, bad ids and unknown routes", async () => {
    for (const path of [`/api/requests/${randomUUID()}`, "/api/requests/not-a-uuid", "/api/nothing-here"]) {
      const r = await call("GET", path);
      assert.equal(r.status, 404, path);
      assert.match(r.type, /application\/json/);
      assert.equal(code(r), "NOT_FOUND");
    }
  });
});