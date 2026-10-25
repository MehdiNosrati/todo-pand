# Todo Pand (`todo-pand`)

[![Built on Pand](https://img.shields.io/badge/built%20on-Pand%20Platform-6366f1?style=for-the-badge&logo=speedtest)](https://github.com/MehdiNosrati/pand)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **The Official Reference & Showcase Application for the [Pand](https://github.com/MehdiNosrati/pand) Agent-Native Application Platform.**

**Todo Pand** is a production-grade, full-stack Task & Project Management workspace designed to demonstrate the full power and architectural purity of the **Pand** platform. Built from scratch with Pand generators and contract-first tooling, it showcases microservice isolation, OpenAPI 3.1 contract compilation, zero-drift typed SDK generation, PostgreSQL schema evolution via Drizzle, guest-to-account state sync, and real-time Admin operations.

---

## 🌟 Key Highlights & Showcase Features

- **Built on [Pand](https://github.com/MehdiNosrati/pand)**: Scaffolding, microservices, OpenAPI contracts, SDK generation, and lint/type/test verification orchestrated via the `pand` CLI.
- **🔒 True Multi-Tenant Isolation**: Strict user-level data ownership (`ownerId`) enforced on both `Project` and `Todo` tables. All queries are scoped to the authenticated identity (`c.get("actor")!.sub`) propagated by the API Gateway via short-lived internal JWTs.
- **⚡ Anonymous Guest Workspace**: Instant zero-login productivity. Unauthenticated visitors enjoy a fully functional, sample-seeded workspace stored locally in browser `localStorage`.
- **🔄 "Account Wins" Guest Migration**: When guests create an account or sign into a new workspace, `POST /todos/import-guest` automatically migrates local projects and tasks into PostgreSQL. When signing into an existing account with data, existing data is preserved without overwriting guest storage.
- **📋 Dual View Modes (Kanban & List)**: Seamlessly toggle between grouped status boards (`To Do`, `In Progress`, `Done`) and searchable, filterable tables.
- **🎨 Modern UI with Tailwind CSS v4**: Built using React 19, `@tanstack/react-query`, Lucide icons, and custom keyboard-accessible dropdown controls with priority color indicators (`Urgent`, `High`, `Medium`, `Low`).
- **🛠️ Dedicated Pand Admin Console**: Built-in reactive Admin app on port `4903` providing dynamic CRUD management across registered entities and Better Auth user administration (RBAC, ban/unban, promotion).

---

## 🏗️ Architecture at a Glance

```
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│           apps/web (:4902)           │       │          apps/admin (:4903)          │
│ React 19 • Tailwind v4 • TanStack Q │       │ Pand Admin Console • Entity / User   │
└──────────────────┬───────────────────┘       └──────────────────┬───────────────────┘
                   │                                              │
                   └──────────────────────┬───────────────────────┘
                                          ▼
                               ┌─────────────────────┐
                               │   @todo-pand/sdk    │ (Generated from OpenAPI 3.1)
                               └──────────┬──────────┘
                                          ▼
                      ┌───────────────────────────────────────┐
                      │        services/gateway (:4901)       │
                      │ Better Auth • Proxy • CORS • JWT Mint │
                      └───────────────────┬───────────────────┘
                                          │ x-pand-internal-token
                                          ▼
                      ┌───────────────────────────────────────┐
                      │         services/core (:4910)         │
                      │ OpenAPIHono • Projects & Todos CRUD   │
                      │ Owner-Scoped Queries • /todos/seed    │
                      └───────────────────┬───────────────────┘
                                          │ pgSchema("core")
                                          ▼
                      ┌───────────────────────────────────────┐
                      │    PostgreSQL 16 (Port 4032 / 4932)   │
                      │ auth.* (Better Auth) • core.* (Drizzle)│
                      └───────────────────────────────────────┘
```

### Core Invariants Demonstrated

1. **Zero-Drift Contracts**: `services/core` defines routes using `@hono/zod-openapi`. Running `pand sdk gen` automatically updates `packages/contracts/openapi.json` and compiles the end-to-end typed client in `@todo-pand/sdk`.
2. **Deterministic Service Ports**: Ports are deterministically assigned via `pand.config.ts` (`gateway: 4901`, `core: 4910`, `web: 4902`, `admin: 4903`, `db: 4932`).
3. **Safe Database Migrations**: Per-service Drizzle migration SQL files in `services/core/drizzle/` ensure repeatable, drift-free migrations with `pand db migrate`.
4. **5-Stage Verification Gate**: Every task passes `pand check` (Biome lint/format, TypeScript typecheck across all workspaces, OpenAPI drift check, SDK drift check, and the Vitest test suite).

---

## 📁 Repository Structure

```text
todo-pand/
├── pand.config.ts               # Single source of truth for services, auth & ports
├── AGENTS.md                    # Golden rules & runbooks for autonomous AI agents
├── packages/
│   ├── contracts/               # Merged OpenAPI 3.1 specification (openapi.json)
│   └── sdk/                     # Auto-generated TypeScript SDK client (@todo-pand/sdk)
├── services/
│   ├── gateway/                 # Public reverse proxy, Better Auth handler & JWT signer
│   └── core/                    # Core microservice owning `core.projects` & `core.todos`
│       ├── src/db/schema/       # Drizzle schema definitions with ownerId columns
│       ├── src/routes/          # OpenAPIHono routes (CRUD, stats, bulk, import-guest)
│       ├── drizzle/             # Generated SQL migration history
│       └── test/                # Vitest multi-tenant data isolation tests
└── apps/
    ├── web/                     # Full-featured consumer web app (React 19 + Tailwind v4)
    └── admin/                   # Reactive admin dashboard powered by @pand/admin-ui
```

---

## ⚡ Quickstart

### Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** >= 9.0.0
- **Pand CLI**: `pnpm add -g @pand/cli` (or cloned from [Pand](https://github.com/MehdiNosrati/pand))
- **PostgreSQL** running locally (or managed automatically via `pand dev`)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/MehdiNosrati/todo-pand.git
cd todo-pand
pnpm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

### 3. Start Development Mode

```bash
pand dev
```

`pand dev` will automatically:
- Spin up the local database container and apply pending migrations (`pand db migrate`).
- Generate and verify client SDKs (`pand sdk gen`).
- Start the API Gateway (`:4901`), Core Service (`:4910`), Web App (`:4902`), and Admin App (`:4903`) with hot-reload.

### 4. Available Surfaces & Endpoints

| Service / Surface | URL | Description |
| :--- | :--- | :--- |
| **Web Application** | `http://localhost:4902` | Main Todo & Project workspace (supports Guest & Auth modes) |
| **Admin Console** | `http://localhost:4903` | Admin dashboard for entity data & Better Auth user management |
| **API Gateway** | `http://localhost:4901` | Public entry point (`/api/auth/*`, `/api/v1/core/*`, `/api/admin/meta`) |
| **OpenAPI Spec** | `http://localhost:4901/api/openapi.json` | Merged OpenAPI 3.1 contract for all services |
| **Core Microservice** | `http://localhost:4910` | Internal backend service for tasks & projects |

---

## 🧪 Testing & Verification

Todo Pand features a comprehensive Vitest suite covering CRUD operations, custom bulk endpoints, stats aggregations, guest migration logic, and multi-tenant data isolation:

```bash
# Run the complete Pand verification gate (lint + typecheck + drift check + tests)
pand check

# Or run tests directly within the core microservice
pnpm --filter @todo-pand/core test
```

Multi-tenant tests verify that:
- User Alpha cannot list, retrieve, patch, or delete User Beta's projects or todos (returns `404 Not Found`).
- Guest workspaces correctly import into empty user accounts and skip imports once an account has data ("account wins").
- Aggregated task stats (`/todos/stats`) are strictly isolated to the caller.

---

## 🔗 The Pand Ecosystem

- **Pand Framework**: [github.com/MehdiNosrati/pand](https://github.com/MehdiNosrati/pand)
- **Official Documentation**: [mahdins.dev/pand](https://mahdins.dev/pand/)
- **Author**: [Mehdi Nosrati](https://github.com/MehdiNosrati)

---

## 📄 License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
