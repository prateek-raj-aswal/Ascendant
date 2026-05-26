Execute the test suite for one story and produce a structured bug report.

WORKFLOW: run-tests (atomic)
Human gate: NO.
Prerequisite: `.claude/memory/stories/{story_id}/test_plan.yaml` exists AND test files exist on disk.

Required input: `story_id`.

---

## Step 1
```powershell
$env:CLAUDE_AGENT = 'qa'
$env:CLAUDE_STORY_ID = '{story_id}'
```

Invoke `qa` RETEST for the story.

`qa` will run the tests via Bash using the framework from `context/tech-stack.md`:
```bash
./gradlew test --tests "UserRegistrationTest"
npx vitest run src/test/registration.test.ts
npx cypress run --spec "cypress/e2e/registration.cy.ts"
```

Writes:
- `.claude/memory/stories/{story_id}/test_results.json`
- `.claude/memory/stories/{story_id}/bugs.json` (one entry per failing test; regressions marked critical)

## Success Criteria
- [ ] All tests executed via Bash (never predicted)
- [ ] Actual results reported per test
- [ ] Regressions flagged as critical

Next step: If `has_critical_bugs: true` — fix via backend/frontend and re-run. If false — `/review-code {story_id}` or advance.
