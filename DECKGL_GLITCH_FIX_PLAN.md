# Deck.gl Layer Glitch Investigation & Fix Plan

## Problem Statement
Sensors and ground track layers experience glitches and flickers when:
- User clicks on various UI elements
- User zooms or pans the map
- User resizes panels

## Goals
1. **Spatial/temporal accuracy** - Ensure layers render in correct positions at correct times
2. **Smooth rendering** - Priority on 60 FPS, no flickers
3. **Error handling** - Graceful degradation when errors occur

---

## Phase 1: Diagnostic Logging (Investigation)

### 1.1 Add Performance Metrics
Add timing measurements to identify slow operations:

```javascript
// In deckgl.js - updateDeckOverlay()
const perfStart = performance.now();
// ... layer creation code ...
const perfEnd = performance.now();
logger.diagnostic('Layer update timing', logger.CATEGORY.SYNC, {
    duration: `${(perfEnd - perfStart).toFixed(2)}ms`,
    sensors: sensorsToRender.length,
    satellites: satellitesToRender.length
});
```

### 1.2 Track setProps() Calls
Log every `setProps()` call to identify race conditions:

```javascript
// Create wrapper function
function safeSetProps(props, source) {
    logger.diagnostic(`setProps called from ${source}`, logger.CATEGORY.SYNC, {
        hasLayers: !!props.layers,
        hasViewState: !!props.viewState,
        hasSize: !!(props.width || props.height)
    });
    window.deckgl.setProps(props);
}
```

### 1.3 Track Layer State
Monitor Deck.gl internal layer state:

```javascript
// After setProps, check layer count
const stats = window.deckgl.getStats();
logger.diagnostic('Layer stats', logger.CATEGORY.SYNC, {
    layerCount: stats?.get('Layer Count') || 'N/A'
});
```

---

## Phase 2: Root Cause Analysis

### 2.1 Potential Issues Identified

| Issue | Description | Likelihood |
|-------|-------------|------------|
| **Race condition** | Multiple `setProps()` calls from sync + updateDeckOverlay | HIGH |
| **Layer recreation** | New layer instances created on every update | MEDIUM |
| **View state interference** | Sync overwrites view state during layer update | HIGH |
| **Canvas resize conflicts** | Auto-fix in sync function triggers additional updates | MEDIUM |
| **Transition artifacts** | Internal Deck.gl transitions despite `transitionDuration: 0` | LOW |

### 2.2 Investigation Steps

1. **Add call stack logging** to identify which code paths trigger glitches
2. **Disable throttling temporarily** to see if timing issues cause problems
3. **Test with single layer** to isolate if issue is layer-specific
4. **Monitor requestAnimationFrame** to see if updates happen mid-frame

---

## Phase 3: Fixes

### 3.1 Consolidate setProps() Calls
**Problem**: Multiple sources call `setProps()` independently, causing state thrashing.

**Solution**: Create a batched update system:

```javascript
// New: Batched update manager
class DeckGLUpdateManager {
    constructor() {
        this.pendingUpdates = {};
        this.frameRequested = false;
    }

    queueUpdate(updates) {
        Object.assign(this.pendingUpdates, updates);
        if (!this.frameRequested) {
            this.frameRequested = true;
            requestAnimationFrame(() => this.flush());
        }
    }

    flush() {
        if (Object.keys(this.pendingUpdates).length > 0) {
            window.deckgl.setProps(this.pendingUpdates);
            this.pendingUpdates = {};
        }
        this.frameRequested = false;
    }
}
```

### 3.2 Layer Instance Caching
**Problem**: Creating new layer objects on every update may cause Deck.gl to lose track of state.

**Solution**: Cache layer configurations and only update when data changes:

```javascript
// Cache layer data fingerprints
let lastSensorFingerprint = '';
let lastSatelliteFingerprint = '';

function shouldUpdateLayers(sensors, satellites) {
    const sensorFP = sensors.map(s => `${s.id}-${s.lat}-${s.lon}`).join(',');
    const satelliteFP = satellites.map(s => `${s.id}-${s.selected}`).join(',');

    const needsUpdate = sensorFP !== lastSensorFingerprint ||
                        satelliteFP !== lastSatelliteFingerprint;

    if (needsUpdate) {
        lastSensorFingerprint = sensorFP;
        lastSatelliteFingerprint = satelliteFP;
    }

    return needsUpdate;
}
```

### 3.3 Separate View State from Layer Updates
**Problem**: Leaflet sync calls `setProps()` with viewState which may interfere with layer updates.

**Solution**: Never mix viewState and layers in the same `setProps()` call:

