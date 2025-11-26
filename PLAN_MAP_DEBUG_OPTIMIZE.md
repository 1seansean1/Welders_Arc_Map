# Scientific Debugging & Optimization Plan
## Map Rendering, Glitch, Flicker, Location & Timing Sync

---

## Methodology: Hypothesis-Driven Debugging

This plan follows a formal scientific debugging process:

```
1. OBSERVE    → Document exact symptoms with reproducible steps
2. MEASURE    → Quantify the problem with metrics and baselines
3. HYPOTHESIZE → Form testable hypotheses about root causes
4. PREDICT    → State what would change if hypothesis is correct
5. EXPERIMENT → Create minimal intervention to test hypothesis
6. VALIDATE   → Accept/reject hypothesis based on predictions
7. ISOLATE    → Use ablation to eliminate false positives
8. FIX        → Only fix confirmed root causes
9. REGRESS    → Verify fix doesn't break existing behavior
```

### False Positive Elimination Criteria

A fix is ONLY accepted if ALL conditions are met:
1. **Reproducibility**: Problem can be reproduced on demand before fix
2. **Isolation**: Disabling the fix brings the problem back
3. **Specificity**: The fix addresses ONLY the hypothesized cause
4. **No Side Effects**: All existing tests still pass
5. **Causal Chain**: Clear explanation of why fix works

---

## Phase 0: Baseline Measurement

Before any debugging, we must establish quantitative baselines.

### 0.1 Create Measurement Framework

**File**: `static/modules/map/diagnostics.js` (new file)

```javascript
/**
 * Map Diagnostics Module
 * Collects quantitative metrics for debugging
 */

class MapDiagnostics {
    constructor() {
        this.metrics = {
            frameTimings: [],
            syncDrifts: [],
            setPropsCallsPerSecond: [],
            glitchEvents: [],
            resizeEvents: []
        };
        this.isRecording = false;
        this.sampleWindow = 1000; // 1 second window
    }

    startRecording() {
        this.isRecording = true;
        this.metrics = {
            frameTimings: [],
            syncDrifts: [],
            setPropsCallsPerSecond: [],
            glitchEvents: [],
            resizeEvents: []
        };
        this._startTime = performance.now();
    }

    stopRecording() {
        this.isRecording = false;
        return this.generateReport();
    }

    recordFrameTime(ms) {
        if (!this.isRecording) return;
        this.metrics.frameTimings.push({
            time: performance.now() - this._startTime,
            value: ms
        });
    }

    recordSyncDrift(lngDrift, latDrift, zoomDrift) {
        if (!this.isRecording) return;
        this.metrics.syncDrifts.push({
            time: performance.now() - this._startTime,
            lng: lngDrift,
            lat: latDrift,
            zoom: zoomDrift
        });
    }

    recordGlitch(type, details) {
        if (!this.isRecording) return;
        this.metrics.glitchEvents.push({
            time: performance.now() - this._startTime,
            type,
            details
        });
    }

    generateReport() {
        const frameTimes = this.metrics.frameTimings.map(f => f.value);
        const syncDrifts = this.metrics.syncDrifts;

        return {
            duration: performance.now() - this._startTime,
            frames: {
                count: frameTimes.length,
                avg: mean(frameTimes),
                p50: percentile(frameTimes, 50),
                p95: percentile(frameTimes, 95),
                p99: percentile(frameTimes, 99),
                max: Math.max(...frameTimes),
                droppedFrames: frameTimes.filter(t => t > 16.67).length
            },
            sync: {
                samples: syncDrifts.length,
                maxLngDrift: Math.max(...syncDrifts.map(s => s.lng)),
                maxLatDrift: Math.max(...syncDrifts.map(s => s.lat)),
                maxZoomDrift: Math.max(...syncDrifts.map(s => s.zoom)),
                driftEvents: syncDrifts.filter(s => s.lng > 0.001 || s.lat > 0.001).length
            },
            glitches: {
                count: this.metrics.glitchEvents.length,
                byType: groupBy(this.metrics.glitchEvents, 'type')
            }
        };
    }
}

function mean(arr) {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function percentile(arr, p) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}

function groupBy(arr, key) {
    return arr.reduce((acc, item) => {
        const k = item[key];
        acc[k] = (acc[k] || 0) + 1;
        return acc;
    }, {});
}

export const diagnostics = new MapDiagnostics();
```

