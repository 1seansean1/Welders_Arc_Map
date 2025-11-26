/**
 * Deck.gl Module - WebGL overlay for satellite and sensor visualization
 *
 * DEPENDENCIES:
 * - logger: Diagnostic logging
 * - sensorState: Sensor data for rendering
 * - satelliteState: Satellite data for rendering
 * - calculateFOVCircle: FOV geometry calculations
 * - calculateGroundTrack: Satellite propagation
 * - deck (global): Deck.gl library
 *
 * Features:
 * - GPU-accelerated rendering
 * - Sensor icons and FOV circles
 * - Satellite ground tracks
 * - Leaflet map sync
 *
 * PERFORMANCE:
 * - GPU-accelerated rendering
 * - 60 FPS target
 * - Instanced rendering for satellites
 * - Separate WebGL context (map doesn't block satellite rendering)
 *
 * MOBILE:
 * - Lower quality on mobile devices
 * - Reduced update frequency
 * - Touch gesture support
 *
 * LEAFLET INTEGRATION:
 * - Uses deck.gl's Deck class with Leaflet adapter
 * - Independent rendering (satellites update even during map pan)
 * - Better performance than shared context
 */

import logger from '../utils/logger.js';
import eventBus from '../events/eventBus.js';
import sensorState from '../state/sensorState.js';
import satelliteState from '../state/satelliteState.js';
import timeState from '../state/timeState.js';
import { calculateFOVCircle } from '../utils/geometry.js';
import { calculateGroundTrack } from '../data/propagation.js';
import { diagnostics } from './diagnostics.js';
import { mapTests } from './automated-tests.js';

// ============================================
// COORDINATE CONVERSION UTILITIES
// ============================================

/**
 * Leaflet to Deck.gl zoom offset constant
 * Deck.gl MapView uses a different zoom scale than Leaflet.
 * This constant ensures consistent conversion everywhere.
 *
 * CRITICAL: Always use this constant or leafletToDeckglViewState()
 * Never hardcode zoom - 1 directly.
 */
const LEAFLET_TO_DECKGL_ZOOM_OFFSET = -1;

/**
 * Convert Leaflet map state to Deck.gl viewState
 * Enforces consistent coordinate conversion across all code paths.
 *
 * This function should be used everywhere viewState is created from Leaflet.
 * It ensures:
 * - Correct zoom offset (Deck.gl MapView uses zoom - 1)
 * - Consistent pitch/bearing (always 0 for 2D map)
 * - No transitions (instant updates)
 *
 * @param {L.Map} map - Leaflet map instance
 * @returns {Object} Deck.gl viewState object
 */
function leafletToDeckglViewState(map) {
    const center = map.getCenter();
    const zoom = map.getZoom();

    return {
        longitude: center.lng,
        latitude: center.lat,
        zoom: zoom + LEAFLET_TO_DECKGL_ZOOM_OFFSET,
        pitch: 0,
        bearing: 0,
        transitionDuration: 0,
        transitionInterpolator: null
    };
}

// ============================================
// BATCHED UPDATE MANAGER
// ============================================

/**
 * Batched update manager to prevent race conditions
 * Collects all setProps updates and flushes them in a single call per frame
 *
 * This prevents glitching caused by:
 * - Multiple setProps calls in quick succession
 * - viewState and layers updates conflicting
 * - Size updates interfering with layer rendering
 */
class DeckGLUpdateManager {
    constructor() {
        this.pendingUpdates = {};
        this.frameRequested = false;
        this.flushCallbacks = [];
    }

    /**
     * Queue an update to be batched with others
     * @param {Object} updates - Props to update
     * @param {string} source - Source identifier for debugging
     */
    queueUpdate(updates, source) {
        // Merge updates (later calls override earlier ones for same keys)
        Object.assign(this.pendingUpdates, updates);

        // Track source for debugging
        if (!this.pendingUpdates._sources) {
            this.pendingUpdates._sources = [];
        }
        this.pendingUpdates._sources.push(source);

        // Schedule flush if not already scheduled
        if (!this.frameRequested) {
            this.frameRequested = true;
            requestAnimationFrame(() => this.flush());
        }
    }

