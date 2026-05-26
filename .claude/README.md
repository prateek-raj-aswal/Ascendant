# .claude — Lean SDLC Agent System

A **9-agent / 13-command** pipeline organized around a **5-stage lifecycle**, with declarative per-agent harnesses, domain + per-story memory for context optimization, and automatic event logging via a `PostToolUse` hook.

---

## Table of contents

1. [Architectural design](#1-architectural-design)
2. [The 5-stage lifecycle](#2-the-5-stage-lifecycle)
3. [Agent reference (9)](#3-agent-reference-9)
4. [Command reference (13)](#4-command-reference-13)
5. [Harness format](#5-harness-format)
6. [Memory architecture](#6-memory-architecture)
7. [Event logging hook](#7-event-logging-hook)
8. [Common workflows](#8-common-workflows)
9. [Decision matrix — when to use what](#9-decision-matrix--when-to-use-what)
10. [File layout](#10-file-layout)

---

## 1. Architectural design

### 1.1 System layers

```
┌─────────────────────────────────────────────────────────────────┐
│  USER                                                           │
│  Types  /command  in Claude Code prompt                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  COMMAND LAYER (13 files in .claude/commands/)                  │
│   • Pipeline    /full-pipeline                                  │
│   • Workflow    /execute-story                                  │
│   • Stage       /clarify · /design · /build · /verify · /ship   │
│   • Atomic      /board · /next · /align · /run-tests ·          │
│                 /review-code · /security-scan                   │
│                                                                 │
│  Each command sets  $env:CLAUDE_AGENT  and  $env:CLAUDE_STORY_ID│
│  before invoking its sub-agent (so the hook can attribute work).│
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  HARNESS LAYER (9 files in .claude/harnesses/)                  │
│  Per-agent YAML contract:                                       │
│   • modes / inputs / outputs / prerequisites / error_modes      │
│   • memory.reads · memory.writes (the only paths it may touch)  │
│   • tools_allowed (mirrored in agent frontmatter — enforced)    │
│   • can_invoke (which other agents it may call)                 │
│                                                                 │
│  Each agent reads its own harness as the first thing it does.   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  AGENT LAYER (9 files in .claude/agents/)                       │
│   tracker · clarify · architect · backend · frontend · qa ·     │
│   auditor · devops · doc-writer                                 │
│                                                                 │
│  Each agent .md file has frontmatter (tools: enforced by Claude │
│  Code) + a # Harness preamble + the system prompt.              │
└──────────────────────────┬──────────────────────────────────────┘
                           │  uses Write/Edit/Bash...
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  MEMORY LAYER (.claude/memory/)                                 │
│  Domain-shared:  kanban.json · plan.json · requirements.md ·    │
│                  architecture/ · decisions/ · patterns/ ·       │
│                  security/findings.json · delivery.md           │
│  Per-story:      stories/{id}/{contracts,test_plan,             │
│                                 test_results,bugs,build_log,    │
│                                 review,doc_summary}             │
│  Audit:          events.jsonl  (hook-appended on every mutation)│
└──────────────────────────┬──────────────────────────────────────┘
                           │  PostToolUse fires
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  HOOK LAYER (.claude/hooks/log-event.ps1)                       │
│  Receives tool JSON on stdin, reads $CLAUDE_AGENT and           │
│  $CLAUDE_STORY_ID from environment, appends 1 JSONL line.       │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Agent invocation chain

```
USER
  │  /design
  ▼
COMMAND  (commands/design.md)
  │  $env:CLAUDE_AGENT = 'architect'
  │  invokes →
  ▼
AGENT  (agents/architect.md)
  │  Reads harness:  harnesses/architect.harness.yaml
  │  Validates prerequisites (plan.json exists?)
  │  Uses tools allowed by frontmatter: Read, Write, Edit, Grep, Glob
  │  May invoke:   auditor    (declared in can_invoke)
  │  May NOT invoke: backend, frontend, ...
  │
  │  writes  .claude/memory/architecture/system-design.yaml
  │              │
  │              ▼  triggers
  │           PostToolUse hook
  │              │
  │              ▼
  │           events.jsonl gets one line
  │
  │  invokes auditor for Design REVIEW
  ▼
NESTED AGENT  (auditor REVIEW)
  │  $env:CLAUDE_AGENT is updated to 'auditor' by the parent context
  │  same enforcement rules apply
  ▼
returns PASS / FAIL  →  architect continues to EXTRACT mode
```

### 1.3 Stage data flow

```
                       ┌───────────────────────────────────┐
                       │  tracker (cross-cutting)          │
                       │  source of truth at every stage   │
                       │  .claude/memory/kanban.json       │
                       └─────────────┬─────────────────────┘
                                     │
   ┌──────────┐    ┌─────────┐    ┌──┴────┐    ┌────────┐    ┌──────┐
   │ CLARIFY  │ →  │ DESIGN  │ →  │ BUILD │ →  │ VERIFY │ →  │ SHIP │
   └────┬─────┘    └────┬────┘    └───┬───┘    └────┬───┘    └───┬──┘
        │               │             │             │            │
        ▼               ▼             ▼             ▼            ▼
   clarify         architect      backend       auditor       devops
                                  frontend      SECURITY      doc-writer
                                  qa                          auditor
                                  auditor                     DELIVERY
                                  doc-writer
        │               │             │             │            │
        ▼               ▼             ▼             ▼            ▼
  requirements    architecture    stories/{id}/  security/   delivery.md
  .md             /system-        contracts      findings    repo files:
                  design.yaml     test_plan      .json       Dockerfile
  plan.json       /design_        test_results               manifests
  kanban.json     review.md       bugs                       CI/CD
                  stories/{id}/   review                     updated docs/
                  contracts.json  build_log
                                  doc_summary
```

### 1.4 The "lean" wins

| Principle | How it's enforced |
|---|---|
| **Lean agent count** | 9 agents with clear domain separation — one cross-cutting state agent (`tracker`) + 5 lifecycle-stage builders + 3 domain specialists |
| **Context optimization** | Each agent's harness declares `memory.reads` — agents pull only what they need from per-story or domain memory; no giant context dumps |
| **Scope enforcement** | Two layers: declarative (`harnesses/*.yaml` — `tools_allowed`, `can_invoke`, `memory.writes`) + hard (Claude Code respects the `tools:` field in agent frontmatter) |
| **Automatic audit** | `PostToolUse` hook → every Write/Edit/Bash logged to `events.jsonl` with agent + story attribution — no agent self-discipline required |
| **Stage handoffs** | File-based — no state machine, no manifest. Each agent's `prerequisites` list the files that must exist; missing → named `error_mode` pointing back to the upstream stage |

---

## 2. The 5-stage lifecycle

| Stage | Name | Primary agent(s) | Output (the handoff to the next stage) |
|---|---|---|---|
| 1 | **CLARIFY** | `clarify` (INTERROGATE → PLAN) | `requirements.md` (ALIGNED) + `plan.json` + `kanban.json` |
| 2 | **DESIGN** | `architect` (DESIGN → EXTRACT), gated by `auditor` REVIEW | `architecture/system-design.yaml` (PASS) + `stories/{id}/contracts.json` per story |
| 3 | **BUILD** | `backend` + `frontend` + `qa` + `auditor` REVIEW + `doc-writer` (per story, via `/execute-story`) | repo code + migrations + `stories/{id}/*` (test_plan, results, bugs, review, build_log, doc_summary) |
| 4 | **VERIFY** | `auditor` SECURITY (project-wide) | `security/findings.json` (verdict: BLOCKED or CLEAR) |
| 5 | **SHIP** | `devops` + `doc-writer` (final) + `auditor` DELIVERY | repo infra (Dockerfile, manifests, CI/CD) + final `docs/` + `delivery.md` (recommendation) |

Gates between stages are **implicit** when you run stage commands individually — you decide when to run the next stage. Inside `/full-pipeline` there are **3 explicit human gates**: after CLARIFY (plan approval), after VERIFY (only if BLOCKED), end of SHIP (GO/NO-GO).

---

## 3. Agent reference (9)

Each agent is defined by **three files**:
- `.claude/agents/{name}.md` — frontmatter (with tool enforcement) + harness preamble + system prompt
- `.claude/harnesses/{name}.harness.yaml` — scope contract
- (no separate state file — agent state lives in `.claude/memory/`)

### 3.1 `tracker` (cross-cutting)

> **When to use**: any time you need the source of truth for story state — what's todo, in_progress, done — or to schedule what's ready next.

| Attribute | Detail |
|---|---|
| **Modes** | `INIT`, `MOVE`, `STATUS`, `NEXT` |
| **Writes** | `.claude/memory/kanban.json` |
| **Tools** | Read, Write, Edit |
| **Invokes** | nothing (leaf agent) |
| **Triggered by commands** | `/clarify` (PLAN) · `/build` · `/board` · `/next` · `/execute-story` |

**Mode breakdown**:
- `INIT` — create fresh board from a story list (all stories start in "todo").
- `MOVE` — advance one story (`todo → in_progress → done`; forward only).
- `STATUS` — read and return current board.
- `NEXT` — return list of stories whose dependencies are all done. Detects `DEADLOCK`.

**Direct invocation example** (not via command):
```
@tracker MOVE { story_id: 'US-001', from: 'todo', to: 'in_progress' }
```

---

### 3.2 `clarify` (Stage 1)

> **When to use**: starting a new idea, or returning to amend requirements that were vague the first time.

| Attribute | Detail |
|---|---|
| **Modes** | `INTERROGATE`, `PLAN` |
| **Writes** | `requirements.md` · `plan.json` |
| **Tools** | Read, Write, Edit, Grep, Glob |
| **Invokes** | `tracker` (only in PLAN, calls INIT) |
| **Triggered by commands** | `/align` (INTERROGATE only) · `/clarify` (both) · `/full-pipeline` |

**Mode breakdown**:
- `INTERROGATE` — adversarial alignment. Surfaces ambiguity, missing scale/scope, error-path gaps. Emits one of: **ALIGNED** | **NEEDS_CLARIFICATION** | **REJECT**. No PRD, no plan.
- `PLAN` — requires `requirements.md` with verdict `ALIGNED`. Asks the user once: *"agents, humans, or both?"* (gates story sizing). Produces PRD, vertical-slice phases, all stories with GIVEN/WHEN/THEN AC. Calls `tracker INIT` to write the board.

**Hard rule**: phases MUST be vertical slices (DB + Backend + Frontend + QA). Horizontal layers like "DB phase" are rejected.

---

### 3.3 `architect` (Stage 2)

> **When to use**: after `/clarify` to produce the system design, then to slice it into per-story contracts.

| Attribute | Detail |
|---|---|
| **Modes** | `DESIGN`, `EXTRACT` |
| **Writes** | `architecture/system-design.yaml` · `stories/{id}/contracts.json` |
| **Tools** | Read, Write, Edit, Grep, Glob |
| **Invokes** | `auditor` (REVIEW Design — mandatory gate between DESIGN and EXTRACT) |
| **Triggered by commands** | `/design` · `/full-pipeline` |

**Mode breakdown**:
- `DESIGN` — full system architecture in one pass: component boundaries, service interfaces, API contracts (with error schemas), DB schema, event schemas. Strict YAML output. Every decision must cite a requirement.
- `EXTRACT` — slices reviewed design into per-story contracts. **Self-resolving CONTRACT_GAP loop**: if a story's AC requires a contract not present, architect switches to DESIGN mode internally for targeted amendment, then re-extracts affected stories. No human intervention.

**Hard rule**: EXTRACT refuses to run against unreviewed design (`UNREVIEWED_DESIGN` error).

---

### 3.4 `backend` (Stage 3)

> **When to use**: per-story, inside `/execute-story` — to implement backend code, DB migrations, and unit tests for one story.

| Attribute | Detail |
|---|---|
| **Modes** | single |
| **Writes** | source code in repo · `db/migrations/*.sql` · `stories/{id}/build_log.json` |
| **Tools** | Read, Write, Edit, Grep, Glob, **Bash** (to run unit tests) |
| **Invokes** | nothing |
| **Triggered by commands** | `/execute-story` · `/build` |

**Operating contract**:
- Reads `context/tech-stack.md` to select framework (JVM → hexagonal, Node → clean, Django → MTV).
- Reads `stories/{id}/contracts.json` for the API/DB/event contracts to implement.
- Reads `stories/{id}/test_plan.yaml` to know what tests must pass.
- **Database role folded in**: generates versioned SQL migrations (UP + DOWN blocks). Reads existing migrations to compute next version. Never reuses or skips.
- Runs unit tests via Bash before reporting done. **Never claims results it didn't execute.**

**Hard rules**:
- `CONTRACT_INCOMPLETE` if required contracts are missing — no partial implementation.
- Never creates new APIs, modifies existing schemas, or invents fields/events.
- If a qa test fails, fix the implementation — never modify a test unless it's fundamentally wrong vs. the contract.

---

### 3.5 `frontend` (Stage 3)

> **When to use**: per-story, inside `/execute-story` — to build UI for one story.

| Attribute | Detail |
|---|---|
| **Modes** | single |
| **Writes** | UI components + routing in repo · `stories/{id}/build_log.json` (appended) |
| **Tools** | Read, Write, Edit, Grep, Glob, Bash |
| **Invokes** | nothing |
| **Triggered by commands** | `/execute-story` · `/build` |

**Operating contract**:
- Reads `context/tech-stack.md` (defaults to Next.js).
- Reads `stories/{id}/contracts.json` for api_contracts + ui_requirements.
- Always implements routing for pages this story introduces.
- State management ONLY if specified in tech-stack.md or required by AC.

**Hard rules**:
- Match API contracts EXACTLY — `CONTRACT_DRIFT` if it would call an endpoint not in the contract.
- Handle every response code defined in the contract.
- No shared abstractions beyond story scope.

---

### 3.6 `qa` (Stage 3 + 4)

> **When to use**: PLAN — to write tests before implementation. RETEST — to execute tests and report actual results.

| Attribute | Detail |
|---|---|
| **Modes** | `PLAN`, `RETEST` |
| **Writes** | test files in repo · `stories/{id}/test_plan.yaml` · `stories/{id}/test_results.json` · `stories/{id}/bugs.json` |
| **Tools** | Read, Write, Edit, Grep, Glob, Bash |
| **Invokes** | nothing |
| **Triggered by commands** | `/execute-story` · `/build` · `/run-tests` · `/verify` (per-story path) |

**Mode breakdown**:
- `PLAN` — writes executable test code (not pseudocode). One test per AC + edge cases. Tests will fail red — that's correct.
- `RETEST` — executes tests via Bash using the framework from `context/tech-stack.md` (gradlew test, vitest, cypress run, etc.). Reports ACTUAL results. **Never predicts pass/fail from reading code.** Regressions auto-flagged as critical severity.

**Hard rule**: A failing test = a critical bug. Always.

---

### 3.7 `auditor` (Stage 3, 4, 5)

> **When to use**: REVIEW — per-story code/test/design audit. SECURITY — project-wide STRIDE+OWASP scan. DELIVERY — final GO/NO-GO package.

| Attribute | Detail |
|---|---|
| **Modes** | `REVIEW`, `SECURITY`, `DELIVERY` |
| **Writes** | `stories/{id}/review.md` · `architecture/design_review.md` · `security/findings.json` · `delivery.md` |
| **Tools** | Read, Write, Edit, Grep, Glob (no Bash — auditing only) |
| **Invokes** | nothing |
| **Triggered by commands** | `/design` (Design REVIEW) · `/execute-story` + `/build` (Code REVIEW) · `/verify` (SECURITY) · `/ship` (DELIVERY) · `/review-code` · `/security-scan` |

**Mode breakdown**:
- `REVIEW` — five sections (Summary, Critical Issues, Warnings, Suggestions, Verdict). Verdict is **PASS** | **FAIL** (soft signal — orchestrator decides response). Enforces Deep Modules checklist on Code reviews.
- `SECURITY` — once at project end. STRIDE threat model + OWASP Top 10 + Auth/AuthZ review + prioritized findings. Verdict: **BLOCKED** (critical findings present) | **CLEAR**. Critical = hardcoded secrets, SQL injection, missing auth, RCE.
- `DELIVERY` — compiles the GO/NO-GO package: executive summary, story-by-story status, QA/security summary, code quality, recommendation (**APPROVE** | **APPROVE WITH CONDITIONS** | **REJECT**), explicit human decision required.

**Hard rule**: DELIVERY refuses to run unless every story is done AND security verdict is CLEAR.

---

### 3.8 `devops` (Stage 5)

> **When to use**: at `/ship` — to generate all infrastructure-as-code and CI/CD config.

| Attribute | Detail |
|---|---|
| **Modes** | single |
| **Writes** | `Dockerfile` · deployment manifests · CI/CD pipeline file · health checks (all in repo) · `decisions/DEC-infra-{ts}.md` |
| **Tools** | Read, Write, Edit, Grep, Glob, Bash |
| **Invokes** | nothing |
| **Triggered by commands** | `/ship` · `/full-pipeline` |

**Operating contract**:
- Reads `context/tech-stack.md` for deployment target (K8s, ECS, Cloud Run, Ansible, etc.). Asks if ambiguous.
- Reads `architecture/system-design.yaml` and `decisions/` for prior infra choices.
- Adapts file formats to whatever target is specified.

**Non-negotiable rules** (will refuse with named error_modes):
- `ROOT_CONTAINER_DETECTED` — every Dockerfile must have a non-root USER directive.
- `HARDCODED_SECRET_DETECTED` — secrets only from external secret managers (Vault, AWS/GCP Secrets Manager, K8s Sealed Secrets).
- `UNPINNED_IMAGE` — never `:latest`. Pin to specific digest or version tag.
- Every service has readiness AND liveness health checks.

---

### 3.9 `doc-writer` (Stage 3 + 5)

> **When to use**: scope=story — after a story completes, surgically update docs. scope=final — at `/ship`, polish and consolidate.

| Attribute | Detail |
|---|---|
| **Modes** | single (with `scope: story | final` argument) |
| **Writes** | `docs/README.md` · `docs/api/{resource}.md` · `docs/adr/ADR-{N}-{slug}.md` (user-selected only) · `docs/runbooks/{feature}.md` (only on new failure mode) · `stories/{id}/doc_summary.md` |
| **Tools** | Read, Write, Edit, Grep, Glob |
| **Invokes** | nothing |
| **Triggered by commands** | `/execute-story` (scope=story) · `/ship` (scope=final) |

**Operating contract**:
- **Reads existing docs first.** Never rewrites; only surgical edits.
- New API endpoint → adds it to `docs/api/{resource}.md` (creates file if new resource).
- New failure mode introduced → creates runbook.
- New decisions during this story → asks user *"Which of these should become an ADR?"*. ADRs generated only for selected entries.

**Hard rule**: `OVERWRITE_REJECTED` if it would overwrite content from a previous story — must edit surgically.

---

## 4. Command reference (13)

All commands set `$env:CLAUDE_AGENT` (and `$env:CLAUDE_STORY_ID` when applicable) before invoking sub-agents, so the logging hook can attribute work correctly.

### 4.1 Pipeline command

#### `/full-pipeline`
> **Run the entire SDLC autonomously, with 3 explicit human gates.**

- **When to use**: when you trust the system to take an idea to a shippable package without manual intermediate review of each stage.
- **Sequence**: `/clarify` → **Gate 1** (plan approval) → `/design` → `/build` (autonomous loop with per-story TDD) → `/verify` → **Gate 2** (if security BLOCKED) → `/ship` → **Gate 3** (final GO/NO-GO).
- **Exception gates**: any `/execute-story` that hits the 5-iteration TDD cap surfaces to the user.

### 4.2 Workflow command

#### `/execute-story {story_id}`
> **Per-story TDD orchestration.** Called by `/build` per ready story; can also be invoked directly.

- **When to use**: when you want to push a single story through the full per-story TDD loop end-to-end.
- **Sequence**: `tracker MOVE` (→ in_progress) → `qa PLAN` → `backend + frontend` (parallel) → **TDD loop**: `qa RETEST` → `auditor REVIEW` → `backend/frontend` fix (max 5 iters) → `auditor REVIEW` (final) → `tracker MOVE` (→ done) → `doc-writer` (scope=story).
- **Escalation**: 5-iteration failure → human pause with full context.

### 4.3 Stage commands (5)

#### `/clarify [raw_idea?]`
> **Stage 1 end-to-end** — INTERROGATE → human gate → PLAN.

- **When to use**: starting a new project. Or to amend the plan (re-run will re-interrogate from existing requirements.md if present).
- **Sequence**: `clarify INTERROGATE` → **human gate** (resolve open questions) → `clarify PLAN` (asks "agents/humans/both?") → `tracker INIT` → `tracker NEXT` (initial ready list).

#### `/design [story_id?]`
> **Stage 2 end-to-end** — DESIGN → internal REVIEW gate → EXTRACT.

- **When to use**: after `/clarify` to produce the system architecture and per-story contracts.
- **Without arg**: runs full DESIGN + EXTRACT for all stories.
- **With `story_id`**: skips DESIGN, only re-extracts contracts for that one story (useful after a targeted design amendment).
- **Sequence**: `architect DESIGN` → `auditor REVIEW (Design)` → (if FAIL, loop) → `architect EXTRACT` (self-resolves CONTRACT_GAPs internally).

#### `/build [story_id?]`
> **Stage 3** — iterate ready stories via per-story TDD, up to 3 in parallel.

- **When to use**: after `/design`, when contracts exist for all stories.
- **Without arg**: gets ready stories via `tracker NEXT`, runs `/execute-story` per story in parallel batches of 3, refreshes ready list as stories complete.
- **With `story_id`**: runs `/execute-story` for just that one story.
- **Stops** when kanban shows `todo == 0 && in_progress == 0`, OR on TDD escalation.

#### `/verify [story_id?]`
> **Stage 4** — project-wide SECURITY scan; or per-story RETEST + REVIEW.

- **When to use**: after `/build` to check security; or to re-verify one story after fixes.
- **Without arg**: invokes `auditor SECURITY` over full codebase. Verdict: BLOCKED | CLEAR.
- **With `story_id`**: invokes `qa RETEST` + `auditor REVIEW` for that one story.

#### `/ship`
> **Stage 5** — generate infra + final docs + delivery package → human GO/NO-GO.

- **When to use**: after `/verify` returns CLEAR.
- **Sequence**: `devops` (Dockerfile, manifests, CI/CD) → `doc-writer (scope=final)` (consolidation + ADR selection) → `auditor DELIVERY` (package) → **human gate** (APPROVE | APPROVE WITH CONDITIONS | REJECT) → decision logged to `decisions/`.

### 4.4 Atomic commands (6)

These are inner-loop tools you reach for during iteration without re-running a whole stage.

#### `/board`
> **Show current kanban state.**

- **When to use**: any time you want to see what's in todo / in_progress / done.
- **Invokes**: `tracker STATUS`.

#### `/next`
> **Show which stories are unblocked right now.**

- **When to use**: planning your next move during BUILD.
- **Invokes**: `tracker NEXT` with the full story list from `plan.json` and current board state.
- **Detects**: `DEADLOCK` (no ready stories AND no in_progress AND todo remaining → circular dependency).

#### `/align`
> **Re-interrogate requirements WITHOUT re-planning.**

- **When to use**: requirements have shifted; you want a fresh adversarial pass without regenerating the plan/backlog.
- **Invokes**: `clarify INTERROGATE` only. Writes `requirements.md`. Stops at human gate.

#### `/run-tests {story_id}`
> **Re-execute tests for one story.**

- **When to use**: after fixing a bug, when you want to verify the fix without going through the full TDD loop.
- **Invokes**: `qa RETEST` for the story.

#### `/review-code {story_id} [type?]`
> **Re-review code or test artifacts for one story.**

- **When to use**: after refactoring or edits, when you want an independent quality check.
- **Invokes**: `auditor REVIEW` (type=Code by default; pass type=Test for test files; type=Design with no story_id for architecture review).

#### `/security-scan`
> **Re-run project-wide security scan.**

- **When to use**: after fixing critical findings, to confirm CLEAR.
- **Invokes**: `auditor SECURITY` (same as the project-wide path of `/verify`).

---

## 5. Harness format

Every agent has a sibling harness file at `.claude/harnesses/{name}.harness.yaml`. The agent reads it as the first thing it does in any invocation. **Scope violations are refusals**, not silent successes.

### 5.1 Schema (Standard + error_modes)

```yaml
agent: {name}                    # must match the file name and the agent .md frontmatter name
purpose: |                       # one-paragraph contract — read by humans and the agent itself
  ...

modes:                           # only if the agent is multi-mode (4 of 9 are)
  MODE_NAME:
    inputs:                      # what the caller (or memory) provides
      - field: type description
    outputs:                     # what gets written and where
      - .claude/memory/path
    prerequisites:               # files that must exist before this mode is allowed to run
      - .claude/memory/X exists
      - X.verdict == 'ALIGNED'
    error_modes:                 # named refusal cases — these are the failure vocabulary
      - ERROR_NAME: human-readable explanation

memory:
  reads:                         # the ONLY memory paths this agent will read
    - .claude/memory/...
  writes:                        # the ONLY memory paths this agent may write
    - .claude/memory/...

tools_allowed: [Read, Write, Edit, Grep, Glob, Bash]   # also enforced via agent frontmatter `tools:`
can_invoke: [other-agent-name]   # which other agents this agent may call (often empty)
```

### 5.2 Why this works

| Concern | How the harness handles it |
|---|---|
| **Context bloat** | `memory.reads` is a closed list — agent pulls only what's declared. No "everything in /memory" dumps. |
| **Tool drift** | `tools_allowed` mirrors the agent's `tools:` frontmatter. Claude Code **literally won't allow** a disallowed tool to be called — hard enforcement. |
| **Stage handoff** | `prerequisites` make every agent self-policing. A downstream agent refuses if upstream stage didn't write the expected file. |
| **Hidden coupling** | `can_invoke` documents the dependency graph. The full set of allowed agent-to-agent edges is visible by `cat`ing the harnesses. |
| **Debugging vocabulary** | `error_modes` give every refusal a name (e.g. `MISSING_REQUIREMENTS`, `CONTRACT_DRIFT`, `ROOT_CONTAINER_DETECTED`). Greppable. |

### 5.3 Example harness — `clarify.harness.yaml` (excerpt)

```yaml
agent: clarify
purpose: |
  Stage 1 of the lifecycle. Two modes:
  - INTERROGATE: adversarial alignment of a raw idea → ALIGNED/NEEDS_CLARIFICATION/REJECT
  - PLAN: convert ALIGNED requirements → PRD + vertical phases + user stories + tracker INIT

modes:
  PLAN:
    inputs:
      - execution_mode: agent | human | both
    outputs:
      - .claude/memory/plan.json
      - .claude/memory/kanban.json     # via tracker INIT
    prerequisites:
      - .claude/memory/requirements.md exists with verdict: ALIGNED
    error_modes:
      - MISSING_REQUIREMENTS: requirements.md absent — run /align first
      - UNALIGNED_REQUIREMENTS: requirements present but verdict != ALIGNED
      - HORIZONTAL_PHASE: a generated phase is a horizontal layer — must rewrite as vertical slice
memory:
  reads:
    - .claude/memory/requirements.md
    - .claude/memory/decisions/
    - .claude/memory/patterns/
  writes:
    - .claude/memory/requirements.md
    - .claude/memory/plan.json
tools_allowed: [Read, Write, Edit, Grep, Glob]
can_invoke: [tracker]
```

---

## 6. Memory architecture

```
.claude/memory/
├── kanban.json                   ← tracker — story state (single source of truth)
├── requirements.md               ← clarify INTERROGATE — verdict + assumptions + open Qs
├── plan.json                     ← clarify PLAN — PRD + phases + stories + dependencies
├── architecture/
│   ├── system-design.yaml        ← architect DESIGN
│   └── design_review.md          ← auditor REVIEW (Design)
├── stories/{story_id}/           ← all per-story working state lives here
│   ├── contracts.json            ← architect EXTRACT
│   ├── test_plan.yaml            ← qa PLAN
│   ├── test_results.json         ← qa RETEST
│   ├── bugs.json                 ← qa RETEST
│   ├── build_log.json            ← backend + frontend
│   ├── review.md                 ← auditor REVIEW (Code/Test)
│   └── doc_summary.md            ← doc-writer (scope=story)
├── security/
│   └── findings.json             ← auditor SECURITY
├── delivery.md                   ← auditor DELIVERY (final GO/NO-GO package)
├── decisions/                    ← architectural/product decisions (ADR sources)
│   └── DEC-{slug}.md
├── patterns/                     ← hand-curated code patterns (read-only reference)
│   └── {pattern}.md
└── events.jsonl                  ← hook-appended audit log (every file mutation)
```

### 6.1 Two layers

| Layer | What lives here | Lifetime |
|---|---|---|
| **Domain-shared** | `kanban.json` · `plan.json` · `requirements.md` · `architecture/` · `decisions/` · `patterns/` · `security/findings.json` · `delivery.md` | Project lifetime |
| **Per-story** | `stories/{id}/*` | Story lifetime — can be garbage-collected once stories are done and shipped |

### 6.2 Read/write matrix

| Agent | Reads | Writes |
|---|---|---|
| `tracker` | `kanban.json` | `kanban.json` |
| `clarify` | `requirements.md` (PLAN), `decisions/`, `patterns/` | `requirements.md`, `plan.json` |
| `architect` | `plan.json`, `architecture/system-design.yaml`, `decisions/`, `patterns/`, `stories/*/contracts.json` (gap re-extract) | `architecture/system-design.yaml`, `stories/{id}/contracts.json` |
| `backend` | `stories/{id}/{contracts,test_plan,bugs}`, `decisions/`, `patterns/` | `stories/{id}/build_log.json` (+ repo code + migrations) |
| `frontend` | `stories/{id}/{contracts,bugs}`, `decisions/`, `patterns/` | `stories/{id}/build_log.json` (+ repo UI) |
| `qa` | `stories/{id}/{contracts,test_plan,test_results}` | `stories/{id}/{test_plan,test_results,bugs}` (+ repo test files) |
| `auditor` | `stories/*/*`, `architecture/`, `kanban.json`, `security/findings.json`, `decisions/` | `stories/{id}/review.md`, `architecture/design_review.md`, `security/findings.json`, `delivery.md` |
| `devops` | `architecture/`, `decisions/`, `kanban.json` | `decisions/DEC-infra-*.md` (+ repo infra files) |
| `doc-writer` | `stories/{id}/{contracts,build_log}`, `decisions/`, `kanban.json` | `stories/{id}/doc_summary.md` (+ repo docs) |

(The hook layer writes `events.jsonl` regardless of agent.)

---

## 7. Event logging hook

### 7.1 Config

`.claude/settings.json`:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|NotebookEdit|Bash",
        "hooks": [
          { "type": "command", "command": "powershell.exe -NoProfile -ExecutionPolicy Bypass -File .claude/hooks/log-event.ps1" }
        ]
      }
    ]
  }
}
```

### 7.2 Hook script behavior (`.claude/hooks/log-event.ps1`)

1. Reads hook JSON from stdin (Claude Code provides `tool_name`, `tool_input`, etc.).
2. Skips `Read | Grep | Glob | WebFetch` etc. (matcher already filters, but defensive).
3. Reads `$env:CLAUDE_AGENT` and `$env:CLAUDE_STORY_ID` set by the calling command file.
4. Truncates Bash commands > 500 chars.
5. Appends one JSONL line to `.claude/memory/events.jsonl` (UTF-8 without BOM).

### 7.3 Log entry shape

```jsonl
{"ts":"2026-05-26T10:23:14Z","agent":"qa","story_id":"US-003","tool":"Write","path":".claude/memory/stories/US-003/test_plan.yaml","ok":true}
{"ts":"2026-05-26T10:23:18Z","agent":"qa","story_id":"US-003","tool":"Bash","command":"./gradlew test --tests UserRegistrationTest","ok":true}
{"ts":"2026-05-26T10:24:01Z","agent":"backend","story_id":"US-003","tool":"Edit","path":"src/main/java/com/kanban/UserService.java","ok":true}
```

### 7.4 Querying the log

```powershell
# Everything qa did for story US-003
Get-Content .claude/memory/events.jsonl |
  ForEach-Object { $_ | ConvertFrom-Json } |
  Where-Object { $_.agent -eq 'qa' -and $_.story_id -eq 'US-003' }

# Every file the architect touched today
$today = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
Get-Content .claude/memory/events.jsonl |
  ForEach-Object { $_ | ConvertFrom-Json } |
  Where-Object { $_.agent -eq 'architect' -and $_.ts -like "$today*" } |
  Select-Object ts, tool, path
```

---

## 8. Common workflows

### 8.1 One-shot end-to-end (autonomous, 3 gates)

```
/full-pipeline
  └── Gate 1 — review & approve plan
  └── (autonomous design + build with per-story TDD)
  └── Gate 2 — if security BLOCKED, fix and re-verify
  └── Gate 3 — APPROVE / APPROVE WITH CONDITIONS / REJECT
```

### 8.2 Deliberate stage-by-stage

```
/clarify          → review requirements + plan
/design           → review architecture
/build            → review delivered stories
/verify           → review security findings
/ship             → GO/NO-GO
```

### 8.3 Surgical iteration on one story

```
/build US-003          # one story only
/run-tests US-003      # re-run tests after a fix
/review-code US-003    # re-review after edits
# Repeat until clean, then advance.
```

### 8.4 Resuming after a break

```
/board                 # see what's in todo / in_progress / done
/next                  # see what's unblocked right now
/execute-story US-007  # pick up a ready story
```

### 8.5 Recovering from a TDD escalation

When `/execute-story` hits the 5-iteration cap and pauses for human input:

1. Inspect `.claude/memory/stories/{id}/bugs.json` for the latest failing tests.
2. Inspect `.claude/memory/stories/{id}/review.md` for auditor's failure analysis.
3. Decide:
   - **Fix the design** (the contracts are wrong) → run `/design {id}` to amend; then resume.
   - **Split the story** (it's too big) → edit `plan.json`, re-`tracker INIT` with new stories.
   - **Override** (your judgment, the loop is wrong) → manually `tracker MOVE` to done.

---

## 9. Decision matrix — when to use what

### 9.1 Which command for which intent?

| You want to... | Use |
|---|---|
| Start a new project from an idea | `/full-pipeline` (autonomous) or `/clarify` (deliberate) |
| Re-align a vague plan without regenerating it | `/align` |
| Re-generate plan from already-aligned requirements | `/clarify` (skips INTERROGATE if requirements.md is ALIGNED) |
| Produce the system architecture | `/design` |
| Re-extract contracts for one story after amendment | `/design US-003` |
| Build all ready stories | `/build` |
| Build only one story | `/build US-003` or `/execute-story US-003` |
| Re-run tests for one story | `/run-tests US-003` |
| Re-review code for one story | `/review-code US-003` |
| Re-review test files | `/review-code US-003 Test` |
| Re-review the architecture | `/review-code (no id) Design` |
| Project-wide security scan | `/security-scan` or `/verify` |
| Per-story re-verify | `/verify US-003` |
| Ship the project | `/ship` |
| See the board | `/board` |
| See unblocked stories | `/next` |

### 9.2 Which agent for which work?

| Work | Agent | Mode |
|---|---|---|
| Resolve ambiguity in requirements | `clarify` | INTERROGATE |
| Generate PRD + backlog | `clarify` | PLAN |
| Design the system | `architect` | DESIGN |
| Extract per-story contracts | `architect` | EXTRACT |
| Write backend code, migrations, unit tests | `backend` | (single) |
| Write UI components, routing | `frontend` | (single) |
| Write tests (TDD red) | `qa` | PLAN |
| Execute tests, report results | `qa` | RETEST |
| Review code or tests | `auditor` | REVIEW |
| Review the design | `auditor` | REVIEW (type=Design) |
| Security scan | `auditor` | SECURITY |
| Compile final GO/NO-GO package | `auditor` | DELIVERY |
| Generate infra + CI/CD | `devops` | (single) |
| Update docs incrementally | `doc-writer` | (scope=story) |
| Final docs consolidation | `doc-writer` | (scope=final) |
| Manage story state | `tracker` | INIT/MOVE/STATUS/NEXT |

### 9.3 When do I need a human in the loop?

| Trigger | Decision the human makes |
|---|---|
| `clarify INTERROGATE` returns NEEDS_CLARIFICATION | Answer the open questions |
| `clarify PLAN` asks execution mode | "agents", "humans", or "both" |
| `auditor SECURITY` returns BLOCKED | Fix critical findings before /ship |
| `/execute-story` hits 5-iteration TDD cap | Fix design, split story, or override |
| `auditor DELIVERY` produces delivery.md | APPROVE / APPROVE WITH CONDITIONS / REJECT |
| `doc-writer` lists new decisions | Which become formal ADRs? |

---

## 10. File layout

```
.claude/
├── agents/                       ← 9 active agents (discoverable by Claude Code)
│   ├── tracker.md
│   ├── clarify.md
│   ├── architect.md
│   ├── backend.md
│   ├── frontend.md
│   ├── qa.md
│   ├── auditor.md
│   ├── devops.md
│   └── doc-writer.md
├── commands/                     ← 13 active commands
│   ├── full-pipeline.md
│   ├── execute-story.md
│   ├── clarify.md
│   ├── design.md
│   ├── build.md
│   ├── verify.md
│   ├── ship.md
│   ├── board.md
│   ├── next.md
│   ├── align.md
│   ├── run-tests.md
│   ├── review-code.md
│   └── security-scan.md
├── harnesses/                    ← 9 per-agent scope contracts
│   └── {agent}.harness.yaml × 9
├── hooks/
│   └── log-event.ps1             ← PostToolUse hook (PowerShell)
├── memory/                       ← runtime state (see §6 for full structure)
│   ├── kanban.json
│   ├── requirements.md
│   ├── plan.json
│   ├── architecture/
│   ├── stories/{id}/
│   ├── security/
│   ├── decisions/
│   ├── patterns/
│   └── events.jsonl
├── settings.json                 ← hook config (PostToolUse)
├── settings.local.json           ← per-developer tool permissions (gitignored)
└── README.md                     ← this file
```
