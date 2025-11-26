/**
 * Deck.gl Module - WebGL overlay for satellite and sensor visualization
 *
 * USES: deck.gl-leaflet integration for automatic Leaflet synchronization
 * This eliminates manual sync, canvas positioning, and race conditions.
 *
 * DEPENDENCIES:
 * - logger: Diagnostic logging
 * - sensorState: Sensor data for rendering
 * - satelliteState: Satellite data for rendering
 * - calculateFOVCircle: FOV geometry calculations
 * - calculateGroundTrack: Satellite propagation
 * - deck (global): Deck.gl library
 * - DeckGlLeaflet (global): deck.gl-leaflet integration (note lowercase 'l' in 'Gl')
 *
 * ARCHITECTURE:
 * - LeafletLayer handles all synchronization automatically
 * - Single integration point via map.addLayer()
 * - No manual canvas positioning or resize handling needed
 */

import logger from '../utils/logger.js';
import eventBus from '../events/eventBus.js';
import sensorState from '../state/sensorState.js';
import satelliteState from '../state/satelliteState.js';
import timeState from '../state/timeState.js';
import { calculateFOVCircle } from '../utils/geometry.js';
import { calculateGroundTrack } from '../data/propagation.js';

// Store reference to the LeafletLayer instance
let deckLayer = null;

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize Deck.gl as a Leaflet layer
 * Uses deck.gl-leaflet for automatic synchronization
 *
 * @param {L.Map} map - Leaflet map instance
 * @returns {Object|null} LeafletLayer instance or null on failure
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

    // Check if deck.gl-leaflet is loaded
    // Note: Global name is DeckGlLeaflet (lowercase 'l' in 'Gl')
    if (typeof DeckGlLeaflet === 'undefined' || !DeckGlLeaflet.LeafletLayer) {
        logger.error(
            'deck.gl-leaflet library not loaded',
            logger.CATEGORY.SATELLITE,
            { expected: 'window.DeckGlLeaflet.LeafletLayer', found: typeof DeckGlLeaflet }
        );
        return null;
    }

    logger.info('Initializing Deck.gl with LeafletLayer integration', logger.CATEGORY.SATELLITE);

    try {
        // Create initial layers
        const initialLayers = createLayers();

        // Create LeafletLayer - this handles ALL synchronization automatically:
        // - Canvas positioning
        // - View state sync on pan/zoom
        // - Coordinate system conversion
        // - Resize handling
        // - World wrapping
        deckLayer = new DeckGlLeaflet.LeafletLayer({
            // Use MapView with world wrapping
            views: [new deck.MapView({ repeat: true })],

            // Initial layers
            layers: initialLayers,

            // Performance settings
            _typedArrayManagerProps: {
                overAlloc: 1,
                poolSize: 0
            }
        });

        // Add as a Leaflet layer - integration handles the rest
        map.addLayer(deckLayer);

        // Setup time state sync for ground track updates
        setupTimeStateSync();

        // Store reference globally for debugging
        window.deckgl = deckLayer;
        window.deckLayer = deckLayer;

        logger.success(
            'Deck.gl LeafletLayer initialized',
            logger.CATEGORY.SATELLITE,
            {
                satellites: satelliteState.getSatelliteCount(),
                integration: 'deck.gl-leaflet@1.3.1'
            }
        );

        logger.diagnostic('Deck.gl configuration', logger.CATEGORY.SATELLITE, {
            integration: 'LeafletLayer (automatic sync)',
            view: 'MapView(repeat=true)',
            manualSync: 'NOT NEEDED'
        });

        return deckLayer;

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
 * Setup time state synchronization
 * Updates ground tracks when simulation time changes.
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
// LAYER CREATION
// ============================================

/**
 * Create all visualization layers
 * @returns {Array} Array of Deck.gl layers
 */
function createLayers() {
    const perfStart = performance.now();

    // Filter to only SELECTED sensors
    const sensorsToRender = sensorState.getSelectedSensors();

    // Prepare sensor icon data (donut circles)
    const sensorIconData = sensorsToRender.map(sensor => ({
        position: [sensor.lon, sensor.lat],
        radius: 8000,
        color: [157, 212, 255],
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

    // Calculate ground tracks for selected satellites
    const satellitesToRender = satelliteState.getSelectedSatellites();
    const currentTime = timeState.getCurrentTime();

    // Prepare ground track data
    const groundTrackData = [];
    const GREY = [128, 128, 128];

    satellitesToRender.forEach((sat) => {
        const segments = calculateGroundTrack(sat.tleLine1, sat.tleLine2, currentTime, 90);
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

    // Create layers - always include all with 'visible' prop
    const layers = [
        // FOV polygon layer
        new deck.PolygonLayer({
            id: 'sensor-fov',
            data: fovPolygonData,
            visible: sensorsToRender.length > 0,
            coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,
            wrapLongitude: true,
            pickable: false,
            stroked: true,
            filled: true,
            wireframe: false,
            lineWidthMinPixels: 1,
            getPolygon: d => d.polygon,
            getFillColor: [157, 212, 255, 30],
            getLineColor: [157, 212, 255, 120],
            getLineWidth: 1,
            transitions: {
                getPolygon: 0,
                getFillColor: 0,
                getLineColor: 0
            },
            updateTriggers: {
                visible: sensorsToRender.length,
                getPolygon: sensorsToRender.map(s => `${s.id}-${s.lat}-${s.lon}-${s.fovAltitude}`).join(',')
            }
        }),

        // Sensor icon layer
        new deck.ScatterplotLayer({
            id: 'sensor-icons',
            data: sensorIconData,
            visible: sensorsToRender.length > 0,
            coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,
            wrapLongitude: true,
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
            getFillColor: d => {
                if (d.sensor.iconType === 'filled') return d.color;
                if (d.sensor.iconType === 'donut') return [157, 212, 255, 0];
                return [0, 0, 0, 0];
            },
            getLineColor: d => d.color,
            getLineWidth: d => d.sensor.iconType === 'outline' ? 1 : 2,
            transitions: {
                getPosition: 0,
                getRadius: 0,
                getFillColor: 0,
                getLineColor: 0
            },
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
        }),

        // Ground track layer
        new deck.PathLayer({
            id: 'satellite-ground-tracks',
            data: groundTrackData,
            visible: satellitesToRender.length > 0,
            coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,
            wrapLongitude: true,
            pickable: true,
            widthScale: 1,
            widthMinPixels: 2,
            widthMaxPixels: 3,
            getPath: d => d.path,
            getColor: d => [...d.color, 180],
            getWidth: 2,
            transitions: {
                getPath: 0,
                getColor: 0,
                getWidth: 0
            },
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
        })
    ];

    const perfEnd = performance.now();
    logger.diagnostic('Layer creation', logger.CATEGORY.SYNC, {
        time: `${(perfEnd - perfStart).toFixed(2)}ms`,
        sensors: sensorsToRender.length,
        satellites: satellitesToRender.length
    });

    return layers;
}

// ============================================
// LAYER UPDATES
// ============================================

/**
 * Update Deck.gl overlay with current sensor and satellite data
 */
export function updateDeckOverlay() {
    if (!deckLayer) {
        logger.warning('Deck.gl not initialized', logger.CATEGORY.SATELLITE);
        return;
    }

    const perfStart = performance.now();

    // Create new layers with current data
    const layers = createLayers();

    // Update the LeafletLayer - it handles sync automatically
    deckLayer.setProps({ layers });

    const perfEnd = performance.now();

    const sensorsToRender = sensorState.getSelectedSensors();
    const satellitesToRender = satelliteState.getSelectedSatellites();

    logger.diagnostic('updateDeckOverlay', logger.CATEGORY.SYNC, {
        time: `${(perfEnd - perfStart).toFixed(2)}ms`,
        sensors: sensorsToRender.length,
        satellites: satellitesToRender.length
    });

    logger.info(`Map updated: ${sensorsToRender.length} sensor(s), ${satellitesToRender.length} satellite ground track(s)`);
}

/**
 * Get the Deck.gl LeafletLayer instance
 * @returns {Object|null} LeafletLayer instance or null if not initialized
 */
export function getDeckGL() {
    return deckLayer;
}

/**
 * Resize Deck.gl canvas to match container
 * NOTE: With LeafletLayer, this is handled automatically
 * This function is kept for backward compatibility but does nothing
 */
export function resizeDeckCanvas() {
    // LeafletLayer handles resize automatically via Leaflet's resize events
    // This is a no-op for backward compatibility
    logger.diagnostic('resizeDeckCanvas called (no-op with LeafletLayer)', logger.CATEGORY.SYNC);
}

// ============================================
// DEBUGGING EXPORTS
// ============================================

/**
 * Get setProps call history (stub for compatibility)
 * @returns {Array} Empty array - batched updates no longer used
 */
export function getSetPropsHistory() {
    return [];
}

/**
 * Reset setProps tracking (stub for compatibility)
 */
export function resetSetPropsTracking() {
    // No-op - batched updates no longer used
}

// Make debugging functions available in browser console
if (typeof window !== 'undefined') {
    window.deckglDebug = {
        getSetPropsHistory,
        resetSetPropsTracking,
        getLayerInfo: () => {
            if (!deckLayer) return null;
            const layers = deckLayer.props?.layers || [];
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
        getIntegrationInfo: () => ({
            type: 'LeafletLayer',
            version: 'deck.gl-leaflet@1.3.1',
            manualSync: false,
            batchedUpdates: false
        })
    };
}