### 0.2 Baseline Collection Protocol

**BEFORE ANY CHANGES**, collect baseline data:

```javascript
// Console commands to run:

// 1. Start recording
diagnostics.startRecording();

// 2. Perform standard test sequence (in order):
//    a. Pan map slowly left-to-right (5 seconds)
//    b. Pan map quickly in circles (5 seconds)
//    c. Zoom in 5 levels using scroll wheel
//    d. Zoom out 5 levels using scroll wheel
//    e. Resize grid pane by dragging border
//    f. Click maximize button, then restore
//    g. Select/deselect a sensor
//    h. Change time using time controls

// 3. Stop recording and get report
const baseline = diagnostics.stopRecording();
console.log('BASELINE REPORT:', baseline);

// 4. Save baseline for comparison
localStorage.setItem('mapDiagnosticsBaseline', JSON.stringify(baseline));
```

### 0.3 Acceptance Criteria for "Fixed"

A problem is considered FIXED if:

| Metric | Baseline Threshold | Fixed Threshold | Measurement |
|--------|-------------------|-----------------|-------------|
| Frame drops during pan | Document current | 50% reduction OR < 5% of frames | `frames.droppedFrames / frames.count` |
| Max position drift | Document current | < 0.0001 degrees (~10 meters) | `sync.maxLngDrift`, `sync.maxLatDrift` |
| Glitch events | Document current | Zero events | `glitches.count` |
| P95 frame time | Document current | < 16.67ms | `frames.p95` |

---

## Phase 1: Problem Observation & Classification

### 1.1 Symptom Documentation

For each reported issue, document:

```
SYMPTOM FORM
============
Issue ID: [unique identifier]
Category: [rendering | glitch | flicker | location | timing]
Description: [what the user sees]
Reproduction Steps:
  1. [step 1]
  2. [step 2]
  ...
Reproduction Rate: [always | often | sometimes | rarely]
Environment: [browser, screen size, device]
Video/Screenshot: [if available]
```

### 1.2 Observed Issues (To Be Filled)

| ID | Category | Description | Repro Steps | Repro Rate |
|----|----------|-------------|-------------|------------|
| MAP-001 | | | | |
| MAP-002 | | | | |
| MAP-003 | | | | |
| MAP-004 | | | | |

**ACTION REQUIRED**: Before proceeding, observe the app and fill in this table with specific, reproducible issues.

---

## Phase 2: Hypothesis Generation

### 2.1 Hypothesis Template

For each observed issue:

```
HYPOTHESIS FORM
===============
Issue ID: [from symptom form]
Hypothesis ID: H-[issue]-[number]

Statement: "The [symptom] is caused by [mechanism] because [reasoning]"

Evidence For:
  - [code reference or observation supporting hypothesis]
  - [another piece of evidence]

Evidence Against:
  - [anything that contradicts hypothesis]

Testable Prediction:
  IF this hypothesis is correct, THEN:
    - [specific, measurable outcome A]
    - [specific, measurable outcome B]

Falsification Criteria:
  This hypothesis is FALSE if:
    - [condition that would disprove it]

Code Location: [file:line where problem likely exists]
```

### 2.2 Candidate Hypotheses

#### H-FLICKER-1: Race Between viewState and layers Updates

**Statement**: "Map flicker during pan is caused by viewState and layers being applied in different frames because the batch manager merges them but doesn't guarantee atomic application."

**Evidence For**:
- `deckgl.js:454` - viewState updated on map move event
- `deckgl.js:723` - layers updated separately in updateDeckOverlay()
- Both use same batch manager but may flush at different times

**Evidence Against**:
- Batch manager uses requestAnimationFrame, so updates in same frame should merge
- Need to verify if flicker occurs within single frame or across frames

**Testable Prediction**:
IF correct, THEN:
1. Logging should show viewState update and layers update happening in different `flush()` calls
2. Artificially forcing same-frame updates should eliminate flicker

**Falsification Criteria**:
- If logging shows viewState and layers always in same flush, hypothesis is FALSE
- If forcing same-frame updates doesn't reduce flicker, hypothesis is FALSE

