# WA_map Test Documentation

> **Document Type**: TESTS
> **Version**: 1.8
> **Last Updated**: 2025-11-27
> **Maintainer**: AI Governor System

---

## Test Philosophy

All tests follow a **hypothesis-driven** approach inspired by the scientific method:

1. **Hypothesis**: Statement of what should be true
2. **Symptom**: What user sees when broken
3. **Prediction**: Specific measurable outcome if working
4. **Threshold**: Quantitative pass criteria

---

## Test Categories

| Category | Prefix | Count | Purpose |
|----------|--------|-------|---------|
| Map | H-MAP-* | 6 | Leaflet-Deck.gl synchronization |
| State | H-STATE-* | 4 | State module integrity |
| Event | H-EVENT-* | 2 | Event bus functionality |
| UI | H-UI-* | 3 | User interface components |
| Validation | H-VALID-* | 2 | Input validation |
| Satellite | H-SAT-*, H-GLOW-* | 7 | Satellite rendering and glow effects |
| Time | H-TIME-* | 8 | Time control functionality |
| List | H-LIST-* | 7 | User list functionality |
| Profile | H-PROFILE-* | 7 | User profiles and settings |
| Polar | H-POLAR-* | 7 | Polar plot functionality |
| **Total** | | **53** | |

---

## Test Matrix

### Map Tests (H-MAP-*)

| ID | Name | Status | Description |
|----|------|--------|-------------|
| H-DRIFT-1 | Initial Zoom Offset | PASS | Deck.gl zoom = Leaflet zoom - 1 |
| H-TIME-1 | Ground Track Time Source | PASS | Tracks use timeState, not wall clock |
| H-SYNC-1 | Pan Synchronization | PASS | Zero drift during pan operations |
| H-SYNC-2 | Zoom Synchronization | PASS | Zero drift during zoom operations |
| H-PERF-1 | Rapid Pan Performance | ADVISORY | Reports frame metrics (informational, not pass/fail) |
| H-BATCH-1 | setProps Batching | PASS | Updates combined per frame |

### State Tests (H-STATE-*)

| ID | Name | Status | Description |
|----|------|--------|-------------|
| H-STATE-1 | Satellite State Immutability | PASS | getAllSatellites() returns deep copy |
| H-STATE-2 | Sensor Selection Persistence | PASS | Selection survives table re-render |
| H-STATE-3 | Time Pending Changes | PASS | hasPendingChanges() tracks correctly |
| H-STATE-4 | Sort State Cycle | PASS | 3 clicks: asc → desc → default |

### Event Tests (H-EVENT-*)

| ID | Name | Status | Description |
|----|------|--------|-------------|
| H-EVENT-1 | Event Delivery | PASS | All subscribers receive events |
| H-EVENT-2 | Once Listener Cleanup | PASS | once() auto-removes after first call |

### UI Tests (H-UI-*)

| ID | Name | Status | Description |
|----|------|--------|-------------|
| H-UI-1 | Panel Expand/Collapse | PASS | togglePanel() inverts state |
| H-UI-2 | Section Switching | PASS | Exactly 1 section visible |
| H-UI-4 | Table Row Highlight | PASS | Only 1 row highlighted at a time |

### Validation Tests (H-VALID-*)

| ID | Name | Status | Description |
|----|------|--------|-------------|
| H-VALID-1 | Coordinate Bounds | PASS | Lat >90 or <-90 rejected |
| H-VALID-2 | TLE Checksum | PASS | Invalid checksum rejected |

### Satellite Tests (H-SAT-*, H-GLOW-*)

| ID | Name | Status | Description |
|----|------|--------|-------------|
| H-SAT-1 | Satellite Selection | PASS | Selected sats appear on map |
| H-SAT-3 | Anti-Meridian Wrapping | PASS | Tracks wrap at date line |
| H-GLOW-1 | Equator Crossing Detection | PASS | Crossings detected when lat changes sign |
| H-GLOW-2 | Glow Fade Timing | PASS | Intensity = 0 beyond fade window |
| H-GLOW-3 | Glow Enable Toggle | PASS | setGlowEnabled toggles correctly |
| H-GLOW-4 | Gradual Fade-In | PENDING | Intensity monotonically increases approaching crossing |
| H-GLOW-5 | Gradual Fade-Out | PENDING | Intensity monotonically decreases after crossing |
| H-GLOW-6 | Fade Controls Responsiveness | PENDING | Changing fade values affects glow timing |

### Time Tests (H-TIME-*)

