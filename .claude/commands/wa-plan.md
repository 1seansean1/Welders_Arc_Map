## Implementation Planning (AI Governor §4)

Before writing any code, create a detailed implementation plan.

### Step 1: Read Context
Read in parallel:
- C:\Users\seanp\Workspace\WA_map\AI_GOVERNOR.md (§4 Implementation Planning)
- C:\Users\seanp\Workspace\WA_map\PLAN.md (current active work)
- C:\Users\seanp\Workspace\WA_map\FEATURES.md (feature status)

### Step 2: Answer the Four Mandatory Questions
1. **What exists now?** (Current state, measured)
2. **What should exist?** (Target state, defined)
3. **How will we know we're done?** (Success criteria, testable)
4. **How do we undo this?** (Rollback plan, documented)

### Step 3: Create Implementation Plan
Use this structure:
```
PROJECT: [Name]
CURRENT STATE: [What exists]
TARGET STATE: [What should exist]
SUCCESS CRITERIA: [How we know we're done]

PHASE 1: [Name]
  STEP 1.1: [Task]
    Status: [ ] | Dependencies: [prior steps]
    Context: [What exists] -> [What changes]
    Tasks: [ ] [Task 1]  [ ] [Task 2]
    Verify: [Test method] | Rollback: [Command]
```

### Step 4: Await Approval
Present the plan and wait for user approval before implementation.

**Do not start implementation until the plan is approved.**