**Test Procedure**:
```javascript
// Add to flush() method:
console.log(`FLUSH #${++flushCount}:`, {
    hasViewState: !!this.pendingUpdates.viewState,
    hasLayers: !!this.pendingUpdates.layers,
    timestamp: performance.now()
});

// Run pan test, analyze log for:
// - Count of flushes with viewState but no layers
// - Count of flushes with layers but no viewState
// - Correlation with observed flicker
```

---

#### H-FLICKER-2: Transition Duration Causing Animation Overlap

**Statement**: "Map flicker is caused by Deck.gl layer transitions despite `transitions: {...: 0}` settings because some properties may still animate."

**Evidence For**:
- Layer definitions include transition settings
- Deck.gl has default transitions that may not be fully disabled

**Evidence Against**:
- Code explicitly sets `transitionDuration: 0` on viewState
- Layer transitions set to 0

**Testable Prediction**:
IF correct, THEN:
1. Setting `transitions: false` (if supported) should eliminate flicker
2. Deck.gl internal state should show active transitions during flicker

**Falsification Criteria**:
- If no transitions are active during flicker events, hypothesis is FALSE

---

#### H-DRIFT-1: Zoom Offset Inconsistency

**Statement**: "Position drift after resize is caused by inconsistent zoom-1 adjustment because some code paths apply it and others don't."

**Evidence For**:
- `deckgl.js:458` applies `zoom: zoom - 1`
- `deckgl.js:780` applies `zoom: zoom - 1`
- Need to verify ALL code paths apply same adjustment

**Testable Prediction**:
IF correct, THEN:
1. Grep for `\.zoom` should find all zoom references
2. Some references should NOT have the `-1` adjustment
3. Adding consistent adjustment should eliminate drift

**Falsification Criteria**:
- If all zoom references correctly apply `-1`, hypothesis is FALSE

**Test Procedure**:
```bash
# Find all zoom references in deckgl.js
grep -n "\.zoom\|zoom:" static/modules/map/deckgl.js
# Manually verify each reference applies correct offset
```

---

#### H-TIME-1: Ground Track Uses Wrong Time Source

**Statement**: "Ground tracks don't reflect simulation time because `new Date()` is used instead of `timeState.getCurrentTime()`."

**Evidence For**:
- `deckgl.js:657` uses `const currentTime = new Date();`
- `timeState.js` exists and provides `getCurrentTime()`
- No import of timeState in deckgl.js top

**Testable Prediction**:
IF correct, THEN:
1. Setting simulation time to yesterday should NOT change ground tracks currently
2. After fix, setting simulation time to yesterday SHOULD change ground tracks

**Falsification Criteria**:
- If ground tracks already respond to timeState changes, hypothesis is FALSE

**Test Procedure**:
```javascript
// 1. Observe current ground track positions
// 2. Set time to yesterday:
timeState.setCurrentTime(new Date(Date.now() - 86400000));
updateDeckOverlay();
// 3. If tracks don't change, hypothesis is supported
```

---

## Phase 3: Controlled Experiments

### 3.1 Experiment Protocol

For each hypothesis:

```
EXPERIMENT FORM
===============
Hypothesis ID: [H-xxx-n]
Experiment ID: E-[hypothesis]-[n]

Control Condition:
  [Exact state of code before experiment]

Independent Variable:
  [What you will change]

Dependent Variable:
  [What you will measure]

Confounding Variables:
  [Other factors that might affect result]
  [How each is controlled]

Procedure:
  1. [Step 1]
  2. [Step 2]
  ...

Expected Results if Hypothesis TRUE:
  [Quantitative prediction]

Expected Results if Hypothesis FALSE:
  [Quantitative prediction]

Actual Results:
  [To be filled after experiment]

Conclusion:
  [ ] Hypothesis SUPPORTED
  [ ] Hypothesis REFUTED
  [ ] Inconclusive - need additional experiment
```

### 3.2 Ablation Study Protocol

To eliminate false positives, every fix must pass ablation:

```
ABLATION FORM
=============
Fix ID: [identifier]
Hypothesis: [which hypothesis this fix addresses]

Step 1: Measure with fix DISABLED
  - Run baseline protocol
  - Record: [metrics]

