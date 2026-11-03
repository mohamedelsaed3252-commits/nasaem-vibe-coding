# نسايم للمنظفات

نظام عربي لنقطة بيع ومخزون متجر نسايم للمنظفات، متاح عبر الإنترنت من الكمبيوتر والموبايل مع تسجيل الدخول والصلاحيات. التشغيل داخل شبكة المحل وضع اختياري وليس قيدًا على الوصول.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `start-nasaem-local.bat` — build and start the local LAN shop system on Windows
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run test:nasaem` — build the API and run isolated local-database regression checks; does not touch shop data
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Replit preview uses `DATABASE_URL` and Clerk; local shop mode uses PGlite in `nasaem-data/` and does not need those services.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM in hosted preview; embedded PGlite + Drizzle ORM in local shop mode
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/nasaem-inventory` — responsive RTL React app, Clerk sign-in for hosted preview, local sign-in and camera barcode capture for shop mode
- `artifacts/api-server` — API routes, hosted Clerk proxy, local shop server and PGlite database
- `lib/api-spec/openapi.yaml` — API contract; regenerate clients after changes
- `lib/db/src/schema` — PostgreSQL-compatible schema for catalog, staff, sales, supplies, and local credentials
- `artifacts/nasaem-inventory/src/index.css` — app theme tokens

## Architecture decisions

- The user's current requirement is internet access from any Wi-Fi or mobile network, not shop-LAN-only access. Treat the hosted system as the primary way to use Nasaem; retain sign-in and staff permissions. Local shop mode is optional, not an access requirement.
- Hosted preview uses Clerk and PostgreSQL. Shop mode uses local password accounts and embedded PGlite; its data stays on the shop computer and is shared with devices on that Wi-Fi.
- The first authenticated account in each environment becomes the owner; later sign-ups stay inactive until an owner approves them.
- The local launcher builds a single-origin LAN app. Its camera scanner captures a barcode image for decoding because browser live-camera streaming requires HTTPS on mobile LAN addresses.
- The shop computer must stay on for other devices to use the local system. Keep `nasaem-data/` and do not forward its port from the router to the public internet.
- Product deletion archives the product so invoice history remains intact.
- Sale deletion is an audited cancellation, limited to owners/managers, with a required reason. Restore stock exactly once inside the sale-lock transaction and exclude cancelled sales from financial totals; keep historical line prices and invoices. This prevents accidental data loss or double returns.
- Sales and supplies update stock in database transactions; backup restore merges records and does not delete records absent from the backup.

## Product

The app supports product CRUD, stock adjustments and low-stock alerts, sales with automatic stock deduction and printable invoices, supply intake, estimated sales profit, staff roles, and JSON backup/restore.
In shop mode, barcode values are saved in the product's SKU field and scanned during sales; other devices refresh shared records every five seconds.

## User preferences

- Brand identity: red, green, yellow, and white; a distinctive N mark; Arabic store name “نسايم للمنظفات”.

## Gotchas

- Keep the `/healthz` API route public; all shop data routes require a signed-in, active staff profile.
- Clerk development and production accounts are separate. Bootstrap the owner account in each environment before inviting staff to use the app.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
