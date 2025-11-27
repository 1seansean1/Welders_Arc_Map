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
 * Detect the NEAREST equator crossing relative to chevron (current position)
 * Only returns crossings within fade range of the chevron's current time
 *
 * @param {Array} tailPoints - Tail track points (with timestamp property)
 * @param {Array} headPoints - Head track points (with timestamp property)
 * @param {Object} currentPosition - Current satellite position (chevron)
 * @param {Date} currentTime - Current simulation time
 * @param {number} fadeInMinutes - Minutes before crossing to start fade in
 * @param {number} fadeOutMinutes - Minutes after crossing to fade out
 * @returns {Object} Single crossing data with intensity based on chevron proximity
 */
function detectEquatorCrossings(tailPoints, headPoints, currentPosition, currentTime, fadeInMinutes = 5, fadeOutMinutes = 5) {
    const crossings = [];
    const currentTimeMs = currentTime ? currentTime.getTime() : Date.now();
    const fadeInMs = fadeInMinutes * 60 * 1000;
    const fadeOutMs = fadeOutMinutes * 60 * 1000;
    const maxRangeMs = Math.max(fadeInMs, fadeOutMs);

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

    // Find ALL equator crossings first
    const allCrossings = [];
    for (let i = 0; i < allPoints.length - 1; i++) {
        const current = allPoints[i];
        const next = allPoints[i + 1];

        const lat1 = current.position[1];
        const lat2 = next.position[1];

        if ((lat1 >= 0 && lat2 < 0) || (lat1 < 0 && lat2 >= 0)) {
            const t = Math.abs(lat1) / (Math.abs(lat1) + Math.abs(lat2));
            const crossingLon = current.position[0] + t * (next.position[0] - current.position[0]);

            let crossingTime = currentTimeMs;
            if (current.time && next.time) {
                crossingTime = current.time + t * (next.time - current.time);
            }

            const direction = lat2 > lat1 ? 'north' : 'south';
            const timeDelta = crossingTime - currentTimeMs;

            allCrossings.push({
                position: [crossingLon, 0],
                crossingTime,
                timeDelta,
                direction
            });
        }
    }

    // Find the NEAREST crossing to current time (chevron position)
    // We want at most one past and one future crossing
    let nearestPast = null;
    let nearestFuture = null;

    for (const crossing of allCrossings) {
        if (crossing.timeDelta <= 0) {
            // Past crossing
            if (!nearestPast || crossing.timeDelta > nearestPast.timeDelta) {
                nearestPast = crossing;
            }
        } else {
            // Future crossing
            if (!nearestFuture || crossing.timeDelta < nearestFuture.timeDelta) {
                nearestFuture = crossing;
            }
        }
    }

    // Process nearest past crossing (fading out)
    if (nearestPast && Math.abs(nearestPast.timeDelta) <= fadeOutMs) {
        const absTimeDelta = Math.abs(nearestPast.timeDelta);
        const fadeProgress = absTimeDelta / fadeOutMs;
        // Smooth cosine fade: 1 at crossing, 0 at edge
        const intensity = Math.cos(fadeProgress * Math.PI / 2);

        if (intensity > 0) {
            crossings.push({
                position: nearestPast.position,
                intensity: Math.max(0, Math.min(1, intensity)),
                direction: nearestPast.direction,
                isHistory: true,
                isFuture: false,
                timeDelta: nearestPast.timeDelta / 60000,
                crossingTimeMs: nearestPast.crossingTime
            });
        }
    }

    // Process nearest future crossing (fading in)
    if (nearestFuture && nearestFuture.timeDelta <= fadeInMs) {
        const fadeProgress = nearestFuture.timeDelta / fadeInMs;
        // Smooth cosine fade: 0 at edge, 1 at crossing
        const intensity = Math.cos(fadeProgress * Math.PI / 2);

        if (intensity > 0) {
            crossings.push({
                position: nearestFuture.position,
                intensity: Math.max(0, Math.min(1, intensity)),
                direction: nearestFuture.direction,
                isHistory: false,
                isFuture: true,
                timeDelta: nearestFuture.timeDelta / 60000,
                crossingTimeMs: nearestFuture.crossingTime
            });
        }
    }

    return crossings;
}