    /**
     * Flush all pending updates in a single setProps call
     */
    flush() {
        this.frameRequested = false;

        if (Object.keys(this.pendingUpdates).length === 0) {
            return;
        }

        // Extract sources for logging, then remove from props
        const sources = this.pendingUpdates._sources || [];
        delete this.pendingUpdates._sources;

        const hasLayers = !!this.pendingUpdates.layers;
        const hasViewState = !!this.pendingUpdates.viewState;
        const hasSize = !!(this.pendingUpdates.width || this.pendingUpdates.height);

        if (window.deckgl && Object.keys(this.pendingUpdates).length > 0) {
            // Log the batched update
            logger.diagnostic('Batched setProps flush', logger.CATEGORY.SYNC, {
                sources: sources.join(' + '),
                hasLayers,
                hasViewState,
                hasSize
            });

            // Record for diagnostics (race condition detection)
            diagnostics.recordSetPropsCall(
                sources.join('+'),
                hasViewState,
                hasLayers,
                hasSize
            );

            // Perform the single setProps call
            window.deckgl.setProps(this.pendingUpdates);

            // Call any registered callbacks
            this.flushCallbacks.forEach(cb => cb(this.pendingUpdates));
        }

        // Clear pending updates
        this.pendingUpdates = {};
    }

    /**
     * Force immediate flush (for critical updates)
     */
    flushNow() {
        if (this.frameRequested) {
            cancelAnimationFrame(this.frameRequested);
            this.frameRequested = false;
        }
        this.flush();
    }

    /**
     * Register a callback to be called after each flush
     * @param {Function} callback
     */
    onFlush(callback) {
        this.flushCallbacks.push(callback);
    }

    /**
     * Check if there are pending updates
     * @returns {boolean}
     */
    hasPendingUpdates() {
        return Object.keys(this.pendingUpdates).length > 0;
    }
}

// Create singleton instance
const updateManager = new DeckGLUpdateManager();

// ============================================
// DIAGNOSTIC: setProps() TRACKING
// ============================================

// Track setProps calls for debugging race conditions
let setPropsCallCount = 0;
let lastSetPropsTime = 0;
let setPropsHistory = [];  // Keep last 10 calls for debugging
const MAX_HISTORY = 10;

/**
 * Wrapper for setProps that tracks all calls for debugging
 * Helps identify race conditions and conflicting updates
 *
 * @param {Object} props - Props to pass to Deck.gl
 * @param {string} source - Identifier for the calling function
 * @param {Object} options - Options
 * @param {boolean} options.batched - If true, queue update instead of immediate (default: true)
 * @param {boolean} options.immediate - If true, flush batched updates immediately
 */
function trackedSetProps(props, source, options = {}) {
    if (!window.deckgl) return;

    const { batched = true, immediate = false } = options;

    const now = performance.now();
    const timeSinceLast = now - lastSetPropsTime;
    setPropsCallCount++;

    // Build call info
    const callInfo = {
        id: setPropsCallCount,
        source: source,
        time: now.toFixed(2),
        timeSinceLast: timeSinceLast.toFixed(2),
        hasLayers: !!props.layers,
        hasViewState: !!props.viewState,
        hasSize: !!(props.width || props.height),
        layerCount: props.layers ? props.layers.length : 0,
        batched: batched
    };

    // Track in history
    setPropsHistory.push(callInfo);
    if (setPropsHistory.length > MAX_HISTORY) {
        setPropsHistory.shift();
    }

    lastSetPropsTime = now;

    if (batched) {
        // Queue for batched update (combines with other updates in same frame)
        updateManager.queueUpdate(props, source);

        if (immediate) {
            updateManager.flushNow();
        }
    } else {
        // Direct update (legacy behavior, may cause glitches)
        // Warn if calls are happening very rapidly (< 5ms apart)
        if (timeSinceLast < 5 && timeSinceLast > 0) {
            logger.warning('Rapid direct setProps calls detected', logger.CATEGORY.SYNC, {
                source: source,
                timeSinceLast: `${timeSinceLast.toFixed(2)}ms`,
                callCount: setPropsCallCount
            });
        }

        // Log significant updates (layers or size changes)
        if (props.layers || props.width || props.height) {
            logger.diagnostic(`setProps [${source}] (direct)`, logger.CATEGORY.SYNC, callInfo);
        }

        // Perform the direct setProps call
        window.deckgl.setProps(props);
    }
}