Step 2: Apply fix

Step 3: Measure with fix ENABLED
  - Run baseline protocol
  - Record: [metrics]

Step 4: DISABLE fix again

Step 5: Measure with fix DISABLED again
  - Run baseline protocol
  - Record: [metrics]

Expected Pattern:
  - Step 1 and Step 5 should have similar metrics (problem present)
  - Step 3 should have improved metrics (problem reduced/eliminated)
  - If Step 1 ≈ Step 3 ≈ Step 5, the fix has NO EFFECT

Conclusion:
  [ ] Fix has CAUSAL effect (Step 1 ≈ Step 5 ≠ Step 3)
  [ ] Fix has NO effect (Step 1 ≈ Step 3 ≈ Step 5)
  [ ] Confounded - cannot determine (inconsistent pattern)
```

---

## Phase 4: Minimal Interventions

### 4.1 Intervention Rules

1. **One Change Per Experiment**: Only modify one variable at a time
2. **Minimal Scope**: Make the smallest possible change to test hypothesis
3. **Reversible**: All changes must be easily reverted
4. **Documented**: Every change recorded with exact diff

### 4.2 Intervention Template

```
INTERVENTION FORM
=================
Intervention ID: I-[n]
For Hypothesis: [H-xxx-n]
For Experiment: [E-xxx-n]

File: [path]
Line(s): [n-m]

Original Code:
```
[exact original code]
```

Modified Code:
```
[exact modified code]
```

Rationale:
  [Why this specific change tests the hypothesis]

Reversal Command:
  git checkout [file] -- OR -- [exact steps to revert]
```

---

## Phase 5: Validation & Acceptance

### 5.1 Fix Acceptance Checklist

A fix is ACCEPTED only if ALL boxes checked:

```
FIX ACCEPTANCE CHECKLIST
========================
Fix ID: [identifier]
Addresses Hypothesis: [H-xxx-n]

□ 1. REPRODUCIBILITY
    □ Problem reproduced before fix (documented with video/log)
    □ Reproduction rate documented: [X out of Y attempts]

□ 2. HYPOTHESIS CONFIRMATION
    □ Experiment E-xxx-n conducted
    □ Results match predictions for "hypothesis TRUE"
    □ Falsification criteria NOT triggered

□ 3. CAUSAL LINK ESTABLISHED
    □ Ablation study completed (disabled → enabled → disabled)
    □ Pattern confirms causal effect
    □ No confounding variables identified

□ 4. SPECIFICITY
    □ Fix modifies ONLY code related to hypothesis
    □ No "while I'm here" improvements included
    □ No unrelated refactoring

□ 5. NO REGRESSION
    □ All existing tests pass
    □ Baseline metrics equal or better
    □ No new issues introduced

□ 6. DOCUMENTED
    □ Causal chain written: [problem] → [cause] → [mechanism] → [fix]
    □ Code comments explain WHY fix works
    □ Regression test added

FINAL DECISION:
  [ ] ACCEPTED - merge fix
  [ ] REJECTED - revert and investigate further
  [ ] DEFERRED - need more evidence
```

### 5.2 Causal Chain Documentation

For each accepted fix:

```
CAUSAL CHAIN
============
Fix ID: [identifier]

OBSERVABLE SYMPTOM:
  [What user sees]
       ↓
PROXIMATE CAUSE:
  [Immediate code behavior causing symptom]
       ↓
ROOT CAUSE:
  [Underlying reason for problematic code behavior]
       ↓
MECHANISM:
  [How root cause leads to proximate cause leads to symptom]
       ↓
FIX:
  [What code change breaks the causal chain]
       ↓
WHY FIX WORKS:
  [Explanation of how fix interrupts the mechanism]
```

---

## Phase 6: Implementation Order

### 6.1 Dependency Graph

Before implementing, identify dependencies:

```
[Baseline Measurement] ─── required before ──→ [Any Experiment]
         │
         ↓
[Symptom Documentation] ─── required before ──→ [Hypothesis Formation]
         │
         ↓
[Hypothesis H-xxx-n] ─── required before ──→ [Experiment E-xxx-n]
         │
         ↓
[Experiment E-xxx-n] ─── required before ──→ [Intervention I-xxx-n]
         │
         ↓
