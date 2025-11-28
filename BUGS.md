# WA_map Bug Tracker

> **Document Type**: BUGS
> **Version**: 1.2
> **Last Updated**: 2025-11-27
> **Maintainer**: AI Governor System

---

## Status Legend

| Code | Status | Description |
|------|--------|-------------|
| OPEN | Open | Confirmed, awaiting fix |
| WIP | In Progress | Currently being addressed |
| FIXED | Fixed | Resolved, pending verification |
| CLOSED | Closed | Verified fixed |
| WONTFIX | Won't Fix | Intentional behavior or out of scope |

## Severity Legend

| Severity | Impact |
|----------|--------|
| CRITICAL | Application unusable |
| HIGH | Major feature broken |
| MEDIUM | Feature degraded |
| LOW | Minor inconvenience |

---

## Active Bugs

*No active bugs at this time.*

---

## Recently Fixed

### BUG-017: Satellites Not Saved to Watch Lists
**ID**: BUG-017
**Severity**: HIGH
**Status**: CLOSED
**Date Reported**: 2025-11-28
**Date Closed**: 2025-11-28

**Symptoms**:
- User selects satellites in list editor modal (shows "2 selected")
- Clicks Save
- List shows "0" satellites - selections not persisted

**Root Cause**:
Two bugs in `showListEditorModal` handleSubmit:

1. **Wrong return value**: `satelliteState.addSatellite()` returns `{success, satellite, errors}`, not the satellite directly
   - Code was: `satId = newSat.id` (undefined!)
   - Should be: `satId = result.satellite.id`

2. **Wrong field names**: `addSatellite` expects `tle1`/`tle2`, but code passed `tleLine1`/`tleLine2`
   - Validation failed silently, returning `{success: false}`

**Solution**:
1. Destructure result correctly: `result.satellite.id`
2. Use correct field names: `tle1: catalogSat.tleLine1`

**Files Modified**:
- static/modules/ui/modals.js (showListEditorModal handleSubmit)

---

### BUG-016: Catalog Edit Modal Performance Degradation
**ID**: BUG-016
**Severity**: HIGH
**Status**: CLOSED
**Date Reported**: 2025-11-28
**Date Closed**: 2025-11-28

**Symptoms**:
- 5-second delay opening catalog edit modal for Celestrak (14K TLEs)
- UI becomes unresponsive during modal open
- Color picker buttons appear white instead of showing colors (red, blue, grey)
- Minor styling inconsistencies in modal

**Root Cause**:
1. **O(n²) complexity**: `countListsForSatellite()` called for each of 14K rows, each call iterates through all satellites
2. **14K DOM nodes**: All rows rendered synchronously, overwhelming the browser
3. **Missing CSS**: Color buttons lack `background-color` inline styles or CSS rules

**Solution**:
Implemented virtual scrolling with:
1. Pre-computed lookup maps (O(1) list count lookups)
2. Fixed-height `CatalogVirtualScroller` (only render ~25 visible rows)
3. Debounced search/filter (150ms)
4. CSS fix for color buttons (inline styles)

**Files Modified**:
- static/modules/ui/virtualScroller.js (new - virtual scrolling module)
- static/modules/ui/modals.js (showCatalogEditModal with virtual scrolling)
- templates/index.html (modal structure, CSS, color button fixes)
- static/modules/test/testRegistry.js (H-CAT-9 performance test)

**Performance Results**:
- Open time: ~50ms (was ~5000ms) - **100x improvement**
- DOM nodes: ~25 (was ~14,000) - **560x reduction**
- Search: <50ms for 14K items
- Scroll: 60fps sustained

---

### BUG-015: Console Logs Not Appearing in UI Log Panel
**ID**: BUG-015
**Severity**: MEDIUM
**Status**: CLOSED
**Date Reported**: 2025-11-27
**Date Closed**: 2025-11-27

**Symptoms**:
- Debug messages appear in browser console but not in UI log panel
- Users cannot see diagnostic information without opening dev tools
- Polar plot debug messages (satellite visibility, propagation failures) only in console

**Root Cause**:
polarPlot.js uses raw `console.log()` statements instead of the `logger` module which routes messages to both console and UI.

**Solution**:
Replace all `console.log()` calls in polarPlot.js with appropriate `logger` methods (logger.diagnostic, logger.warning, etc.).

**Files Modified**:
- static/modules/ui/polarPlot.js