/**
 * Detect latitude apex points (maxima and minima) in the ground track
 * Returns apex data with position and time for glow tick marks
 */
function detectLatitudeApexes(tailPoints, headPoints, currentPosition, currentTime, fadeInMinutes = 5, fadeOutMinutes = 5) {
    const apexes = [];
    const currentTimeMs = currentTime ? currentTime.getTime() : Date.now();
    const fadeInMs = fadeInMinutes * 60 * 1000;
    const fadeOutMs = fadeOutMinutes * 60 * 1000;
    const TICK_WIDTH_DEG = 1.5; // Horizontal tick width in degrees longitude

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

    // Find ALL latitude apexes (local maxima and minima)
    const allApexes = [];
    for (let i = 1; i < allPoints.length - 1; i++) {
        const prev = allPoints[i - 1];
        const curr = allPoints[i];
        const next = allPoints[i + 1];

        const lat_prev = prev.position[1];
        const lat_curr = curr.position[1];
        const lat_next = next.position[1];

        // Check for local maximum (latitude increasing then decreasing)
        const isMax = lat_curr > lat_prev && lat_curr > lat_next;
        // Check for local minimum (latitude decreasing then increasing)
        const isMin = lat_curr < lat_prev && lat_curr < lat_next;

        if (isMax || isMin) {
            const lon = curr.position[0];
            const lat = curr.position[1];
            const apexTime = curr.time || currentTimeMs;
            const timeDelta = apexTime - currentTimeMs;

            allApexes.push({
                position: [lon, lat],
                apexTime,
                timeDelta,
                type: isMax ? 'max' : 'min',
                // Horizontal tick path at the apex latitude
                path: [[lon - TICK_WIDTH_DEG / 2, lat], [lon + TICK_WIDTH_DEG / 2, lat]]
            });
        }
    }

    // Find nearest past and future apexes
    let nearestPast = null;
    let nearestFuture = null;

    for (const apex of allApexes) {
        if (apex.timeDelta <= 0) {
            if (!nearestPast || apex.timeDelta > nearestPast.timeDelta) {
                nearestPast = apex;
            }
        } else {
            if (!nearestFuture || apex.timeDelta < nearestFuture.timeDelta) {
                nearestFuture = apex;
            }
        }
    }

    // Process nearest past apex (fading out)
    if (nearestPast && Math.abs(nearestPast.timeDelta) <= fadeOutMs) {
        apexes.push({
            path: nearestPast.path,
            position: nearestPast.position,
            type: nearestPast.type,
            time: new Date(nearestPast.apexTime),
            timeDelta: nearestPast.timeDelta / 60000,
            isHistory: true
        });
    }

    // Process nearest future apex (fading in)
    if (nearestFuture && nearestFuture.timeDelta <= fadeInMs) {
        apexes.push({
            path: nearestFuture.path,
            position: nearestFuture.position,
            type: nearestFuture.type,
            time: new Date(nearestFuture.apexTime),
            timeDelta: nearestFuture.timeDelta / 60000,
            isFuture: true
        });
    }

    return apexes;
}

/**
 * Calculate glow proximity factor for a track segment
 * Returns a value 0-1 indicating how close the segment is to an equator crossing
 * Used to enhance ground track gradient near crossings
 */
function calculateGlowProximity(segmentLat, crossings, glowIntensity) {
    if (!crossings || crossings.length === 0 || glowIntensity === 0) {
        return 0;
    }

    // Check if segment latitude is near equator (within ±5 degrees)
    const latDistance = Math.abs(segmentLat);
    if (latDistance > 5) {
        return 0;
    }

    // Get the maximum crossing intensity
    const maxCrossingIntensity = Math.max(...crossings.map(c => c.intensity));

    // Proximity is stronger closer to equator, scaled by crossing intensity
    const latProximity = 1 - (latDistance / 5);
    return latProximity * maxCrossingIntensity * glowIntensity;
}