[Intervention I-xxx-n] ─── required before ──→ [Ablation Study]
         │
         ↓
[Ablation Study] ─── required before ──→ [Fix Acceptance]
```

### 6.2 Recommended Order

1. **Day 1: Setup & Baseline**
   - [ ] Add diagnostics.js measurement framework
   - [ ] Collect baseline metrics
   - [ ] Document all observable symptoms with reproduction steps

2. **Day 2: Hypothesis Testing**
   - [ ] Form hypotheses for each symptom
   - [ ] Design experiments
   - [ ] Run experiments, collect data

3. **Day 3: Minimal Interventions**
   - [ ] For confirmed hypotheses, create minimal fixes
   - [ ] Run ablation studies
   - [ ] Accept or reject each fix

4. **Day 4: Integration & Regression**
   - [ ] Combine accepted fixes
   - [ ] Run full baseline protocol again
   - [ ] Verify all metrics improved or unchanged
   - [ ] Document all causal chains

---

## Phase 7: Preventing Accidental Fixes

### 7.1 Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Prevention |
|--------------|--------------|------------|
| Shotgun debugging | Multiple changes obscure causality | One change per experiment |
| Cargo cult fix | Copy solution without understanding | Require causal chain |
| "It works now" | No understanding of why | Require ablation |
| Over-engineering | Fixing things that aren't broken | Require symptom first |
| Scope creep | Refactoring while debugging | Minimal intervention rule |

### 7.2 Red Flags

Stop and reassess if:

- Fix seems to work but you can't explain why
- Ablation study shows inconsistent results
- Fix required multiple unrelated changes
- Problem "goes away" without explicit fix
- Metrics improve but symptom still occasionally appears

### 7.3 "It Just Works" Response Protocol

If something starts working without clear intervention:

1. **STOP** - Don't celebrate yet
2. **DOCUMENT** - What was the last change?
3. **REVERT** - Undo the last change
4. **VERIFY** - Does problem return?
5. **ANALYZE** - If problem returns, you found the fix. If not, something else changed.
6. **INVESTIGATE** - Check for:
   - Browser cache cleared
   - Different test conditions
   - Race condition timing change
   - Placebo effect (observer bias)

---

## Appendix A: Code Locations for Investigation

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Batch Manager | deckgl.js | 54-143 | Batches setProps calls |
| Leaflet Sync | deckgl.js | 383-499 | Syncs Deck.gl with Leaflet |
| Layer Update | deckgl.js | 545-740 | Updates visualization layers |
| Canvas Resize | deckgl.js | 758-797 | Handles container resize |
| Zoom Offset | deckgl.js | 458, 780 | Zoom-1 adjustment |
| Time Source | deckgl.js | 657 | Ground track time |
| Time State | timeState.js | 43-380 | Simulation time management |
| Event Bus | eventBus.js | 39-263 | Inter-module communication |

---

## Appendix B: Measurement Commands

```javascript
// Start full diagnostic session
diagnostics.startRecording();

// Check real-time sync status
window.deckglDebug.validateMapSync();

// View recent setProps calls
window.deckglDebug.getSetPropsHistory();

// Check Deck.gl layer state
window.deckglDebug.getLayerInfo();

// Force layer refresh
window.deckglDebug.forceLayerUpdate();

// Check batch manager state
window.deckglDebug.getUpdateManagerState();

// Stop recording and get report
const report = diagnostics.stopRecording();
console.table(report.frames);
console.table(report.sync);
console.table(report.glitches);
```

---

## Appendix C: Git Commands for Experiments

```bash
# Create experiment branch
git checkout -b experiment/H-xxx-n

# After experiment
git stash  # Save changes temporarily

# Baseline test
# Run tests...

git stash pop  # Restore changes

# With-fix test
# Run tests...

git stash  # Save again

# Verify baseline again
# Run tests...

# If experiment successful:
git checkout main
git merge experiment/H-xxx-n

# If experiment failed:
git checkout main
git branch -D experiment/H-xxx-n
```

---

## Implementation Results (2025-11-25)

### Confirmed & Fixed Issues

#### FIX-001: H-DRIFT-1 - Initial Zoom Offset Missing

**CAUSAL CHAIN:**
```
OBSERVABLE SYMPTOM:
  Position drift on initial load / sensors in wrong place initially
       ↓
