# Preventing Merge Conflicts & Improving Agentic Workflow

This document outlines architectural decisions and specific action items to minimize merge conflicts and improve type safety, enabling parallel development by multiple agents.

## Analysis of Conflict Hotspots

### 1. Monolithic Service Handlers ("God Classes")
The current implementation of `GcloudHandler` (`src/services/gcloud/handler.ts`) and `StitchHandler` (`src/services/stitch/handler.ts`) consolidates too many responsibilities into single files.
- **Risk:** Agents adding authentication features will conflict with agents adding project management features.
- **Current Size:** `GcloudHandler` is ~560 lines and growing.
- **Responsibilities:** Installation, Auth (User/ADC), Project Listing, API Management, Token Fetching.

### 2. Loose Command Input Typing
Commands use `CommandDefinition<Args = any, Options = any>`, leading to manual validation inside `action` handlers.
- **Risk:** Refactoring command arguments requires changes in multiple places (definition + handler logic), increasing conflict surface.
- **Missing:** Strict Zod schemas for inputs.

### 3. Barrel Files
While not pervasive, `index.ts` files exist (e.g., `src/ui/serve-behaviors/index.ts`).
- **Risk:** "Export noise". Modifying a barrel file to export a new module often causes git conflicts if multiple agents add modules simultaneously.

### 4. Shared Configuration/State
State management is currently done via `Context` objects passed through `CommandStep`. This is good, but the `Context` interfaces themselves can become bottlenecks if not segmented by domain.

---

## Action Items

### A. Decompose Service Handlers
Break down "God Classes" into focused, domain-specific services. Use composition over inheritance.

1.  **Split `GcloudHandler`** (Completed: 2025-02-18):
    -   `GcloudAuthService`: Handle `login`, `adc`, `token` fetching.
    -   `GcloudProjectService`: Handle `list`, `set`, `create`.
    -   `GcloudInstallService`: Handle binary download and version checks.
    -   *Implementation:* Create `src/services/gcloud/auth.ts`, `src/services/gcloud/projects.ts`, etc.

2.  **Split `StitchHandler`** (Completed: 2025-02-18):
    -   `StitchIamService`: Handle IAM policy bindings.
    -   `StitchApiService`: Handle API enablement.
    -   `StitchConnectionService`: Handle connectivity tests.

### B. Enforce Strict Input Validation (Zod) (Partially Completed: 2025-02-18)
Replace `any` in `CommandDefinition` with Zod schemas. This allows automatic type inference and validation.

**Implemented for:** `init`, `doctor`, `logout`.

1.  **Define Schema:**
    ```typescript
    import { z } from 'zod';

    export const InitOptionsSchema = z.object({
      local: z.boolean().default(false),
      yes: z.boolean().default(false),
      // ...
    });

    export type InitOptions = z.infer<typeof InitOptionsSchema>;
    ```

2.  **Update Command Definition:**
    -   Use the inferred type in `CommandDefinition<Args, InitOptions>`.
    -   Validate `options` against the schema at the start of `action`.

### C. Eliminate Barrel Files (Completed: 2025-02-18)
**Do not use `index.ts` files to re-export modules.**
-   **Why:** It creates a central point of contention.
-   **Action:** Delete existing `index.ts` files in `src/ui/*` and `src/services/*` (if any).
-   **Rule:** Import directly from the source file.
    -   *Bad:* `import { Service } from './services';`
    -   *Good:* `import { Service } from './services/service.ts';`

### D. Vertical Slicing & Co-location
Keep all related code for a feature in one directory.
-   **Pattern:**
    ```
    src/features/my-feature/
    ├── handler.ts       // Logic
    ├── handler.test.ts  // Tests
    ├── schema.ts        // Zod input/output schemas
    ├── types.ts         // Internal types
    └── ui.tsx           // UI components (if any)
    ```
-   **Benefit:** An agent working on "my-feature" only touches files in this folder, guaranteeing zero conflicts with other agents.

### E. Dynamic Registration (Glob Patterns)
Continue and expand the pattern used in `src/commands/autoload.ts`.
-   **Pattern:** Use `import.meta.glob` or `readdir` to load modules dynamically.
-   **Apply to:**
    -   UI Behaviors (Navigation, Copy, Serve).
    -   Service Providers (if multiple implementations exist).
-   **Benefit:** Adding a new behavior is just adding a file; no registry update needed.
