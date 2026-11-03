// Isolated regression checks: never reads or modifies the shop's real data.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = await mkdtemp(path.join(tmpdir(), "nasaem-regression-"));
const socket = createServer();
await new Promise(resolve => socket.listen(0, "127.0.0.1", resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const server = spawn(process.execPath, ["artifacts/api-server/dist/index.mjs"], {
  cwd: root,
  env: {
    ...process.env,
    NASAEM_LOCAL_MODE: "true",
    NASAEM_DATA_DIR: directory,
    NASAEM_MIGRATIONS_DIR: path.join(root, "lib/db/drizzle"),
    PORT: String(port),
    NODE_ENV: "production",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", data => { logs = (logs + data).slice(-6000); });
}
const exited = new Promise(resolve => server.once("exit", resolve));
async function request(route, { method = "GET", cookie, data, status = 200 } = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/api${route}`, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${route}: ${text}`);
  return {
    body: text && text !== "No Content" ? JSON.parse(text) : null,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try { await request("/healthz"); ready = true; break; } catch {
      if (server.exitCode !== null) throw new Error(logs);
      await delay(250);
    }
  }
  assert.ok(ready, `Local test server did not start: ${logs}`);
  const password = "IsolatedTest123!";
  const { cookie } = await request("/auth/local/register", {
    method: "POST", status: 201,
    data: { displayName: "Regression Owner", email: "owner@regression.test", password },
  });
  assert.ok(cookie);
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = key => parts.find(item => item.type === key)?.value;
  const month = `${part("year")}-${part("month")}`;
  const expenseDate = `${month}-${part("day")}`;
  const { body: product } = await request("/products", {
    method: "POST", status: 201, cookie,
    data: { name: "Regression item", sku: "REGRESSION-1", category: "Test", unit: "عبوة", unitsPerCarton: 6, stock: 10, purchasePrice: 10, sellingPrice: 15, lowStockThreshold: 2 },
  });
  assert.equal(product.unitsPerCarton, 6);
  const { body: supply } = await request("/supplies", {
    method: "POST", status: 201, cookie,
    data: { supplierName: "Regression supplier", amountPaid: 10, items: [{ productId: product.id, quantity: 2, unitCost: 10 }] },
  });
  assert.equal(supply.total, 20);
  assert.equal(supply.amountPaid, 10);
  let debtRows = (await request("/debts", { cookie })).body;
  const supplierDebt = debtRows.find(debt => debt.supplyId === supply.id);
  assert.equal(supplierDebt.remaining, 10);
  assert.equal(supplierDebt.payments.length, 1);
  const supplierPayment = await request(`/debts/${supplierDebt.id}/payments`, {
    method: "POST", cookie, data: { amount: 10, notes: "Final supplier payment" },
  });
  assert.equal(supplierPayment.body.remaining, 0);
  assert.equal((await request("/supplies?limit=100", { cookie })).body[0].amountPaid, 20);
  await request("/expenses", {
    method: "POST", status: 201, cookie,
    data: { category: "electricity", amount: 5, expenseDate, notes: "Regression expense" },
  });
  const { body: sale } = await request("/sales", {
    method: "POST", status: 201, cookie,
    data: { items: [{ productId: product.id, quantity: 3 }], discount: 0 },
  });
  assert.equal((await request(`/products/${product.id}`, { cookie })).body.stock, 9);
  let monthly = (await request(`/finance/monthly?month=${month}`, { cookie })).body;
  assert.equal(monthly.salesRevenue, 45);
  assert.equal(monthly.costOfGoodsSold, 30);
  assert.equal(monthly.grossProfit, 15);
  assert.equal(monthly.expensesTotal, 5);
  assert.equal(monthly.netProfit, 10);
  const { body: receivable } = await request("/debts", {
    method: "POST", status: 201, cookie,
    data: { direction: "receivable", partyType: "customer", partyName: "Regression customer", amount: 50, paidAmount: 5 },
  });
  assert.equal(receivable.remaining, 45);
  const partialPayment = await request(`/debts/${receivable.id}/payments`, {
    method: "POST", cookie, data: { amount: 15 },
  });
  assert.equal(partialPayment.body.remaining, 30);
  await request(`/debts/${receivable.id}/payments`, {
    method: "POST", status: 400, cookie, data: { amount: 31 },
  });
  await request(`/products/${product.id}`, { method: "PATCH", cookie, data: { name: "Updated regression item", sellingPrice: 20 } });
  assert.equal((await request(`/sales/${sale.id}/invoice`, { cookie })).body.items[0].unitPrice, 15);
  await request(`/products/${product.id}`, { method: "DELETE", cookie, status: 204 });
  assert.equal((await request("/products", { cookie })).body.length, 0);
  assert.equal((await request("/products?includeInactive=true", { cookie })).body[0].isActive, false);
  await request("/sales", { method: "POST", status: 400, cookie, data: { items: [{ productId: product.id, quantity: 1 }], discount: 0 } });
  const cancel = () => request(`/sales/${sale.id}/cancel`, { method: "POST", cookie, data: { reason: "Regression cancellation" } });
  const cancellations = await Promise.all([cancel(), cancel()]);
  assert.ok(cancellations.every(result => result.body.cancelledAt));
  assert.equal((await request(`/products/${product.id}`, { cookie })).body.stock, 12);
  const totals = (await request("/dashboard", { cookie })).body;
  assert.equal(totals.todaySales, 0);
  assert.equal(totals.todaySaleCount, 0);
  assert.equal(totals.estimatedProfit, 0);
  monthly = (await request(`/finance/monthly?month=${month}`, { cookie })).body;
  assert.equal(monthly.salesRevenue, 0);
  assert.equal(monthly.costOfGoodsSold, 0);
  assert.equal(monthly.netProfit, -5);
  const backup = (await request("/backup", { cookie })).body;
  assert.equal(backup.sales[0].cancellationReason, "Regression cancellation");
  assert.equal(backup.products[0].unitsPerCarton, 6);
  assert.equal(backup.supplies[0].amountPaid, 20);
  assert.equal(backup.debts.length, 2);
  assert.equal(backup.expenses.length, 1);
  await request("/backup", { method: "POST", cookie, data: backup });
  await cancel();
  assert.equal((await request(`/products/${product.id}`, { cookie })).body.stock, 12);
  await request(`/products/${product.id}`, { method: "PATCH", cookie, data: { isActive: true } });
  assert.equal((await request("/products", { cookie })).body.length, 1);
  await request("/auth/local/register", { method: "POST", status: 201, data: { displayName: "Regression Cashier", email: "cashier@regression.test", password } });
  const staff = (await request("/team", { cookie })).body.find(member => member.displayName === "Regression Cashier");
  await request("/team", { method: "PATCH", cookie, data: { userId: staff.id, role: "cashier", active: true } });
  const cashier = await request("/auth/local/login", { method: "POST", data: { email: "cashier@regression.test", password } });
  await request(`/sales/${sale.id}/cancel`, { method: "POST", cookie: cashier.cookie, status: 403, data: { reason: "Not permitted" } });
  await request(`/products/${product.id}`, { method: "DELETE", cookie: cashier.cookie, status: 403 });
  console.log("PASS: product carton conversion, paid supplier supplies, partial debt payments, monthly profit and expense math, editing, archive/restore, historical invoices, cancellation, backup roundtrip, cashier permissions.");
} finally {
  server.kill("SIGTERM");
  await exited;
  await rm(directory, { recursive: true, force: true });
}