PROXIMATE CAUSE:
  Deck.gl viewState zoom doesn't match Leaflet zoom on initialization
       ↓
ROOT CAUSE:
  Line 299 used `zoom: leafletZoom` instead of `zoom: leafletZoom - 1`
  While sync functions (lines 472, 807) correctly used `zoom - 1`
       ↓
MECHANISM:
  Deck.gl MapView uses a different zoom scale than Leaflet.
  Without the -1 offset, coordinates transform incorrectly.
       ↓
FIX:
  Changed line 299 from `zoom: leafletZoom` to `zoom: leafletZoom - 1`
  Added LEAFLET_TO_DECKGL_ZOOM_OFFSET constant and helper function
       ↓
WHY FIX WORKS:
  Consistent zoom offset ensures coordinate transforms match between
  Leaflet and Deck.gl from the very first frame.
```

**File**: `static/modules/map/deckgl.js`
**Lines Changed**: 55-83 (added), 299 (fixed)

---

#### FIX-002: H-TIME-1 - Ground Track Wrong Time Source

**CAUSAL CHAIN:**
```
OBSERVABLE SYMPTOM:
  Ground tracks don't reflect simulation time settings
       ↓
PROXIMATE CAUSE:
  Ground track positions calculated using wall clock time
       ↓
ROOT CAUSE:
  Line 680 used `const currentTime = new Date()` instead of
  `timeState.getCurrentTime()`
       ↓
MECHANISM:
  SGP4 propagation uses the provided time to calculate satellite position.
  Using `new Date()` always shows current positions, ignoring time controls.
       ↓
FIX:
  Changed to `const currentTime = timeState.getCurrentTime()`
  Added eventBus listener for 'time:changed' and 'time:applied' events
       ↓
WHY FIX WORKS:
  Ground tracks now use simulation time from timeState.
  Event listeners ensure tracks update when user changes time.
```

**File**: `static/modules/map/deckgl.js`
**Lines Changed**: 36 (import), 680 (fixed), 610-629 (added)

---

### New Infrastructure Added

#### Diagnostics Framework

**File**: `static/modules/map/diagnostics.js`

Provides quantitative metrics for:
- Frame timing (dropped frames detection)
- Sync drift measurement
- setProps call analysis (race condition detection)
- Glitch event logging
- Resize event tracking

**Console Commands**:
```javascript
// Manual diagnostics
deckglDebug.startDiagnostics()  // Start recording
deckglDebug.stopDiagnostics()   // Stop and view report
deckglDebug.validateMapSync()   // Check current sync state
deckglDebug.saveBaseline()      // Save for comparison
deckglDebug.compareToBaseline() // Compare after changes

