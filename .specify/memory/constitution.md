<!--
SYNC IMPACT REPORT
==================
Version change: [template] → 1.0.0 (initial ratification)
Modified principles: N/A (initial fill — all sections created from template placeholders)
Added sections:
  - Core Principles (5 principles)
  - Deployment & Platform Constraints
  - Development Workflow
  - Governance
Templates requiring updates:
  ✅ .specify/templates/plan-template.md — Constitution Check section verified; gates align with principles
  ✅ .specify/templates/spec-template.md — Functional Requirements and Success Criteria sections align
  ✅ .specify/templates/tasks-template.md — Observability and versioning task types align with principles
Follow-up TODOs: none — all placeholders resolved
-->

# KranzTV Constitution

## Core Principles

### I. Deterministic Scheduling (NON-NEGOTIABLE)

The scheduling algorithm (`src/lib/scheduling/algorithm.ts`) MUST remain a pure function: given a channel and a UTC timestamp, it MUST return the same result for every viewer on every device. Server state, randomness, user-session data, and network calls are FORBIDDEN inside scheduling logic. The invariant is that every viewer of a channel sees the same video at the same seek position at any given moment.

**Rationale**: This constraint is the product's core promise — a shared, synchronized TV experience without a database or server sync. Violating it collapses the UX into an ordinary video player.

### II. Client-Side Data Fetching

All YouTube Data API calls MUST happen client-side via `VITE_YOUTUBE_API_KEY`. Server functions MUST NOT proxy YouTube requests or store video metadata server-side. When no API key is present, the app MUST fall back to `buildMockChannel()` and remain fully functional.

**Rationale**: KranzTV deploys to Cloudflare Workers with a stateless, serverless runtime. Centralizing data fetching server-side would introduce latency, caching complexity, and Worker cold-start risk with no user-facing benefit.

### III. Test-First for Pure Logic

All pure functions — especially scheduling, time utilities, and EPG builders — MUST have unit tests written before implementation (Red-Green-Refactor). Coverage thresholds are enforced at 80% (lines/functions/branches/statements). New scheduling logic that ships without unit tests MUST be treated as a constitution violation.

**Rationale**: Pure functions are the most testable surface in the codebase. Skipping tests here is unjustified and erodes confidence in the determinism guarantee from Principle I.

### IV. Observability by Default

Every user-facing interaction of consequence MUST emit a Datadog RUM custom action or a DogStatsD metric. Required events: `channel_switch`, `guide_toggle`, `import_started`, `keyboard_shortcut`. New features that introduce user flows without telemetry MUST justify the omission.

**Rationale**: The project uses Datadog (the user's employer) as its observability platform. Instrumentation is not optional — it is the feedback loop that validates feature behavior in production.

### V. Immutability and Small Files

All state transformations MUST return new objects — mutation of existing objects is forbidden. Files MUST stay under 800 lines; 200–400 lines is the target. Code MUST be organized by feature/domain (e.g., `src/lib/scheduling/`, `src/components/epg-overlay/`), not by type.

**Rationale**: The codebase uses React with hooks and a stateless scheduling model. Mutation introduces subtle bugs that undermine the determinism guarantee and make state flow harder to reason about.

## Deployment & Platform Constraints

KranzTV deploys to **Cloudflare Workers** (not Pages) via `wrangler deploy` using `nodejs_compat`. These constraints are non-negotiable for all new code:

- Use Web Platform APIs (`fetch`, `Request`, `Response`, `crypto.subtle`) over Node built-ins wherever possible.
- ESM imports only — `require()` and `createRequire()` are forbidden in Worker code paths.
- `dd-trace` and other Node-runtime-only dependencies MUST NOT be used in Worker code paths; server APM is Docker-only.
- Endpoints that read runtime environment variables MUST NOT be statically prerendered.
- New top-level scripts (e.g., `scripts/*.ts`) MUST be added to `tsconfig` before pushing — CI lint enforces this.

**App version** (`__APP_VERSION__`) is read from `package.json` at Vite build time. Version MUST be bumped in every PR that ships a user-facing change; `DD_VERSION` depends on it for deploy correlation.

## Development Workflow

1. **Feature branch + PR required** — direct commits to `main` are forbidden unless explicitly authorized. PRs use `gh pr create` with a HEREDOC body.
2. **Lint and typecheck before commit** — `pnpm lint` (ESLint, strict mode with `noUnusedLocals`/`noUnusedParameters`) MUST pass. TypeScript strict mode is enforced; Zod schemas MUST validate all YouTube API responses before use.
3. **UI/design standard** — Bold and visible over conservative. `text-base` or larger for labels. No decorative flourishes (emoji badges, per-channel gradient accents) unless explicitly requested.
4. **Visual effects** — Scaffold 3–4 named presets behind a URL param or dev toggle on the first pass; do not one-shot tune individual values.
5. **No server state in scheduling** — Reiterated here as a workflow gate: any PR that touches `src/lib/scheduling/` MUST confirm the pure-function invariant is preserved.

## Governance

This constitution supersedes all other informal practices. Amendments require:

1. A documented rationale explaining what changed and why.
2. A `CONSTITUTION_VERSION` bump following semantic versioning:
   - **MAJOR**: Principle removals, redefinitions, or backward-incompatible governance changes.
   - **MINOR**: New principles or materially expanded guidance added.
   - **PATCH**: Clarifications, wording, or non-semantic refinements.
3. Updates to dependent templates (plan, spec, tasks) propagated in the same PR.

All implementation plans MUST include a **Constitution Check** gate before Phase 0 research. All PRs touching scheduling, deployment config, or observability MUST re-verify compliance with Principles I, II, and IV respectively.

Runtime development guidance lives in `CLAUDE.md` (project root) and `.claude/` (session hooks and memory). The constitution takes precedence when they conflict.

**Version**: 1.0.0 | **Ratified**: 2026-05-03 | **Last Amended**: 2026-05-03
