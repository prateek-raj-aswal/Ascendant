Run **Stage 5 (SHIP)** — generate deployment artifacts, consolidate documentation, compile final GO/NO-GO package.

WORKFLOW: ship (stage)
Stage: 5 (SHIP)
Human gate: YES — final GO / GO-WITH-CONDITIONS / NO-GO decision at the end.
Prerequisite: every story done AND security verdict CLEAR (from `/verify`).

---

## Step 1: Infrastructure
```powershell
$env:CLAUDE_AGENT = 'devops'
$env:CLAUDE_STORY_ID = $null
```
Invoke `devops`.

Reads `context/tech-stack.md` to select deployment target. Writes directly to repo:
- `Dockerfile` (multi-stage, non-root)
- Deployment manifests (K8s / ECS / Cloud Run / Ansible — per target)
- CI/CD pipeline file (`.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, etc.)
- Health checks + readiness probes

Non-negotiables enforced by `devops` (will refuse otherwise): non-root containers, no hardcoded secrets, no `:latest` tags, health checks on every service.

## Step 2: Documentation consolidation
```powershell
$env:CLAUDE_AGENT = 'doc-writer'
```
Invoke `doc-writer` with scope=final.

Reads existing `docs/` and all per-story `doc_summary.md` files. Surgical edits only — polish README, finalize ADRs, integrate runbooks. Asks user once which decisions_log entries should become ADRs.

## Step 3: Compile delivery package
```powershell
$env:CLAUDE_AGENT = 'auditor'
```
Invoke `auditor` DELIVERY.

Reads every story's review.md, test_results.json, bugs.json, plus security/findings.json (must be CLEAR — refuses otherwise). Writes `.claude/memory/delivery.md` with executive summary, story-by-story status, code quality assessment, and recommendation: **APPROVE** | **APPROVE WITH CONDITIONS** | **REJECT**.

## HUMAN GATE — Final GO/NO-GO
Present `.claude/memory/delivery.md` to user.

Decision:
- **APPROVE** → log to `.claude/memory/decisions/DEC-final-{timestamp}.md`. Pipeline complete.
- **APPROVE WITH CONDITIONS** → each condition becomes a real backlog story; append to plan.json + tracker INIT-add (or MOVE prior board to "blocked").
- **REJECT** → log feedback to decisions/. Pipeline stops. Address blockers and re-run from the affected stage.

---

## Outputs
- Infrastructure files in repo
- Updated `docs/` (README, ADRs, runbooks)
- `.claude/memory/delivery.md`
- `.claude/memory/decisions/DEC-final-{timestamp}.md` (decision logged)

## Success Criteria
- [ ] Dockerfile present (non-root, pinned image)
- [ ] Deployment manifests written
- [ ] CI/CD pipeline file present
- [ ] `delivery.md` complete with explicit recommendation
- [ ] Human decision recorded
