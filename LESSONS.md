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
| LL-006 | deck.gl-leaflet Integration vs Manual Sync | Architecture | 2025-11-26 |
| LL-007 | Test Visual Properties Not Just Existence | Testing | 2025-11-26 |
| LL-008 | Time Control Paradigms from Industry Standards | Architecture | 2025-11-27 |
| LL-009 | Decouple Event Detection from Display Parameters | Architecture | 2025-11-27 |
| LL-010 | Virtual Scrolling for Large Lists | Performance | 2025-11-28 |
| LL-011 | Implementing Lambert Solver for Orbital Transfer Analysis | Analysis | 2025-11-29 |

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

## LL-006: deck.gl-leaflet Integration vs Manual Sync

**Date**: 2025-11-26
**Category**: Architecture
**Status**: RESOLVED

### Problem

Multiple rendering issues when using manual Deck.gl overlay on Leaflet:
1. Layers lagging behind base map during pan/zoom
2. World wrapping issues at anti-meridian
3. Sensor/satellite position errors when zoomed all the way out
4. Flickering during canvas resize
5. Complex manual sync code prone to race conditions

### Root Cause

Manual overlay architecture creates two separate rendering contexts that must stay perfectly synchronized:

```
User Interaction (pan/zoom/resize)
       ↓
Leaflet (handles input, updates its own view)
       ↓
[MANUAL SYNC POINT - error-prone]
       ↓
Deck.gl standalone instance (separate canvas, separate viewState)
       ↓
Symptoms: lag, drift, flickering, wrapping issues
```

Problems with manual sync:
- Zoom offset (-1) must be applied in multiple places
- Canvas positioning must be kept in sync manually
- Resize events create race conditions
- Two separate rendering contexts drift during rapid interactions

### Solution

Replace manual sync with `deck.gl-leaflet` integration library:

```javascript
// OLD: Manual standalone Deck instance
const deck = new Deck({
    parent: container,
    viewState: getLeafletViewState(),
    // Many sync handlers required...
});

// NEW: LeafletLayer integration (handles ALL sync automatically)
import { LeafletLayer } from 'deck.gl-leaflet';

const deckLayer = new DeckGlLeaflet.LeafletLayer({
    views: [new deck.MapView({ repeat: true })],
    layers: [...],
});
map.addLayer(deckLayer);  // Integration handles everything
```

### Key Findings from Research

1. **No official @deck.gl/leaflet package** - Use community `deck.gl-leaflet` by zakjan
2. **Global export name**: `DeckGlLeaflet` (lowercase 'l' in 'Gl')
3. **CDN path**: `unpkg.com/deck.gl-leaflet@1.3.1/dist/deck.gl-leaflet.umd.min.js`
4. **For high-performance**: Consider MapLibre GL JS + deck.gl interleaved mode

### What LeafletLayer Handles Automatically

- Canvas positioning
- View state synchronization on pan/zoom
- Coordinate system conversion (zoom offset)
- Resize handling
- World wrapping

### Prevention

1. **Prefer integration libraries** over manual sync between rendering contexts
2. **Research before implementing** - check if community solutions exist
3. **Two canvas overlay is inherently complex** - single canvas solutions (MapLibre) are more robust
4. **Document library global names** - CDN bundles may use unexpected names

### Anti-Pattern

Manual sync between two separate rendering contexts:
```javascript
// DON'T: Manual sync with many edge cases
map.on('move', () => {
    deck.setProps({
        viewState: {
            longitude: map.getCenter().lng,
            latitude: map.getCenter().lat,
            zoom: map.getZoom() - 1,  // Easy to forget!
            // ...
        }
    });
});
```

### Good Pattern

Use integration library that handles sync internally:
```javascript
// DO: Let the library handle sync
const deckLayer = new DeckGlLeaflet.LeafletLayer({ layers });
map.addLayer(deckLayer);
// No manual sync code needed!
```

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

---

## LL-007: Test Visual Properties Not Just Existence

**Date**: 2025-11-26
**Category**: Testing
**Status**: RESOLVED

### Problem

