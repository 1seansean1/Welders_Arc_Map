# Comprehensive Test Suite Plan

## Overview

This plan extends the hypothesis-driven testing framework to cover the entire application, following the same scientific methodology established in `PLAN_MAP_DEBUG_OPTIMIZE.md`.

---

## Part 1: Test Suite Architecture

### Test Categories

| Category | Scope | Run Time | Location |
|----------|-------|----------|----------|
| **Unit** | Single function/module | <1s each | In-browser, automated |
| **Integration** | Cross-module flows | 1-5s each | In-browser, automated |
| **E2E** | User workflows | 5-30s each | In-browser, manual trigger |
| **Performance** | Benchmarks/stress | 10-60s each | In-browser, manual trigger |
| **Regression** | Known bug fixes | <1s each | In-browser, automated |

### Hypothesis ID Conventions

```
Category Prefixes:
  H-STATE-n    State management tests
  H-EVENT-n    Event bus tests
  H-UI-n       UI component tests
  H-MAP-n      Map rendering tests (existing: H-DRIFT, H-TIME, H-SYNC, H-PERF, H-BATCH)
  H-DATA-n     Data/API tests
  H-VALID-n    Validation tests
  H-UTIL-n     Utility function tests
  H-FLOW-n     Integration flow tests
  H-PERF-n     Performance tests
```

---

## Part 2: New Test Modules

### 2.1 State Module Tests

#### H-STATE-1: Satellite State Immutability
```javascript
{
    id: 'H-STATE-1',
    name: 'Satellite State Immutability',
    hypothesis: 'getAllSatellites() returns deep copy, not reference',
    symptom: 'External mutations corrupt internal state',
    prediction: 'Modifying returned array should not affect state',
    threshold: { mutationDetected: false }
}
```

#### H-STATE-2: Sensor Selection Persistence
```javascript
{
    id: 'H-STATE-2',
    name: 'Sensor Selection Persistence',
    hypothesis: 'Selection state persists across render cycles',
    symptom: 'Checkbox states reset unexpectedly',
    prediction: 'Selection survives table re-render',
    threshold: { selectionPreserved: true }
}
```

#### H-STATE-3: Time Pending State
```javascript
{
    id: 'H-STATE-3',
    name: 'Time Pending Changes',
    hypothesis: 'Time changes marked pending until applied',
    symptom: 'Changes apply immediately without confirmation',
    prediction: 'hasPendingChanges() true after set, false after apply',
    threshold: { pendingCorrect: true }
}
```

#### H-STATE-4: Sort State Cycle
```javascript
{
    id: 'H-STATE-4',
    name: 'Sort State 3-Click Cycle',
    hypothesis: 'Column sort cycles: asc -> desc -> default',
    symptom: 'Sort gets stuck or skips states',
    prediction: '3 clicks return to original order',
    threshold: { cycleComplete: true }
}
```

### 2.2 Event Bus Tests

#### H-EVENT-1: Event Delivery
```javascript
{
    id: 'H-EVENT-1',
    name: 'Event Delivery',
    hypothesis: 'Events delivered to all subscribers',
    symptom: 'Some handlers not called',
    prediction: 'N subscribers = N calls',
    threshold: { allCalled: true }
}
```

#### H-EVENT-2: Once Listener Cleanup
```javascript
{
    id: 'H-EVENT-2',
    name: 'Once Listener Auto-Removal',
    hypothesis: 'once() listeners removed after first call',
    symptom: 'Handler called multiple times',
    prediction: 'Second emit does not call handler',
    threshold: { callCount: 1 }
}
```

### 2.3 UI Component Tests

#### H-UI-1: Panel Expand/Collapse
```javascript
{
    id: 'H-UI-1',
    name: 'Panel Expand/Collapse',
    hypothesis: 'Panel state toggles correctly',
    symptom: 'Panel stuck open or closed',
    prediction: 'togglePanel() inverts state',
    threshold: { stateToggled: true }
}
```

