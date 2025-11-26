---
description: Complete feature implementation with all AI Governor mandatory actions (user)
---

# Feature Implementation Workflow

Complete end-to-end feature workflow: gather requirements → plan → implement → test → document → commit.

---

## Phase 1: Gather Requirements

**User provides feature request.** Extract and summarize:

```
Feature: [name]
Description: [what it does]
Location: [where it lives]
Priority: [infer P0-P3 from context]
```

**Then immediately proceed to Phase 2.** Do not ask for confirmation.

---

## Phase 2: Answer Four Mandatory Questions (AI Governor §3)

Before implementation, explicitly answer:

| Question | Answer |
|----------|--------|
| 1. What exists now? | [Current state of affected code/UI] |
| 2. What should exist? | [Target state after implementation] |
| 3. How will we know we're done? | [Testable success criteria] |
| 4. How do we undo this? | [Rollback plan - git revert, feature flag, etc.] |

---

## Phase 3: Plan Implementation

Read relevant existing code first, then create implementation plan:

1. **Files to modify**: List each file and what changes
2. **Files to create**: Any new modules/components
3. **Dependencies**: What this feature depends on
4. **Risks**: What could go wrong

---

## Phase 4: Implement Feature

Execute the implementation plan:
- [ ] Create/modify files as planned
- [ ] Follow existing code patterns
- [ ] No TODO/FIXME left unaddressed
- [ ] Self-review for obvious issues

---

## Phase 5: Verify Build/Server

- [ ] Start server: `venv\Scripts\python backend\main.py`
- [ ] Confirm no startup errors
- [ ] App loads at http://localhost:8000

---

## Phase 6: Create Tests

Add hypothesis-driven test(s) in `static/modules/test/testRegistry.js`:

```javascript
{
    id: 'FEAT-XXX',
    hypothesis: 'If [condition], then [expected behavior]',
    category: '[category]',
    steps: [
        { action: '...', expected: '...' }
    ],
    validate: async () => { /* return true/false */ }
}
```

---

## Phase 7: Run All Tests

- [ ] Open test panel in browser
- [ ] Run ALL tests (not just new ones)
- [ ] Report results: X/Y passing

**If ANY test fails**:
1. Stop and fix the issue
2. Use `/wa-research` if bug is complex
3. Re-run tests until ALL pass

**Do NOT proceed until all tests pass.**

---

## Phase 8: Update Documentation

### 8a. FEATURES.md
- [ ] Add feature entry with ID, name, priority, complexity, status=DONE
- [ ] Update Summary Statistics (totals and completion %)
- [ ] Update Version History

### 8b. PLAN.md
- [ ] Move to "Recently Completed" if it was in Active Tasks
- [ ] Add milestone entry if significant

### 8c. BUGS.md (if applicable)
- [ ] Add any bugs found (BUG-XXX format)
- [ ] Close any bugs fixed

### 8d. LESSONS.md (if applicable)
- [ ] Document debugging insights
- [ ] Add prevention patterns

---

## Phase 9: Quality Gates Checklist

```
GATE 1: Code Complete
  [ ] Implementation finished
  [ ] Self-review complete
  [ ] No TODO/FIXME remaining

GATE 2: Tested
  [ ] New tests added
  [ ] All tests pass
  [ ] Manual verification done

GATE 3: Documented
  [ ] FEATURES.md updated
  [ ] PLAN.md updated
  [ ] Other docs as needed

GATE 4: Ready to Commit
  [ ] All gates passed
```

---

## Phase 10: Git Commit AND Push

```bash
git -C "C:/Users/seanp/Workspace/WA_map" add -A
git -C "C:/Users/seanp/Workspace/WA_map" commit -m "<type>(<scope>): <summary>"
git -C "C:/Users/seanp/Workspace/WA_map" push
```

Commit types: feat | fix | docs | refactor | test | chore | perf

---

## Phase 11: Final Report

Provide completion summary:

```
## Feature Complete: [Feature Name]

**Implementation**:
- Files modified: [list]
- Files created: [list]

**Tests**: X/Y passing (including N new tests)

**Documentation Updated**:
- [x] FEATURES.md
- [x] PLAN.md
- [ ] BUGS.md (if applicable)
- [ ] LESSONS.md (if applicable)

**Git**: Committed and pushed to origin/main

**Mandatory Behaviors**: All 7 confirmed
```

---

## Execution Mode

**All phases execute sequentially** - report progress at each phase.
**No confirmation needed** - parse user request and proceed immediately.
**Stop on test failure** - do not skip to documentation if tests fail.

**Start now: Parse the user's feature request and begin Phase 1.**
