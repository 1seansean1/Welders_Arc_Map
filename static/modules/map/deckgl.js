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

    // Update ground tracks when tail/head duration changes
    eventBus.on('time:track:changed', ({ tailMinutes, headMinutes }) => {
        logger.info('Track duration changed, updating visualization', logger.CATEGORY.SYNC, {
            tail: `${tailMinutes} min`,
            head: `${headMinutes} min`
        });
        updateDeckOverlay();
    });

    // Update glow effect when settings change
    eventBus.on('time:glow:changed', ({ glowEnabled, glowIntensity }) => {
        logger.info('Glow settings changed, updating visualization', logger.CATEGORY.SYNC, {
            enabled: glowEnabled,
            intensity: glowIntensity
        });
        updateDeckOverlay();
    });

    logger.diagnostic('Time state sync configured', logger.CATEGORY.SYNC);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Cached chevron atlas canvas
let chevronAtlasCanvas = null;

/**
 * Create a canvas with a chevron/arrow icon for IconLayer
 * The chevron points up (north) by default, rotation is applied via getAngle
 * @returns {HTMLCanvasElement} Canvas with chevron icon
 */
function createChevronAtlas() {
    // Return cached canvas if available
    if (chevronAtlasCanvas) {
        return chevronAtlasCanvas;
    }

    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Clear background (transparent)
    ctx.clearRect(0, 0, size, size);

    // Draw chevron pointing UP (north)
    // Narrow delta/chevron shape
    ctx.beginPath();

    // Chevron vertices (pointing up)
    const centerX = size / 2;
    const tipY = 8;           // Top point
    const baseY = size - 12;   // Bottom points
    const wingWidth = 14;      // Half width of the wings
    const notchDepth = 16;     // How deep the notch goes

    // Draw the chevron shape
    ctx.moveTo(centerX, tipY);                    // Top tip
    ctx.lineTo(centerX + wingWidth, baseY);       // Right wing bottom
    ctx.lineTo(centerX, baseY - notchDepth);      // Center notch
    ctx.lineTo(centerX - wingWidth, baseY);       // Left wing bottom
    ctx.closePath();

    // Fill with white (mask mode will tint it)
    ctx.fillStyle = 'white';
    ctx.fill();

    // Add thin outline for visibility
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Cache and return
    chevronAtlasCanvas = canvas;
    return canvas;
}

/**
 * Detect equator crossings in a set of track points with time-based fade
 * @param {Array} tailPoints - Tail track points (with timestamp property)
 * @param {Array} headPoints - Head track points (with timestamp property)
 * @param {Object} currentPosition - Current satellite position (with timestamp)
 * @param {Date} currentTime - Current simulation time
 * @param {number} fadeMinutes - Minutes for fade effect (crossing fades over this range)
 * @returns {Array} Array of equator crossing data with smooth fade intensity
 */
function detectEquatorCrossings(tailPoints, headPoints, currentPosition, currentTime, fadeMinutes = 5) {
    const crossings = [];
    const currentTimeMs = currentTime ? currentTime.getTime() : Date.now();
    const fadeMs = fadeMinutes * 60 * 1000;

    // Build array with all points including timestamps
    const allPoints = [
        ...tailPoints.map((p, i) => ({
            ...p,
            isHistory: true,
            index: i,
            time: p.timestamp ? new Date(p.timestamp).getTime() : null
        })),
        ...(currentPosition ? [{
            position: [currentPosition.lon, currentPosition.lat],
            progress: 1,
            isHistory: false,
            isCurrent: true,
            time: currentTimeMs
        }] : []),
        ...headPoints.map((p, i) => ({
            ...p,
            isHistory: false,
            index: i,
            time: p.timestamp ? new Date(p.timestamp).getTime() : null
        }))
    ];

    // Detect equator crossings between consecutive points
    for (let i = 0; i < allPoints.length - 1; i++) {
        const current = allPoints[i];
        const next = allPoints[i + 1];

        // Get latitudes
        const lat1 = current.position[1];
        const lat2 = next.position[1];

        // Check if equator crossed (sign change in latitude)
        if ((lat1 >= 0 && lat2 < 0) || (lat1 < 0 && lat2 >= 0)) {
            // Interpolate exact crossing point
            const t = Math.abs(lat1) / (Math.abs(lat1) + Math.abs(lat2));
            const crossingLon = current.position[0] + t * (next.position[0] - current.position[0]);

            // Interpolate crossing time
            let crossingTime = currentTimeMs;
            if (current.time && next.time) {
                crossingTime = current.time + t * (next.time - current.time);
            }

            // Calculate time-based intensity using smooth fade
            // Distance from current time in ms
            const timeDelta = Math.abs(crossingTime - currentTimeMs);

            // Smooth fade: full intensity at current time, fading to 0 at fadeMs
            // Using cosine curve for smooth fade (1 at center, 0 at edges)
            let intensity = 1.0;
            if (timeDelta < fadeMs) {
                // Smooth cosine fade: cos(0) = 1 (at crossing), cos(PI/2) = 0 (at edge)
                const fadeProgress = timeDelta / fadeMs;
                intensity = Math.cos(fadeProgress * Math.PI / 2);
            } else {
                // Beyond fade range - hide completely
                intensity = 0;
            }

            // Direction: northbound or southbound
            const direction = lat2 > lat1 ? 'north' : 'south';

            // Only add crossing if it has visible intensity
            if (intensity > 0) {
                crossings.push({
                    position: [crossingLon, 0],
                    intensity: Math.max(0, Math.min(1, intensity)),
                direction,
                isHistory: crossingTime < currentTimeMs,
                isFuture: crossingTime > currentTimeMs,
                timeDelta: timeDelta / 60000 // Minutes from now (for debugging)
                });
            }
        }
    }

    return crossings;
}