// Automated tests
await deckglDebug.runAllTests()  // Run full test suite
await deckglDebug.runAblation()  // Run ablation study
await deckglDebug.testPanSync()  // Test pan synchronization
await deckglDebug.testZoomSync() // Test zoom synchronization
await deckglDebug.testTimeSync() // Test time sync (H-TIME-1)
await deckglDebug.testZoomOffset() // Test zoom offset (H-DRIFT-1)
await deckglDebug.testRapidPan() // Stress test rapid panning
```

#### Automated Test Suite

**File**: `static/modules/map/automated-tests.js`

Tests implemented:
| Test | Validates | Pass Criteria |
|------|-----------|---------------|
| `testInitialZoomOffset` | H-DRIFT-1 fix | Deck.gl zoom = Leaflet zoom - 1 |
| `testPanSync` | Position sync during pan | Zero drift events |
| `testZoomSync` | Position sync during zoom | Zero drift events |
| `testTimeSync` | H-TIME-1 fix | Ground tracks use timeState |
| `testRapidPan` | Stress test | <10% dropped frames, 0 glitches |
| `testSetPropsBatching` | Race conditions | Combined calls exist |

---

### Automated Ablation Testing

To fully validate fixes, run ablation study:

1. **Baseline** (before fixes were applied):
   - Revert commits
   - Run diagnostics, record metrics

2. **With fixes**:
   - Apply fixes
   - Run same test sequence
   - Record metrics

3. **Verify regression**:
   - Revert fixes again
   - Confirm problem returns

Expected pattern:
- Baseline: drift events > 0, time sync fails
- With fixes: drift events = 0, time sync works
- Revert: drift events return

---

## Sign-Off

This plan will be executed only after user approval of:

1. [x] Measurement framework design
2. [x] Symptom documentation completeness
3. [x] Hypothesis-experiment mapping
4. [x] Acceptance criteria thresholds
5. [x] Anti-pattern prevention measures

**User Approval**: APPROVED  Date: 2025-11-25

---

## Update: Comprehensive Test Suite Integration (2025-11-26)

### New Test Infrastructure

The scientific debugging methodology has been extended to cover the entire application with a comprehensive test suite. See `PLAN_COMPREHENSIVE_TEST_SUITE.md` for full details.

#### New Test Modules

| Module | Location | Purpose |
|--------|----------|---------|
| Test Registry | `static/modules/test/testRegistry.js` | Central definition of all 17 test hypotheses |
| Test Results | `static/modules/test/testResults.js` | Persistence, history tracking, regression detection |

#### Test Categories

| Category | Count | Coverage |
|----------|-------|----------|
| Map Tests (H-MAP-*) | 6 | Zoom sync, time sync, pan performance |
| State Tests (H-STATE-*) | 4 | Immutability, selection persistence, pending changes |
| Event Tests (H-EVENT-*) | 2 | Subscriber delivery, once() cleanup |
| UI Tests (H-UI-*) | 3 | Panel toggle, section switching, row highlight |
| Validation Tests (H-VALID-*) | 2 | Coordinate bounds, TLE checksum |

#### Result Persistence Features

- **localStorage storage**: Up to 50 runs preserved
- **Regression detection**: Automatic alerts when previously passing tests fail
- **Export formats**: JSON (full data) and CSV (summary table)
- **History tracking**: Pass rate trends, per-test history

#### Running Tests

```javascript
// In browser console or via Settings panel:

// Run all 17 tests
await window.automatedTests.runAllTests();

// Run specific category
await window.automatedTests.runMapTests();

// View test history
console.log(window.testResults.getAllRuns());

// Export results
window.testResults.download('json');  // or 'csv'

// Detect regressions from last run
console.log(window.testResults.detectRegressions());
```

#### Test Panel Location

Settings → Test Suite section provides UI for:
- Running individual or all tests
- Viewing pass/fail status with details
- Reviewing history summary
- Exporting and clearing results

#### UI Consistency (2025-11-26)

Test panel UI updated to match sensor/satellite table styling:
- Table columns: St (status), ID (hypothesis), Name, Run (▶ button)
- Uses `sensor-table` and `sensor-action-btn` CSS classes
- Expandable rows show hypothesis and prediction on click
- Consistent 8px monospace font and button heights

---

## Update: Ground Track Improvements (2025-11-26)

### Changes Made

| Component | Before | After |
|-----------|--------|-------|
| Step interval | 60 seconds | 20 seconds |
| Points per orbit | 90 | 270 |
| Color | Per-satellite cycling | Grey [128,128,128] |
| Anti-meridian | Artifacts visible | Split into segments |

### Files Modified

| File | Change |
|------|--------|
| `static/modules/data/propagation.js` | Added `splitPathAtAntimeridian()`, changed default stepSeconds to 20 |
| `static/modules/map/deckgl.js` | Updated to handle segment arrays, changed color to grey |

### Anti-Meridian Handling

When satellites cross the ±180° longitude line, the path is now split into separate segments:

```javascript
// Before: Single path with wrap artifact
[[170, 45], [-170, 46]]  // Draws line across entire map

// After: Split into segments
[[[170, 45]], [[-170, 46]]]  // Two separate paths, no artifact
```

Detection threshold: longitude jump > 300° indicates anti-meridian crossing.

### Performance Impact

- Layer creation: ~47ms for 18 satellites (acceptable)
- Only recalculates on selection/time change, not on pan/zoom
- 3x more SGP4 propagations but still <3ms per satellite

### Future: Conditional Coloring

Grey default color prepared for future conditional coloring:
```javascript
const GREY = [128, 128, 128];  // Ready for conditional logic
// Future: color based on satellite type, status, or user selection
```
