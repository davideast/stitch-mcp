# Stitch MCP Helper CLI

> A guided checklist and proxy server for the Stitch MCP

![Example usage](/assets/splash.png)

## Quick Start

```bash
npx @_davideast/stitch-mcp init
```

This single command will:
1. Install Google Cloud CLI (if needed)
2. Guide you through authentication with gcloud commands
3. Set up application credentials
4. Select a GCP project
5. Configure IAM permissions
6. Enable Stitch API
7. Generate MCP configuration for your client

**Example session:**
```
Stitch MCP Setup

Step 1: Select your MCP client
✔ Which MCP client are you using? Antigravity

Step 2: Setting up Google Cloud CLI
✔ Google Cloud CLI ready (bundled): v552.0.0

Step 3: Setup Authentication
✔ Check your current setup status? Yes

Authenticate with Google Cloud

  CLOUDSDK_CONFIG="~/.stitch-mcp/config" gcloud auth login

  (copied to clipboard)
✔ Press Enter when complete Yes
✔ Logged in as you@gmail.com

Authorize Application Default Credentials

  CLOUDSDK_CONFIG="~/.stitch-mcp/config" gcloud auth application-default login

  (copied to clipboard)
✔ Press Enter when complete Yes
✔ ADC configured

Step 4: Select a Google Cloud project
✔ Select a project: My Project (my-project-id)

Step 5: Configure IAM Permissions
✔ Required IAM role is already configured.

Step 6: Generating MCP Configuration
✔ Configuration generated

Setup Complete! ✔
```

**How it works:** Commands are displayed and automatically copied to your clipboard. Run the command in your terminal, complete the OAuth flow in your browser, then press Enter to continue.

**Example output:**
```json
{
  "mcpServers": {
    "stitch": {
      "command": "npx",
      "args": ["@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_PROJECT_ID": "your-project-id"
      }
    }
  }
}
```

Copy this config into your MCP client settings and you're ready to use the Stitch MCP server.

## Quick Start (Existing gcloud Users)

If you already have `gcloud` configured, skip `init` and use the proxy directly.

**Prerequisites:**
```bash
# 1. Application Default Credentials
gcloud auth application-default login

# 2. Set project (if not already set)
gcloud config set project <PROJECT_ID>

# 3. Enable Stitch API (requires beta component)
gcloud components install beta
gcloud beta services mcp enable stitch.googleapis.com --project=<PROJECT_ID>
```

**MCP Configuration:**
```json
{
  "mcpServers": {
    "stitch": {
      "command": "npx",
      "args": ["@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_USE_SYSTEM_GCLOUD": "1"
      }
    }
  }
}
```

**Environment Variables:**
| Variable | Description |
|----------|-------------|
| `STITCH_USE_SYSTEM_GCLOUD` | Use system gcloud config instead of isolated config |
| `STITCH_PROJECT_ID` | Override project ID |
| `GOOGLE_CLOUD_PROJECT` | Alternative project ID variable |
| `STITCH_HOST` | Custom Stitch API endpoint |

## Verify Your Setup

```bash
npx @_davideast/stitch-mcp doctor
```

Runs health checks on:
- ✔ Google Cloud CLI installation
- ✔ User authentication
- ✔ Application credentials
- ✔ Project configuration
- ✔ Stitch API connectivity

## Logout

```bash
npx @_davideast/stitch-mcp logout

# Skip confirmation
npx @_davideast/stitch-mcp logout --force

# Clear all config
npx @_davideast/stitch-mcp logout --clear-config
```

## Deep Dive

### Installation

Can be configured with `npx` or installed globally.

```bash
npx @_davideast/stitch-mcp init
```

Or install globally if you prefer:

```bash
npm install -g @_davideast/stitch-mcp
stitch-mcp init
```

### Commands Reference

#### `init` - Interactive Setup

```bash
npx @_davideast/stitch-mcp init [options]
```

**Options:**
- `--local` - Install gcloud locally to project instead of user home
- `-y, --yes` - Auto-approve verification prompts (skips "Check your current setup status?")
- `-c, --client <client>` - Specify MCP client (antigravity, vscode, cursor, claude-code, gemini-cli, opencode)
- `-t, --transport <type>` - Transport type (http or stdio)

**What happens:**
1. **MCP Client Selection** - Choose your IDE/CLI
2. **gcloud Setup** - Install or detect Google Cloud CLI
3. **User Authentication** - OAuth login flow
4. **Application Credentials** - API-level authentication
5. **Project Selection** - Interactive picker with search
6. **IAM Configuration** - Set up required permissions
7. **API Enablement** - Enable Stitch API
8. **Connection Test** - Verify API access
9. **Config Generation** - Output ready-to-use MCP config

#### `doctor` - Health Checks

```bash
npx @_davideast/stitch-mcp doctor [options]
```

**Options:**
- `--verbose` - Show detailed error information

Diagnoses common setup issues and verifies:
- Google Cloud CLI is installed and accessible
- User is authenticated
- Application Default Credentials exist
- Active GCP project is configured
- Stitch API is reachable

#### `logout` - Revoke Credentials

```bash
npx @_davideast/stitch-mcp logout [options]
```

**Options:**
- `--force` - Skip confirmation prompts
- `--clear-config` - Delete entire gcloud config directory

