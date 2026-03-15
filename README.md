# openclaw-token

> CLI client for the OpenClaw Token proxy — manage credits, provision API keys, and integrate with the OpenClaw fallback chain.

[![npm version](https://img.shields.io/npm/v/openclaw-token)](https://www.npmjs.com/package/openclaw-token)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ✨ Features

- 🔐 **Auth** — register, login (email/password or GitHub OAuth Device Flow), rotate management key
- 💳 **Credits** — check balance, purchase credits ($5 minimum, 5.5% fee), transaction history, auto top-up
- 🔑 **Provisioned keys** — create, list, update, rotate, revoke, bulk export/import, per-key spend limits with daily/weekly/monthly reset
- 📊 **Live usage monitoring** — `keys usage --watch` polls key stats in real time
- 🔗 **OpenClaw integration** — inject a provisioned key into the OpenClaw fallback chain with one command
- 👤 **Multi-profile** — manage multiple accounts or servers with named profiles
- 🛠️ **Scripting-friendly** — `--json` machine-readable output, `--mock` offline mode, `--verbose` debug logs
- 📋 **Audit log** — local audit trail of every CLI operation

---

## 🚀 Quick Start

```bash
npm install -g openclaw-token
```

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

---

## 📖 CLI Commands

### Global Flags

Global flags go **before** the subcommand:

```bash
openclaw-token --json credits balance
openclaw-token --profile work keys list
openclaw-token --mock --verbose auth whoami
```

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON (useful for scripting) |
| `--mock` | Use in-process mock backend (no network) |
| `--profile <name>` | Use a specific named profile |
| `--no-color` | Disable colored output |
| `--verbose` | Print API request/response details |
| `--version` | Print CLI version |
| `--help` | Print help |

---

### `auth` — Account Authentication

| Command | Description |
|---------|-------------|
| `auth register` | Create a new account |
| `auth login` | Log in with email/password |
| `auth login --github` | Log in via GitHub OAuth Device Flow |
| `auth logout` | Clear local credentials |
| `auth whoami` | Show current account info |
| `auth rotate [--yes]` | Rotate management key (old key immediately invalidated) |

```bash
openclaw-token auth login --github
openclaw-token auth rotate --yes   # skip confirmation
```

---

### `credits` — Credits Management

| Command | Description |
|---------|-------------|
| `credits balance` | Show total, used, and remaining credits |
| `credits buy --amount <USD>` | Purchase credits (min $5, 5.5% fee) |
| `credits history` | List transactions (`--limit`, `--offset`, `--type`) |
| `credits auto-topup` | View or configure auto top-up |

```bash
openclaw-token credits buy --amount 50 --yes
openclaw-token credits history --limit 50 --type purchase
openclaw-token credits auto-topup --enable --threshold 5 --amount 25
openclaw-token credits auto-topup --disable
```

---

### `keys` — Provisioned API Keys

| Command | Description |
|---------|-------------|
| `keys create --name <name>` | Provision a new API key |
| `keys list` | List all keys (`--sort <field>`, `--filter <expr>`) |
| `keys info <hash>` | Detailed usage breakdown (daily/weekly/monthly, per-model) |
| `keys update <hash>` | Modify settings (`--limit`, `--limit-reset`, `--disabled`, `--enabled`) |
| `keys rotate <hash> [--yes]` | Rotate key value (hash and settings preserved) |
| `keys revoke <hash> [--yes]` | Permanently revoke a key |
| `keys revoke-all [--yes]` | Revoke all active keys |
| `keys export` | Export keys to JSON or CSV (`--format`, `--output`) |
| `keys import <file>` | Batch create keys from a JSON file |
| `keys usage <hash>` | Show usage snapshot (`--watch`, `--interval`) |

```bash
# Create with spend limit
openclaw-token keys create --name prod --limit 50 --limit-reset monthly --expires 2026-12-31

# Filter and sort
openclaw-token keys list --filter "usage>10" --sort -usage

# Live monitoring
openclaw-token keys usage <hash> --watch --interval 5

# Bulk export
openclaw-token keys export --format csv --output keys.csv
```

**Filter expressions for `keys list`:**

| Expression | Meaning |
|------------|---------|
| `active` | Keys not disabled |
| `disabled` | Disabled keys only |
| `usage>N` | Usage exceeds N USD |
| `usage<=N` | Usage at most N USD |

---

### `integrate` — OpenClaw Integration

| Command | Description |
|---------|-------------|
| `integrate` | Inject provisioned key into OpenClaw fallback chain |
| `integrate --status` | Show current integration status |
| `integrate --remove` | Remove integration |

---

### `profile` — Multi-Profile Management

| Command | Description |
|---------|-------------|
| `profile create <name>` | Create a new profile |
| `profile switch <name>` | Switch active profile |
| `profile list` | List all profiles (active profile marked with `*`) |
| `profile current` | Show active profile name |
| `profile delete <name>` | Delete a profile |

---

### `config` — Per-Profile Config

| Command | Description |
|---------|-------------|
| `config get <key>` | Read a config value |
| `config set <key> <value>` | Write a config value |
| `config show` | Show full config for active profile |
| `config reset` | Reset config to defaults |

---

### `audit` — Audit Log

| Command | Description |
|---------|-------------|
| `audit show [--limit N]` | Show recent operation log |
| `audit clear` | Clear audit log |

---

### `completion` — Shell Completion

```bash
# Bash
eval "$(openclaw-token completion bash)"
# Or persist it:
openclaw-token completion bash >> ~/.bashrc

# Zsh
eval "$(openclaw-token completion zsh)"

# Fish
openclaw-token completion fish >> ~/.config/fish/completions/openclaw-token.fish
```

---

## ⚙️ Configuration

### Config File Location

```
~/.openclaw-token/
├── current_profile           # name of the active profile
├── audit.log                 # local audit trail
└── profiles/
    ├── default/
    │   └── config.json
    └── staging/
        └── config.json
```

`config.json` fields:

```json
{
  "management_key": "sk-mgmt-...",
  "api_base": "https://proxy.openclaw-token.dev/v1",
  "email": "you@example.com"
}
```

Config files are written with `0o600` (owner-read-write only).

### Environment Variables

Environment variables override values in the config file.

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCLAW_TOKEN_KEY` | Management key (must start with `sk-mgmt-`) | — |
| `OPENCLAW_TOKEN_API_BASE` | Override API base URL | `https://proxy.openclaw-token.dev/v1` |
| `OPENCLAW_TOKEN_CONFIG_DIR` | Override config directory | `~/.openclaw-token` |
| `OPENCLAW_TOKEN_PROFILE` | Active profile name | `default` |
| `OPENCLAW_TOKEN_MOCK=1` | Enable mock mode globally | — |
| `NO_COLOR` | Disable colored output | — |

---

## 🧪 Mock Mode

Mock mode runs entirely in-process with no real API calls. Useful for CI, demos, and offline development.

```bash
openclaw-token --mock auth register
export OPENCLAW_TOKEN_MOCK=1 && openclaw-token credits balance
```

Pre-seeded demo account in mock mode:

| Field | Value |
|-------|-------|
| Email | `demo@openclaw.dev` |
| Password | `Demo1234!` |
| Credits | $100.00 |

---

## 🔧 Development

**Requirements:** Node.js ≥ 18

```bash
git clone https://github.com/openclaw/openclaw-token-cli
cd openclaw-token-cli
npm install

# Run from source (no build step)
npm run dev -- --mock auth whoami

# Type check
npm run typecheck

# Build distributable
npm run build
```

### Testing

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Contract tests — mock backend (no server needed)
npm run test:contract:mock

# Contract tests — real server (requires running openclaw-token-server)
npm run test:contract:real

# Custom server URL
CONTRACT_TEST_BASE_URL=http://my-server:3000 npm run test:contract:real
```

---

## 🏗️ Architecture

```
src/
├── commands/      # Commander subcommands (auth, credits, keys, integrate, …)
├── services/      # Business logic per domain (auth, credits, keys, integrate, oauth)
├── api/           # Axios HTTP client, endpoint definitions, response types
├── mock/          # In-process mock backend (handlers, store, router)
├── config/        # Config manager, path resolution, zod schema
├── output/        # Formatter, spinner (ora), table (cli-table3)
├── errors/        # Typed error hierarchy with actionable messages
├── audit/         # Local audit logger
└── utils/         # auth-guard, atomic fs writes, redact, validation, sleep
```

The `--mock` flag swaps the real HTTP client for an in-process mock that mirrors the server's API contract exactly, enabling full offline development and contract testing without a running server.

---

## 🔒 Security

- Config files written with `0o600` permissions (owner-only)
- Sensitive values (keys, tokens) are redacted in `--verbose` output
- Network errors and 5xx responses automatically retry up to 3 times with exponential backoff
- Request timeout: 15 seconds

---

## 📄 License

[MIT](LICENSE)
