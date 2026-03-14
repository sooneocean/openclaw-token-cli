# OpenClaw Token CLI

## Overview

Credit-based API proxy CLI client for OpenClaw. Pre-purchase credits, provision isolated API keys with optional spend limits, and inject the proxy as a fallback token provider into your OpenClaw config.

## Installation

```bash
npm install -g openclaw-token
```

Requires Node.js >= 18.

## Quick Start

```bash
# 1. Create an account
openclaw-token auth register

# 2. Buy credits (minimum $5.00; 5.5% platform fee applies)
openclaw-token credits buy --amount 20

# 3. Provision an API key with a monthly $10 spend cap
openclaw-token keys create --name my-app --limit 10 --limit-reset monthly

# 4. Inject into OpenClaw as a fallback token provider
openclaw-token integrate
```

## Commands

### auth

```
openclaw-token auth register          Register a new account
openclaw-token auth login             Login to an existing account
openclaw-token auth logout            Clear local credentials
openclaw-token auth whoami            Show current account info (email, plan, balance, key count)
```

### credits

```
openclaw-token credits balance        Show total, used, and remaining credits
openclaw-token credits buy            Purchase credits
  --amount <number>                   Amount in USD (required, minimum $5.00)
  --yes                               Skip confirmation prompt

openclaw-token credits history        List transactions
  --limit <number>                    Items per page (default: 20)
  --offset <number>                   Pagination offset (default: 0)
  --type <type>                       Filter: purchase | usage | refund

openclaw-token credits auto-topup     View or configure automatic top-up
  --enable                            Enable auto top-up
  --disable                           Disable auto top-up
  --threshold <number>                Trigger when balance drops below this USD amount
  --amount <number>                   Amount to top up in USD
```

### keys

```
openclaw-token keys create            Provision a new API key (shown once — save it immediately)
  --name <name>                       Key label (required)
  --limit <number>                    Credit limit in USD
  --limit-reset <frequency>           Reset period: daily | weekly | monthly
  --expires <date>                    Expiry in ISO 8601 format

openclaw-token keys list              List all provisioned keys

openclaw-token keys info <hash>       Detailed usage breakdown by period and model

openclaw-token keys update <hash>     Modify key settings
  --limit <number>                    New credit limit
  --limit-reset <frequency>           New reset period
  --disabled                          Disable key
  --enabled                           Re-enable key

openclaw-token keys revoke <hash>     Permanently revoke a key
  --yes                               Skip confirmation prompt
```

### integrate

```
openclaw-token integrate              Inject OpenClaw Token as a fallback provider in OpenClaw config
openclaw-token integrate --status     Show current integration status
openclaw-token integrate --remove     Remove the integration from OpenClaw config
```

## Global Flags

| Flag | Description |
|------|-------------|
| `--json` | Print output as JSON (useful for scripting) |
| `--mock` | Use mock backend; no real API calls are made |
| `--no-color` | Disable colored output |
| `--verbose` | Print outgoing API requests for debugging |
| `--version` | Print CLI version |
| `--help` | Print help for a command |

Global flags must be placed before the subcommand:

```bash
openclaw-token --json credits balance
openclaw-token --verbose keys list
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENCLAW_TOKEN_KEY` | Management API key (alternative to storing credentials on disk) |
| `OPENCLAW_TOKEN_API_BASE` | Override the API base URL |
| `OPENCLAW_TOKEN_CONFIG_DIR` | Override the config directory path |
| `OPENCLAW_TOKEN_MOCK=1` | Enable mock mode without passing `--mock` each time |
| `NO_COLOR` | Disable colored output (standard convention) |

## Mock Mode

Mock mode runs entirely in-process with no real API calls. All data is stored in memory and reset on each process invocation.

### Enable Mock Mode

```bash
# Via flag (before subcommand)
openclaw-token --mock auth register

# Via environment variable (persists across invocations in the same shell session)
export OPENCLAW_TOKEN_MOCK=1
openclaw-token credits balance
```

### Pre-seeded Demo Account

When mock mode is active, a demo account is available out of the box:

| Field | Value |
|-------|-------|
| Email | `demo@openclaw.dev` |
| Password | `Demo1234!` |
| Initial credits | $100.00 |

```bash
# Login with demo credentials
openclaw-token --mock auth login
# Email: demo@openclaw.dev
# Password: Demo1234!

# Check balance
openclaw-token --mock credits balance

# Create a key
openclaw-token --mock keys create --name test-key
```

### Mock Behavior Notes

- Any token in the format `sk-mgmt-<UUID>` is treated as valid and maps to the demo account
- Data does **not** persist between process invocations
- Idempotency keys are checked within a single process run
- The mock backend simulates all API endpoints including error cases

---

## Development

```bash
npm install

# Run directly from source (no build step needed)
npm run dev -- --mock auth whoami
npm run dev -- --mock credits balance

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck

# Build for production
npm run build
```

The compiled output lands in `dist/`. The package bin entry points to `dist/bin/openclaw-token.js`.