---

### BUG-014: Polar Plot Not Rendering Satellites from Watch Lists
**ID**: BUG-014
**Severity**: HIGH
**Status**: CLOSED
**Date Reported**: 2025-11-27
**Date Closed**: 2025-11-27

**Symptoms**:
- Polar plot shows no satellites or only some satellites
- Satellites visible on map are not shown on polar plot
- User must individually select satellites in table to see them on polar plot

**Root Cause**:
Polar plot uses `satelliteState.getSelectedSatellites()` (only `selected: true` satellites) while map uses `listState.getVisibleSatelliteIds()` (list-based visibility). The two systems are not synchronized - polar plot should show satellites from visible lists, not just individually selected ones.

**Solution**:
1. Import `listState` module in polarPlot.js
2. Change satellite retrieval from `satelliteState.getSelectedSatellites()` to `listState.getVisibleSatelliteIds()` + `satelliteState.getSatelliteById()`
3. Subscribe to `list:changed` and `list:visibility:changed` events to re-render when lists change

**Files Modified**:
- static/modules/ui/polarPlot.js

---

### BUG-011: Equator Reference Line Not Visible
**ID**: BUG-011
**Severity**: MEDIUM
**Status**: CLOSED
**Date Reported**: 2025-11-26
**Date Closed**: 2025-11-26

**Symptoms**:
- Equator reference line layer exists but is invisible on map
- Tests passed because they only checked layer existence, not visibility

**Root Cause**:
Alpha value of 60/255 (~24% opacity) combined with 1px width made the line essentially invisible on the map.

**Solution**:
1. Increased alpha from 60 to 150 (~59% opacity)
2. Increased width from 1px to 2px
3. Updated H-MAP-7 test to verify alpha >= 100

**Files Modified**:
- static/modules/map/deckgl.js (alpha, width)
- static/modules/test/testRegistry.js (test enhancement)

---

### BUG-013: Satellite Color Not Saved When Editing
**ID**: BUG-013
**Severity**: MEDIUM
**Status**: CLOSED
**Date Reported**: 2025-11-27
**Date Closed**: 2025-11-27

**Symptoms**:
- Color picker in satellite editor modal has no effect
- Color column in satellite table always shows grey
- Ground track colors on map don't reflect selected color

**Root Cause**:
Two issues:
1. `editSatellite()` in satelliteCRUD.js was not passing `watchColor` to `updateSatellite()`
2. `updateSatellite()` in satelliteState.js was rebuilding the satellite object with only specific properties (name, TLE, noradId), dropping `watchColor` and other custom properties

**Solution**:
1. Added `watchColor: data.watchColor` to the updateSatellite call in satelliteCRUD.js
2. Fixed satelliteState.js updateSatellite() to spread `...updates` before applying validated fields, preserving watchColor and other properties

**Files Modified**:
- static/modules/data/satelliteCRUD.js (added watchColor to update call)
- static/modules/state/satelliteState.js (spread updates in updateSatellite)

---

### BUG-012: Satellite Displays When No Lists Selected
**ID**: BUG-012
**Severity**: MEDIUM
**Status**: CLOSED
**Date Reported**: 2025-11-27
**Date Closed**: 2025-11-27

**Symptoms**:
- Satellite ground track visible on map even when all list checkboxes are unchecked
- Expected: No satellites should display when no lists are selected

**Root Cause**:
`deckgl.js` was rendering satellites from TWO sources: `getSelectedSatellites()` AND `getVisibleSatelliteIds()` from lists. This meant satellites with `selected: true` would always show regardless of list visibility.

**Solution**:
Changed `satellitesToRender` to only use list-based satellite IDs:
```javascript
const satellitesToRender = listSatelliteIds.map(id => satelliteState.getSatelliteById(id)).filter(sat => sat !== null);
```

**Files Modified**:
- static/modules/map/deckgl.js (line 523 - satellite rendering source)

---

### BUG-010: Map Time Bar Click-Through to Map
**ID**: BUG-010
**Severity**: HIGH
**Status**: CLOSED
**Date Reported**: 2025-11-26
**Date Closed**: 2025-11-26

**Symptoms**:
- Clicking on time controls at bottom of map causes map to pan/zoom underneath
- Slider dragging also moves the map
- Glitchy interaction with map while using time controls

**Root Cause**:
Mouse events were propagating through the time bar overlay to the map underneath. Missing `pointer-events: auto` CSS and no container-level event blocking.

