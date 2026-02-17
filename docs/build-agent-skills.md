---
title: Build an Agent Skill
description: Create a reusable Agent Skill that packages Stitch design-to-code workflows.
order: 5
category: agent-integration
---

# Build an Agent Skill

An [Agent Skill](https://agentskills.io) is a directory with a `SKILL.md` file that tells coding agents how to run a workflow. This guide walks through creating one for Stitch. See [Agent Skills](agent-skills.md) for background on what skills are and why they pair with Stitch.

## The `tool` command

The `tool` command is the CLI interface skills use to call Stitch tools. It's how you test and debug tool calls outside an agent session:

```bash
# List every tool available
stitch tool

# See what a specific tool expects
stitch tool get_screen_code -s

# Call a tool with data
stitch tool list_projects -o json
```

## Directory structure

A skill is a directory with a `SKILL.md` file:

```plaintext
design-review/
├── SKILL.md
├── scripts/       # Executable helpers (optional)
├── references/    # Extra docs loaded on demand (optional)
└── assets/        # Templates, schemas (optional)
```

## SKILL.md format

YAML frontmatter followed by markdown instructions.

```yaml
---
name: design-review
description: Review UI implementations against Stitch designs. Use when the user asks to compare their code to a design, check design fidelity, or audit visual accuracy.
license: MIT
compatibility: Requires npx and network access to the Stitch API.
allowed-tools: mcp__stitch__get_screen mcp__stitch__get_project mcp__stitch__list_screens Bash(npx:*) Bash(stitch:*) Read
metadata:
  author: your-org
  version: "1.0"
---
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Lowercase, hyphens, numbers. Max 64 chars. Must match directory name. |
| `description` | Yes | What the skill does and when to activate. Max 1024 chars. |
| `license` | No | License name or reference to a bundled file. |
| `compatibility` | No | Environment requirements. |
| `allowed-tools` | No | Pre-approved tools. Experimental — format varies by agent. |
| `metadata` | No | Arbitrary key-value pairs. |

## About `allowed-tools`

The `allowed-tools` field lists tools the agent is pre-approved to call without prompting the user. What goes in this list depends on how the agent reaches the tools:

- **MCP tools** — if the agent has stitch-mcp connected as an MCP server, it calls tools like `get_screen`, `list_screens` directly through the protocol. List them by their MCP tool name (e.g., `mcp__stitch__get_screen`).
- **CLI tools** — if the skill uses `stitch tool ...` bash commands, list `Bash(stitch:*)` and/or `Bash(npx:*)`.
- **File access** — `Read` and `Write` for reading user code and writing reports.

Most Stitch skills need both: MCP tool names for agents connected via MCP, and Bash patterns as a fallback for CLI invocation.

## Writing descriptions that trigger

The `description` is how agents decide whether to activate your skill. Include the verbs and nouns a user would actually say:

```yaml
# Good — matches natural requests
description: Review UI implementations against Stitch designs. Use when the user asks to compare their code to a design, check design fidelity, or audit visual accuracy.
```

```yaml
# Bad — too vague, agents won't match it
description: Works with Stitch designs.
```

## The body

After the frontmatter, write whatever instructions help the agent succeed. Step-by-step workflows, tool invocations, edge cases, output formatting — there are no format restrictions.

## Name rules

- 1–64 characters, lowercase letters, numbers, and hyphens
- No leading/trailing hyphens, no consecutive hyphens (`--`)
- Must match the parent directory name

## Example: a design review skill

````markdown
---
name: design-review
description: Review UI implementations against Stitch designs. Use when the user asks to compare their code to a design, check design fidelity, or audit visual accuracy.
allowed-tools: mcp__stitch__get_screen mcp__stitch__list_screens Bash(stitch:*) Read
metadata:
  author: your-org
  version: "1.0"
---

## When to activate

The user asks something like:
- "Does my page match the Stitch design?"
- "Review my header against the original screen"
- "Check design fidelity for the pricing page"

## Steps

1. Ask the user which Stitch project and screen to compare against.
2. If they don't know the screen ID, run `stitch tool list_screens -d '{ "projectId": "PROJECT_ID" }'` and let them pick.
3. Fetch the design HTML:

```bash
stitch tool get_screen_code -d '{
  "projectId": "PROJECT_ID",
  "screenId": "SCREEN_ID"
}'
```

4. Fetch the design screenshot:

```bash
stitch tool get_screen_image -d '{
  "projectId": "PROJECT_ID",
  "screenId": "SCREEN_ID"
}'
```

5. Read the user's implementation files.
6. Compare and report discrepancies in these categories:

### What to check

- **Colors** — hex values, CSS variables, opacity
- **Typography** — font family, size, weight, line height, letter spacing
- **Spacing** — margins, padding, gaps
- **Layout** — flex/grid structure, alignment, ordering
- **Components** — missing elements, extra elements, structural differences

### Output format

Report findings as a checklist:

```
## Design Review: [screen name]

### Matches
- [x] Font family matches (JetBrains Mono)
- [x] Background color matches (#0c0c0c)

### Discrepancies
- [ ] Hero heading: `text-4xl` → should be `text-[44px]`
- [ ] Card grid gap: `gap-4` → should be `gap-6` (design uses 24px)
- [ ] CTA button: `bg-blue-500` → should be `bg-[#2563eb]`
```
````

## Progressive disclosure

Skills should minimize context usage. The agent loads content in three stages:

1. **Metadata** (~100 tokens) — `name` and `description` loaded at startup for all installed skills
2. **Instructions** (< 5000 tokens) — the full `SKILL.md` body loaded when activated
3. **Resources** (on demand) — `scripts/`, `references/`, `assets/` loaded only when referenced

Keep `SKILL.md` under 500 lines. Move detailed reference material to separate files.

## Validation

```bash
npx skills-ref validate ./my-skill
```

Checks that frontmatter is valid and naming conventions are followed.