/**
 * Get setProps call history for debugging
 * @returns {Array} Recent setProps calls
 */
export function getSetPropsHistory() {
    return [...setPropsHistory];
}

/**
 * Reset setProps tracking (for testing)
 */
export function resetSetPropsTracking() {
    setPropsCallCount = 0;
    lastSetPropsTime = 0;
    setPropsHistory = [];
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize Deck.gl and overlay it on Leaflet map
 *
 * @param {L.Map} map - Leaflet map instance
 * @returns {deck.Deck|null} Deck.gl instance or null on failure
 */
export function initializeDeckGL(map) {
    // Check if Deck.gl library is loaded
    if (typeof deck === 'undefined') {
        logger.error(
            'Deck.gl library not loaded',
            logger.CATEGORY.SATELLITE,
            { expected: 'window.deck', found: typeof deck }
        );
        return null;
    }

    logger.info('Initializing Deck.gl overlay', logger.CATEGORY.SATELLITE);

    try {
        // Get Leaflet map center and zoom for initial sync
        const leafletCenter = map.getCenter();
        const leafletZoom = map.getZoom();

        // Create Deck.gl instance
        // Note: Deck.gl with Leaflet uses separate WebGL context (better performance)
        const deckgl = new deck.Deck({
            // Let Deck.gl create its own canvas
            parent: document.getElementById('map-container'),

            // CRITICAL: Explicit MapView with world wrapping to match Leaflet's Web Mercator
            views: new deck.MapView({repeat: true}),

            // CRITICAL: Use viewState (controlled) not initialViewState (uncontrolled)
            // This ensures Deck.gl always uses our external view state
            viewState: {
                longitude: leafletCenter.lng,
                latitude: leafletCenter.lat,
                zoom: leafletZoom - 1,  // FIXED H-DRIFT-1: Deck.gl MapView needs zoom - 1 for Leaflet compatibility
                pitch: 0,
                bearing: 0,
                transitionDuration: 0  // No transitions - instant updates
            },

            // Controller disabled (Leaflet handles interaction)
            controller: false,

            // CRITICAL: Match Leaflet's coordinate system (CSS pixels, not device pixels)
            // Setting to false ensures 1:1 coordinate mapping with Leaflet
            // Otherwise Deck.gl scales by devicePixelRatio (typically 2x on retina)
            useDevicePixels: false,

            // Performance settings
            _typedArrayManagerProps: {
                overAlloc: 1,
                poolSize: 0
            },

            // Add initial satellite layers
            layers: [
                new deck.ScatterplotLayer({
                    id: 'test-satellites',
                    data: satelliteState.getAllSatellites(),
                    coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,  // CRITICAL: Explicit WGS84 → Web Mercator
                    wrapLongitude: true,  // CRITICAL: Render on all wrapped world copies
                    getPosition: d => [d.lon, d.lat],
                    getRadius: 100000,  // 100km radius
                    getFillColor: [0, 255, 100, 200],  // Green with transparency
                    getLineColor: [0, 255, 100, 255],
                    lineWidthMinPixels: 2,
                    stroked: true,
                    filled: true,
                    pickable: true,

                    // Show satellite name on hover
                    onHover: ({object}) => {
                        if (object) {
                            logger.diagnostic('Satellite hover', logger.CATEGORY.SATELLITE, {
                                name: object.name,
                                altitude: `${object.altitude}km`
                            });
                        }
                    }
                })
            ]
        });

        // Setup Leaflet sync
        setupLeafletSync(deckgl, map);

        // Setup canvas positioning
        setupCanvasPositioning(deckgl);

        // Setup time state sync for ground track updates
        setupTimeStateSync();

        logger.success(
            'Deck.gl initialized',
            logger.CATEGORY.SATELLITE,
            { satellites: satelliteState.getSatelliteCount() }
        );

        logger.diagnostic('Deck.gl configuration', logger.CATEGORY.SATELLITE, {
            context: 'Separate WebGL',
            controller: 'disabled',
            viewStateMode: 'controlled'
        });

        const initialView = deckgl.viewState || deckgl.props.viewState;
        logger.diagnostic('Coordinate system', logger.CATEGORY.SATELLITE, {
            projection: 'Web Mercator',
            view: 'MapView(repeat=true)',
            coordinateSystem: 'LNGLAT (WGS84→WebMercator)',
            wrapLongitude: 'true (render on all world copies)',
            initialView: `${initialView.longitude.toFixed(4)}°E, ${initialView.latitude.toFixed(4)}°N, zoom=${initialView.zoom.toFixed(2)}`
        });

        // Make accessible globally for layer updates
        window.deckgl = deckgl;

        return deckgl;

    } catch (error) {
        logger.error(
            `Deck.gl initialization failed: ${error.message}`,
            logger.CATEGORY.SATELLITE,
            { error: error.stack }
        );
        return null;
    }
}

/**
 * Setup Leaflet map sync with Deck.gl
 * Syncs view state when Leaflet map moves/zooms
 *
 * @param {deck.Deck} deckgl - Deck.gl instance
 * @param {L.Map} map - Leaflet map instance
 */
function setupLeafletSync(deckgl, map) {
    // Throttle variables for sync function (max 60 FPS = 16.67ms interval)
    let lastSyncTime = 0;
    let syncThrottleMs = 16; // 60 FPS max
    let pendingSyncFrame = null;

    const syncDeckWithLeaflet = () => {
        const now = performance.now();

        // Cancel any pending sync
        if (pendingSyncFrame) {
            cancelAnimationFrame(pendingSyncFrame);
            pendingSyncFrame = null;
        }

        // Throttle: only sync if enough time has passed since last sync
        const timeSinceLastSync = now - lastSyncTime;
        if (timeSinceLastSync < syncThrottleMs) {
            // Schedule sync for next frame
            pendingSyncFrame = requestAnimationFrame(syncDeckWithLeaflet);
            return;
        }

        lastSyncTime = now;

        const center = map.getCenter();
        const zoom = map.getZoom();

        // DIAGNOSTIC: Log sync event with structured context (reduced frequency)
        if (Math.random() < 0.1) { // Log only 10% of syncs to reduce noise
            logger.diagnostic(
                'Leaflet→Deck sync',
                logger.CATEGORY.SYNC,
                {
                    lng: center.lng.toFixed(4),
                    lat: center.lat.toFixed(4),
                    zoom: zoom.toFixed(2)
                }
            );
        }

        // Check canvas size
        const mapContainer = document.getElementById('map-container');
        const deckCanvas = deckgl.canvas;
        if (mapContainer && deckCanvas) {
            const containerRect = mapContainer.getBoundingClientRect();
            const canvasRect = deckCanvas.getBoundingClientRect();

            const widthDiff = Math.abs(containerRect.width - canvasRect.width);
            const heightDiff = Math.abs(containerRect.height - canvasRect.height);

            if (widthDiff > 1 || heightDiff > 1) {
                logger.warning(
                    'Canvas size mismatch',
                    logger.CATEGORY.SYNC,
                    {
                        container: `${containerRect.width.toFixed(0)}×${containerRect.height.toFixed(0)}`,
                        canvas: `${canvasRect.width.toFixed(0)}×${canvasRect.height.toFixed(0)}`,
                        drift: `${widthDiff.toFixed(0)}×${heightDiff.toFixed(0)}`
                    }
                );

                // CRITICAL: Auto-fix canvas size mismatch by resizing Deck.gl canvas
                trackedSetProps({
                    width: containerRect.width,
                    height: containerRect.height
                }, 'sync:size-fix');
            }
        }

        // CRITICAL: Set viewState with all transition controls disabled
        trackedSetProps({
            viewState: {
                longitude: center.lng,
                latitude: center.lat,
                zoom: zoom - 1,  // CRITICAL: Deck.gl MapView needs zoom - 1 for Leaflet compatibility
                pitch: 0,
                bearing: 0,
                transitionDuration: 0,  // No animation
                transitionInterpolator: null  // Force disable all interpolation
            }
        }, 'sync:viewState');

        // DIAGNOSTIC: Verify Deck.gl accepted the view state (only check occasionally)
        if (Math.random() < 0.05) { // Check only 5% of the time to reduce overhead
            setTimeout(() => {
                const deckViewState = deckgl.viewState || deckgl.props.viewState;
                if (deckViewState) {
                    // Check for drift (relaxed thresholds due to throttling)
                    const lngDrift = Math.abs(deckViewState.longitude - center.lng);
                    const latDrift = Math.abs(deckViewState.latitude - center.lat);
                    const zoomDrift = Math.abs(deckViewState.zoom - (zoom - 1)); // Account for zoom offset

                    // Record for diagnostics
                    diagnostics.recordSyncDrift(lngDrift, latDrift, zoomDrift);

                    // Higher thresholds to account for throttling delay
                    if (lngDrift > 0.01 || latDrift > 0.01 || zoomDrift > 0.01) {
                        logger.warning(
                            'Sync drift detected',
                            logger.CATEGORY.SYNC,
                            {
                                lngDrift: lngDrift.toFixed(6),
                                latDrift: latDrift.toFixed(6),
                                zoomDrift: zoomDrift.toFixed(4)
                            }
                        );

                        // Record as potential glitch
                        diagnostics.recordGlitch('drift', {
                            lngDrift, latDrift, zoomDrift
                        });
                    }
                }
            }, 0);
        }
    };

    // Listen to Leaflet map events
    map.on('move', syncDeckWithLeaflet);
    map.on('zoom', syncDeckWithLeaflet);

    // Initial sync
    syncDeckWithLeaflet();
}

/**
 * Setup Deck.gl canvas positioning over Leaflet map
 *
 * @param {deck.Deck} deckgl - Deck.gl instance
 */
function setupCanvasPositioning(deckgl) {
    // Wait for Deck.gl to create its canvas, then set proper layering
    // This ensures the canvas appears ABOVE Leaflet tiles and has EXACT same dimensions
    requestAnimationFrame(() => {
        const deckCanvas = deckgl.canvas || document.querySelector('#map-container canvas');
        const mapContainer = document.getElementById('map-container');

        if (deckCanvas && mapContainer) {
            // CRITICAL: Canvas must exactly match container size for proper coordinate transforms
            const rect = mapContainer.getBoundingClientRect();

            deckCanvas.style.position = 'absolute';
            deckCanvas.style.left = '0';
            deckCanvas.style.top = '0';
            deckCanvas.style.width = '100%';
            deckCanvas.style.height = '100%';
            deckCanvas.style.zIndex = '400';  // Above Leaflet tiles (z-index 200) but below controls (z-index 1000)
            deckCanvas.style.pointerEvents = 'none';  // Let Leaflet handle all interaction

            logger.success('Deck.gl canvas positioned', logger.CATEGORY.SATELLITE, {
                zIndex: 400,
                size: `${rect.width.toFixed(0)}×${rect.height.toFixed(0)}px`
            });
        } else {
            logger.warning('Could not find Deck.gl canvas for styling', logger.CATEGORY.SATELLITE);
        }
    });
}

/**
 * Setup time state synchronization
 * Updates ground tracks when simulation time changes.
 *
 * This ensures ground tracks reflect the simulation time (timeState)
 * not the wall clock time (new Date()).
 */
function setupTimeStateSync() {
    // Update ground tracks when simulation time changes
    eventBus.on('time:changed', ({ currentTime }) => {
        logger.diagnostic('Time changed, updating ground tracks', logger.CATEGORY.SYNC, {
            time: currentTime.toISOString()
        });
        updateDeckOverlay();
    });

    // Update ground tracks when time range is applied
    eventBus.on('time:applied', ({ startTime, stopTime }) => {
        logger.info('Time range applied, updating visualization', logger.CATEGORY.SYNC, {
            start: startTime?.toISOString().slice(0, 16),
            stop: stopTime?.toISOString().slice(0, 16)
        });
        updateDeckOverlay();
    });

    logger.diagnostic('Time state sync configured', logger.CATEGORY.SYNC);
}

// ============================================
// LAYER UPDATES
// ============================================

/**
 * Update Deck.gl overlay with sensors, FOV, and satellite ground tracks
 * Renders only selected sensors and satellites on the map
 *
 * PERFORMANCE: O(n + m*k) where n = sensors, m = satellites, k = ground track points
 */
export function updateDeckOverlay() {
    const perfStart = performance.now();

    if (!window.deckgl) {
        logger.warning('Deck.gl not initialized', logger.CATEGORY.SATELLITE);
        return;
    }

    // Filter to only SELECTED sensors (checkbox = visibility control)
    const sensorsToRender = sensorState.getSelectedSensors();
    const perfAfterSensorFetch = performance.now();

    // Prepare sensor icon data (donut circles)
    const sensorIconData = sensorsToRender.map(sensor => ({
        position: [sensor.lon, sensor.lat],
        radius: 8000, // meters (visual size on map)
        color: [157, 212, 255], // Steel blue (#9dd4ff)
        sensor: sensor
    }));

    // Prepare FOV polygon data
    const fovPolygonData = sensorsToRender.map(sensor => {
        const polygon = calculateFOVCircle(sensor.lat, sensor.lon, sensor.fovAltitude);
        return {
            polygon: polygon,
            sensor: sensor
        };
    });

    // Create sensor icon layer (donut circles)
    // CRITICAL: Always include layer with 'visible' prop to prevent state corruption
    const sensorLayer = new deck.ScatterplotLayer({
        id: 'sensor-icons',
        data: sensorIconData,
        visible: sensorsToRender.length > 0,  // Hide when no sensors selected
        coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,  // CRITICAL: Explicit WGS84 → Web Mercator
        wrapLongitude: true,  // CRITICAL: Render on all wrapped world copies
        pickable: true,
        opacity: 0.9,
        stroked: true,
        filled: true,
        radiusScale: 1,
        radiusMinPixels: 6,
        radiusMaxPixels: 12,
        lineWidthMinPixels: 2,
        getPosition: d => d.position,
        getRadius: d => d.radius,
        // Icon type: 'filled' = solid blue, 'donut' = blue ring (default), 'outline' = thin outline
        getFillColor: d => {
            if (d.sensor.iconType === 'filled') return d.color; // Solid fill
            if (d.sensor.iconType === 'donut') return [157, 212, 255, 0]; // Transparent center
            return [0, 0, 0, 0]; // Outline only - no fill
        },
        getLineColor: d => d.color,
        getLineWidth: d => d.sensor.iconType === 'outline' ? 1 : 2,
        // CRITICAL: Disable transitions to prevent glitching during pan/zoom
        transitions: {
            getPosition: 0,
            getRadius: 0,
            getFillColor: 0,
            getLineColor: 0
        },
        // Update triggers: only recreate when sensor data actually changes
        updateTriggers: {
            visible: sensorsToRender.length,
            getPosition: sensorsToRender.map(s => `${s.id}-${s.lon}-${s.lat}`).join(','),
            getFillColor: sensorsToRender.map(s => `${s.id}-${s.iconType}`).join(',')
        },
        onHover: ({object}) => {
            if (object) {
                logger.diagnostic('Sensor hover', logger.CATEGORY.SENSOR, {
                    name: object.sensor.name,
                    lat: object.sensor.lat.toFixed(2),
                    lon: object.sensor.lon.toFixed(2)
                });
            }
        }
    });

    // Create FOV polygon layer
    // CRITICAL: Always include layer with 'visible' prop to prevent state corruption
    const fovLayer = new deck.PolygonLayer({
        id: 'sensor-fov',
        data: fovPolygonData,
        visible: sensorsToRender.length > 0,  // Hide when no sensors selected
        coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,  // CRITICAL: Explicit WGS84 → Web Mercator
        wrapLongitude: true,  // CRITICAL: Render on all wrapped world copies
        pickable: false,
        stroked: true,
        filled: true,
        wireframe: false,
        lineWidthMinPixels: 1,
        getPolygon: d => d.polygon,
        getFillColor: [157, 212, 255, 30], // Semi-transparent steel blue
        getLineColor: [157, 212, 255, 120],
        getLineWidth: 1,
        // CRITICAL: Disable transitions to prevent glitching during pan/zoom
        transitions: {
            getPolygon: 0,
            getFillColor: 0,
            getLineColor: 0
        },
        // Update triggers: only recreate when FOV data actually changes
        updateTriggers: {
            visible: sensorsToRender.length,
            getPolygon: sensorsToRender.map(s => `${s.id}-${s.lat}-${s.lon}-${s.fovAltitude}`).join(',')
        }
    });

    // Calculate ground tracks for selected satellites
    const satellitesToRender = satelliteState.getSelectedSatellites();
    // FIXED: Use simulation time from timeState instead of wall clock
    // This ensures ground tracks reflect the simulation time, not real time
    const currentTime = timeState.getCurrentTime();

    // Prepare ground track data
    // calculateGroundTrack returns array of path segments (split at anti-meridian crossings)
    // Flatten to one data entry per segment for PathLayer
    const groundTrackData = [];
    const GREY = [128, 128, 128];  // Default grey color (conditional coloring in future)

    satellitesToRender.forEach((sat) => {
        // Calculate ground track: 90 minutes forward, 20-second steps (default)
        // Returns array of path segments to handle anti-meridian crossings
        const segments = calculateGroundTrack(sat.tleLine1, sat.tleLine2, currentTime, 90);

        // Add each segment as a separate path entry
        segments.forEach((segment, segIndex) => {
            groundTrackData.push({
                path: segment,
                name: sat.name,
                color: GREY,
                satellite: sat,
                segmentIndex: segIndex
            });
        });
    });

    // Create ground track layer (PathLayer for orbital paths)
    // CRITICAL: Always include layer with 'visible' prop to prevent state corruption
    const groundTrackLayer = new deck.PathLayer({
        id: 'satellite-ground-tracks',
        data: groundTrackData,
        visible: satellitesToRender.length > 0,  // Hide when no satellites selected
        coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,
        wrapLongitude: true,
        pickable: true,
        widthScale: 1,
        widthMinPixels: 2,
        widthMaxPixels: 3,
        getPath: d => d.path,
        getColor: d => [...d.color, 180], // Add alpha channel
        getWidth: 2,
        // Disable transitions to prevent glitching
        transitions: {
            getPath: 0,
            getColor: 0,
            getWidth: 0
        },
        // Update triggers
        updateTriggers: {
            visible: satellitesToRender.length,
            getPath: satellitesToRender.map(s => `${s.id}-${s.tleLine1}`).join(',')
        },
        onHover: ({object}) => {
            if (object) {
                logger.diagnostic('Satellite ground track hover', logger.CATEGORY.SATELLITE, {
                    name: object.name,
                    noradId: object.satellite.noradId
                });
            }
        }
    });

    const perfAfterLayerCreation = performance.now();

    // CRITICAL: Always include ALL layers to prevent state corruption when other setProps() calls happen
    // Use 'visible' prop on each layer to control rendering instead of conditionally including layers
    // This ensures consistent layer IDs and prevents Deck.gl from losing track of layer state
    trackedSetProps({
        layers: [fovLayer, sensorLayer, groundTrackLayer]
    }, 'updateDeckOverlay:layers');

    const perfEnd = performance.now();

    // Log performance metrics
    logger.diagnostic('updateDeckOverlay timing', logger.CATEGORY.SYNC, {
        total: `${(perfEnd - perfStart).toFixed(2)}ms`,
        dataFetch: `${(perfAfterSensorFetch - perfStart).toFixed(2)}ms`,
        layerCreation: `${(perfAfterLayerCreation - perfAfterSensorFetch).toFixed(2)}ms`,
        setProps: `${(perfEnd - perfAfterLayerCreation).toFixed(2)}ms`,
        sensors: sensorsToRender.length,
        satellites: satellitesToRender.length
    });

    logger.info(`Map updated: ${sensorsToRender.length} sensor(s), ${satellitesToRender.length} satellite ground track(s)`);
}

/**
 * Get the global Deck.gl instance
 * @returns {deck.Deck|null} Deck.gl instance or null if not initialized
 */
export function getDeckGL() {
    return window.deckgl || null;
}

/**
 * Resize Deck.gl canvas to match container
 * Call after container size changes (pane resize, maximize, etc.)
 *
 * CRITICAL: Must also sync view state with Leaflet to prevent coordinate mismatch
 * When the canvas resizes, Deck.gl needs updated dimensions AND view state
 * to correctly transform lat/lng to screen coordinates
 */
export function resizeDeckCanvas() {
    if (!window.deckgl) return;

    const mapContainer = document.getElementById('map-container');
    const map = window.leafletMap;
    if (!mapContainer) return;

    const rect = mapContainer.getBoundingClientRect();

    // Record resize event for diagnostics
    diagnostics.recordResize(rect.width, rect.height, 'resizeDeckCanvas');

    // CRITICAL: Sync view state along with size to prevent coordinate mismatch
    // Without this, Deck.gl uses stale view state with new dimensions, causing
    // sensors to appear in wrong locations until a zoom/pan event syncs them
    if (map) {
        const center = map.getCenter();
        const zoom = map.getZoom();

        trackedSetProps({
            width: rect.width,
            height: rect.height,
            viewState: {
                longitude: center.lng,
                latitude: center.lat,
                zoom: zoom - 1,  // Deck.gl MapView needs zoom - 1 for Leaflet compatibility
                pitch: 0,
                bearing: 0,
                transitionDuration: 0
            }
        }, 'resizeDeckCanvas:size+viewState');
    } else {
        // Fallback if map not available
        trackedSetProps({
            width: rect.width,
            height: rect.height
        }, 'resizeDeckCanvas:size-only');
    }

    logger.diagnostic('Deck.gl canvas resized', logger.CATEGORY.SATELLITE, {
        size: `${rect.width.toFixed(0)}×${rect.height.toFixed(0)}px`
    });
}

// ============================================
// GLOBAL DEBUGGING EXPORTS
// ============================================

// Make debugging functions available in browser console
if (typeof window !== 'undefined') {
    window.deckglDebug = {
        getSetPropsHistory,
        resetSetPropsTracking,
        getLayerInfo: () => {
            if (!window.deckgl) return null;
            const layers = window.deckgl.props?.layers || [];
            return layers.map(l => ({
                id: l.id,
                visible: l.props?.visible,
                dataLength: l.props?.data?.length || 0
            }));
        },
        forceLayerUpdate: () => {
            updateDeckOverlay();
            return 'Layer update triggered';
        },
        flushNow: () => {
            updateManager.flushNow();
            return 'Batched updates flushed';
        },
        hasPendingUpdates: () => updateManager.hasPendingUpdates(),
        getUpdateManagerState: () => ({
            hasPending: updateManager.hasPendingUpdates(),
            pendingKeys: Object.keys(updateManager.pendingUpdates).filter(k => k !== '_sources'),
            frameRequested: updateManager.frameRequested
        }),
        // Diagnostics integration
        validateMapSync: () => diagnostics.validateSync(),
        startDiagnostics: () => {
            diagnostics.startRecording();
            return 'Diagnostics recording started';
        },
        stopDiagnostics: () => {
            const report = diagnostics.stopRecording();
            console.log('=== DIAGNOSTIC REPORT ===');
            console.log('Duration:', report.durationFormatted);
            console.log('\nFRAMES:');
            console.table(report.frames);
            console.log('\nSYNC:');
            console.table(report.sync);
            console.log('\nSETPROPS CALLS:');
            console.table(report.setProps);
            console.log('\nGLITCHES:');
            console.table(report.glitches);
            console.log('\nSUMMARY:');
            console.log('Healthy:', report.summary.healthy);
            console.log('Issues:', report.summary.issues);
            return report;
        },
        saveBaseline: () => {
            const report = diagnostics.generateReport();
            diagnostics.saveAsBaseline(report);
            return 'Baseline saved';
        },
        compareToBaseline: () => {
            const current = diagnostics.generateReport();
            return diagnostics.compareToBaseline(current);
        },
        // Automated test suite
        runAllTests: () => mapTests.runAll(),
        runAblation: () => mapTests.runAblationStudy(),
        testPanSync: () => mapTests.testPanSync(),
        testZoomSync: () => mapTests.testZoomSync(),
        testTimeSync: () => mapTests.testTimeSync(),
        testRapidPan: () => mapTests.testRapidPan(),
        testZoomOffset: () => mapTests.testInitialZoomOffset()
    };
}
