---
description: Execute Deep Research Protocol for complex/persistent issues (AI Governor §10)
---

## Deep Research Protocol

For complex issues requiring systematic investigation.

### When to Use
- Bug persists after 2+ fix attempts
- Multiple symptoms may share unknown common cause
- Issue requires domain expertise (orbital mechanics, WebGL, async timing)
- Behavior contradicts documentation
- "It works sometimes" scenarios

### Step 1: Gather Context
Read in parallel:
- C:\Users\seanp\Workspace\WA_map\LESSONS.md (check for similar past patterns)
- C:\Users\seanp\Workspace\WA_map\BUGS.md (related bugs)

### Step 2: Collect User Input

Ask the user to describe:
1. **Symptoms**: What exactly happens? (all manifestations)
2. **Reproduction**: Steps to reproduce, when it happens/doesn't
3. **Timeline**: When did it start? What changed recently?
4. **Investigation so far**: What's been tried? What was learned?
5. **Domain context**: Relevant technical area (SGP4, Deck.gl, state, etc.)

### Step 3: Execute 5-Phase Framework

**PHASE 1: SCOPE DEFINITION**
- [ ] Catalog all observed symptoms
- [ ] Document reproduction conditions
- [ ] Establish timeline (when started, what changed)
- [ ] Trace affected component chain
- **Output**: Problem scope statement (1-2 sentences)

**PHASE 2: DOMAIN DEEP-DIVE**
- [ ] Gather authoritative sources (docs, specs)
- [ ] Identify domain constraints (math, physics, protocol rules)
- [ ] Map assumptions vs. verified facts
- [ ] List knowledge gaps
- **Output**: Domain knowledge summary

**PHASE 3: HYPOTHESIS TREE**
- [ ] List ALL plausible root causes (minimum 3)
- [ ] Rank by: likelihood × testability × impact
- [ ] Design minimal experiments for top 3
- [ ] Predict specific outcomes for each
- **Output**: Hypothesis matrix table

**PHASE 4: SYSTEMATIC ELIMINATION**
- [ ] Test ONE variable at a time
- [ ] Document: hypothesis → prediction → result → conclusion
- [ ] Update rankings after each test
- [ ] Continue until root cause is PROVEN
- **Output**: Test log with conclusions

**PHASE 5: RESOLUTION & PREVENTION**
- [ ] Implement fix with clear rationale
- [ ] Add regression test
- [ ] Update LESSONS.md (use template in AI_GOVERNOR.md §10)
- [ ] Update BUGS.md (add/close as applicable)
- [ ] Commit and push changes

### Required Outputs

Present these to user upon completion:
1. **Research Log**: Timestamped investigation notes
2. **Hypothesis Matrix**: Ranked causes with test results
3. **Root Cause Statement**: Single sentence, PROVEN not guessed
4. **Fix Specification**: What changed and why it works
5. **Prevention Pattern**: How to avoid this class of bug

### Critical Rules

- **Do NOT attempt fixes until Phase 4 completes with proven root cause**
- **Do NOT skip phases** - each builds on the previous
- **Document everything** - future sessions will benefit from LESSONS.md

Key Principle: "Prove before fixing, commit before changing, document before forgetting."
