# WA_map Lessons Learned

> **Document Type**: LESSONS
> **Version**: 1.0
> **Last Updated**: 2025-11-26
> **Maintainer**: AI Governor System

---

## Purpose

This document captures debugging knowledge, integration patterns, and hard-won insights from developing the WA_map satellite visualization system. Each lesson includes the problem context, investigation process, solution, and prevention strategies.

---

## Lesson Index

| ID | Title | Category | Date |
|----|-------|----------|------|
| LL-001 | Coordinate Drift: Leaflet-Deck.gl Zoom Offset | Integration | 2025-11-24 |
| LL-002 | ES6 Module Scope Isolation | Architecture | 2025-11-25 |
| LL-003 | Property Name Mapping at Boundaries | Data Flow | 2025-11-25 |
| LL-004 | Test State Pollution | Testing | 2025-11-25 |
| LL-005 | Deck.gl Layer State Corruption | Rendering | 2025-11-26 |

---

## LL-001: Coordinate Drift - Leaflet-Deck.gl Zoom Offset

**Date**: 2025-11-24
**Category**: Integration
**Status**: RESOLVED

### Problem

Satellites and sensors "wandered away" from geographic positions during pan/zoom operations. Objects maintained correct positions relative to each other but drifted together away from the base map. Error amplified at higher zoom levels.

### Key Observation

> "They appear to render correctly on map at max zoom out but when I pan they move faster than the map in pan-direction. This is amplified when I zoom in farther."

### Root Cause

Zoom scale mismatch between Leaflet and Deck.gl MapView:
- Leaflet: `scale = 2^zoom`
- Deck.gl MapView: `scale = 2^(zoom - 1)`

```
At zoom 1:  Leaflet = 2,    Deck.gl = 1    (2x difference, barely noticeable)
At zoom 5:  Leaflet = 32,   Deck.gl = 16   (2x difference, very visible)
At zoom 10: Leaflet = 1024, Deck.gl = 512  (2x difference, extreme)
```

### Solution

```javascript
// WRONG
zoom: zoom,

// CORRECT
zoom: zoom - 1,  // Deck.gl MapView needs zoom - 1 for Leaflet compatibility
```

### Prevention

1. **Read documentation first** - Feature_list_2D_Map.txt documented this requirement
2. **Test at multiple zoom levels** - Exponential errors hide at low zoom
3. **Check for scale/offset issues** in any exponential coordinate system

### Failed Fixes (Learning Opportunities)

| Fix Attempted | Why It Failed |
|---------------|---------------|
| `coordinateSystem: LNGLAT` | Already the default |
| `MapView({repeat: true})` | Fixed wrapping, not drift |
| `wrapLongitude: true` | Fixed edge clipping, not scale |
| Throttling to 60 FPS | User insight: "too consistent for timing issue" |
| `useDevicePixels: false` | Reduced error but didn't eliminate |

### Key Insight

> When integrating two coordinate systems, verify scales match at multiple zoom levels. Exponential errors hide at low zoom and explode at high zoom.

---

## LL-002: ES6 Module Scope Isolation

**Date**: 2025-11-25
**Category**: Architecture
**Status**: RESOLVED

### Problem

After modularizing from monolithic app.js to ES6 modules:
- `ReferenceError: toggleSatelliteSelection is not defined`
- `ReferenceError: editSatellite is not defined`
- Ground tracks failed silently

### Root Cause

ES6 modules have their own scope:
1. Functions are NOT automatically global
2. HTML inline handlers (`onclick="fn()"`) look for functions on `window`
3. Libraries loaded via `<script>` tags must be accessed as `window.libraryName`

### Solution

```javascript
// Expose functions needed by HTML handlers
window.editSatellite = editSatellite;
window.toggleSatelliteSelection = toggleSatelliteSelection;

// Access global libraries explicitly
const satellite = window.satellite;
if (!satellite) {
    logger.error('satellite.js library not loaded');
    return null;
}
```

### Prevention

1. Avoid inline `onclick/onchange` handlers in modular code
2. Use event delegation or programmatic event listeners
3. Document which functions need global exposure
4. Access external libraries via `window.libraryName`

---

## LL-003: Property Name Mapping at Boundaries

**Date**: 2025-11-25
**Category**: Data Flow
**Status**: RESOLVED

### Problem

Test "Can update satellite" failed - validation rejected valid updates.

### Root Cause

Property name mismatch between storage and validation layers:
- Storage: `tleLine1`, `tleLine2`
- Validation expects: `tle1`, `tle2`

```javascript
// Storage uses:
{ tleLine1: '1 25544U ...', tleLine2: '2 25544 ...' }

// Validation expects:
function validateSatellite(sat) {
    validateTLE(sat.tle1, sat.tle2);  // Looking for tle1/tle2!
}
```

