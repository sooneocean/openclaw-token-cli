# System Architecture — OpenClaw Token

> Auto-generated on 2026-03-15 by `/architecture`

## System Overview

OpenClaw Token is a **credit-based API proxy system** that lets AI agents use provisioned API keys to access LLM providers (OpenAI-compatible). Users pre-purchase credits, create rate-limited provisioned keys, and agents use those keys through a proxy that automatically tracks token usage and deducts credits.

The system consists of two repositories:

- **openclaw-token-cli** — CLI client for account management, credit purchases, key provisioning, and OpenClaw integration
- **openclaw-token-server** — Hono + Bun + PostgreSQL backend with API proxy for LLM request forwarding

## Tech Stack

### CLI (openclaw-token-cli)

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Runtime | Node.js | 18+ | CLI execution |
| Language | TypeScript | 5.x | Type safety |
| CLI Framework | Commander.js | ^14 | Command parsing |
| HTTP Client | Axios | ^1.13 | API requests |
| Validation | Zod | ^4.3 | Config schema validation |
| Output | chalk, ora, cli-table3 | latest | Terminal formatting |
| Build | tsup | latest | Bundle for distribution |
| Test | Vitest | ^4.1 | Unit + integration + contract tests |

### Server (openclaw-token-server)

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Runtime | Bun | 1.x | Server execution |
| Language | TypeScript | 5.x | Type safety |
| Web Framework | Hono | ^4.6 | HTTP routing + middleware |
| Database | PostgreSQL | 16 | Persistent storage |
| DB Client | postgres (porsager) | ^3.4 | Tagged template SQL |
| Container | Docker + Docker Compose | latest | One-command dev environment |

## Directory Structure

### CLI

```
src/
├── index.ts                    # Entry point — Commander program setup
├── api/
│   ├── client.ts               # Axios client with mock adapter
│   ├── endpoints.ts            # API path constants
│   └── types.ts                # Response type definitions (single source of truth)
├── commands/
│   ├── auth.ts                 # auth register/login/logout/whoami/rotate
│   ├── credits.ts              # credits balance/buy/history/auto-topup
│   ├── keys.ts                 # keys create/list/info/update/revoke/rotate
│   ├── integrate.ts            # integrate/--remove/--status (OpenClaw fallback)
│   ├── profile.ts              # profile create/switch/list/current/delete
│   ├── config.ts               # config show/path/validate
│   ├── audit.ts                # audit log viewer
│   └── completion.ts           # shell completion scripts
├── services/
│   ├── base.service.ts         # Base service with API client creation
│   ├── auth.service.ts         # Auth business logic
│   ├── credits.service.ts      # Credits business logic
│   ├── keys.service.ts         # Keys business logic
│   ├── oauth.service.ts        # GitHub OAuth Device Flow
│   └── integrate.service.ts    # OpenClaw config integration
├── config/
│   ├── manager.ts              # ConfigManager — read/write/resolve + profile management
│   ├── paths.ts                # File path resolution (profiles dir, active profile)
│   └── schema.ts               # Zod config schema
├── mock/
│   ├── handler.ts              # MockRouter — in-memory route matching
│   ├── store.ts                # MockStore — in-memory state + token-email mapping
│   ├── utils.ts                # Shared extractToken/requireValidToken
│   ├── index.ts                # Handler registration bootstrap
│   └── handlers/
│       ├── auth.mock.ts        # Auth mock endpoints
│       ├── credits.mock.ts     # Credits mock endpoints
│       ├── keys.mock.ts        # Keys mock endpoints
│       └── oauth.mock.ts       # OAuth mock endpoints
├── errors/
│   ├── base.ts                 # CLIError class
│   ├── api.ts                  # mapApiError — HTTP status to CLI error
│   └── messages.ts             # User-facing error messages
├── output/
│   ├── formatter.ts            # JSON/text output formatting
│   ├── spinner.ts              # ora spinner wrapper
│   └── table.ts                # cli-table3 wrapper
├── utils/
│   ├── auth-guard.ts           # requireAuth helper
│   ├── fs.ts                   # atomicWrite
│   ├── redact.ts               # Secret redaction
│   ├── sleep.ts                # Injectable sleep (for testing)
│   └── validation.ts           # Input validators
└── audit/
    └── logger.ts               # Audit log file writer

tests/
├── unit/                       # Unit tests (mock handlers, services, utils)
├── integration/                # Integration tests (CLI services + mock backend)
└── contract/                   # Contract tests (mock vs real server parity)
    ├── harness/client.ts       # ContractClient — MockClient + RealClient
    ├── helpers/                # Assertions + fixtures
    └── scenarios/              # Auth, credits, keys, errors, OAuth, idempotency
```

