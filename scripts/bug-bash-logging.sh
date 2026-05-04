#!/usr/bin/env bash
#
# Bug-bash scenario for the event-logging system.
#
# Walks through a realistic project lifecycle with STITCH_MCP_LOG=1, then
# inspects .stitch-mcp/log/ to confirm events were captured correctly.
#
# Requirements:
#   - bun (project's dev runtime)
#   - jq  (brew install jq)
#   - Authenticated Stitch session (env vars or gcloud ADC already set up)
#
# Usage:
#   ./scripts/bug-bash-logging.sh
#   ./scripts/bug-bash-logging.sh --keep   # don't wipe .stitch-mcp/log/ first
#
set -uo pipefail

KEEP=0
[[ "${1:-}" == "--keep" ]] && KEEP=1

LOG_DIR=".stitch-mcp/log"
EVENTS="$LOG_DIR/events.jsonl"
BLOBS="$LOG_DIR/blobs"

export STITCH_MCP_LOG=1

# --- helpers ---------------------------------------------------------------

# All UI output goes to stderr so $(tool ...) captures clean JSON on stdout.
bold()  { printf '\033[1m%s\033[0m\n' "$*" >&2; }
green() { printf '\033[32m%s\033[0m\n' "$*" >&2; }
red()   { printf '\033[31m%s\033[0m\n' "$*" >&2; }
gray()  { printf '\033[90m%s\033[0m\n' "$*" >&2; }

step() {
  echo >&2
  bold "▶ $*"
}

# Invoke a tool via the CLI. Echoes raw JSON on stdout, status on stderr.
# Usage: tool <tool_name> <json_args>
tool() {
  local name=$1
  local args=$2
  gray "  args: $args"
  local start=$(date +%s)
  local out
  if ! out=$(bun run src/cli.ts tool "$name" -d "$args" -o json 2>/tmp/bug-bash.err); then
    red "  ✖ tool $name failed (exit $?)"
    cat /tmp/bug-bash.err >&2
    echo "$out"
    return 1
  fi
  local end=$(date +%s)
  gray "  duration: $((end - start))s"
  echo "$out"
}

require() {
  command -v "$1" >/dev/null 2>&1 || { red "✖ missing dependency: $1"; exit 1; }
}

# --- preflight -------------------------------------------------------------

require bun
require jq

if [[ $KEEP -eq 0 ]]; then
  bold "Wiping $LOG_DIR (use --keep to preserve)"
  rm -rf "$LOG_DIR"
fi

# --- step 1: create project ------------------------------------------------

step "create_project"
PROJECT_RESPONSE=$(tool create_project '{"title":"bug-bash logging '"$(date +%s)"'"}')
PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.. | objects | .name? // empty | select(test("^projects/"))' | head -1 | sed 's|^projects/||')
if [[ -z "$PROJECT_ID" ]]; then
  red "✖ failed to extract project ID"
  echo "$PROJECT_RESPONSE" | jq '.' >&2
  exit 1
fi
green "  ✓ project_id: $PROJECT_ID"

# --- step 2: generate first screen -----------------------------------------

step "generate_screen_from_text (cold — no previous screens)"
echo "  this can take 1–3 min..."
SCREEN1_RESPONSE=$(tool generate_screen_from_text "$(jq -n --arg p "$PROJECT_ID" '{
  projectId: $p,
  prompt: "A clean mobile login screen with email and password inputs and a primary CTA button"
}')")
SCREEN1_ID=$(echo "$SCREEN1_RESPONSE" | jq -r '.. | objects | .id? // empty | select(test("^[a-f0-9]+$"))' | head -1)
if [[ -z "$SCREEN1_ID" ]]; then
  red "✖ failed to extract screen ID"
  echo "$SCREEN1_RESPONSE" | jq '.structuredContent | keys' >&2 || true
  exit 1
fi
green "  ✓ screen_id: $SCREEN1_ID"

# --- step 3: edit that screen ----------------------------------------------

step "edit_screens (modify the login screen)"
echo "  this can take 1–3 min..."
EDIT_RESPONSE=$(tool edit_screens "$(jq -n --arg p "$PROJECT_ID" --arg s "$SCREEN1_ID" '{
  projectId: $p,
  selectedScreenIds: [$s],
  prompt: "Add a Sign in with Google button above the email input"
}')")
EDITED_ID=$(echo "$EDIT_RESPONSE" | jq -r '.. | objects | .id? // empty | select(test("^[a-f0-9]+$"))' | head -1)
green "  ✓ edited screen id: ${EDITED_ID:-<none>}"

# --- step 4: generate variants ---------------------------------------------

