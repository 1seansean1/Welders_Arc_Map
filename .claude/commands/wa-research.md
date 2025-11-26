## Deep Research Protocol (AI Governor §10)

For complex issues requiring systematic investigation.

### When to Use
- Bug persists after 2+ fix attempts
- Multiple symptoms may share unknown common cause
- Issue requires domain expertise (orbital mechanics, WebGL, async timing)
- Behavior contradicts documentation
- "It works sometimes" scenarios

### Step 1: Read Context
Read in parallel:
- C:\Users\seanp\Workspace\WA_map\AI_GOVERNOR.md (§10 Deep Research Protocol)
- C:\Users\seanp\Workspace\WA_map\LESSONS.md (past patterns)
- C:\Users\seanp\Workspace\WA_map\BUGS.md (related bugs)

### Step 2: Execute Research Framework

**PHASE 1: SCOPE DEFINITION**
- Catalog all symptoms
- Document reproduction conditions
- Trace affected component chain

**PHASE 2: DOMAIN DEEP-DIVE**
- Gather authoritative sources
- Identify domain constraints
- Map assumptions vs. verified facts

**PHASE 3: HYPOTHESIS TREE**
- List all plausible root causes
- Rank by: likelihood × testability × impact
- Design minimal experiments for top 3

**PHASE 4: SYSTEMATIC ELIMINATION**
- Test one variable at a time
- Document: hypothesis → prediction → result → conclusion
- Stop when root cause is PROVEN

**PHASE 5: RESOLUTION & PREVENTION**
- Implement fix with clear rationale
- Add regression test
- Update LESSONS.md with pattern

### Output Requirements
1. Research Log (timestamped notes)
2. Hypothesis Matrix (ranked causes with test results)
3. Root Cause Statement (single sentence, proven)
4. Fix Specification
5. Prevention Pattern

**Do not attempt fixes until Phase 4 completes with proven root cause.**