Equator reference line layer was created and configured, but was invisible on the map. Tests passed because they only verified the layer existed, not that it was actually visible.

### Key Observation

> "Tests passed but feature not working - tests only checked layer existence, not visibility properties"

### Root Cause

- Alpha value of 60/255 (~24% opacity) made line nearly invisible
- Width of 1px too thin to see against map
- Test only checked existence and visible prop, not actual color values

### Solution

1. Increased alpha from 60 to 150 (~59% opacity)
2. Increased width from 1px to 2px
3. Enhanced test to verify alpha >= 100

### Prevention Pattern

When testing visual elements:
1. Don't just test existence - verify visibility properties
2. Check opacity/alpha values - a layer with alpha=1 exists but isn't visible
3. Validate dimensions - width/height must be perceivable
4. Add threshold checks for minimum visible values

---

## LL-008: Time Control Paradigms from Industry Standards

**Date**: 2025-11-27
**Category**: Architecture
**Status**: APPLIED

### Context

Implementing time navigation controls for satellite visualization required researching industry terminology and UX patterns. Initial confusion about "scrubbing", "seeking", and "playback" led to research across video editing, GIS, and aerospace domains.

### Key Industry Terminology

| Term | Origin | Definition | WA_map Implementation |
|------|--------|------------|----------------------|
| **Scrubbing** | Video editing | Dragging playhead along timeline | Click/drag on time bar thumb |
| **Jog** | Professional editing | Frame-by-frame stepping (shuttle dial inner ring) | Ctrl+mouse wheel = ±1 step |
| **Shuttle** | Professional editing | Variable-speed playback (outer ring) | FF/RW buttons × playback rate |
| **Seeking** | Media players | Jump to specific points (bookmarks, chapters) | Stub API for AOS/LOS, conjunctions |
| **Playback Rate** | Video/animation | Speed multiplier (0.5x-600x) | Speed selector dropdown |
| **Time Extent** | ArcGIS/GIS | Start/stop window for temporal data | Analysis window (start/stop times) |
| **Time Instant** | STK/Aerospace | Single point in time | currentTime in timeState |
| **Time Interval** | STK/Aerospace | Duration between instants | Analysis window duration |

### Key Patterns Discovered

**1. Separate "Current Time" from "Analysis Window"**

```javascript
// Two distinct concepts:
_state.currentTime     // The instant being displayed (playhead position)
_state.startTime       // Analysis window start (data query boundary)
_state.stopTime        // Analysis window stop (data query boundary)
```

The current time can move within the analysis window, but the window itself defines what data is loaded/visible.

**2. Playback Rate as Multiplier, Not Absolute Speed**

Industry uses multipliers (1x, 2x, 60x) rather than "seconds per frame":
```javascript
static VALID_PLAYBACK_RATES = [0.5, 1, 2, 4, 8, 16, 60, 600];
// 600x = 10 minutes per second of wall clock (useful for orbital periods)
```

**3. Jog Requires Modifier Key**

Mouse wheel naturally scrolls/zooms the map. Jog requires modifier to distinguish intent:
```javascript
function handleWheelJog(e) {
    if (!e.ctrlKey) return;  // Only jog with Ctrl held
    // ...step time
}
```

**4. Presets Commit Immediately**

Time window presets (Last 1h, Next 24h) should apply instantly, not require confirmation:
```javascript
function applyPreset(preset) {
    // Calculate window immediately
    // Commit time range directly
    // No intermediate "preview" state needed
}
```

**5. Seek Points as Future-Proofing Stub**

Even if not fully implemented, stub the API early:
```javascript
// Stub enables future features without refactoring:
// - AOS/LOS events (satellite passes)
// - Conjunction events (close approaches)
// - User bookmarks
// - Event highlights from analysis
addSeekPoint(name, time, type = 'user')
seekNext() / seekPrevious()
```

### Sources Researched

1. **Video Editing**: Premiere Pro, Final Cut Pro - JKL controls, jog/shuttle
2. **GIS**: ArcGIS Time Slider API - time extent, time instants
3. **Aerospace**: AGI STK - scenario time intervals, animation epochs
4. **Web Standards**: HTML5 video element - playbackRate property