#### H-UI-2: Section Switching
```javascript
{
    id: 'H-UI-2',
    name: 'Section Switching',
    hypothesis: 'Only one content section visible at a time',
    symptom: 'Multiple sections visible or none',
    prediction: 'Exactly 1 section has display:block',
    threshold: { visibleSections: 1 }
}
```

#### H-UI-3: Modal Form Validation
```javascript
{
    id: 'H-UI-3',
    name: 'Modal Form Validation',
    hypothesis: 'Invalid input prevents save',
    symptom: 'Invalid data saved to state',
    prediction: 'Save button disabled with invalid input',
    threshold: { invalidRejected: true }
}
```

#### H-UI-4: Table Row Highlight
```javascript
{
    id: 'H-UI-4',
    name: 'Table Row Highlight',
    hypothesis: 'Only one row highlighted at a time',
    symptom: 'Multiple rows highlighted',
    prediction: 'Clicking row removes highlight from others',
    threshold: { highlightedRows: 1 }
}
```

### 2.4 Validation Tests

#### H-VALID-1: Coordinate Bounds
```javascript
{
    id: 'H-VALID-1',
    name: 'Coordinate Validation',
    hypothesis: 'Invalid coordinates rejected',
    symptom: 'Out-of-range coords accepted',
    prediction: 'Lat > 90 or < -90 returns error',
    threshold: { invalidRejected: true }
}
```

#### H-VALID-2: TLE Checksum
```javascript
{
    id: 'H-VALID-2',
    name: 'TLE Checksum Validation',
    hypothesis: 'TLE checksum verified on input',
    symptom: 'Corrupted TLE accepted',
    prediction: 'Wrong checksum returns validation error',
    threshold: { checksumValidated: true }
}
```

### 2.5 Integration Flow Tests

#### H-FLOW-1: Add Sensor Flow
```javascript
{
    id: 'H-FLOW-1',
    name: 'Add Sensor Full Flow',
    hypothesis: 'New sensor appears in table and map',
    symptom: 'Sensor missing from table or map',
    prediction: 'Table row count +1, map layer includes sensor',
    threshold: { tableUpdated: true, mapUpdated: true }
}
```

#### H-FLOW-2: Time Change Flow
```javascript
{
    id: 'H-FLOW-2',
    name: 'Time Change Propagation',
    hypothesis: 'Time change updates all dependent components',
    symptom: 'Some components show old time',
    prediction: 'Satellite positions recalculated for new time',
    threshold: { allUpdated: true }
}
```

---

## Part 3: Test Results Enhancement

### 3.1 Result Persistence

Store test results in localStorage for historical tracking:

```javascript
// Result storage structure
{
    version: '1.0',
    runs: [
        {
            id: 'run-2025-11-26-143052',
            timestamp: '2025-11-26T14:30:52.000Z',
            duration: 12450,  // ms
            environment: {
                userAgent: '...',
                screenSize: '1920x1080',
                devicePixelRatio: 1
            },
            summary: {
                total: 24,
                passed: 22,
                failed: 2,
                skipped: 0
            },
            results: [
                {
                    hypothesisId: 'H-DRIFT-1',
                    name: 'Initial Zoom Offset',
                    passed: true,
                    duration: 145,
                    measurements: {
                        leafletZoom: 4,
                        deckglZoom: 3,
                        difference: 0.0
                    },
                    timestamp: '2025-11-26T14:30:53.145Z'
                },
                // ... more results
            ]
        },
        // ... previous runs (keep last 50)
    ]
}
```

### 3.2 Result Dashboard

New UI section in test panel showing:

```
+----------------------------------+
| Test History                     |
+----------------------------------+
| Last Run: 2025-11-26 14:30       |
| Result: 22/24 PASSED (91.7%)     |
+----------------------------------+
| Trend (last 10 runs):            |
| ████████░░ 92% → 91% → 92%      |
+----------------------------------+
| Failed Tests:                    |
| - H-PERF-1: Dropped 12% frames  |
| - H-BATCH-1: Ratio 96%          |
+----------------------------------+
| [View Details] [Export] [Clear] |
+----------------------------------+
```

