## Testing & Debugging (AI Governor §5)

Use hypothesis-driven methodology to investigate bugs.

### Step 1: Read Context
Read in parallel:
- C:\Users\seanp\Workspace\WA_map\AI_GOVERNOR.md (§5 Testing & Debugging)
- C:\Users\seanp\Workspace\WA_map\BUGS.md (existing bugs)
- C:\Users\seanp\Workspace\WA_map\LESSONS.md (past patterns)

### Step 2: Document the Bug
If not already in BUGS.md, add using this template:
```
### BUG-XXX: [Short Description]
**ID**: BUG-XXX
**Severity**: [CRITICAL|HIGH|MEDIUM|LOW]
**Status**: OPEN
**Date Reported**: YYYY-MM-DD

**Symptoms**:
- [What the user sees]
- [Reproduction steps]
```

### Step 3: Form Hypothesis
```
Hypothesis: [Cause theory]
Prediction: [Observable change if true]
Test: [Minimal experiment to validate]
```

### Step 4: Test & Validate
- Test one variable at a time
- Document results
- Update hypothesis if disproven

### Step 5: Fix & Verify
- Implement fix only after root cause confirmed
- Add regression test
- Update BUGS.md with solution
- Update LESSONS.md if new pattern discovered

**Key Principle**: Prove before fixing.