### Server

```
src/
├── index.ts                    # Entry point — DB connect + migrate + serve
├── app.ts                      # Hono app — route mounting + security headers
├── config.ts                   # Environment config (lazy getters)
├── errors.ts                   # AppError class
├── db/
│   ├── client.ts               # PostgreSQL client (porsager/postgres)
│   ├── migrate.ts              # Auto-migration runner
│   └── migrations/
│       ├── 001_initial.sql     # Users, keys, credits, transactions, OAuth
│       ├── 002_usage_logs.sql  # Proxy usage tracking
│       └── 003_auto_topup_type.sql  # Transaction type constraint update
├── middleware/
│   ├── auth.ts                 # Management key auth (sk-mgmt-*)
│   ├── proxy-auth.ts           # Provisioned key auth (sk-prov-*) + rate limiting
│   └── error.ts                # Global error handler
├── routes/
│   ├── auth.ts                 # POST register/login/rotate, GET me
│   ├── keys.ts                 # CRUD + rotate provisioned keys
│   ├── credits.ts              # Balance, purchase, history, auto-topup
│   ├── oauth.ts                # GitHub Device Flow (device/code, device/token, userinfo)
│   └── proxy.ts                # POST /v1/chat/completions — LLM proxy
└── utils/
    ├── token.ts                # Key generation + hashing
    ├── password.ts             # Bcrypt hash/verify
    ├── pricing.ts              # Model pricing table + cost calculation
    └── usage.ts                # Usage recording (PostgreSQL transaction)

tests/
├── setup.ts                    # Test DB setup/teardown
├── unit/routes/                # Route unit tests
└── integration/                # Full integration tests (auth, keys, credits, OAuth, proxy)
```

## Layered Architecture

### CLI Layers

```
┌─────────────────────────────────────────────┐
│  Commands (Commander.js)                     │  User interaction, argument parsing
├─────────────────────────────────────────────┤
│  Services                                    │  Business logic, error handling
├─────────────────────────────────────────────┤
│  API Client (Axios)                          │  HTTP requests, mock adapter
├──────────────────────┬──────────────────────┤
│  Mock Backend        │  Real Server          │  Interchangeable via --mock flag
│  (MockRouter)        │  (HTTP)               │
└──────────────────────┴──────────────────────┘
```

### Server Layers

```
┌─────────────────────────────────────────────┐
│  Hono Routes                                 │  HTTP endpoints, request parsing
├─────────────────────────────────────────────┤
│  Middleware                                  │  Auth (mgmt key / prov key), error handling
├─────────────────────────────────────────────┤
│  Utils / Services                            │  Pricing, usage recording, token gen
├─────────────────────────────────────────────┤
│  PostgreSQL (porsager/postgres)              │  7 tables, tagged template queries
└─────────────────────────────────────────────┘
```

## Core Features

| # | Feature | CLI Module | Server Route | Description |
|---|---------|-----------|--------------|-------------|
| 1 | Account Auth | `commands/auth.ts` | `routes/auth.ts` | Register, login (email+password), whoami, logout |
| 2 | GitHub OAuth | `services/oauth.service.ts` | `routes/oauth.ts` | Device Flow login, account merge |
| 3 | Key Rotation | `commands/auth.ts`, `commands/keys.ts` | `routes/auth.ts`, `routes/keys.ts` | Rotate management + provisioned keys, old keys immediately invalid |
| 4 | Credits | `commands/credits.ts` | `routes/credits.ts` | Balance, purchase (with platform fee), history, auto-topup config |
| 5 | Key Management | `commands/keys.ts` | `routes/keys.ts` | CRUD provisioned keys with credit limits |
| 6 | OpenClaw Integration | `commands/integrate.ts` | — | Inject provisioned key into OpenClaw fallback chain |
| 7 | **API Proxy** | — | `routes/proxy.ts` | Forward LLM requests via provisioned keys, calculate usage, deduct credits |
| 8 | Rate Limiting | — | `middleware/proxy-auth.ts` | Period-based (daily/weekly/monthly) credit limit enforcement |
| 9 | Auto-topup | — | `routes/proxy.ts` | Auto-add credits when balance drops below threshold |
| 10 | Multi-Profile | `commands/profile.ts` | — | Multiple CLI profiles (dev/staging/prod) |