### Solution

Map property names at module boundaries:

```javascript
const validationData = {
    name: updatedSatellite.name,
    tle1: updatedSatellite.tleLine1,  // Convert: tleLine1 → tle1
    tle2: updatedSatellite.tleLine2   // Convert: tleLine2 → tle2
};
```

### Prevention

1. Document expected property names in JSDoc
2. Consider TypeScript interfaces to catch mismatches
3. Create adapter functions for property conversions
4. Write integration tests that exercise full data flow

---

## LL-004: Test State Pollution

**Date**: 2025-11-25
**Category**: Testing
**Status**: RESOLVED

### Problem

Test "Cannot mutate state directly" failed intermittently.

### Root Cause

Previous test left state modified:
```javascript
// Test A: uiState.setPanelExpanded(true)
// Test B assumes panelExpanded = false (default)
// Test B fails because state is actually true
```

### Solution

Reset to known state before testing:
```javascript
uiState.reset();  // panelExpanded=false, activeSection='time'
```

### Prevention

1. Use `beforeEach()`/`afterEach()` hooks for cleanup
2. Explicitly reset shared state at test start
3. Don't rely on state from previous tests
4. Consider fresh instances for each test

---

## LL-005: Deck.gl Layer State Corruption

**Date**: 2025-11-26
**Category**: Rendering
**Status**: RESOLVED

### Problem

Layers flickered, disappeared, or appeared at wrong positions during:
- Panel clicks
- Map pan/zoom
- Grid resize

### Root Cause

Multiple `setProps()` calls racing within single animation frames:
1. `sync:viewState` - Leaflet move events
2. `sync:size-fix` - Canvas size correction
3. `updateDeckOverlay:layers` - Data changes
4. `resizeDeckCanvas` - Resize operations

Also: Conditional layer inclusion caused Deck.gl state corruption when data became empty.

### Solution

1. **Batch Update Manager**: Queue all updates, flush once per frame
2. **Always include layers**: Use `visible` prop instead of conditional inclusion

```javascript
// DON'T
if (sensors.length > 0) {
    layers.push(new ScatterplotLayer(...));
}

// DO
layers.push(new ScatterplotLayer({
    visible: sensors.length > 0,
    // ...
}));
```

### Prevention

1. Never call `setProps()` directly - use batched wrapper
2. Always include all layers with consistent IDs
3. Use `visible` prop for conditional rendering
4. Include `visible` in `updateTriggers`

---

## Debugging Methodology

### Scientific Debugging Process

```
1. OBSERVE    → Document exact symptoms with reproducible steps
2. MEASURE    → Quantify with metrics and baselines
3. HYPOTHESIZE → Form testable hypotheses about root causes
4. PREDICT    → State what would change if hypothesis is correct
5. EXPERIMENT → Create minimal intervention to test
6. VALIDATE   → Accept/reject based on predictions
7. ISOLATE    → Use ablation to eliminate false positives
8. FIX        → Only fix confirmed root causes
9. REGRESS    → Verify fix doesn't break existing behavior
```

### False Positive Elimination

A fix is ONLY accepted if ALL conditions are met:
1. **Reproducibility**: Problem reproduced before fix
2. **Isolation**: Disabling fix brings problem back
3. **Specificity**: Fix addresses ONLY hypothesized cause
4. **No Side Effects**: Existing tests still pass
5. **Causal Chain**: Clear explanation of why fix works

### "It Just Works" Protocol

If something starts working without clear intervention:
1. **STOP** - Don't celebrate yet
2. **DOCUMENT** - What was the last change?
3. **REVERT** - Undo the last change
4. **VERIFY** - Does problem return?
5. **ANALYZE** - If not, investigate other factors

---

## Common Patterns

### Integration Issues Are Multi-Layered

Leaflet + Deck.gl integration has many concerns:
- Coordinate system (LNGLAT vs METER_OFFSET)
- Coordinate scale (zoom offset)
- Canvas size (CSS vs device pixels)
- Device pixels (retina displays)
- World wrapping (anti-meridian)

Fix them in order from most obvious to most subtle.

### Symptom Patterns Reveal Root Causes

| Symptom Pattern | Likely Root Cause |
|-----------------|-------------------|
| Error amplifies with zoom | Exponential/scale issue |
| Always wrong by same amount | Offset error |
| Wrong by scaling factor | Scale mismatch |
| Intermittent/random | Timing/race condition |
| Consistent but wrong | Logic/algorithm error |

### Listen to Domain Expert Observations

User insights that saved hours:
- "Too consistent for it to be a firing issue" → Ruled out timing bugs
- "Amplified at higher zoom" → Pointed to exponential error
- "Correct relative to each other" → Pointed to scale, not position

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-26 | Initial consolidated lessons document |