### 3.3 Result Actions

| Action | Description |
|--------|-------------|
| **Export JSON** | Download full run history as JSON |
| **Export CSV** | Download summary table as CSV |
| **Compare Runs** | Side-by-side comparison of two runs |
| **Baseline Diff** | Compare current to saved baseline |
| **Clear History** | Remove all stored results |

### 3.4 Regression Detection

Automatic alerts when:
- A previously passing test fails
- Performance degrades >10% from baseline
- New test added to suite

```javascript
// Regression detection
function detectRegressions(currentRun, previousRun) {
    const regressions = [];

    for (const result of currentRun.results) {
        const prev = previousRun.results.find(r => r.hypothesisId === result.hypothesisId);

        if (prev && prev.passed && !result.passed) {
            regressions.push({
                hypothesisId: result.hypothesisId,
                type: 'pass_to_fail',
                previous: prev,
                current: result
            });
        }
    }

    return regressions;
}
```

---

## Part 4: Implementation Plan

### Phase 1: Foundation ✅ COMPLETE (2025-11-26)

1. **Create test infrastructure** ✅
   - `static/modules/test/testRegistry.js` - All hypothesis definitions (17 tests)
   - `static/modules/test/testResults.js` - Result storage/retrieval with versioning

2. **Add result persistence** ✅
   - localStorage wrapper with versioning (STORAGE_VERSION: '1.0')
   - Result serialization/deserialization
   - History pruning (keep last 50 runs via MAX_RUNS constant)

3. **Update test panel UI** ✅
   - Result history display with last run summary
   - Export buttons (JSON, CSV)
   - Clear history functionality
   - Regression detection with alerts in console

### Phase 2: State Tests ✅ COMPLETE (2025-11-26)

4. **Implement state module tests** ✅
   - H-STATE-1: Satellite State Immutability
   - H-STATE-2: Sensor Selection Persistence
   - H-STATE-3: Time Pending Changes
   - H-STATE-4: Sort State 3-Click Cycle

5. **Implement event bus tests** ✅
   - H-EVENT-1: Event Delivery to All Subscribers
   - H-EVENT-2: Once Listener Auto-Removal

### Phase 3: UI Tests ✅ COMPLETE (2025-11-26)

6. **Implement UI component tests** ✅
   - H-UI-1: Panel Expand/Collapse
   - H-UI-2: Section Switching (one section visible)
   - H-UI-4: Table Row Highlight (single highlight)
   - Note: H-UI-3 (Modal Form Validation) deferred - requires modal interaction

7. **Implement validation tests** ✅
   - H-VALID-1: Coordinate Bounds Validation
   - H-VALID-2: TLE Checksum Validation

### Phase 4: Integration Tests (Pending)

8. **Implement flow tests** (Pending)
   - H-FLOW-1: Add Sensor Full Flow
   - H-FLOW-2: Time Change Propagation
   - Multi-step assertions
   - Async completion handling

9. **Add performance benchmarks** (Pending)
   - Baseline capture
   - Threshold assertions
   - Trend tracking

### Phase 5: Polish (Week 5)

10. **Dashboard and reporting**
    - Visual trend charts
    - Detailed failure analysis
    - Comparison tools

11. **Documentation**
    - Test writing guide
    - Hypothesis template
    - Contribution guidelines

---

## Part 5: Test Writing Template

Every new test follows this template:

```javascript
// In testRegistry.js
'H-CATEGORY-N': {
    id: 'H-CATEGORY-N',
    name: 'Short Name',
    category: 'state|event|ui|map|data|valid|util|flow|perf',
    hypothesis: 'Statement of what should be true',
    symptom: 'What user sees when broken',
    prediction: 'Specific measurable outcome if working',
    nullPrediction: 'What happens if broken',
    threshold: { /* specific pass criteria */ },
    causalChain: [
        'SYMPTOM: User-visible problem',
        'PROXIMATE: Immediate technical cause',
        'ROOT: Underlying code issue',
        'MECHANISM: Why root causes symptom',
        'FIX: How to resolve'
    ],
    testFn: async () => { /* implementation */ }
}
```