```javascript
// In setupLeafletSync - ONLY update viewState
deckgl.setProps({ viewState: {...} });  // Never include layers here

// In updateDeckOverlay - ONLY update layers
window.deckgl.setProps({ layers: [...] });  // Never include viewState here
```

### 3.4 Add Debounced Layer Updates
**Problem**: Rapid layer updates (e.g., during resize drag) cause flickering.

**Solution**: Debounce layer updates:

```javascript
let updateLayerTimeout = null;

function debouncedUpdateDeckOverlay(delay = 16) {  // 16ms = 60fps
    if (updateLayerTimeout) {
        clearTimeout(updateLayerTimeout);
    }
    updateLayerTimeout = setTimeout(() => {
        updateDeckOverlay();
        updateLayerTimeout = null;
    }, delay);
}
```

### 3.5 Error Handling for Ground Tracks
**Problem**: Invalid TLE or propagation errors could cause incomplete tracks.

**Solution**: Add validation and fallback:

```javascript
export function calculateGroundTrack(tle1, tle2, startTime, duration, step) {
    // Validate inputs
    if (!tle1 || !tle2 || tle1.length !== 69 || tle2.length !== 69) {
        logger.error('Invalid TLE data', logger.CATEGORY.SATELLITE);
        return []; // Return empty array instead of undefined
    }

    const track = [];
    let consecutiveErrors = 0;
    const MAX_ERRORS = 3;

    for (let i = 0; i <= steps; i++) {
        const position = propagateSatellite(tle1, tle2, time);

        if (position) {
            track.push([position.lon, position.lat]);
            consecutiveErrors = 0;
        } else {
            consecutiveErrors++;
            if (consecutiveErrors >= MAX_ERRORS) {
                logger.warning('Ground track calculation aborted - too many errors');
                break;
            }
        }
    }

    return track;
}
```

---

## Phase 4: Testing

### 4.1 Create test-deckgl.html
New test file for Deck.gl layer rendering:

```
Tests to implement:
- [ ] Layer visibility toggles correctly
- [ ] View state sync maintains accuracy after 100 pan/zoom operations
- [ ] Resize operations don't cause coordinate drift
- [ ] Empty data arrays render correctly (no orphan icons)
- [ ] Ground track with invalid TLE returns empty array
- [ ] Rapid selection/deselection doesn't cause flickering
```

### 4.2 Performance Benchmarks

```
Targets:
- updateDeckOverlay(): < 5ms for 12 sensors
- Ground track calculation: < 50ms for 90 points
- View state sync: < 1ms per call
- No frame drops during 60-second pan/zoom test
```

### 4.3 Manual Testing Checklist

```
[ ] Load app - sensors visible at correct locations
[ ] Click control panel - sensors don't disappear
[ ] Resize panels vertically - sensors stay in place
[ ] Resize panels horizontally - sensors stay in place
[ ] Drag crosshair - sensors don't drift
[ ] Deselect all sensors - all icons disappear
[ ] Select all sensors - all icons appear
[ ] Zoom in/out rapidly - no flickering
[ ] Pan across date line - layers render on wrapped world copies
[ ] Maximize map - sensors stay accurate
[ ] Restore map - sensors stay accurate
```

---

## Phase 5: Documentation

### 5.1 Update BUGS_TO_FIX.md
Document the root cause and solution.

### 5.2 Add Code Comments
Add inline documentation explaining the synchronization pattern.

---

## Implementation Order

1. **Phase 1** - Add diagnostic logging (to identify exact trigger)
2. **Phase 2** - Analyze logs to confirm root cause
3. **Phase 3.3** - Separate view state from layer updates (likely main fix)
4. **Phase 3.1** - Batch setProps() calls (if still glitching)
5. **Phase 3.5** - Add error handling (for stability)
6. **Phase 4** - Create test file and run manual tests
7. **Phase 5** - Document findings

---

## Files to Modify

| File | Changes |
|------|---------|
| `static/modules/map/deckgl.js` | Main fixes - batching, caching, separation |
| `static/modules/map/interactions.js` | Use debounced updates during resize |
| `static/modules/data/propagation.js` | Add error handling |
| `static/test-deckgl.html` | New test file |
| `BUGS_TO_FIX.md` | Documentation update |

---

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| Batched updates | May introduce latency | Use requestAnimationFrame for 16ms max delay |
| Layer caching | May miss updates | Use comprehensive fingerprint including all mutable fields |
| Separated setProps | May cause brief desync | Test thoroughly with rapid operations |

---

## Estimated Effort

- Phase 1 (Logging): 30 minutes
- Phase 2 (Analysis): 1 hour (depends on logs)
- Phase 3 (Fixes): 2-3 hours
- Phase 4 (Testing): 1 hour
- Phase 5 (Docs): 30 minutes

**Total: ~5-6 hours**
