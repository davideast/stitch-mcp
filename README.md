# Stitch MCP

> Stitch MCP OAuth setup assistant - automates Google Cloud authentication for Stitch API

## Installation

```bash
npx @_davideast/stitch-mcp init
```

## Commands

### `init`

Initialize authentication and configure your MCP client for Stitch API.

```bash
npx @_davideast/stitch-mcp init

# Options:
#   --local    Install gcloud locally to project (default: user home)
#   --staging  Use staging Stitch API endpoint
```

**What it does:**

1. **MCP Client Selection** - Choose your client (Antigravity, VSCode, Cursor, Claude Code, or Gemini CLI)
2. **gcloud Setup** - Automatically install Google Cloud CLI if needed
3. **Authentication** - Guide you through user and application credential auth
4. **Project Selection** - Interactive project picker with search
5. **Configuration** - Set up IAM roles and enable Stitch API
6. **Testing** - Verify API connectivity
7. **MCP Config** - Generate ready-to-use configuration for your client

### `doctor`

Verify your setup health and diagnose issues.

```bash
npx @_davideast/stitch-mcp doctor

# Options:
#   --staging  Test against staging endpoint
```

**Health checks:**
- ✔ Google Cloud CLI installation
- ✔ User authentication status
- ✔ Application credentials
- ✔ Active project configuration
- ✔ Stitch API connectivity

### `proxy`

Start the Stitch MCP proxy server. This command is typically configured as the entry point in your MCP client settings.

```bash
npx @_davideast/stitch-mcp proxy

# Options:
#   --transport <type>  Transport type: 'stdio' or 'sse' (default: 'stdio')
#   --port <number>     Port number (required for sse)
#   --debug             Enable debug logging to file
```

**Debug Mode:**

When the `--debug` flag is provided, the proxy server will write debug logs to `/tmp/stitch-proxy-debug.log`. This is useful for troubleshooting connection issues or inspecting the traffic between the client and the Stitch API.

## Platform Support

- ✅ macOS (ARM64 & Intel)
- ✅ Linux (x86_64)
- ✅ Windows (x86_64)

## How It Works

### gcloud Installation

The tool automatically manages Google Cloud CLI:

- **Prefers global installation**: If you already have `gcloud` installed globally, it will use it
- **Auto-installs to user home**: If not found, installs to `~/.stitch-mcp/google-cloud-sdk`
- **Isolated config**: Uses separate config directory to avoid conflicts with system gcloud

### Authentication

Two separate authentication steps are required:

1. **User Auth** (`gcloud auth login`) - Identifies you
2. **Application Default Credentials** (`gcloud auth application-default login`) - Allows the Stitch MCP server to make API calls on your behalf

### MCP Configuration

All clients receive the same configuration format:

```json
{
  "mcpServers": {
    "stitch": {
      "type": "http",
      "url": "https://stitch.googleapis.com/mcp",
      "headers": {
        "Authorization": "Bearer <your-token>",
        "X-Goog-User-Project": "<your-project-id>"
      }
    }
  }
}
```

## Troubleshooting

### "Permission Denied" errors

Ensure:
- You have Owner or Editor role on the GCP project
- Billing is enabled on the project
- Stitch API is enabled

### "gcloud command not found"

Run `npx @_davideast/stitch-mcp init` to auto-install gcloud.

### API connection fails

Run the doctor command to diagnose:

```bash
npx @_davideast/stitch-mcp doctor
```

## Development

```bash
# Install dependencies
bun install

# Run locally
bun run dev init

# Run tests
bun test

# Build
bun run build
```

## License

MIT © David East
