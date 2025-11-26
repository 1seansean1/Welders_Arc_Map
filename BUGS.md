# WA_map Bug Tracker

> **Document Type**: BUGS
> **Version**: 1.0
> **Last Updated**: 2025-11-26
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

## Closed Bugs

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