step "generate_variants (3 variants of the login screen)"
echo "  this can take 2–5 min..."
VARIANTS_RESPONSE=$(tool generate_variants "$(jq -n --arg p "$PROJECT_ID" --arg s "$SCREEN1_ID" '{
  projectId: $p,
  selectedScreenIds: [$s],
  prompt: "Try different visual styles — minimal, playful, and corporate",
  variantOptions: { variantCount: 3, creativeRange: "EXPLORE" }
}')")
VARIANT_COUNT=$(echo "$VARIANTS_RESPONSE" | jq '[.. | objects | .id? // empty | select(test("^[a-f0-9]+$"))] | unique | length')
VARIANT_API_ERR=$(echo "$VARIANTS_RESPONSE" | jq -r '.error // empty')
if [[ -n "$VARIANT_API_ERR" ]]; then
  red "  ⚠ generate_variants API error: $VARIANT_API_ERR (logging system should still capture as call.failed)"
else
  green "  ✓ produced screens: $VARIANT_COUNT"
fi

# --- step 5: read-only call (sanity-check the read path) -------------------

step "list_screens (read path — should log without asset capture)"
LIST_RESPONSE=$(tool list_screens "$(jq -n --arg p "$PROJECT_ID" '{projectId: $p}')")
LIST_COUNT=$(echo "$LIST_RESPONSE" | jq '[.. | objects | .name? // empty | select(test("^screens/"))] | unique | length')
green "  ✓ list_screens returned $LIST_COUNT screens"

# --- step 6: an unclassified tool (should NOT crash the user call) ---------

step "list_design_systems (unclassified tool — capture should fail silently)"
DS_RESPONSE=$(tool list_design_systems '{}')
if echo "$DS_RESPONSE" | jq -e '.isError == true' >/dev/null 2>&1; then
  red "  ⚠ user-visible error returned — capture leaked into the response"
else
  green "  ✓ user-visible response is intact (capture failure was swallowed)"
fi

# --- inspection ------------------------------------------------------------

echo
bold "═══════════════════════════════════════════════════════════════"
bold "  Inspection"
bold "═══════════════════════════════════════════════════════════════"

if [[ ! -f "$EVENTS" ]]; then
  red "✖ events.jsonl was not created — logging may not be wired through"
  exit 1
fi

EVENT_COUNT=$(wc -l <"$EVENTS" | tr -d ' ')
BLOB_COUNT=$(find "$BLOBS" -type f 2>/dev/null | wc -l | tr -d ' ')
BLOB_SIZE=$(du -sh "$BLOBS" 2>/dev/null | awk '{print $1}')

echo
bold "Counts"
echo "  events:      $EVENT_COUNT lines"
echo "  blobs:       $BLOB_COUNT files ($BLOB_SIZE)"

echo
bold "Event types (call.requested vs call.completed vs call.failed)"
jq -r '.type' "$EVENTS" | sort | uniq -c

echo
bold "Tools called (from call.requested events)"
jq -r 'select(.type == "call.requested") | .payload.tool' "$EVENTS" | sort | uniq -c

echo
bold "Trace pairs (each tool call should appear twice — requested + completed/failed)"
jq -r '.trace_id' "$EVENTS" | sort | uniq -c | awk '
  $1 == 2 { paired++ }
  $1 == 1 { unpaired++; print "  ⚠ unpaired trace: " $2 }
  $1 >  2 { extra++;    print "  ⚠ trace with " $1 " events: " $2 }
  END {
    print ""
    print "  paired traces:   " (paired+0)
    print "  unpaired traces: " (unpaired+0)
    print "  >2-event traces: " (extra+0)
  }
'

echo
bold "Generative-call asset capture"
jq -c 'select(.type == "call.completed" and .payload.kind == "generative")' "$EVENTS" | while read -r line; do
  tool=$(echo "$line" | jq -r '.payload.tool')
  produced=$(echo "$line" | jq '.payload.produced_screens | length')
  has_html=$(echo "$line" | jq '[.payload.produced_screens[]?.html_blob // empty] | length')
  has_screenshot=$(echo "$line" | jq '[.payload.produced_screens[]?.screenshot_blob // empty] | length')
  echo "  $tool — $produced screens, $has_html html blobs, $has_screenshot screenshots"
done

echo
bold "Failures (call.failed)"
FAIL_COUNT=$(jq -c 'select(.type == "call.failed")' "$EVENTS" | wc -l | tr -d ' ')
if [[ "$FAIL_COUNT" == "0" ]]; then
  green "  ✓ none"
else
  red "  ✖ $FAIL_COUNT failures:"
  jq -c 'select(.type == "call.failed") | {tool: .payload.tool, is_error: .payload.is_error, err: .payload.error_text}' "$EVENTS"
fi

echo
bold "Summary"
echo "  project_id: $PROJECT_ID"
echo "  log dir:    $LOG_DIR"
echo "  re-inspect: jq -c . $EVENTS"
echo "  blob dir:   $BLOBS"
