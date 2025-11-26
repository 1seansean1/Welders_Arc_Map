# AI GOVERNOR

## Document Authority Statement

**THIS DOCUMENT IS THE AUTHORITATIVE GOVERNANCE FRAMEWORK FOR ALL AI ASSISTANCE ON THIS PROJECT.**

This AI Governor serves as the master reference document that must be consulted, followed, and maintained by any AI system providing assistance on the WA_map codebase. It establishes the methodologies, standards, constraints, and expectations that govern all AI-assisted development work.

### Governance Principles

1. **Mandatory Compliance**: All AI assistants must read and adhere to this document before beginning any work.

2. **Living Document**: This document must be actively maintained. When processes change, lessons are learned, or standards evolve, this document must be updated to reflect current practices.

3. **Single Source of Truth**: This document references the standardized documentation system (FEATURES.md, BUGS.md, LESSONS.md, TESTS.md, PLAN.md) but remains the authoritative guide for AI behavior and methodology.

4. **Continuous Improvement**: AI assistants should identify opportunities to improve this governance framework and propose updates when gaps or ambiguities are discovered.

### Document Hierarchy

```
AI_GOVERNOR.md          <- Master governance (THIS DOCUMENT)
    |
    +-- FEATURES.md     <- Feature registry with status/priority/complexity
    +-- BUGS.md         <- Active bug tracking and resolution history
    +-- LESSONS.md      <- Debugging knowledge and prevention strategies
    +-- TESTS.md        <- Test documentation and coverage tracking
    +-- PLAN.md         <- Active work plan and roadmap
    +-- README.md       <- Project overview for humans
```

### Document Style Mandate

**All edits to AI_GOVERNOR.md must be maximally information-dense.** Minimize tokens while preserving semantic completeness. AI assistants consume this document—optimize for LLM comprehension, not human readability. Brevity = lower cost + faster inference.

### Maintenance Obligation

AI assistants must: flag outdated info, propose additions for new patterns, update referenced docs after work, maintain cross-references, preserve lessons learned.

### Bug Tracking Protocol (Mandatory)

User reports bug → immediately add to BUGS.md using template. Assign sequential BUG-XXX ID, status=OPEN. Update to WIP when fixing, CLOSED when resolved with root cause + solution documented. No prompt required—this is default behavior.

### Git Commit Protocol (Mandatory)

Any change to code or documentation → commit to GitHub immediately after completion. Commit message format: `<type>(<scope>): <summary>`. Types: feat|fix|docs|refactor|test|chore|perf. Push after commit. No prompt required—this is default behavior.

---

**Version**: 2.0.0 | **Last Updated**: 2025-11-26

---

## Table of Contents

