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
import sensorState from '../state/sensorState.js';
import satelliteState from '../state/satelliteState.js';
import { calculateFOVCircle } from '../utils/geometry.js';
import { calculateGroundTrack } from '../data/propagation.js';

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
                zoom: leafletZoom,
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
                deckgl.setProps({
                    width: containerRect.width,
                    height: containerRect.height
                });
                logger.diagnostic('Canvas size auto-corrected', logger.CATEGORY.SYNC, {
                    size: `${containerRect.width.toFixed(0)}×${containerRect.height.toFixed(0)}px`
                });
            }
        }

        // CRITICAL: Set viewState with all transition controls disabled
        deckgl.setProps({
            viewState: {
                longitude: center.lng,
                latitude: center.lat,
                zoom: zoom - 1,  // CRITICAL: Deck.gl MapView needs zoom - 1 for Leaflet compatibility
                pitch: 0,
                bearing: 0,
                transitionDuration: 0,  // No animation
                transitionInterpolator: null  // Force disable all interpolation
            }
        });

        // DIAGNOSTIC: Verify Deck.gl accepted the view state (only check occasionally)
        if (Math.random() < 0.05) { // Check only 5% of the time to reduce overhead
            setTimeout(() => {
                const deckViewState = deckgl.viewState || deckgl.props.viewState;
                if (deckViewState) {
                    // Check for drift (relaxed thresholds due to throttling)
                    const lngDrift = Math.abs(deckViewState.longitude - center.lng);
                    const latDrift = Math.abs(deckViewState.latitude - center.lat);
                    const zoomDrift = Math.abs(deckViewState.zoom - zoom);

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
    if (!window.deckgl) {
        logger.warning('Deck.gl not initialized', logger.CATEGORY.SATELLITE);
        return;
    }

    // Filter to only SELECTED sensors (checkbox = visibility control)
    const sensorsToRender = sensorState.getSelectedSensors();

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
    const sensorLayer = new deck.ScatterplotLayer({
        id: 'sensor-icons',
        data: sensorIconData,
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
    const fovLayer = new deck.PolygonLayer({
        id: 'sensor-fov',
        data: fovPolygonData,
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
            getPolygon: sensorsToRender.map(s => `${s.id}-${s.lat}-${s.lon}-${s.fovAltitude}`).join(',')
        }
    });

    // Calculate ground tracks for selected satellites
    const satellitesToRender = satelliteState.getSelectedSatellites();
    const currentTime = new Date();

    // Prepare ground track data
    const groundTrackData = satellitesToRender.map((sat, index) => {
        // Calculate ground track: 90 minutes forward, 60-second steps
        const track = calculateGroundTrack(sat.tleLine1, sat.tleLine2, currentTime, 90, 60);

        // Assign different colors to each satellite
        const colors = [
            [0, 255, 100],    // Green
            [255, 100, 0],    // Orange
            [100, 100, 255],  // Blue
            [255, 255, 0],    // Yellow
            [255, 0, 255],    // Magenta
            [0, 255, 255],    // Cyan
        ];
        const color = colors[index % colors.length];

        return {
            path: track,
            name: sat.name,
            color: color,
            satellite: sat
        };
    });

    // Create ground track layer (PathLayer for orbital paths)
    const groundTrackLayer = new deck.PathLayer({
        id: 'satellite-ground-tracks',
        data: groundTrackData,
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

    // Update Deck.gl overlay with all layers
    window.deckgl.setProps({
        layers: [fovLayer, sensorLayer, groundTrackLayer]
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
 */
export function resizeDeckCanvas() {
    if (!window.deckgl) return;

    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) return;

    const rect = mapContainer.getBoundingClientRect();
    window.deckgl.setProps({
        width: rect.width,
        height: rect.height
    });

    logger.diagnostic('Deck.gl canvas resized', logger.CATEGORY.SATELLITE, {
        size: `${rect.width.toFixed(0)}×${rect.height.toFixed(0)}px`
    });
}
