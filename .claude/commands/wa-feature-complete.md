---
description: Complete feature implementation with all AI Governor mandatory actions
---

## Feature Completion Protocol

Complete a feature with full AI Governor compliance: gather details, build, test, debug, document, commit.

### Step 1: Gather Feature Details

**Ask the user:**
1. **Feature name/ID**: What feature was implemented? (e.g., SAT-015, TIME-011)
2. **Description**: Brief summary of what was built
3. **Files changed**: Which files were modified/created?
4. **Known issues**: Any concerns or edge cases to test?

**Wait for user response before proceeding.**

### Step 2: Verify Build

Execute build/server startup to ensure no syntax errors:

```bash
cd C:\Users\seanp\Workspace\WA_map
venv\Scripts\python backend\main.py
```

**Check for:**
- [ ] Server starts without errors
- [ ] No import/syntax errors in console
- [ ] App loads at http://localhost:8000

**If build fails**: Stop and fix errors before proceeding.

### Step 3: Run Automated Tests

Open test page and run all tests:
- URL: http://localhost:8000/static/test-runner.html (or test-*.html)
- Execute all hypothesis-driven tests
- Capture results

**Report:**
- Total tests: X
- Passing: X
- Failing: X
- Test names and status

### Step 4: Evaluate Test Results

**Decision point based on test outcomes:**

#### If ALL tests pass:
- [ ] Proceed to Step 6 (Documentation)
- [ ] Capture test summary for commit message

#### If tests FAIL:
- [ ] Identify failing test(s) and symptoms
- [ ] Attempt quick fix (< 5 minutes)
- [ ] Re-run tests

#### If failure persists after 2+ attempts:
**Trigger Deep Research Protocol:**
- Report to user: "Tests failing after multiple attempts. Recommending /wa-research"
- Ask user: "Should I execute the Deep Research Protocol for systematic debugging?"
- If yes → Execute `/wa-research` command
- If no → Document known issues and proceed with user guidance

### Step 5: Add Feature Tests (if missing)

If the new feature lacks test coverage:
- [ ] Add hypothesis-driven test to `static/modules/test/testRegistry.js`
- [ ] Test format:
  ```javascript
  {
      id: 'FEATURE-XXX',
      hypothesis: 'If [condition], then [expected behavior]',
      category: 'feature',
      test: async () => { /* validation logic */ }
  }
  ```
- [ ] Run new test to verify it passes

### Step 6: Update Documentation

Read and update all applicable docs:

**6a. FEATURES.md**
- [ ] Add/update feature entry with status=DONE
- [ ] Update Summary Statistics
- [ ] Update Version History

**6b. PLAN.md**
- [ ] Move task to "Recently Completed"
- [ ] Add milestone entry if significant
- [ ] Update active tasks

**6c. BUGS.md** (if applicable)
- [ ] Add any new bugs discovered (BUG-XXX format)
- [ ] Close any bugs fixed by this feature

**6d. LESSONS.md** (if applicable)
- [ ] Document debugging insights
- [ ] Add prevention patterns

### Step 7: Re-Read AI Governor & Verify Compliance

Read C:\Users\seanp\Workspace\WA_map\AI_GOVERNOR.md

**Verify all 7 mandatory behaviors:**

| # | Behavior | Status |
|---|----------|--------|
| 1 | Read AI_GOVERNOR.md | [ ] |
| 2 | Add bugs to BUGS.md (BUG-XXX format) | [ ] N/A or Done |
| 3 | Commit AND push to origin | [ ] Pending |
| 4 | Answer Four Mandatory Questions | [ ] |
| 5 | Pass all Quality Gates | [ ] |
| 6 | Update referenced docs | [ ] |
| 7 | Flag outdated info, propose additions | [ ] N/A or Done |

**Answer Four Mandatory Questions:**
1. What exists now? [Current state]
2. What should exist? [Target state - achieved]
3. How will we know we're done? [Test results]
4. How do we undo this? [git revert <commit>]

### Step 8: Quality Gates Checklist

```
GATE 1: Code Complete
  [ ] Implementation finished
  [ ] Self-review complete
  [ ] No TODO/FIXME left unaddressed

GATE 2: Tested
  [ ] New tests added for feature
  [ ] All tests pass (X/Y passing)
  [ ] Manual verification complete

GATE 3: Documented
  [ ] FEATURES.md updated
  [ ] PLAN.md updated
  [ ] BUGS.md updated (if applicable)
  [ ] LESSONS.md updated (if applicable)

GATE 4: Committed
  [ ] Atomic commit with clear message
  [ ] Pushed to remote
```

### Step 9: Git Commit AND Push

Execute commit workflow:

```bash
git -C "C:/Users/seanp/Workspace/WA_map" add -A
git -C "C:/Users/seanp/Workspace/WA_map" status
git -C "C:/Users/seanp/Workspace/WA_map" commit -m "<type>(<scope>): <summary>"
git -C "C:/Users/seanp/Workspace/WA_map" push
```

Commit message format: `feat(<scope>): <summary>`
Types: feat | fix | docs | refactor | test | chore | perf

### Step 10: Final Report

Present completion summary:

```
## Feature Completion Report

**Feature**: [ID] - [Name]
**Status**: COMPLETE

### Test Results
- Total: X tests
- Passing: X/X (100%)
- New tests added: [count]

### Documentation Updated
- [x] FEATURES.md
- [x] PLAN.md
- [ ] BUGS.md (N/A)
- [ ] LESSONS.md (N/A)

### Git
- Commit: [hash]
- Pushed: Yes

### Mandatory Behaviors: 7/7 Confirmed
```

---

**Key Principle**: "Prove before fixing, commit before changing, document before forgetting."
