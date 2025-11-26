## Quick Bug Registration (AI Governor §Bug Tracking Protocol)

Immediately register a user-reported bug in BUGS.md.

### Step 1: Read Current Bugs
Read C:\Users\seanp\Workspace\WA_map\BUGS.md to get the next BUG-XXX ID.

### Step 2: Gather Bug Information
Ask user if not provided:
- What is the symptom? (What happens)
- What is expected? (What should happen)
- How to reproduce? (Steps)
- Severity? (CRITICAL/HIGH/MEDIUM/LOW)

### Step 3: Add to BUGS.md
Use this template:
```markdown
### BUG-XXX: [Short Description]
**ID**: BUG-XXX
**Severity**: [CRITICAL|HIGH|MEDIUM|LOW]
**Status**: OPEN
**Date Reported**: YYYY-MM-DD

**Symptoms**:
- [What the user sees]
- [Reproduction steps]

**Root Cause**:
[To be determined]

**Solution**:
[To be determined]

**Files Modified**:
- [To be determined]
```

### Step 4: Commit
Commit the BUGS.md update:
```
docs(bugs): add BUG-XXX [short description]
```

### Step 5: Offer Next Steps
Ask user:
- Investigate now with /wa-debug?
- Deep research with /wa-research?
- Add to backlog for later?

**This is mandatory behavior - no prompt required when user reports a bug.**