Revokes both user authentication and Application Default Credentials. Useful for:
- Switching Google accounts
- Clearing authentication for testing
- Resetting state when troubleshooting

#### `view` - View Stitch Resources

```bash
npx @_davideast/stitch-mcp view [options]
```

**Options:**
- `--projects` - List all projects
- `--name <name>` - Resource name to view
- `--sourceScreen <name>` - Source screen resource name
- `--project <id>` - Project ID
- `--screen <id>` - Screen ID

Interactively view Stitch resources such as projects and screens. Displays the resource data in a JSON tree format.

#### `proxy` - MCP Proxy Server

```bash
npx @_davideast/stitch-mcp proxy [options]
```

**Options:**
- `--transport <type>` - Transport type: 'stdio' or 'sse' (default: 'stdio')
- `--port <number>` - Port number (required for sse)
- `--debug` - Enable debug logging

This command is typically configured as the entry point in your MCP client settings. It handles:
- Automatic token refresh
- Request/response proxying
- Error handling
- Debug logging (when `--debug` is enabled to `/tmp/stitch-proxy-debug.log`)

### How It Works

#### Automatic gcloud Management

This library manages Google Cloud CLI:

- **Prefers global installation:** Uses existing `gcloud` if available
- **Auto-installs locally:** Downloads to `~/.stitch-mcp/google-cloud-sdk` if needed
- **Isolated configuration:** Separate config directory prevents config conflicts with other gcloud configurations

#### Two-Step Authentication

Two authentication flows are required for Stitch MCP server access:

1. **User Auth** (`gcloud auth login`)
   - Identifies you to Google Cloud
   - Opens browser for OAuth flow

2. **Application Default Credentials** (`gcloud auth application-default login`)
   - Allows MCP server to make API calls on your behalf
   - Separate OAuth flow with API-level permissions

The CLI presents these as a guided checklist. You run the commands yourself, then the CLI verifies completion:

```
Authenticate with Google Cloud

  CLOUDSDK_CONFIG="~/.stitch-mcp/config" gcloud auth login

  (copied to clipboard)
✔ Press Enter when complete Yes
✔ Logged in as you@gmail.com
```

#### WSL / SSH / Docker Environments

The CLI automatically detects WSL, SSH sessions, Docker containers, and Cloud Shell. In these environments, browser-based auth may not work automatically. The CLI shows guidance:

```
⚠ WSL detected - browser redirect to localhost may not work
  If browser auth fails, copy the URL from terminal and open manually.
```

Simply copy the OAuth URL from your terminal and paste it into your browser to complete authentication.

#### Transport Options

**Direct Connection (HTTP)** - Default for most clients:
```json
{
  "mcpServers": {
    "stitch": {
      "type": "http",
      "url": "https://stitch.googleapis.com/mcp",
      "headers": {
        "Authorization": "Bearer <token>",
        "X-Goog-User-Project": "<project-id>"
      }
    }
  }
}
```

**Proxy Mode (STDIO)** - Recommended for development:
```json
{
  "mcpServers": {
    "stitch": {
      "command": "npx",
      "args": ["@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_PROJECT_ID": "<project-id>"
      }
    }
  }
}
```

Proxy mode handles token refresh automatically and provides debug logging.

### Troubleshooting

#### "Permission Denied" errors

Ensure:
- You have Owner or Editor role on the GCP project
- Billing is enabled on your project
- Stitch API is enabled

Run `doctor` to diagnose:
```bash
npx @_davideast/stitch-mcp doctor --verbose
```

#### Authentication URL not appearing

The tool now **always prints authentication URLs to the terminal** with a 5-second timeout to prevent hanging. If the URL doesn't appear:

1. Check your terminal output carefully
2. The URL starts with `https://accounts.google.com`
3. If still not visible, check `/tmp/stitch-proxy-debug.log` (if using proxy with `--debug`)

#### Already authenticated but showing logged in

The bundled gcloud SDK maintains separate authentication from your global gcloud installation. To fully clear authentication:

```bash
npx @_davideast/stitch-mcp logout --force --clear-config
```

#### API connection fails after setup

1. Run the doctor command:
   ```bash
   npx @_davideast/stitch-mcp doctor --verbose
   ```

2. Verify your project has billing enabled

3. Check that Stitch API is enabled:
   ```bash
   gcloud services list --enabled | grep stitch
   ```

4. Try re-authenticating:
   ```bash
   npx @_davideast/stitch-mcp logout --force
   npx @_davideast/stitch-mcp init
   ```

### Development

```bash
# Install dependencies
bun install

# Run locally
bun run dev init

# Run tests
bun test

# Build
bun run build

# Verify package
bun run verify-pack
```

## License

Apache 2.0 © David East

## Disclaimer

> [!WARNING]
> **Experimental Project** - This is an independent, experimental tool.

This project is:
- **NOT** affiliated with, endorsed by, or sponsored by Google LLC, Alphabet Inc., or the Stitch API team
- Provided **AS-IS** with **NO WARRANTIES** of any kind
- **NOT** guaranteed to be maintained, secure, or compatible with future API versions

"Stitch" and "Google Cloud" are trademarks of Google LLC.

**USE AT YOUR OWN RISK.**
