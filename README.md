# litellm-cc-statusline

A Claude Code status line for LiteLLM that displays your username, spending, and budget information.

![Status Line Example](https://img.shields.io/badge/matan.baruch-💰%24 22.9%2F%24100.00%20(22%25)-green)

## Output

```
matan.baruch | 💰$22.9/$100.00 (22%)
```

The status line changes color based on your budget usage:
- 🟢 **Green**: Less than 50% of budget used
- 🟡 **Yellow**: 50-80% of budget used
- 🔴 **Red**: More than 80% of budget used

## Installation

### Quick Install (recommended)

```bash
# Install globally
npm install -g litellm-cc-statusline

# Auto-configure Claude Code
litellm-cc-statusline --install
```

That's it! Restart Claude Code to see the status line.

### Via npx

No installation required, just configure Claude Code manually (see below).

## CLI Options

```
litellm-cc-statusline [OPTIONS]

OPTIONS
  --help, -h      Show help message
  --install       Install the status line in Claude Code settings
  --uninstall     Remove the status line from Claude Code settings
  --version, -v   Show version number
```

## Configuration

### 1. Set Environment Variables

Make sure you have these environment variables set:

```bash
export ANTHROPIC_BASE_URL=https://your-litellm-proxy.com
export ANTHROPIC_AUTH_TOKEN=sk-your-api-key-here
```

### 2. Configure Claude Code

#### Automatic (recommended)

```bash
litellm-cc-statusline --install
```

#### Manual

Add the following to your `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "litellm-cc-statusline",
    "padding": 0
  }
}
```

Or with npx (no global install needed):

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx litellm-cc-statusline",
    "padding": 0
  }
}
```

## LiteLLM API

This status line queries your LiteLLM instance's `/user/info` endpoint to retrieve:
- `user_id` / `user_email` / `username` - Your identifier
- `spend` - Current spending amount
- `max_budget` / `budget` - Your maximum budget

## Requirements

- Node.js >= 14.0.0
- LiteLLM instance with `/user/info` endpoint
- Valid API key with access to user info

## License

MIT