| ID | Name | Status | Description |
|----|------|--------|-------------|
| H-TIME-1 | Ground Track Time Source | PASS | Tracks use timeState, not wall clock |
| H-TIME-5 | Playback Rate State | PENDING | setPlaybackRate/getPlaybackRate work correctly |
| H-TIME-6 | Preset Sets Analysis Window | PENDING | Time presets apply correct start/stop times |
| H-TIME-7 | Seek Points API | PENDING | addSeekPoint/getSeekPoints/removeSeekPoint work |
| H-TIME-8 | Valid Playback Rates Enforced | PENDING | Invalid rates rejected with error |
| H-TIME-9 | DateTime Inputs Sync with State | PENDING | Inputs update when presets applied (compact MM/DD format) |
| H-TIME-10 | Play/Pause Toggle | PENDING | Play button toggles ‖/▶, stop button removed |
| H-TIME-11 | Compact Time Bar with Flatpickr | PENDING | Flatpickr replaces native datetime, compact layout |
| H-TIME-12 | Ctrl+Wheel Jog Control | PENDING | Ctrl+wheel scrubs time, blocks map zoom |

### List Tests (H-LIST-*)

| ID | Name | Status | Description |
|----|------|--------|-------------|
| H-LIST-1 | List CRUD Operations | PENDING | Create, read, delete lists work correctly |
| H-LIST-2 | List Satellite Management | PENDING | Add/remove satellites from lists |
| H-LIST-3 | List Visibility Toggle | PENDING | Toggle visibility changes state and emits event |
| H-LIST-4 | Visible Satellite IDs Aggregation | PENDING | Union of visible list satellites, no duplicates |
| H-LIST-5 | Satellite Table Simplified | PENDING | Table has Color, NORAD, Name columns (no Sel/Star/List) |
| H-LIST-6 | +Sat and +List Buttons | PENDING | +Sat in Satellites panel, +List in Watch Lists panel |
| H-LIST-7 | Lists Tab Removed | PENDING | No data-section="lists" in navigation |

### Profile Tests (H-PROFILE-*)

| ID | Name | Status | Description |
|----|------|--------|-------------|
| H-PROFILE-1 | Default Profile Auto-Load | PASS | On init, default profile auto-loaded from backend |
| H-PROFILE-2 | Login Modal Dismissible | PENDING | Login modal can be skipped without login |
| H-PROFILE-3 | Profile Settings Persistence | PENDING | Settings saved to backend and restored on reload |
| H-PROFILE-4 | Profile API CRUD | PASS | Create/Read/Update/Delete profiles via API |
| H-PROFILE-5 | Login Authentication | PASS | Login with correct credentials returns profile |
| H-PROFILE-6 | Stubbed Roles Structure | PASS | Roles exist with permissions array (admin/user/viewer) |
| H-PROFILE-7 | Settings JSON Blob Storage | PASS | Settings stored as JSON with default values |

### Polar Plot Tests (H-POLAR-*)

| ID | Name | Status | Description |
|----|------|--------|-------------|
| H-POLAR-1 | Polar Plot Checkbox Toggle | PASS | Checkbox toggles container visibility |
| H-POLAR-2 | Analysis State Toggle | PASS | analysisState tracks polar plot enabled state |
| H-POLAR-3 | Polar View Sensor Selection | PASS | Sensor selection updates state correctly |
| H-POLAR-4 | Canvas Rendering | PASS | Canvas renders grid when enabled |
| H-POLAR-5 | Sky Tracks Rendering | PASS | Sky tracks rendered using head/tail minutes |
| H-POLAR-6 | Click-to-Select Integration | PASS | Clicking satellite sets activeRowId |
| H-POLAR-7 | Selection Highlight Ring | PASS | Active satellite displays cyan selection ring |

---

## Running Tests

### Via UI (Settings Panel)

1. Open application
2. Navigate to Settings panel
3. Expand "Test Suite" section
4. Click "Run All Tests" or individual ▶ buttons

### Via Console