**Solution**:
1. Added `pointer-events: auto` to `.map-time-bar` CSS
2. Added container-level event blocking for click, dblclick, mousedown, mouseup, mousemove, wheel
3. Added `stopPropagation()` to slider input and select change handlers

**Files Modified**:
- templates/index.html (CSS)
- static/modules/ui/mapTimeBar.js (event handlers)

---

## Closed Bugs

### BUG-009: Test Dashboard Returns 404
**ID**: BUG-009
**Severity**: MEDIUM
**Status**: CLOSED
**Date Reported**: 2025-11-26
**Date Closed**: 2025-11-26

**Symptoms**:
- http://localhost:8000/static/test-basic.html returns 404 Not Found
- Test panel in UI links to non-existent file

**Root Cause**:
The test-basic.html file was never created. The Tests panel in the UI referenced it but it didn't exist.

**Solution**:
Created test-basic.html as a test dashboard that runs all registered hypothesis tests and displays results.

**Files Created**:
- static/test-basic.html

---

### BUG-008: Satellite Chevrons Point North Instead of Direction of Travel
**ID**: BUG-008
**Severity**: HIGH
**Status**: CLOSED
**Date Reported**: 2025-11-26
**Date Closed**: 2025-11-26

**Symptoms**:
- All satellite chevrons point north (bearing=0.0)
- Console logs showed bearing=0.0 for ALL satellites regardless of direction

**Root Cause**:
Two issues:
1. `getAngle` needed negation for clockwise rotation
2. `calculateBearing()` used `tailPoints[length-1]` which was at currentTime (same as currentPosition), so bearing between identical points = 0

**Solution**:
1. Changed `getAngle: d => d.bearing` to `getAngle: d => -d.bearing`
2. Changed to use `tailPoints[length-3]` (~60 seconds back) for meaningful direction

**Files Modified**:
- static/modules/map/deckgl.js

---

### BUG-007: Equator Crossing Glows Always Visible
**ID**: BUG-007
**Severity**: MEDIUM
**Status**: CLOSED
**Date Reported**: 2025-11-26
**Date Closed**: 2025-11-26

**Symptoms**:
- Equator crossing glow points always visible
- Should fade in/out within specified minutes of crossing
- Crossings beyond fade range still showing due to radiusMinPixels

**Root Cause**:
Even with intensity=0, ScatterplotLayer radiusMinPixels (4px) and alpha calculation (intensity*200+55) kept points visible with 55 alpha.

**Solution**:
Filter out zero-intensity crossings at data level: `if (intensity > 0) { crossings.push(...) }`

**Files Modified**:
- static/modules/map/deckgl.js

---

### BUG-006: TIME Panel Bottom Content Cut Off
**ID**: BUG-006
**Severity**: LOW
**Status**: CLOSED
**Date Reported**: 2025-11-26
**Date Closed**: 2025-11-26

**Symptoms**:
- Bottom of TIME control panel content appears cut off
- Half-visible button at panel bottom
- Settings glow controls not visible (test panel overwrote them)

**Root Cause**:
Two issues:
1. content-section had only 8px bottom padding
2. testPanel.js targeted content-settings instead of content-tests, overwriting glow controls

**Solution**:
1. Increased content-section bottom padding to 24px
2. Changed testPanel.js to target content-tests

**Files Modified**:
- templates/index.html
- static/modules/ui/testPanel.js

---

### BUG-005: Satellite Tests Missing from UI Test Panel
**ID**: BUG-005
**Severity**: MEDIUM
**Status**: CLOSED
**Date Reported**: 2025-11-26
**Date Closed**: 2025-11-26

**Symptoms**:
- Test panel showed only 17 tests (map, state, event, ui, validation)
- Satellite tests existed in testRegistry.js but not shown in UI

**Root Cause**:
TEST_LIST array in testPanel.js was hardcoded and didn't include satellite tests.

**Solution**:
Added 6 satellite tests to TEST_LIST in testPanel.js:
- H-SAT-1: Satellite Selection
- H-SAT-2: Ground Track Propagation
- H-CHEV-1: Chevron Direction Calculation
- H-GLOW-1: Equator Crossing Detection
- H-GLOW-2: Glow Fade Timing
- H-GLOW-3: Glow Enable Toggle

**Files Modified**:
- static/modules/ui/testPanel.js

---

