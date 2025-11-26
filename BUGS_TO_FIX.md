# Bugs to Fix - Satellite Visualization System

## Session: 2025-11-26

### Bug 1: Log Panel Minimum Height Not Enforced on Crosshair Drag
**Status:** FIXED

**Problem:** Panel 2 (bottom-left) has a minimum height constraint for the log panel (50px). This was enforced when resizing the log panel UP, but NOT when dragging the crosshair/horizontal handle DOWN.

**Root Cause:** The crosshair resizer in `interactions.js` didn't know about the log panel's pixel-based minimum height constraint.

**Fix:**
- Added `enforceLogPanelConstraints()` function to `logPanel.js` that dynamically shrinks the log panel when the parent pane gets too small
- Called this function during drag movements in `interactions.js`
- Log panel now smoothly shrinks as the crosshair is dragged down

**Files Modified:**
- `static/modules/ui/logPanel.js`
- `static/modules/map/interactions.js`

---

### Bug 2: Sensor Icons Remain on Map After Deselecting All
**Status:** FIXED

**Problem:** When deselecting all sensors (clicking "Sel" header), some sensor donut icons remained visible on the map even though the log showed "Map updated: 0 sensor(s)".

**Root Cause:** Deck.gl's `updateTriggers` weren't properly forcing layer updates when the data array became empty. The conditional layer inclusion (only adding layers when data exists) caused state corruption.

**Fix:**
- Added `visible` prop to all three layers (sensor icons, FOV polygons, ground tracks)
- Changed from conditionally including layers to ALWAYS including all layers
- Use `visible: length > 0` to control rendering instead of excluding layers
- This ensures consistent layer IDs and prevents Deck.gl state corruption

**Files Modified:**
- `static/modules/map/deckgl.js`

---

### Bug 3: Sensors Disappear/Glitch When Resizing Map or Clicking Panel
**Status:** PARTIALLY FIXED (may need more testing)

**Problem:**
1. When the app first loads, sensors are visible
2. Clicking on control panel or resizing panels causes sensors to disappear
3. Another click makes them reappear
4. When vertically resizing the map, sensors appear at WRONG LOCATIONS (e.g., New York appears in Greenland)
5. Zooming in/out fixes the location issue

**Root Cause:**
1. Deck.gl layer state was getting corrupted when `setProps()` was called with different layer arrays
2. When the map container resizes, Deck.gl canvas dimensions change but the view state wasn't being synced with Leaflet, causing coordinate transformation mismatch

**Fix:**
1. Always include all layers with `visible` prop (see Bug 2 fix)
2. Modified `resizeDeckCanvas()` to sync BOTH canvas size AND view state with Leaflet
3. Added real-time Leaflet/Deck.gl sync during ALL resize drag operations:
   - Vertical handle (horizontal resize)
   - Horizontal handle (vertical resize)
   - Crosshair (both axes)

**Files Modified:**
- `static/modules/map/deckgl.js`
- `static/modules/map/interactions.js`

---

### Bug 4: Sensor/Ground Track Flickering During Pan/Zoom/Click
**Status:** FIXED (implementation complete, pending testing)

**Problem:**
- Sensors and ground track layers flicker/glitch during:
  - User clicks on various UI elements
  - User zooms or pans the map
  - User resizes panels
- Layers occasionally disappear and reappear

**Root Cause:**
Multiple `setProps()` calls from different sources were racing against each other:
1. `sync:viewState` - Called on every Leaflet move/zoom event
2. `sync:size-fix` - Called when canvas size mismatch detected
3. `updateDeckOverlay:layers` - Called when layer data changes
4. `resizeDeckCanvas:size+viewState` - Called during resize operations

These calls could interleave within a single animation frame, causing Deck.gl to receive conflicting state updates.

**Fix:**
1. **Batched Update Manager** - Created `DeckGLUpdateManager` class that:
   - Queues all `setProps()` updates
   - Combines multiple updates into a single call per animation frame
   - Uses `requestAnimationFrame` to batch updates at 60 FPS
   - Merges viewState, layers, and size updates into one atomic operation

2. **Tracked setProps Wrapper** - All setProps calls now go through `trackedSetProps()` which:
   - Logs call source and timing for debugging
   - Queues updates for batching by default
   - Warns about rapid successive calls

3. **Error Handling for Ground Tracks** - Enhanced `calculateGroundTrack()`:
   - Validates TLE data before processing
   - Returns empty array (not undefined) on errors
   - Aborts after 3 consecutive propagation errors
   - Logs success rate for partial failures

**Debugging Tools Added:**
```javascript
// Available in browser console:
window.deckglDebug.getSetPropsHistory()     // View recent setProps calls
window.deckglDebug.hasPendingUpdates()      // Check for queued updates
window.deckglDebug.flushNow()               // Force immediate flush
window.deckglDebug.getLayerInfo()           // View current layer state
window.deckglDebug.getUpdateManagerState()  // View batch manager state
```

**Files Modified:**
- `static/modules/map/deckgl.js` - Batched update manager, tracked setProps
- `static/modules/data/propagation.js` - Error handling for ground tracks

**Test File Added:**
- `static/test-deckgl.html` - Automated and manual test suite

---

## Technical Notes

### Deck.gl Layer State Management
- Always include all layers in the `layers` array with consistent IDs
- Use `visible` prop to show/hide layers instead of conditionally including them
- Include `visible` in `updateTriggers` to force updates when visibility changes

### Leaflet-Deck.gl Sync
- When resizing the map container, BOTH Leaflet and Deck.gl need to be updated
- Call `map.invalidateSize()` to update Leaflet
- Call `resizeDeckCanvas()` which now syncs both size AND view state
- The view state must be synced to prevent coordinate transformation mismatch

### View State Sync Formula
```javascript
// Deck.gl MapView needs zoom - 1 for Leaflet compatibility
viewState: {
    longitude: center.lng,
    latitude: center.lat,
    zoom: zoom - 1,
    pitch: 0,
    bearing: 0,
    transitionDuration: 0
}
```

### Batched Updates Pattern
To prevent race conditions, all Deck.gl `setProps()` calls should go through the batched update manager:

```javascript
// Instead of direct setProps:
window.deckgl.setProps({ layers: [...] });  // DON'T DO THIS

// Use the tracked wrapper (batched by default):
trackedSetProps({ layers: [...] }, 'source-name');  // DO THIS

// For immediate updates (rare, only when batching would cause issues):
trackedSetProps({ layers: [...] }, 'source-name', { immediate: true });
```

The batched update manager:
1. Collects all `setProps()` calls within a single animation frame
2. Merges overlapping properties (later calls override earlier ones)
3. Flushes all updates in one atomic `setProps()` call
4. Logs the combined sources for debugging

### Error Handling Best Practices
- Always return empty arrays `[]` instead of `undefined` or `null` for array data
- Validate inputs before processing (TLE strings, dates, coordinates)
- Use consecutive error tracking to abort early on persistent failures
- Log success rates for partial failures to aid debugging
