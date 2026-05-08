# feat: Universal Asset Upload CLI Command & Resilient SDK Schema Repair

This PR refactors the image-only `upload-image` CLI command into a universal **`upload`** command, enabling seamless uploads of design assets (PNG, JPG, JPEG, WEBP) as well as interactive HTML files via the updated `@google/stitch-sdk` client. Additionally, it introduces runtime schema-repair mechanisms in the SDK layer to guarantee client-side resilience against incomplete backend schema payloads.

---

## What Changed

### 1. Universal `upload` Command Slice (`src/commands/upload/`)
- **`command.ts`**: Standardizes option parsing (`--project`, `--file`, `--title`) using Commander. Implements lazy, dynamic imports to isolate connection side-effects and boost CLI boot speeds. Wire-connects the command action to the unified `project.upload()` SDK method.
- **`handler.ts`**: Generalizes the business logic layer to process any valid asset. Maintained strong **Dependency Injection** ports (`UploadFn`) for isolated test mapping, transforming errors into result-oriented, typed status values without throwing.
- **`spec.ts`**: Hardens input validation using Zod (`UploadInputSchema`). Features directory traversal guardrails (`..`) to reject malicious path escalations before shell or disk operations.

### 2. Core SDK Resilience Layer (Schema Repair)
- Patched the `@google/stitch-sdk` tool discovery sequence (`StitchToolClient.listTools()`).
- Intercepts remote tool schemas at runtime and injects missing `$defs` declarations (e.g., `ScreenInstance`, `File`). This prevents strict AJV validation crashes during discovery and tool compilation, shielding developers and CI setups from malformed upstream schemas.

### 3. Test Suite Alignment & Verification
- Renamed and refactored all test assets inside `tests/commands/upload/`.
- Hardened mock definitions and assertions to cover robust file inputs and the new results structure.
- Verified full test compliance: all **567 unit and integration tests** pass cleanly with 100% test health.

---

## Files Changed

**New CLI Command Slice**
- `src/commands/upload/command.ts` — Options parsing, lazy import, and SDK wiring
- `src/commands/upload/handler.ts` — Generalized asset handling and DI upload mappings
- `src/commands/upload/spec.ts` — Zod input validation and directory traversal guards

**Unit & Integration Test Suites**
- `tests/commands/upload/handler.test.ts` — Comprehensive error classification and mock upload tests
- `tests/commands/upload/spec.test.ts` — Input schema constraint and path-traversal verification

**Underlying SDK Patches**
- `packages/sdk/src/client.ts` — On-the-fly schema repair interceptor