### Prevention

1. **Research industry terminology first** - Different domains use different terms for similar concepts
2. **Stub future APIs early** - Seek points API costs little but enables future features
3. **Separate state concerns** - Current time vs analysis window serve different purposes
4. **Use multipliers over absolutes** - 2x is more intuitive than "500ms per frame"
5. **Modifier keys for overloaded inputs** - Ctrl+wheel for jog vs regular wheel for zoom

---

## LL-009: Decouple Event Detection from Display Parameters

**Date**: 2025-11-27
**Category**: Architecture
**Status**: RESOLVED

### Problem

Equator crossing glow feature had multiple reports of incorrect behavior:
1. Glow appeared/disappeared suddenly instead of smooth fade-in/fade-out
2. Ground track tail/head length affected when glow appeared (shouldn't)
3. Glow only appeared when crossing was within the visible track segment

### Key Observation

> "I do NOT want the ground track TAIL to affect the glow in any way. I do NOT want the ground track HEAD to affect the glow in any way. I ONLY want the satellite chevron icon to be considered."

### Root Cause

The equator crossing detection algorithm searched for crossings within the **display ground track** (bounded by `tailMinutes`/`headMinutes`), but the fade effect required detecting crossings within the **fade range** (bounded by `fadeInMinutes`/`fadeOutMinutes`).

These are independent concerns that were incorrectly coupled:
- **Display track**: How much of the orbit path to render (visual preference)
- **Event detection window**: How far to look for events that affect glow (functional requirement)

```javascript
// BUG: Event detection inherits display bounds
const track = calculateGroundTrack(sat, currentTime, tailMinutes, headMinutes);
const crossings = detectCrossings(track.points); // Limited to display range!

// If headMinutes=5 but fadeInMinutes=15, crossings at +10min are NEVER FOUND
```

### Solution

Created `EventDetector` module that propagates **independently** using fade parameters:

```javascript
// FIXED: Event detection uses its own propagation window
const crossings = eventDetector.detectLatitudeCrossing(satellite, currentTime, {
    latitude: 0,  // Equator
    fadeInMinutes: 15,  // Search 15 min into future
    fadeOutMinutes: 4   // Search 4 min into past
});
// Crossings at +10min ARE detected, regardless of display head length
```

### Key Design Pattern

**Independent Detection Windows**: Event detection should use its own time window based on effect requirements, not inherit from display parameters.

```
Display Parameters          Effect Parameters
(tailMinutes, headMinutes)  (fadeInMinutes, fadeOutMinutes)
         │                           │
         ▼                           ▼
  calculateGroundTrack()      eventDetector.detect()
         │                           │
         ▼                           ▼
  [Render track path]         [Calculate glow intensity]
```

### Prevention

1. **Identify concerns**: Display vs detection are separate concerns
2. **Don't share bounds**: Effect parameters shouldn't inherit from display parameters
3. **Create dedicated modules**: EventDetector handles all proximity-based event detection
4. **Design for reuse**: Same pattern works for equator crossings, nodal crossings, maneuvers, etc.

### Anti-Pattern

```javascript
// DON'T: Use display track for event detection
const track = calculateGroundTrack(..., tailMinutes, headMinutes);
const events = detectEvents(track.points);
```

### Good Pattern

```javascript
// DO: Use dedicated event detection with effect-specific parameters
const events = eventDetector.detect(satellite, currentTime, {
    fadeInMinutes: fadeConfig.in,
    fadeOutMinutes: fadeConfig.out
});
```

### Files Created

- `static/modules/events/eventDetector.js` - Generalized proximity-based event detection

### Files Modified

- `static/modules/map/deckgl.js` - Uses eventDetector for crossings and apexes

---

## LL-010: Virtual Scrolling for Large Lists

**Date**: 2025-11-28
**Category**: Performance
**Status**: RESOLVED

### Problem

Catalog edit modal took 5+ seconds to open for Celestrak (14K satellites). UI became completely unresponsive during modal render.

### Key Observation

> "14K TLEs is a lot, but not a number that should be causing lag"

### Root Cause

Two compounding issues:

1. **O(n²) complexity**: `countListsForSatellite()` called for each row, each call searching through all satellites
2. **14K DOM nodes**: All rows rendered synchronously, overwhelming browser rendering

```javascript
// BUG: O(n²) - for each of 14K rows, search 14K satellites
currentCatalog.satellites.forEach((sat, index) => {
    tdLists.textContent = countListsForSatellite(sat.noradId);  // O(n) search inside
});
```

### Solution

**Virtual Scrolling + Pre-computed Lookups**

1. **Pre-compute lookup maps once** (O(n)):
```javascript
const noradToListCount = new Map();
// Single pass through lists to build count map
for (const list of allLists) {
    for (const satId of list.satelliteIds) {
        const noradId = satIdToNorad.get(satId);
        noradToListCount.set(noradId, (noradToListCount.get(noradId) || 0) + 1);
    }
}
// O(1) lookup
const count = noradToListCount.get(sat.noradId) || 0;
```

2. **Virtual scrolling** (only render visible rows ~25):
```javascript
class CatalogVirtualScroller {
    ROW_HEIGHT = 28;
    BUFFER_ROWS = 5;

    getVisibleRange() {
        const first = Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS;
        const last = Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + BUFFER_ROWS;
        return { first, last };
    }

    render() {
        // Only create DOM for visible rows
        for (let i = first; i <= last; i++) {
            if (!this.activeRows.has(i)) {
                const row = this.createRow(data[i], i);
                row.style.transform = `translateY(${i * ROW_HEIGHT}px)`;
                this.rowContainer.appendChild(row);
            }
        }
    }
}
```

3. **Transform positioning** for 60fps scroll:
```css
.virtual-row {
    position: absolute;
    transform: translateY(Npx);  /* Compositor-only, no layout */
    contain: layout paint;       /* Isolation for rendering */
}
```

### Performance Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Open time | ~5000ms | ~50ms | **100x** |
| DOM nodes | 14,000 | ~25 | **560x** |
| Search | N/A | <50ms | New feature |
| Scroll | Janky | 60fps | Smooth |

### Prevention Pattern

When rendering lists with >100 items:
1. **Pre-compute lookups** - Don't do O(n) searches per row
2. **Virtual scroll** - Only render visible rows
3. **Use transforms** - Not top/left positioning
4. **Add search** - Nobody scrolls 14K rows manually

### Anti-Pattern

```javascript
// DON'T: Render all rows + O(n) search per row
items.forEach((item, index) => {
    const row = createRow(item);
    row.querySelector('.count').textContent = expensiveLookup(item.id);  // O(n)
    container.appendChild(row);  // 14K DOM nodes
});
```

### Good Pattern

```javascript
// DO: Pre-compute + virtual scroll
const lookupMap = buildLookupMap(items);  // O(n) once
const scroller = new VirtualScroller(container, {
    getListCount: (id) => lookupMap.get(id) || 0,  // O(1)
    onRowClick: handleClick
});
scroller.setData(items);  // Only renders ~25 rows
```

### Files Created

- `static/modules/ui/virtualScroller.js` - Reusable virtual scrolling module

### Files Modified

- `static/modules/ui/modals.js` - showCatalogEditModal with virtual scrolling
- `templates/index.html` - Modal structure and CSS for virtual rows

---

## LL-011: Implementing Lambert Solver for Orbital Transfer Analysis

**Date**: 2025-11-29
**Category**: Analysis
**Status**: RESOLVED

### Problem

Need to implement orbital transfer analysis between satellite pairs. Initial research found no production-quality JavaScript Lambert solver implementations. Existing options (influenceth/lambert-orbit, orbjs) had issues with edge cases, poor documentation, or unmaintained codebases.

### Key Observation

> "There is no production-grade JavaScript Lambert solver. We must implement Izzo's algorithm from scratch."

### Research Process

1. **Survey of Existing Solutions**:
   - `influenceth/lambert-orbit` - Incomplete, orbit-related project
   - `orbjs` - Incomplete multi-rev, edge case failures
   - `Poliastro` (Python) - Excellent reference implementation
   - `PyKEP` (C++) - Comprehensive but complex

2. **Algorithm Selection**:
   - Izzo (2015) algorithm chosen for robustness and convergence
   - Householder 4th-order iteration for fast convergence
   - Battin series for near-parabolic edge cases

### Solution Architecture

**1. Core Solver** (`lambertSolver.js` ~500 lines):
```javascript
export function lambertIzzo(mu, r1, r2, tof, M = 0, prograde = true, lowPath = true) {
    // Householder 4th-order iteration
    // Float64Array pre-allocation for GC optimization
    // Convergence: <35 iterations typical
    return { v1, v2, iterations, converged };
}
```

**2. Satellite Integration** (`transferCalculator.js`):
```javascript
// Extract ECI state from satellite.js propagation
export function getECIState(satellite, date);

// Compute transfer with delta-V breakdown
export function computeTransfer(chaser, target, departureTime, tofSeconds);

// Generate arc points for visualization
export function generateTransferArcPath(transfer, numPoints = 60);
```

**3. State Management** (`analysisState.js` extensions):
```javascript
// Lambert state properties
lambertEnabled, lambertChaserId, lambertTargetId
lambertTofSeconds, lambertDepartureTime, lambertM
lambertResults, lambertArcPoints
```

**4. UI Components** (`lambertPanel.js`):
- Satellite pair selection dropdowns
- TOF slider with human-readable display
- Revolution count (M) buttons
- Compute button with results display
- Status/error messaging

**5. Visualization** (`deckgl.js` additions):
- PathLayer for transfer arc (orange dashed line)
- ScatterplotLayer for departure/arrival endpoints

### Performance Results

| Metric | Value |
|--------|-------|
| Solver throughput | >100,000 ops/sec |
| Average iterations | 3-5 for M=0 |
| Convergence rate | >99.9% for valid inputs |
| Arc generation | <1ms for 60 points |

### Validation Against Reference

Validated against Poliastro test vectors:
```
POL-1: Coplanar elliptic transfer - PASS (error < 0.01 km/s)
POL-2: 3D transfer - PASS (error < 0.01 km/s)
CAN-1: Canonical 90° - PASS
CAN-2: Near-180° - PASS
LEO-1: LEO coplanar - PASS
```

### Integration Pattern

```javascript
// In UI: compute transfer
const results = computeTransfer(chaser, target, departureTime, tof, { M, prograde, lowPath });
const arcPoints = generateTransferArcPath(results, 60);
results.arcPoints = arcPoints;
analysisState.setLambertResults(results);  // Emits event

// In deckgl.js: visualize arc
const lambertArcPoints = analysisState.getLambertArcPoints();
new deck.PathLayer({
    data: [{ path: lambertArcPoints.map(p => [p[0], p[1]]) }],
    getColor: [255, 140, 0, 200],
    getDashArray: [8, 4]
});
```

### Key Design Decisions

1. **Vanilla ES6+**: No external dependencies, browser-compatible
2. **Float64Array**: Pre-allocated arrays avoid GC pressure
3. **Event-driven**: State changes emit events for UI/visualization sync
4. **Modular**: Core solver separate from satellite.js integration
5. **Testable**: Hypothesis tests validate solver correctness

### Files Created

- `static/modules/analysis/lambertSolver.js` - Core Izzo implementation
- `static/modules/analysis/transferCalculator.js` - Satellite.js integration
- `static/modules/analysis/lambertValidation.js` - Test vectors
- `static/modules/ui/lambertPanel.js` - UI component

### Files Modified

- `static/modules/state/analysisState.js` - Lambert state methods
- `static/modules/map/deckgl.js` - Transfer arc visualization layers
- `static/modules/init/bootstrap.js` - Lambert panel initialization
- `static/modules/test/testRegistry.js` - H-LAM hypothesis tests
- `static/modules/utils/logger.js` - ANALYSIS category
- `templates/index.html` - Lambert UI elements and CSS