### BUG-004: Sensor/Ground Track Flickering During Pan/Zoom/Click
**ID**: BUG-004
**Severity**: HIGH
**Status**: CLOSED
**Date Reported**: 2025-11-26
**Date Closed**: 2025-11-26

**Symptoms**:
- Sensors and ground track layers flicker during user interactions
- Layers occasionally disappear and reappear during pan/zoom

**Root Cause**:
Multiple `setProps()` calls from different sources racing against each other:
1. `sync:viewState` - Leaflet move/zoom events
2. `sync:size-fix` - Canvas size mismatch detection
3. `updateDeckOverlay:layers` - Layer data changes
4. `resizeDeckCanvas:size+viewState` - Resize operations

**Solution**:
Created `DeckGLUpdateManager` class that batches all `setProps()` updates into a single call per animation frame using `requestAnimationFrame`.

**Files Modified**:
- `static/modules/map/deckgl.js`
- `static/modules/data/propagation.js`

---

### BUG-003: Sensors Disappear/Glitch When Resizing Map
**ID**: BUG-003
**Severity**: HIGH
**Status**: CLOSED
**Date Reported**: 2025-11-26
**Date Closed**: 2025-11-26

**Symptoms**:
1. Sensors visible on initial load
2. Clicking panel or resizing causes sensors to disappear
3. Another click makes them reappear
4. Vertical resize causes sensors at wrong locations

**Root Cause**:
1. Deck.gl layer state corrupted with different layer arrays
2. Canvas resize not syncing view state with Leaflet

**Solution**:
1. Always include all layers with `visible` prop
2. Modified `resizeDeckCanvas()` to sync both canvas size AND view state

**Files Modified**:
- `static/modules/map/deckgl.js`
- `static/modules/map/interactions.js`

---

### BUG-002: Sensor Icons Remain After Deselecting All
**ID**: BUG-002
**Severity**: MEDIUM
**Status**: CLOSED
**Date Reported**: 2025-11-26
**Date Closed**: 2025-11-26

**Symptoms**:
- Deselecting all sensors (clicking "Sel" header)
- Some donut icons remain visible despite log showing "0 sensor(s)"

**Root Cause**:
Deck.gl `updateTriggers` not forcing layer updates when data array became empty. Conditional layer inclusion caused state corruption.

**Solution**:
Added `visible` prop to all layers. Changed from conditionally including layers to always including with `visible: length > 0`.

**Files Modified**:
- `static/modules/map/deckgl.js`

---

### BUG-001: Log Panel Minimum Height Not Enforced
**ID**: BUG-001
**Severity**: LOW
**Status**: CLOSED
**Date Reported**: 2025-11-26
**Date Closed**: 2025-11-26

**Symptoms**:
- Log panel has 50px minimum height constraint
- Enforced when resizing log panel UP
- NOT enforced when dragging crosshair DOWN

**Root Cause**:
Crosshair resizer in `interactions.js` didn't know about log panel's pixel-based minimum height constraint.

**Solution**:
Added `enforceLogPanelConstraints()` function that dynamically shrinks log panel when parent pane gets too small.

**Files Modified**:
- `static/modules/ui/logPanel.js`
- `static/modules/map/interactions.js`

---

## Technical Notes

### Deck.gl Layer State Management
- Always include all layers in the `layers` array with consistent IDs
- Use `visible` prop to show/hide layers instead of conditional inclusion
- Include `visible` in `updateTriggers` to force updates

### Leaflet-Deck.gl Sync
- When resizing, BOTH Leaflet and Deck.gl need updates
- Call `map.invalidateSize()` for Leaflet
- Call `resizeDeckCanvas()` which syncs size AND view state

### View State Sync Formula
```javascript
viewState: {
    longitude: center.lng,
    latitude: center.lat,
    zoom: zoom - 1,  // CRITICAL: Deck.gl MapView needs zoom - 1
    pitch: 0,
    bearing: 0,
    transitionDuration: 0
}
```

### Batched Updates Pattern
```javascript
// DON'T: Direct setProps
window.deckgl.setProps({ layers: [...] });

// DO: Use tracked wrapper (batched by default)
trackedSetProps({ layers: [...] }, 'source-name');
```

---

## Bug Report Template

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
[Technical explanation once identified]

**Solution**:
[Description of fix]

**Files Modified**:
- [file1.js]
- [file2.js]
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-26 | Initial standardized bug tracker |