## API / Route Overview

### Management API (Authorization: Bearer sk-mgmt-*)

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/register | Create account |
| POST | /auth/login | Login with email/password |
| GET | /auth/me | Account info |
| POST | /auth/rotate | Rotate management key |
| POST | /keys | Create provisioned key |
| GET | /keys | List keys |
| GET | /keys/:hash | Key detail + usage stats |
| PATCH | /keys/:hash | Update key settings |
| DELETE | /keys/:hash | Revoke key |
| POST | /keys/:hash/rotate | Rotate key value |
| GET | /credits | Balance info |
| POST | /credits/purchase | Buy credits |
| GET | /credits/history | Transaction history |
| GET | /credits/auto-topup | Auto-topup config |
| PUT | /credits/auto-topup | Update auto-topup |

### OAuth API (No auth required)

| Method | Path | Description |
|--------|------|-------------|
| POST | /oauth/device/code | Start device flow |
| POST | /oauth/device/token | Poll for token |
| GET | /oauth/userinfo | Get user info + management key |

### Proxy API (Authorization: Bearer sk-prov-*)

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/chat/completions | Forward to upstream LLM |

## Data Flow

### Proxy Request Flow (Core Value)

```
Agent (sk-prov-xxx)
    │
    ▼
POST /v1/chat/completions
    │
    ├── [proxy-auth MW] Validate provisioned key
    │   ├── Check: exists? revoked? disabled?
    │   ├── Check: period-based credit limit
    │   └── Check: account credits remaining > 0
    │
    ├── [auto-topup] If remaining <= threshold → add credits
    │
    ├── [proxy route] Forward to upstream LLM
    │   ├── Replace Authorization with UPSTREAM_API_KEY
    │   └── Passthrough request body unchanged
    │
    ├── [usage] Extract response.usage tokens
    │   ├── Calculate cost (model pricing table)
    │   ├── Update provisioned_keys.usage
    │   ├── Update credit_balances.total_usage
    │   └── Insert usage_logs record
    │   (all in one PostgreSQL transaction)
    │
    └── Return upstream response to agent
```

## External Integrations

| Service | Purpose | Integration |
|---------|---------|-------------|
| GitHub OAuth | Device Flow login | REST API (device/code + device/token + user endpoint) |
| OpenAI API | LLM proxy upstream | HTTP forwarding via fetch |
| OpenClaw CLI | Fallback chain config | Direct file manipulation (openclaw.json) |

## Database Schema (Server)

| Table | Purpose |
|-------|---------|
| `users` | Account info (email, password hash, plan, github_id) |
| `management_keys` | Auth tokens (sk-mgmt-*), revocation tracking |
| `provisioned_keys` | API keys (sk-prov-*), credit limits, usage tracking |
| `credit_balances` | Per-user credits + auto-topup config |
| `credit_transactions` | Purchase/usage/refund/auto-topup records |
| `oauth_sessions` | GitHub Device Flow state |
| `usage_logs` | Per-request proxy usage (model, tokens, cost) |

## Deployment Architecture

### Docker Compose (Development)

```
docker-compose.yml
├── postgres (PostgreSQL 16 Alpine)
│   ├── Port: 5432
│   └── Volume: pgdata
└── server (Bun + Hono)
    ├── Port: 3000
    ├── Auto-migration on startup
    └── Depends on postgres (healthcheck)
```

### Production (Not yet deployed)

Planned: Fly.io or Railway with managed PostgreSQL.

## Development Guide

### CLI Development

```bash
cd token-cli
npm install
npm test                      # 167 unit + integration tests
npm run test:contract:mock    # 38 contract tests (mock mode)
npm run typecheck             # TypeScript check
```

### Server Development

```bash
cd openclaw-token-server
docker compose up             # One-command: PostgreSQL + server
# or manually:
bun install
bun run dev                   # Hot reload on port 3000
bun test                      # 60 tests (requires PostgreSQL)
```

### Test Summary

| Suite | Count | Framework | Description |
|-------|-------|-----------|-------------|
| CLI Unit + Integration | 173 | Vitest | Mock backend, services, utils |
| CLI Contract | 38 | Vitest | Mock vs real server parity |
| Server Integration | 60 | Bun test | Full DB integration |
| **Total** | **265** | | |