/**
 * Calculate bearing (heading direction) from tail points to current position
 * @param {Array} tailPoints - Array of tail point objects with position
 * @param {Object} currentPosition - Current position {lon, lat}
 * @returns {number} Bearing in degrees (0-360, 0 = North)
 */
function calculateBearing(tailPoints, currentPosition) {
    // Need at least 2 tail points to calculate bearing
    // (last point is at currentTime, so we need second-to-last for direction)
    if (!tailPoints || tailPoints.length < 2 || !currentPosition) {
        return 0; // Default to North if we can't calculate
    }

    // Get the second-to-last tail point (the last one is at currentTime, same as currentPosition)
    // Use a point a few steps back for more stable direction
    const pointIndex = Math.max(0, tailPoints.length - 3); // 3 steps back (~60 seconds at 20s intervals)
    const prevPoint = tailPoints[pointIndex];
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
/**
 * Handle anti-meridian crossing by splitting segment into two wrapped segments
 * Instead of skipping segments that cross the date line, we split them
 * so one segment goes to the edge and another continues from the opposite edge.
 *
 * @param {Array} startPos - [lon, lat] of start point
 * @param {Array} endPos - [lon, lat] of end point
 * @returns {Array} Array of path segments (1 if no crossing, 2 if crossing)
 */
function wrapAntiMeridianSegment(startPos, endPos) {
    const [lon1, lat1] = startPos;
    const [lon2, lat2] = endPos;

    const lonDiff = lon2 - lon1;

    // No crossing if longitude difference is reasonable
    if (Math.abs(lonDiff) <= 180) {
        return [[startPos, endPos]];
    }

    // Determine crossing direction
    let crossingLon, wrapLon;
    if (lonDiff < -180) {
        // Eastward: crossing +180/-180 boundary (e.g., 170 -> -170)
        crossingLon = 180;
        wrapLon = -180;
    } else {
        // Westward: crossing -180/+180 boundary (e.g., -170 -> 170)
        crossingLon = -180;
        wrapLon = 180;
    }

    // Calculate the actual angular distance traveled (shorter path around globe)
    const actualDistance = 360 - Math.abs(lonDiff);

    // Distance to crossing from start
    const distToCrossing = Math.abs(crossingLon - lon1);

    // Fraction of total path to reach crossing
    const fraction = distToCrossing / actualDistance;

    // Interpolate latitude at crossing point
    const crossingLat = lat1 + (lat2 - lat1) * fraction;

    // Return two segments that wrap around the date line
    return [
        [[lon1, lat1], [crossingLon, crossingLat]],
        [[wrapLon, crossingLat], [lon2, lat2]]
    ];
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
    const glowFadeInMinutes = timeState.getGlowFadeInMinutes();
    const glowFadeOutMinutes = timeState.getGlowFadeOutMinutes();

    // Prepare ground track data and satellite position data
    const groundTrackData = [];
    const satellitePositionData = [];
    const equatorCrossingData = [];
    const apexTickData = [];
    const GREY = [128, 128, 128];

    satellitesToRender.forEach((sat) => {
        const trackResult = calculateGroundTrack(sat.tleLine1, sat.tleLine2, currentTime, tailMinutes, headMinutes);

        // Detect equator crossings FIRST (based on chevron proximity)
        const crossings = detectEquatorCrossings(
            trackResult.tailPoints || [],
            trackResult.headPoints || [],
            trackResult.currentPosition,
            currentTime,
            glowFadeInMinutes,
            glowFadeOutMinutes
        );

        // Store crossings for glow layers
        crossings.forEach(crossing => {
            equatorCrossingData.push({
                position: crossing.position,
                intensity: crossing.intensity,
                direction: crossing.direction,
                satellite: sat,
                name: sat.name,
                isHistory: crossing.isHistory,
                isFuture: crossing.isFuture,
                timeDelta: crossing.timeDelta
            });
        });

        // Detect latitude apexes for tick marks
        const apexes = detectLatitudeApexes(
            trackResult.tailPoints || [],
            trackResult.headPoints || [],
            trackResult.currentPosition,
            currentTime,
            glowFadeInMinutes,
            glowFadeOutMinutes
        );

        // Store apexes for tick mark layer
        apexes.forEach(apex => {
            apexTickData.push({
                path: apex.path,
                position: apex.position,
                type: apex.type,
                time: apex.time,
                timeDelta: apex.timeDelta,
                satellite: sat,
                name: sat.name,
                isHistory: apex.isHistory,
                isFuture: apex.isFuture
            });
        });

        // Create gradient segments from tail points with glow-enhanced coloring
        if (trackResult.tailPoints && trackResult.tailPoints.length >= 2) {
            for (let i = 0; i < trackResult.tailPoints.length - 1; i++) {
                const startPoint = trackResult.tailPoints[i];
                const endPoint = trackResult.tailPoints[i + 1];

                // Handle anti-meridian crossing by wrapping segments
                const wrappedSegments = wrapAntiMeridianSegment(startPoint.position, endPoint.position);

                // Calculate opacity based on progress (older = more transparent)
                const avgProgress = (startPoint.progress + endPoint.progress) / 2;
                const avgLat = (startPoint.position[1] + endPoint.position[1]) / 2;
                const alpha = Math.floor(avgProgress * 200 + 55); // Range: 55-255

                // Calculate glow proximity for this segment
                const glowProximity = glowEnabled ?
                    calculateGlowProximity(avgLat, crossings, glowIntensity) : 0;

                // Enhanced coloring: blend towards bright blue/white near equator during glow
                let r = GREY[0];
                let g = GREY[1];
                let b = GREY[2];
                let segmentAlpha = alpha;

                if (glowProximity > 0) {
                    // Blend towards bright cyan-blue based on glow proximity
                    const blendFactor = glowProximity * 0.8;
                    r = Math.floor(r + (180 - r) * blendFactor);
                    g = Math.floor(g + (220 - g) * blendFactor);
                    b = Math.floor(b + (255 - b) * blendFactor);
                    // Also boost alpha for visibility
                    segmentAlpha = Math.min(255, alpha + Math.floor(glowProximity * 80));
                }

                // Add each wrapped segment (1 for normal, 2 for date line crossing)
                wrappedSegments.forEach((segPath, segIdx) => {
                    groundTrackData.push({
                        path: segPath,
                        name: sat.name,
                        color: [r, g, b, segmentAlpha],
                        satellite: sat,
                        segmentIndex: i * 10 + segIdx,
                        isTail: true,
                        glowProximity
                    });
                });
            }
        }

        // Add head segments with glow-enhanced coloring
        if (trackResult.headPoints && trackResult.headPoints.length >= 2) {
            for (let i = 0; i < trackResult.headPoints.length - 1; i++) {
                const startPoint = trackResult.headPoints[i];
                const endPoint = trackResult.headPoints[i + 1];

                // Handle anti-meridian crossing by wrapping segments
                const wrappedSegments = wrapAntiMeridianSegment(startPoint.position, endPoint.position);

                // Head uses lighter color and decreasing opacity into future
                const avgProgress = (startPoint.progress + endPoint.progress) / 2;
                const avgLat = (startPoint.position[1] + endPoint.position[1]) / 2;
                const alpha = Math.floor((1 - avgProgress) * 150 + 80);

                // Calculate glow proximity for this segment
                const glowProximity = glowEnabled ?
                    calculateGlowProximity(avgLat, crossings, glowIntensity) : 0;

                // Enhanced coloring for head segments near equator
                let r = 180;
                let g = 200;
                let b = 255;
                let segmentAlpha = alpha;

                if (glowProximity > 0) {
                    // Blend towards brighter white-blue
                    const blendFactor = glowProximity * 0.6;
                    r = Math.floor(r + (220 - r) * blendFactor);
                    g = Math.floor(g + (240 - g) * blendFactor);
                    b = 255;
                    segmentAlpha = Math.min(255, alpha + Math.floor(glowProximity * 60));
                }

                // Add each wrapped segment (1 for normal, 2 for date line crossing)
                wrappedSegments.forEach((segPath, segIdx) => {
                    groundTrackData.push({
                        path: segPath,
                        name: sat.name,
                        color: [r, g, b, segmentAlpha],
                        satellite: sat,
                        segmentIndex: i * 10 + segIdx,
                        isHead: true,
                        glowProximity
                    });
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
    });

    // Create layers - always include all with 'visible' prop
    const layers = [
        // Equator reference line - split into segments for proper rendering
        new deck.PathLayer({
            id: 'equator-line',
            data: [
                { path: [[-180, 0], [-90, 0]] },
                { path: [[-90, 0], [0, 0]] },
                { path: [[0, 0], [90, 0]] },
                { path: [[90, 0], [180, 0]] }
            ],
            visible: true,
            coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,
            wrapLongitude: true,
            pickable: false,
            widthMinPixels: 2,
            widthMaxPixels: 2,
            getPath: d => d.path,
            getColor: [100, 120, 140, 150],  // Subtle blue-gray
            getWidth: 2
        }),

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

        // Enhanced Equator Glow Effect - 5 organic layers with subtle pulse
        // Layer 1: OUTERMOST diffuse halo (very large, very faint)
        new deck.ScatterplotLayer({
            id: 'equator-glow-halo',
            data: equatorCrossingData,
            visible: glowEnabled && equatorCrossingData.length > 0,
            coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,
            wrapLongitude: true,
            pickable: false,
            opacity: 1,
            stroked: false,
            filled: true,
            radiusScale: glowIntensity,
            radiusMinPixels: 25 * glowIntensity,
            radiusMaxPixels: 90 * glowIntensity,
            getPosition: d => d.position,
            getRadius: d => 120000 * d.intensity,
            getFillColor: d => {
                // Ultra-faint outer halo
                const alpha = Math.floor(d.intensity * 25 * glowIntensity);
                return [120, 160, 220, Math.min(50, alpha)];
            },
            updateTriggers: {
                visible: `${glowEnabled}-${equatorCrossingData.length}`,
                getRadius: `${currentTime.getTime()}-${glowIntensity}`,
                getFillColor: `${currentTime.getTime()}-${glowIntensity}`
            }
        }),

        // Layer 2: OUTER diffuse glow
        new deck.ScatterplotLayer({
            id: 'equator-glow-outer',
            data: equatorCrossingData,
            visible: glowEnabled && equatorCrossingData.length > 0,
            coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,
            wrapLongitude: true,
            pickable: false,
            opacity: 1,
            stroked: false,
            filled: true,
            radiusScale: glowIntensity,
            radiusMinPixels: 18 * glowIntensity,
            radiusMaxPixels: 65 * glowIntensity,
            getPosition: d => d.position,
            getRadius: d => 85000 * d.intensity,
            getFillColor: d => {
                const alpha = Math.floor(d.intensity * 45 * glowIntensity);
                if (d.isFuture) {
                    // Approaching: cooler blue tint
                    return [130, 170, 240, Math.min(70, alpha)];
                }
                // Receding: warmer blue-white
                return [150, 185, 235, Math.min(70, alpha)];
            },
            updateTriggers: {
                visible: `${glowEnabled}-${equatorCrossingData.length}`,
                getRadius: `${currentTime.getTime()}-${glowIntensity}`,
                getFillColor: `${currentTime.getTime()}-${glowIntensity}`
            }
        }),

        // Layer 3: MIDDLE glow
        new deck.ScatterplotLayer({
            id: 'equator-glow-middle',
            data: equatorCrossingData,
            visible: glowEnabled && equatorCrossingData.length > 0,
            coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,
            wrapLongitude: true,
            pickable: false,
            opacity: 1,
            stroked: false,
            filled: true,
            radiusScale: glowIntensity,
            radiusMinPixels: 10 * glowIntensity,
            radiusMaxPixels: 40 * glowIntensity,
            getPosition: d => d.position,
            getRadius: d => 50000 * d.intensity,
            getFillColor: d => {
                const alpha = Math.floor(d.intensity * 100 * glowIntensity);
                if (d.isFuture) {
                    return [160, 195, 250, Math.min(130, alpha)];
                }
                return [180, 210, 245, Math.min(130, alpha)];
            },
            updateTriggers: {
                visible: `${glowEnabled}-${equatorCrossingData.length}`,
                getRadius: `${currentTime.getTime()}-${glowIntensity}`,
                getFillColor: `${currentTime.getTime()}-${glowIntensity}`
            }
        }),

        // Layer 4: INNER glow (brighter)
        new deck.ScatterplotLayer({
            id: 'equator-glow-inner',
            data: equatorCrossingData,
            visible: glowEnabled && equatorCrossingData.length > 0,
            coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,
            wrapLongitude: true,
            pickable: false,
            opacity: 1,
            stroked: false,
            filled: true,
            radiusScale: glowIntensity,
            radiusMinPixels: 5 * glowIntensity,
            radiusMaxPixels: 22 * glowIntensity,
            getPosition: d => d.position,
            getRadius: d => 25000 * d.intensity,
            getFillColor: d => {
                const alpha = Math.floor(d.intensity * 180 * glowIntensity);
                if (d.isFuture) {
                    return [200, 225, 255, Math.min(200, alpha)];
                }
                return [210, 230, 250, Math.min(200, alpha)];
            },
            updateTriggers: {
                visible: `${glowEnabled}-${equatorCrossingData.length}`,
                getRadius: `${currentTime.getTime()}-${glowIntensity}`,
                getFillColor: `${currentTime.getTime()}-${glowIntensity}`
            }
        }),

        // Layer 5: CORE bright center
        new deck.ScatterplotLayer({
            id: 'equator-glow-core',
            data: equatorCrossingData,
            visible: glowEnabled && equatorCrossingData.length > 0,
            coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,
            wrapLongitude: true,
            pickable: true,
            opacity: 1,
            stroked: false,
            filled: true,
            radiusScale: glowIntensity,
            radiusMinPixels: 2 * glowIntensity,
            radiusMaxPixels: 10 * glowIntensity,
            getPosition: d => d.position,
            getRadius: d => 10000 * d.intensity,
            getFillColor: d => {
                // Bright white-blue core
                const alpha = Math.floor(d.intensity * 230 * glowIntensity + 25);
                return [240, 248, 255, Math.min(255, alpha)];
            },
            updateTriggers: {
                visible: `${glowEnabled}-${equatorCrossingData.length}`,
                getRadius: `${currentTime.getTime()}-${glowIntensity}`,
                getFillColor: `${currentTime.getTime()}-${glowIntensity}`
            },
            onHover: ({object}) => {
                if (object) {
                    logger.diagnostic('Equator crossing hover', logger.CATEGORY.SATELLITE, {
                        name: object.name,
                        direction: object.direction,
                        intensity: object.intensity?.toFixed(2),
                        timeDelta: object.timeDelta?.toFixed(1) + 'min'
                    });
                }
            }
        }),

        // Latitude Apex Tick Marks - horizontal lines at max/min latitude points
        new deck.PathLayer({
            id: 'apex-tick-marks',
            data: apexTickData,
            visible: glowEnabled && apexTickData.length > 0,
            getPath: d => d.path,
            getColor: d => {
                // Same fade logic as equator glow
                const timeDelta = (currentTime - d.time) / 60000; // minutes
                const fadeStart = glowFadeOutMinutes * 0.3;
                const fadeEnd = glowFadeOutMinutes;

                let alpha = 0;
                if (timeDelta >= 0 && timeDelta < fadeStart) {
                    alpha = 255;
                } else if (timeDelta >= fadeStart && timeDelta < fadeEnd) {
                    const fadeProgress = (timeDelta - fadeStart) / (fadeEnd - fadeStart);
                    alpha = Math.round(255 * (1 - (1 - Math.cos(fadeProgress * Math.PI)) / 2));
                }

                return [255, 215, 0, alpha]; // Gold color matching equator glow
            },
            getWidth: 2,
            widthUnits: 'pixels',
            capRounded: true,
            updateTriggers: {
                visible: `${glowEnabled}-${apexTickData.length}`,
                getColor: `${currentTime.getTime()}-${glowFadeOutMinutes}`
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
