# OpenClaw Token CLI

CLI client for the OpenClaw Token proxy. Pre-purchase credits, provision isolated API keys with spend limits, and inject the proxy as a fallback token provider into your OpenClaw config.

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

| Command | Description |
|---------|-------------|
| `auth register` | Create a new account |
| `auth login` | Log in (email/password or `--github` for OAuth) |
| `auth logout` | Clear local credentials |
| `auth whoami` | Show current account info |
| `auth rotate` | Rotate management key (old key immediately invalidated) |

### credits

| Command | Description |
|---------|-------------|
| `credits balance` | Show total, used, and remaining credits |
| `credits buy --amount <USD>` | Purchase credits (min $5, 5.5% fee) |
| `credits history` | List transactions (`--limit`, `--offset`, `--type`) |
| `credits auto-topup` | View/configure auto top-up (`--enable`, `--disable`, `--threshold`, `--amount`) |

### keys

| Command | Description |
|---------|-------------|
| `keys create --name <name>` | Provision a new API key (`--limit`, `--limit-reset`, `--expires`) |
| `keys list` | List all keys (`--sort <field>`, `--filter <expr>`) |
| `keys info <hash>` | Detailed usage breakdown |
| `keys update <hash>` | Modify settings (`--limit`, `--disabled`, `--enabled`) |
| `keys revoke <hash>` | Permanently revoke a key |
| `keys revoke-all` | Revoke all active keys |
| `keys rotate <hash>` | Rotate key value (hash stays the same) |
| `keys export` | Export keys to JSON/CSV (`--format`, `--output`) |
| `keys import <file>` | Batch create keys from JSON file |
| `keys usage <hash>` | Show usage (`--watch` for live monitoring, `--interval`) |

### integrate

| Command | Description |
|---------|-------------|
| `integrate` | Inject as fallback provider in OpenClaw config |
| `integrate --status` | Show integration status |
| `integrate --remove` | Remove integration |

### profile

Manage multiple accounts/servers with named profiles.

| Command | Description |
|---------|-------------|
| `profile create <name>` | Create a new profile |
| `profile switch <name>` | Switch active profile |
| `profile list` | List all profiles |
| `profile current` | Show active profile |
| `profile delete <name>` | Delete a profile |

### config

| Command | Description |
|---------|-------------|
| `config get <key>` | Read a config value |
| `config set <key> <value>` | Write a config value |
| `config list` | Show all config entries |

### audit

| Command | Description |
|---------|-------------|
| `audit show` | Show recent operation log (`--limit`) |
| `audit clear` | Clear audit log |

### completion

| Command | Description |
|---------|-------------|
| `completion bash` | Output bash completion script |
| `completion zsh` | Output zsh completion script |

Install completions:

```bash
# Bash
eval "$(openclaw-token completion bash)"

# Zsh
eval "$(openclaw-token completion zsh)"
```

## Global Flags

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON (useful for scripting) |
| `--mock` | Use in-memory mock backend |
| `--profile <name>` | Use a specific profile |
| `--no-color` | Disable colored output |
| `--verbose` | Print API requests for debugging |
| `--version` | Print CLI version |
| `--help` | Print help |

Global flags go before the subcommand:

```bash
openclaw-token --json credits balance
openclaw-token --profile work keys list
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENCLAW_TOKEN_KEY` | Management API key (must start with `sk-mgmt-`) |
| `OPENCLAW_TOKEN_API_BASE` | Override API base URL |
| `OPENCLAW_TOKEN_CONFIG_DIR` | Override config directory |
| `OPENCLAW_TOKEN_MOCK=1` | Enable mock mode globally |
| `NO_COLOR` | Disable colored output |

## Mock Mode

Mock mode runs entirely in-process with no real API calls. Data resets on each invocation.

```bash
# Via flag
openclaw-token --mock auth register

# Via environment variable
export OPENCLAW_TOKEN_MOCK=1
openclaw-token credits balance
```

**Demo account** (pre-seeded in mock mode):

| Field | Value |
|-------|-------|
| Email | `demo@openclaw.dev` |
| Password | `Demo1234!` |
| Credits | $100.00 |

## Error Handling

- Network errors and 5xx responses automatically retry up to 3 times with exponential backoff
- All errors include actionable suggestions (e.g. "Run: openclaw-token auth login")
- Request timeout: 15 seconds

## Security

- Config files are written with `0o600` permissions (owner-only)
- Sensitive values are redacted in verbose output
- `OPENCLAW_TOKEN_KEY` is validated on startup

## Development

```bash
npm install

# Run from source
npm run dev -- --mock auth whoami

# Run tests (173 tests)
npm test

# Type check
npm run typecheck

# Build
npm run build
```

## License

[MIT](LICENSE)