/**
 * Calculate bearing (heading direction) from tail points to current position
 * @param {Array} tailPoints - Array of tail point objects with position
 * @param {Object} currentPosition - Current position {lon, lat}
 * @returns {number} Bearing in degrees (0-360, 0 = North)
 */
function calculateBearing(tailPoints, currentPosition) {
    // Need at least one tail point to calculate bearing
    if (!tailPoints || tailPoints.length === 0 || !currentPosition) {
        return 0; // Default to North if we can't calculate
    }

    // Get the most recent tail point (last one before current)
    const prevPoint = tailPoints[tailPoints.length - 1];
    if (!prevPoint || !prevPoint.position) {
        return 0;
    }

    const [lon1, lat1] = prevPoint.position;
    const lon2 = currentPosition.lon;
    const lat2 = currentPosition.lat;

    // Convert to radians
    const toRad = Math.PI / 180;
    const lat1Rad = lat1 * toRad;
    const lat2Rad = lat2 * toRad;
    const dLon = (lon2 - lon1) * toRad;

    // Calculate bearing
    const x = Math.sin(dLon) * Math.cos(lat2Rad);
    const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    let bearing = Math.atan2(x, y) * (180 / Math.PI);

    // Normalize to 0-360
    bearing = (bearing + 360) % 360;

    return bearing;
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
    const tailMinutes = timeState.getTailMinutes();
    const headMinutes = timeState.getHeadMinutes();
    const glowEnabled = timeState.isGlowEnabled();
    const glowIntensity = timeState.getGlowIntensity();
    const glowFadeMinutes = timeState.getGlowFadeMinutes();

    // Prepare ground track data and satellite position data
    const groundTrackData = [];
    const satellitePositionData = [];
    const equatorCrossingData = [];
    const GREY = [128, 128, 128];

    satellitesToRender.forEach((sat) => {
        const trackResult = calculateGroundTrack(sat.tleLine1, sat.tleLine2, currentTime, tailMinutes, headMinutes);

        // Create gradient segments from tail points
        // Each segment is a short path with its own opacity based on progress
        if (trackResult.tailPoints && trackResult.tailPoints.length >= 2) {
            for (let i = 0; i < trackResult.tailPoints.length - 1; i++) {
                const startPoint = trackResult.tailPoints[i];
                const endPoint = trackResult.tailPoints[i + 1];

                // Check for anti-meridian crossing (skip segment if crossing detected)
                const lonDiff = Math.abs(endPoint.position[0] - startPoint.position[0]);
                if (lonDiff > 300) continue;

                // Calculate opacity based on progress (older = more transparent)
                // progress goes from 0 (oldest) to 1 (newest)
                const avgProgress = (startPoint.progress + endPoint.progress) / 2;
                const alpha = Math.floor(avgProgress * 200 + 55); // Range: 55-255

                groundTrackData.push({
                    path: [startPoint.position, endPoint.position],
                    name: sat.name,
                    color: [...GREY, alpha],
                    satellite: sat,
                    segmentIndex: i,
                    isTail: true
                });
            }
        }

        // Add head segments (full opacity, or could also gradient)
        if (trackResult.headPoints && trackResult.headPoints.length >= 2) {
            for (let i = 0; i < trackResult.headPoints.length - 1; i++) {
                const startPoint = trackResult.headPoints[i];
                const endPoint = trackResult.headPoints[i + 1];

                // Check for anti-meridian crossing
                const lonDiff = Math.abs(endPoint.position[0] - startPoint.position[0]);
                if (lonDiff > 300) continue;

                // Head uses lighter color and decreasing opacity into future
                const avgProgress = (startPoint.progress + endPoint.progress) / 2;
                const alpha = Math.floor((1 - avgProgress) * 150 + 80); // Fade into future

                groundTrackData.push({
                    path: [startPoint.position, endPoint.position],
                    name: sat.name,
                    color: [180, 200, 255, alpha], // Lighter blue for head
                    satellite: sat,
                    segmentIndex: i,
                    isHead: true
                });
            }
        }

        // Add current position for satellite icon
        if (trackResult.currentPosition) {
            satellitePositionData.push({
                position: [trackResult.currentPosition.lon, trackResult.currentPosition.lat],
                name: sat.name,
                satellite: sat,
                // Calculate bearing for chevron direction (from previous point)
                bearing: calculateBearing(trackResult.tailPoints, trackResult.currentPosition)
            });
        }

        // Detect equator crossings for glow effect
        const crossings = detectEquatorCrossings(
            trackResult.tailPoints || [],
            trackResult.headPoints || [],
            trackResult.currentPosition,
            currentTime,
            glowFadeMinutes
        );

        crossings.forEach(crossing => {
            equatorCrossingData.push({
                position: crossing.position,
                intensity: crossing.intensity,
                direction: crossing.direction,
                satellite: sat,
                name: sat.name,
                isHistory: crossing.isHistory,
                isFuture: crossing.isFuture
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

        // Ground track layer (with gradient fade)
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
            getColor: d => d.color, // Use per-segment RGBA color with alpha gradient
            getWidth: 2,
            transitions: {
                getPath: 0,
                getColor: 0,
                getWidth: 0
            },
            updateTriggers: {
                visible: satellitesToRender.length,
                getPath: `${satellitesToRender.map(s => `${s.id}-${s.tleLine1}`).join(',')}-${tailMinutes}-${headMinutes}-${currentTime.getTime()}`,
                getColor: `${tailMinutes}-${headMinutes}-${currentTime.getTime()}`
            },
            onHover: ({object}) => {
                if (object) {
                    logger.diagnostic('Satellite ground track hover', logger.CATEGORY.SATELLITE, {
                        name: object.name,
                        noradId: object.satellite.noradId
                    });
                }
            }
        }),

        // Satellite position icon layer (chevron pointing in direction of travel)
        new deck.IconLayer({
            id: 'satellite-positions',
            data: satellitePositionData,
            visible: satellitesToRender.length > 0,
            coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,
            wrapLongitude: true,
            pickable: true,
            billboard: false, // Keep icon flat on map, not facing camera
            sizeScale: 1,
            sizeMinPixels: 12,
            sizeMaxPixels: 24,
            getPosition: d => d.position,
            getIcon: () => 'chevron',
            getSize: 20,
            getAngle: d => -d.bearing, // Negative = clockwise rotation (bearing 0° = north, 90° = east)
            getColor: [157, 212, 255, 255],
            iconAtlas: createChevronAtlas(),
            iconMapping: {
                chevron: {
                    x: 0,
                    y: 0,
                    width: 64,
                    height: 64,
                    anchorY: 32, // Center vertically
                    mask: true // Allows color tinting
                }
            },
            updateTriggers: {
                visible: satellitesToRender.length,
                getPosition: `${satellitesToRender.map(s => s.id).join(',')}-${currentTime.getTime()}`,
                getAngle: `${satellitesToRender.map(s => s.id).join(',')}-${currentTime.getTime()}`
            },
            onHover: ({object}) => {
                if (object) {
                    logger.diagnostic('Satellite position hover', logger.CATEGORY.SATELLITE, {
                        name: object.name,
                        noradId: object.satellite.noradId,
                        bearing: object.bearing?.toFixed(1)
                    });
                }
            }
        }),

        // Equator crossing glow layer
        new deck.ScatterplotLayer({
            id: 'equator-crossings',
            data: equatorCrossingData,
            visible: glowEnabled && equatorCrossingData.length > 0,
            coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,
            wrapLongitude: true,
            pickable: true,
            opacity: 1,
            stroked: false,
            filled: true,
            radiusScale: glowIntensity, // Apply intensity as size multiplier
            radiusMinPixels: 4 * glowIntensity,
            radiusMaxPixels: 20 * glowIntensity,
            getPosition: d => d.position,
            getRadius: d => 20000 * d.intensity,
            getFillColor: d => {
                // Blue-white glow color based on intensity
                const alpha = Math.floor(d.intensity * 200 * glowIntensity + 55);
                // Past crossings: grey-blue, Future crossings: white-blue
                if (d.isHistory) {
                    return [150, 180, 220, Math.min(255, alpha)];
                } else if (d.isFuture) {
                    return [200, 220, 255, Math.min(255, alpha)];
                }
                // Current/near: bright white-blue
                return [220, 240, 255, Math.min(255, alpha)];
            },
            updateTriggers: {
                visible: `${glowEnabled}-${equatorCrossingData.length}`,
                getRadius: `${tailMinutes}-${headMinutes}-${currentTime.getTime()}-${glowIntensity}-${glowFadeMinutes}`,
                getFillColor: `${tailMinutes}-${headMinutes}-${currentTime.getTime()}-${glowIntensity}-${glowFadeMinutes}`
            },
            onHover: ({object}) => {
                if (object) {
                    logger.diagnostic('Equator crossing hover', logger.CATEGORY.SATELLITE, {
                        name: object.name,
                        direction: object.direction,
                        intensity: object.intensity?.toFixed(2)
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
