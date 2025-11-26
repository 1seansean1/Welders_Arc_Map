## Documentation & Git Workflow (AI Governor §6)

After completing code work, ensure documentation stays synchronized.

### Step 1: Assess Changes
Run git status and git diff to understand what changed.

### Step 2: Update Documentation
Check and update as applicable:
- **FEATURES.md**: Update feature status if feature work
- **BUGS.md**: Close bugs if fixes, add new if discovered
- **LESSONS.md**: Document any insights learned
- **TESTS.md**: Update test coverage information
- **PLAN.md**: Mark tasks complete, update active work

### Step 3: Quality Gate Check
Before committing, verify:
```
GATE 1: Code Complete
  [ ] Implementation finished
  [ ] Self-review complete
  [ ] No TODO/FIXME left unaddressed

GATE 2: Tested
  [ ] Tests pass
  [ ] Manual verification complete

GATE 3: Documented
  [ ] Code comments current
  [ ] Referenced docs updated
```

### Step 4: Commit
Use format: `<type>(<scope>): <summary>`

Types: feat | fix | docs | refactor | test | chore | perf

Example:
```
feat(sensors): add FOV altitude configuration
fix(deckgl): resolve layer flickering on pan
docs(governor): add Deep Research Protocol
```

### Step 5: Push
Push to remote after successful commit.

**Key Principle**: Commit before changing, document before forgetting.