---

## Part 6: Files to Create/Modify

### New Files

| File | Purpose | Status |
|------|---------|--------|
| `static/modules/test/testRegistry.js` | All hypothesis definitions | ✅ Created |
| `static/modules/test/testResults.js` | Result persistence | ✅ Created |
| `static/modules/test/testRunner.js` | Enhanced test execution | Merged into testPanel.js |
| `static/modules/test/stateTests.js` | State module tests | Merged into testRegistry.js |
| `static/modules/test/eventTests.js` | Event bus tests | Merged into testRegistry.js |
| `static/modules/test/uiTests.js` | UI component tests | Merged into testRegistry.js |
| `static/modules/test/validationTests.js` | Validation tests | Merged into testRegistry.js |
| `static/modules/test/flowTests.js` | Integration flow tests | Pending |

### Modified Files

| File | Changes | Status |
|------|---------|--------|
| `testPanel.js` | Add result history UI, export buttons | ✅ Complete |
| `automated-tests.js` | Scientific logging, hypothesis registry | ✅ Complete |
| `bootstrap.js` | Register new test modules | ✅ Complete |

---

## Part 7: Success Criteria

The test suite is complete when:

1. **Coverage**: All 26 modules have at least 1 test
2. **Reliability**: Tests pass consistently (no flaky tests)
3. **Speed**: Full suite runs in <60 seconds
4. **Persistence**: Results stored and retrievable
5. **Trends**: Historical comparison available
6. **Regressions**: Auto-detected and highlighted
7. **Documentation**: All tests follow template

---

## Approval Checklist

- [x] Test architecture approved
- [x] Hypothesis ID conventions approved
- [x] Result storage format approved
- [x] UI mockup approved
- [x] Implementation phases approved
- [x] Success criteria approved

**User Approval**: APPROVED  Date: 2025-11-26

---

## Implementation Summary (2025-11-26)

### Completed

| Component | Location | Tests |
|-----------|----------|-------|
| Test Results Persistence | `static/modules/test/testResults.js` | N/A (infrastructure) |
| Test Registry | `static/modules/test/testRegistry.js` | 17 hypotheses defined |
| Map Tests | `static/modules/map/automated-tests.js` | 6 tests (H-DRIFT, H-TIME, H-SYNC, H-PERF, H-BATCH) |
| State Tests | `static/modules/test/testRegistry.js` | 4 tests (H-STATE-1 to 4) |
| Event Tests | `static/modules/test/testRegistry.js` | 2 tests (H-EVENT-1, 2) |
| UI Tests | `static/modules/test/testRegistry.js` | 3 tests (H-UI-1, 2, 4) |
| Validation Tests | `static/modules/test/testRegistry.js` | 2 tests (H-VALID-1, 2) |

### Test Panel Features

- Run all 17 tests from Settings → Test Suite
- View pass/fail results with expandable details
- History summary shows last run statistics
- Export results as JSON or CSV
- Clear history to reset localStorage
- Automatic regression detection between runs

### Test Panel UI (Updated 2025-11-26)

Table-based layout matching sensor/satellite panels:

| Column | Width | Content |
|--------|-------|---------|
| St | 28px | Status indicator (-/OK/FAIL/SKIP) |
| ID | 72px | Hypothesis ID (H-DRIFT-1, etc.) |
| Name | flex | Test name |
| Run | 32px | ▶ button for individual test |

- Uses `sensor-table` CSS class for consistent styling
- Uses `sensor-action-btn` for action buttons (Run All, Ablation, Baseline)
- Click row to expand hypothesis/prediction details
- History bar shows pass rate and current status
- Bottom row: run count, JSON/CSV export, Clear buttons

### Usage

1. Open the application
2. Navigate to Settings panel
3. Expand "Test Suite" section
4. Click "Run All Tests" or individual test buttons
5. View results inline and in history summary
6. Export results using JSON/CSV buttons