```javascript
// Run all 23 tests
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

### Browser-Based Test Files

| File | Tests | Purpose |
|------|-------|---------|
| `/static/test-utils.html` | 50+ | Utility module tests |
| `/static/test-eventbus.html` | 24 | Event bus tests |
| `/static/test-state.html` | 69+ | State module tests |
| `/static/test-deckgl.html` | - | Manual Deck.gl tests |

---

## Test Infrastructure

### Files

| File | Purpose |
|------|---------|
| `static/modules/test/testRegistry.js` | All hypothesis definitions |
| `static/modules/test/testResults.js` | Result persistence & history |
| `static/modules/map/automated-tests.js` | Map-specific test implementations |
| `static/modules/map/diagnostics.js` | Performance measurement framework |

### Result Persistence

Results stored in localStorage:
- Up to 50 runs preserved
- Automatic regression detection
- JSON and CSV export available

### Result Storage Schema

```javascript
{
    version: '1.0',
    runs: [{
        id: 'run-2025-11-26-143052',
        timestamp: '2025-11-26T14:30:52.000Z',
        duration: 12450,
        summary: { total: 17, passed: 17, failed: 0, skipped: 0 },
        results: [{
            hypothesisId: 'H-DRIFT-1',
            name: 'Initial Zoom Offset',
            passed: true,
            duration: 145,
            measurements: { leafletZoom: 4, deckglZoom: 3, difference: 0.0 }
        }]
    }]
}
```

---

## Writing New Tests

### Hypothesis Template

```javascript
'H-CATEGORY-N': {
    id: 'H-CATEGORY-N',
    name: 'Short Name',
    category: 'state|event|ui|map|data|valid',
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

### Example Test Implementation

```javascript
'H-STATE-1': {
    id: 'H-STATE-1',
    name: 'Satellite State Immutability',
    category: 'state',
    hypothesis: 'getAllSatellites() returns deep copy, not reference',
    symptom: 'External mutations corrupt internal state',
    prediction: 'Modifying returned array should not affect state',
    threshold: { mutationDetected: false },
    testFn: async () => {
        const satellites1 = satelliteState.getAllSatellites();
        const originalLength = satellites1.length;

        // Attempt mutation
        satellites1.push({ id: 999, name: 'FAKE' });

        // Get fresh copy
        const satellites2 = satelliteState.getAllSatellites();

        return {
            passed: satellites2.length === originalLength,
            measurements: {
                originalLength,
                afterMutation: satellites2.length,
                mutationDetected: satellites2.length !== originalLength
            }
        };
    }
}
```

---

## Diagnostics Framework

### Recording Metrics

```javascript
// Start recording
diagnostics.startRecording();

// Perform test actions...

// Stop and get report
const report = diagnostics.stopRecording();
```

### Available Metrics

| Metric | Description |
|--------|-------------|
| Frame Timings | Individual frame durations |
| Sync Drifts | Leaflet-Deck.gl position differences |
| setProps Calls | Rate of Deck.gl updates |
| Glitch Events | Rendering anomalies |
| Resize Events | Container size changes |

### Debug Commands

```javascript
window.deckglDebug.startDiagnostics()   // Start recording
window.deckglDebug.stopDiagnostics()    // Stop and view report
window.deckglDebug.validateMapSync()    // Check current sync state
window.deckglDebug.saveBaseline()       // Save for comparison
window.deckglDebug.compareToBaseline()  // Compare after changes
window.deckglDebug.getSetPropsHistory() // View recent setProps calls
window.deckglDebug.getLayerInfo()       // View current layer state
```

---

## Test Coverage Gaps

### Covered

- utils/ (test-utils.html)
- events/ (test-eventbus.html)
- state/ (test-state.html)
- map/sync (automated-tests.js)

### Pending

| Module | Tests Needed |
|--------|--------------|
| data/sensorCRUD.js | Add/Edit/Delete flows |
| data/satelliteCRUD.js | Add/Edit/Delete flows |
| ui/modals.js | Modal open/close/submit |
| ui/controlPanel.js | Section switching |
| map/interactions.js | Resize handles |
| init/bootstrap.js | Initialization sequence |

---

## Success Criteria

The test suite is complete when:

1. **Coverage**: All modules have at least 1 test
2. **Reliability**: Tests pass consistently (no flaky tests)
3. **Speed**: Full suite runs in <60 seconds
4. **Persistence**: Results stored and retrievable
5. **Trends**: Historical comparison available
6. **Regressions**: Auto-detected and highlighted

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.9 | 2025-11-28 | Added H-POLAR-5/6/7 (sky tracks, click-to-select, selection ring); added Polar category section; updated count to 53 |
| 1.8 | 2025-11-27 | Added H-LIST-5, H-LIST-6, H-LIST-7 (UI tests for Control Panel reorganization); updated count to 39 |
| 1.7 | 2025-11-27 | Added H-TIME-12 (Ctrl+wheel jog control fix test); updated count to 29 |
| 1.6 | 2025-11-27 | Added H-LIST-1 to H-LIST-4 (User List tests); updated category count to 28 |
| 1.5 | 2025-11-27 | Added H-TIME-11 (compact time bar with Flatpickr); updated H-TIME-9 for compact date format |
| 1.4 | 2025-11-27 | Changed H-PERF-1 to ADVISORY (stress test too environment-sensitive for pass/fail) |
| 1.3 | 2025-11-27 | Fixed H-TIME-1/H-UI-5 real-time interference; relaxed H-PERF-1 threshold (10%→60%) |
| 1.2 | 2025-11-27 | Added TIME tests H-TIME-9, H-TIME-10 (datetime sync, stop button) |
| 1.1 | 2025-11-27 | Added TIME tests H-TIME-5 through H-TIME-8 (playback rate, presets, seek points) |
| 1.0 | 2025-11-26 | Initial standardized test documentation |