1. [Project Description](#1-project-description)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [Codebase Stewardship Philosophy](#3-codebase-stewardship-philosophy)
4. [Implementation Planning Prompt](#4-implementation-planning-prompt)
5. [Testing & Debugging Prompt](#5-testing--debugging-prompt)
6. [Documentation & Git Workflow Prompt](#6-documentation--git-workflow-prompt)
7. [Lessons Learned & Reflection Prompt](#7-lessons-learned--reflection-prompt)
8. [Growth & Future Vision Prompt](#8-growth--future-vision-prompt)
9. [Deployment & User Adoption Prompt](#9-deployment--user-adoption-prompt)

---

## Quick Reference

| Resource | Command/Location |
|----------|------------------|
| **Setup** | `python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt` |
| **Start Server** | `venv\Scripts\python backend\main.py` (from project root) |
| **App URL** | http://localhost:8000 |
| **Tests** | Browser-based at `/static/test-*.html` |
| **Feature Registry** | [FEATURES.md](FEATURES.md) |
| **Bug Tracker** | [BUGS.md](BUGS.md) |
| **Lessons Learned** | [LESSONS.md](LESSONS.md) |
| **Test Documentation** | [TESTS.md](TESTS.md) |
| **Active Plan** | [PLAN.md](PLAN.md) |

**Key Principle**: Prove before fixing, commit before changing, document before forgetting.

---

## Changelog

### [2.0.0] - 2025-11-26
- **MAJOR**: Renamed from `AI_assistance_guide.md` to `AI_GOVERNOR.md`
- **MAJOR**: Added Document Authority Statement establishing governance framework
- **MAJOR**: Established standardized documentation system (FEATURES, BUGS, LESSONS, TESTS, PLAN)
- Updated: Document references to point to new standardized files
- Added: Maintenance obligation for AI assistants

### [1.7.0] - 2025-11-26
- Added: Detailed Provisioning Specifications for IT/DevOps teams
- Added: AWS EC2 Development and Production Environment specs
- Added: Installation script for Amazon Linux 2023
- Added: Azure/GCP/DigitalOcean equivalents table

### [1.6.0] - 2025-11-26
- Added: Changelog section for tracking document evolution
- Added: Deployment Environment Requirements subsection

### [1.5.0] - 2025-11-26
- Initial versioned release
- Comprehensive project documentation for AI assistants

---

## 1. Project Description

**WA_map (Welders Arc Map)** is a high-performance satellite visualization system for tracking and visualizing satellite positions, orbital mechanics, and ground sensor coverage.

### Purpose
- Real-time satellite tracking using SGP4 orbital propagation
- 2D Mercator map visualization with interactive controls
- Ground sensor management with field-of-view (FOV) calculations
- WebSocket-ready architecture for real-time updates

### Repository
- **GitHub**: https://github.com/1seansean1/Welders_Arc_Map
- **Local Path**: Project root directory

### Current Status
- Modularization complete (3,395 lines -> 79-line entry point)
- 23 ES6 modules organized by responsibility
- 60 FPS performance target maintained
- Test infrastructure in place (17 hypothesis-driven tests)
- 81% feature completion (67/83 features)

### Key Metrics

| Metric | Value |
|--------|-------|
| Frontend JS files | 30 |
| Frontend JS lines | ~6,300 |
| Backend Python files | 1 |
| Backend Python lines | ~165 |
| Test assertions | 174+ |
| Features complete | 67/83 (81%) |

---

## 2. Architecture & Tech Stack

### Backend
| Component | Technology |
|-----------|------------|
| Framework | FastAPI 0.122.0+ |
| Server | Uvicorn with auto-reload |
| Orbital Mechanics | Skyfield 1.53 (SGP4 propagation) |
| Data (planned) | PostgreSQL + TimescaleDB |
| Caching (planned) | Redis |

### Frontend
| Component | Technology |
|-----------|------------|
| Map Library | Leaflet.js 1.9.4 (CartoDB Dark Matter tiles) |
| Visualization | Deck.gl 9.0.0 (GPU-accelerated WebGL) |
| Orbital Math | satellite.js 5.0.0 |
| Date Picker | Flatpickr (dark theme) |
| JavaScript | ES6+ modules (no bundler) |

### Module Architecture

```
static/
+-- app.js                     # Entry Point (79 lines)
+-- config.js                  # Configuration Constants
+-- modules/
    +-- data/
    |   +-- propagation.js     # SGP4 calculations
    |   +-- satelliteCRUD.js   # Satellite CRUD operations
    |   +-- sensorCRUD.js      # Sensor CRUD operations
    |   +-- websocket.js       # Real-time updates (stub)
    +-- events/
    |   +-- eventBus.js        # Centralized event communication
    +-- init/
    |   +-- bootstrap.js       # Application initialization
    +-- map/
    |   +-- automated-tests.js # Hypothesis-driven tests
    |   +-- deckgl.js          # WebGL overlay
    |   +-- diagnostics.js     # Performance diagnostics
    |   +-- interactions.js    # Pane resizer, map maximize
    |   +-- leaflet.js         # Map initialization
    +-- state/
    |   +-- satelliteState.js  # Satellite state management
    |   +-- sensorState.js     # Sensor state management
    |   +-- timeState.js       # Time simulation state
    |   +-- uiState.js         # UI state management
    +-- test/
    |   +-- testRegistry.js    # Test hypothesis definitions
    |   +-- testResults.js     # Result persistence
    +-- ui/
    |   +-- controlPanel.js    # Panel expand/collapse
    |   +-- logPanel.js        # Log panel resize
    |   +-- modals.js          # Editor/confirm modals
    |   +-- satelliteTable.js  # Satellite table rendering
    |   +-- sensorTable.js     # Sensor table rendering
    |   +-- testPanel.js       # Test UI
    |   +-- timeControls.js    # Time inputs, Flatpickr
    +-- utils/
        +-- geometry.js        # Coordinate calculations
        +-- logger.js          # Dual console/UI logging
        +-- time.js            # Date/time utilities
        +-- validation.js      # Input validation
```

### Module Dependency Hierarchy

```
utils/ (no dependencies)
  |
  v
events/ (no dependencies)
  |
  v
state/ (depends on: utils, events)
  |
  v
data/ (depends on: state, utils)
  |
  v
ui/ (depends on: state, data, utils)
  |
  v
map/ (depends on: state, data)
  |
  v
init/bootstrap (depends on: everything)
```

### Performance Targets
- 60 FPS rendering
- <16.67ms frame time
- GPU-accelerated CSS transforms
- Passive event listeners

---

## 3. Codebase Stewardship Philosophy

### Core Belief

**Code is a liability. Working software is the asset.**

Every line of code is a future maintenance burden. We write only what is necessary, document why it exists, test that it works, and ensure it can be safely changed or removed.

### The Scientific Method Applied to Software

```
1. OBSERVE    -> What is actually happening? (not what should happen)
2. MEASURE    -> Quantify it. Numbers, not feelings.
3. HYPOTHESIZE -> Form a testable explanation.
4. PREDICT    -> If the hypothesis is true, what specific outcome follows?
5. EXPERIMENT -> Minimal intervention to test the prediction.
6. VALIDATE   -> Did the prediction hold? Accept or reject.
7. ISOLATE    -> Rule out confounding variables.
8. IMPLEMENT  -> Only act on validated understanding.
9. VERIFY     -> Confirm the action achieved the intended result.
```

### Principles

1. **Reversibility Over Confidence**: Every change must be undoable.
2. **Proof Over Trust**: Working code is proven code.
3. **Isolation Over Assumption**: One variable at a time.
4. **Explicit Over Implicit**: What is not written down does not exist.
5. **Incremental Over Monolithic**: Small steps with verification.
6. **Prevention Over Cure**: Make bugs impossible, not just fixable.

### The Four Questions

Before any work, answer:
1. **What exists now?** (Current state, measured)
2. **What should exist?** (Target state, defined)
3. **How will we know we're done?** (Success criteria, testable)
4. **How do we undo this?** (Rollback plan, documented)

### Quality Gates

Work is not done until it passes all gates:

```
GATE 1: Code Complete
  [ ] Implementation finished
  [ ] Self-review complete
  [ ] No TODO/FIXME left unaddressed

GATE 2: Tested
  [ ] Unit tests pass
  [ ] Integration tests pass
  [ ] Manual verification complete

GATE 3: Documented
  [ ] Code comments current
  [ ] Documentation updated
  [ ] FEATURES/BUGS/LESSONS updated as applicable

GATE 4: Committed
  [ ] Atomic commit with clear message
  [ ] Pushed to remote

GATE 5: Verified
  [ ] Works in target environment
  [ ] No regressions detected
```

---

## 4. Implementation Planning Prompt

Use this prompt when beginning any new feature, refactor, or significant code change.

### Prompt

I need to **[DESCRIBE THE WORK]**. Before writing any code, create a detailed implementation plan.

#### Plan Requirements

1. **Header**: Project name, current state, target state, success criteria
2. **Phases**: Break work into phases with clear deliverables
3. **Step Template**:
   ```
   STEP X.Y: [Name]
   Status: [ ]  |  Dependencies: [prior steps]
   Context: [What exists] -> [What changes]
   Tasks: [ ] [Task 1]  [ ] [Task 2]
   Verify: [Test method]  |  Rollback: [Command]
   ```
4. **Phase Summaries**: What was accomplished, metrics, commits
5. **Risk Mitigation**: What could go wrong, rollback procedures
6. **Validation Strategy**: How to verify complete work

**Create the plan. Do not start implementation until approved.**

---

## 5. Testing & Debugging Prompt

Use when investigating bugs, adding tests, or improving test infrastructure.

### Prompt

I need to **[DESCRIBE THE TESTING/DEBUGGING WORK]**. Create a plan following hypothesis-driven methodology.

#### Bug Template
```
BUG X.Y: [Name]
Status: [ ]  |  Severity: [C/H/M/L]
Symptom: [What happens] vs Expected: [What should happen]
Hypothesis: [Cause theory] -> Prediction: [Observable change if true]
Validation: [ ] Hypothesis confirmed  [ ] Root cause certain
Fix: [Files] -> [Change] -> [Why it works]
Regression: [ ] Tests pass  [ ] New test added
```

**Update BUGS.md when resolved. Update LESSONS.md with debugging insights.**

---

## 6. Documentation & Git Workflow Prompt

Use after completing code work to ensure documentation stays synchronized.

### Prompt

I have completed **[DESCRIBE THE WORK]**. Update all affected documentation:

1. **FEATURES.md**: Update feature status if applicable
2. **BUGS.md**: Add or close bugs as applicable
3. **LESSONS.md**: Document any insights learned
4. **TESTS.md**: Update test coverage information
5. **PLAN.md**: Mark tasks complete, update active work

### Commit Message Convention

`<type>(<scope>): <summary>`

Types: feat | fix | docs | refactor | test | chore | perf

---

## 7. Lessons Learned & Reflection Prompt

Use after completing significant work to capture learnings.

### Prompt

I have completed **[DESCRIBE THE WORK]**. Conduct structured reflection:

1. What went wrong? (Mistakes, false assumptions, misestimates)
2. What took longer than expected?
3. What would I do differently?
4. What went well?
5. What did I learn?

**Add findings to LESSONS.md.**

---

## 8. Growth & Future Vision Prompt

Use for exploring scaling, new use cases, or strategic direction.

### Prompt

I want to explore **[GROWTH AREA]**. Create structured analysis:

1. Current state assessment
2. Scaling analysis (if applicable)
3. Feature prioritization matrix
4. Architecture evolution considerations
5. Decision log

**Update FEATURES.md with new planned features. Update PLAN.md with roadmap changes.**

---

## 9. Deployment & User Adoption Prompt

Use for production deployment planning.

### Prompt

I need to plan **[DEPLOYMENT WORK]**. Create structured analysis:

1. Production readiness checklist
2. Deployment strategy
3. Rollback procedures
4. Success criteria

---

## Environment Requirements

### Minimum (Development)
| Resource | Requirement |
|----------|-------------|
| CPU | 2 cores |
| RAM | 2 GB |
| Storage | 500 MB |
| OS | Windows 10+, macOS 12+, Ubuntu 20.04+ |
| Python | 3.12+ |

### Optimal (Production)
| Resource | Requirement |
|----------|-------------|
| CPU | 4+ cores |
| RAM | 8 GB |
| Storage | 10 GB SSD |
| Database | PostgreSQL 14+ with TimescaleDB |
| Cache | Redis 7+ |

### Cloud Equivalents
| Provider | Minimum | Optimal |
|----------|---------|---------|
| AWS | t3.small | t3.large or c6i.xlarge |
| Azure | B2s | D4s_v5 |
| GCP | e2-small | e2-standard-4 |
| DigitalOcean | Basic 2GB | General Purpose 8GB |

---

## Security Considerations

| Vector | Risk | Status | Mitigation |
|--------|------|--------|------------|
| CORS `allow_origins=["*"]` | HIGH | Open | Restrict in production |
| No input validation on API | MEDIUM | Open | Add Pydantic models |
| WebSocket unauthenticated | MEDIUM | Open | Add token auth |
| No HTTPS enforcement | HIGH | Open | Configure TLS |
| No rate limiting | MEDIUM | Open | Add rate limiter |

---

*This document must be read and followed by any AI assistant working on this codebase. Maintain this document as the project evolves.*
