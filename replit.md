# KisanSaathi Crop Advisory

KisanSaathi helps farmers manage fields and receive structured crop planning and plant-health guidance.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required secret: `SESSION_SECRET` and `GEMINI_API_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/agri-advisory/` — React/Vite farmer-facing app and responsive UI
- `artifacts/api-server/src/routes/app.ts` — authenticated REST routes and ownership checks
- `artifacts/api-server/src/services/ai.ts` — Gemini structured-output integration and retry handling
- `lib/db/src/schema/index.ts` — Drizzle schema for farmers, farms, advisories, and diagnostics
- `lib/api-spec/openapi.yaml` — source of truth for generated API hooks and Zod contracts

## Architecture decisions

- Cookie-based JWT sessions are used because the original product brief explicitly requires HTTP-only JWT cookies; the server uses the workspace session secret.
- Farm-scoped resources always filter by the authenticated farmer ID in the same query, so foreign IDs resolve as not found.
- Gemini is called server-side with JSON output mode, a 10-second timeout, and one retry; malformed output is never persisted.
- Archived farms are hidden from the active farm list while their advisory and diagnostic history remains readable.

## Product

- Public landing, registration, login, and profile management
- Farm create/edit/archive with soil and irrigation context
- Structured crop advisories with ranked crops, stage plans, risks, and confidence
- Structured pest/disease diagnostics with treatment and prevention guidance
- Dashboard summary and filterable combined history

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
