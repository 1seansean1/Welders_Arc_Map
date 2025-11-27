/**
 * Event Detector Module - Generalized proximity-based event detection
 *
 * PATTERN: Decouples event detection from display rendering
 *
 * This module detects when satellites approach/pass specific events
 * (equator crossings, latitude thresholds, time markers, orbit intersections)
 * and calculates fade intensity based on CHEVRON position only.
 *
 * KEY PRINCIPLE: Event detection uses its own time window based on fade
 * parameters, completely independent of ground track display settings.
 *
 * DEPENDENCIES:
 * - propagation.js: For satellite position calculation
 * - logger.js: For diagnostic logging
 *
 * USAGE:
 *   import eventDetector from './events/eventDetector.js';
 *
 *   const glowEvents = eventDetector.detectLatitudeCrossing(
 *       satellite, currentTime,
 *       { latitude: 0, fadeInMinutes: 15, fadeOutMinutes: 4 }
 *   );
 *
 *   // Returns array of { position, intensity, direction, timeDelta, ... }
 */

import { propagateSatellite } from '../data/propagation.js';
import logger from '../utils/logger.js';

/**
 * EventDetector class - Generalized event detection with fade animation
 */
class EventDetector {
    constructor() {
        // Default propagation step (seconds) - balance between accuracy and performance
        this.stepSeconds = 20;

        logger.log('EventDetector initialized', logger.CATEGORY.SYSTEM);
    }

    /**
     * Propagate satellite positions for event detection
     * Uses fade parameters to determine search range, NOT display parameters
     *
     * @param {Object} satellite - Satellite with tleLine1, tleLine2
     * @param {Date} currentTime - Current simulation time (chevron position)
     * @param {number} pastMinutes - How far back to search
     * @param {number} futureMinutes - How far forward to search
     * @returns {Array} Array of { position: [lon, lat], time: Date, timeMs: number }
     */
    propagateForDetection(satellite, currentTime, pastMinutes, futureMinutes) {
        const points = [];
        const currentTimeMs = currentTime.getTime();

        // Calculate time bounds
        const startTimeMs = currentTimeMs - (pastMinutes * 60 * 1000);
        const endTimeMs = currentTimeMs + (futureMinutes * 60 * 1000);
        const stepMs = this.stepSeconds * 1000;

        // Propagate through the detection window
        for (let timeMs = startTimeMs; timeMs <= endTimeMs; timeMs += stepMs) {
            const time = new Date(timeMs);
            const position = propagateSatellite(satellite.tleLine1, satellite.tleLine2, time);

            if (position) {
                points.push({
                    position: [position.lon, position.lat],
                    time: time,
                    timeMs: timeMs
                });
            }
        }

        return points;
    }

    /**
     * Calculate fade intensity based on chevron proximity to event
     * Uses cosine curve for smooth, organic fade
     *
     * @param {number} eventTimeMs - Time of the event (crossing)
     * @param {number} currentTimeMs - Current simulation time (chevron)
     * @param {number} fadeInMinutes - Minutes before event to start fade in
     * @param {number} fadeOutMinutes - Minutes after event to complete fade out
     * @returns {number} Intensity 0-1 (0 = invisible, 1 = peak brightness)
     */
    calculateIntensity(eventTimeMs, currentTimeMs, fadeInMinutes, fadeOutMinutes) {
        const timeDeltaMs = eventTimeMs - currentTimeMs;
        const fadeInMs = fadeInMinutes * 60 * 1000;
        const fadeOutMs = fadeOutMinutes * 60 * 1000;

        if (timeDeltaMs > 0) {
            // Event is in the FUTURE (chevron approaching)
            if (timeDeltaMs > fadeInMs) {
                return 0; // Too far ahead - no glow yet
            }
            // Fade in: intensity increases as chevron approaches
            // At fadeInMs: progress=1, cos(π/2)=0
            // At 0: progress=0, cos(0)=1
            const fadeProgress = timeDeltaMs / fadeInMs;
            return Math.cos(fadeProgress * Math.PI / 2);
        } else {
            // Event is in the PAST (chevron has passed)
            const pastMs = Math.abs(timeDeltaMs);
            if (pastMs > fadeOutMs) {
                return 0; // Too far past - glow gone
            }
            // Fade out: intensity decreases as chevron moves away
            // At 0: progress=0, cos(0)=1
            // At fadeOutMs: progress=1, cos(π/2)=0
            const fadeProgress = pastMs / fadeOutMs;
            return Math.cos(fadeProgress * Math.PI / 2);
        }
    }

    /**
     * Detect latitude crossing events (equator, tropics, arctic circles, etc.)
     *
     * @param {Object} satellite - Satellite with tleLine1, tleLine2, name, id
     * @param {Date} currentTime - Current simulation time
     * @param {Object} config - Detection configuration
     * @param {number} config.latitude - Target latitude to detect crossing (0 for equator)
     * @param {number} config.fadeInMinutes - Minutes before crossing to start glow
     * @param {number} config.fadeOutMinutes - Minutes after crossing to end glow
     * @returns {Array} Array of detected crossings with intensity
     */
    detectLatitudeCrossing(satellite, currentTime, config) {
        const {
            latitude = 0,
            fadeInMinutes = 5,
            fadeOutMinutes = 5
        } = config;

        const currentTimeMs = currentTime.getTime();
        const crossings = [];

        // Propagate using FADE parameters (independent of display settings)
        const points = this.propagateForDetection(
            satellite,
            currentTime,
            fadeOutMinutes,  // Search past based on fade-out range
            fadeInMinutes    // Search future based on fade-in range
        );

        if (points.length < 2) {
            return crossings;
        }

        // Find crossings of target latitude
        for (let i = 0; i < points.length - 1; i++) {
            const curr = points[i];
            const next = points[i + 1];

            const lat1 = curr.position[1];
            const lat2 = next.position[1];

            // Check for crossing (latitude passes through target)
            const crossesUp = lat1 < latitude && lat2 >= latitude;
            const crossesDown = lat1 > latitude && lat2 <= latitude;

            if (crossesUp || crossesDown) {
                // Interpolate exact crossing position and time
                const t = Math.abs(lat1 - latitude) / Math.abs(lat2 - lat1);
                const crossingLon = curr.position[0] + t * (next.position[0] - curr.position[0]);
                const crossingTimeMs = curr.timeMs + t * (next.timeMs - curr.timeMs);

                // Calculate intensity based on chevron proximity
                const intensity = this.calculateIntensity(
                    crossingTimeMs,
                    currentTimeMs,
                    fadeInMinutes,
                    fadeOutMinutes
                );

                // Only include if visible (intensity > 0)
                if (intensity > 0) {
                    const timeDeltaMs = crossingTimeMs - currentTimeMs;
                    crossings.push({
                        position: [crossingLon, latitude],
                        intensity: intensity,
                        direction: crossesUp ? 'ascending' : 'descending',
                        isHistory: timeDeltaMs <= 0,
                        isFuture: timeDeltaMs > 0,
                        timeDelta: timeDeltaMs / 60000, // Minutes for display
                        crossingTime: new Date(crossingTimeMs),
                        satellite: satellite,
                        name: satellite.name,
                        eventType: 'latitude-crossing',
                        targetLatitude: latitude
                    });
                }
            }
        }

        return crossings;
    }

    /**
     * Detect time marker events (predicted maneuvers, scheduled events)
     * Creates a glow at a specific location at a specific time
     *
     * @param {Object} satellite - Satellite with tleLine1, tleLine2
     * @param {Date} currentTime - Current simulation time
     * @param {Object} config - Detection configuration
     * @param {Date} config.eventTime - When the event occurs
     * @param {number} config.fadeInMinutes - Minutes before to start glow
     * @param {number} config.fadeOutMinutes - Minutes after to end glow
     * @param {string} [config.label] - Optional label for the event
     * @returns {Array} Array with 0 or 1 event (single time marker)
     */
    detectTimeMarker(satellite, currentTime, config) {
        const {
            eventTime,
            fadeInMinutes = 10,
            fadeOutMinutes = 5,
            label = 'Event'
        } = config;

        if (!eventTime || !(eventTime instanceof Date)) {
            return [];
        }

        const currentTimeMs = currentTime.getTime();
        const eventTimeMs = eventTime.getTime();

        // Calculate intensity based on chevron proximity
        const intensity = this.calculateIntensity(
            eventTimeMs,
            currentTimeMs,
            fadeInMinutes,
            fadeOutMinutes
        );

        if (intensity <= 0) {
            return [];
        }

        // Get satellite position at event time
        const position = propagateSatellite(satellite.tleLine1, satellite.tleLine2, eventTime);

        if (!position) {
            return [];
        }

        const timeDeltaMs = eventTimeMs - currentTimeMs;
        return [{
            position: [position.lon, position.lat],
            intensity: intensity,
            isHistory: timeDeltaMs <= 0,
            isFuture: timeDeltaMs > 0,
            timeDelta: timeDeltaMs / 60000,
            eventTime: eventTime,
            satellite: satellite,
            name: satellite.name,
            label: label,
            eventType: 'time-marker'
        }];
    }

    /**
     * Detect latitude apex events (orbit max/min latitude - turning points)
     *
     * @param {Object} satellite - Satellite with tleLine1, tleLine2
     * @param {Date} currentTime - Current simulation time
     * @param {Object} config - Detection configuration
     * @param {number} config.fadeInMinutes - Minutes before apex to start glow
     * @param {number} config.fadeOutMinutes - Minutes after apex to end glow
     * @returns {Array} Array of detected apex events with intensity
     */
    detectLatitudeApex(satellite, currentTime, config) {
        const {
            fadeInMinutes = 5,
            fadeOutMinutes = 5
        } = config;

        const currentTimeMs = currentTime.getTime();
        const apexes = [];

        // Propagate using FADE parameters
        const points = this.propagateForDetection(
            satellite,
            currentTime,
            fadeOutMinutes,
            fadeInMinutes
        );

        if (points.length < 3) {
            return apexes;
        }

        // Find local maxima and minima
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];

            const latPrev = prev.position[1];
            const latCurr = curr.position[1];
            const latNext = next.position[1];

            const isMax = latCurr > latPrev && latCurr > latNext;
            const isMin = latCurr < latPrev && latCurr < latNext;

            if (isMax || isMin) {
                const intensity = this.calculateIntensity(
                    curr.timeMs,
                    currentTimeMs,
                    fadeInMinutes,
                    fadeOutMinutes
                );

                if (intensity > 0) {
                    const timeDeltaMs = curr.timeMs - currentTimeMs;
                    const TICK_WIDTH_DEG = 1.5;

                    apexes.push({
                        position: curr.position,
                        path: [
                            [curr.position[0] - TICK_WIDTH_DEG / 2, curr.position[1]],
                            [curr.position[0] + TICK_WIDTH_DEG / 2, curr.position[1]]
                        ],
                        intensity: intensity,
                        type: isMax ? 'max' : 'min',
                        isHistory: timeDeltaMs <= 0,
                        isFuture: timeDeltaMs > 0,
                        timeDelta: timeDeltaMs / 60000,
                        apexTime: curr.time,
                        satellite: satellite,
                        name: satellite.name,
                        eventType: 'latitude-apex'
                    });
                }
            }
        }

        // Return only the nearest past and future apex
        const pastApexes = apexes.filter(a => a.isHistory).sort((a, b) => b.timeDelta - a.timeDelta);
        const futureApexes = apexes.filter(a => a.isFuture).sort((a, b) => a.timeDelta - b.timeDelta);

        const result = [];
        if (pastApexes.length > 0) result.push(pastApexes[0]);
        if (futureApexes.length > 0) result.push(futureApexes[0]);

        return result;
    }

    /**
     * Stub: Detect orbit intersection events (nodal crossings between two satellites)
     * This is a placeholder for future implementation
     *
     * @param {Object} satellite1 - First satellite
     * @param {Object} satellite2 - Second satellite
     * @param {Date} currentTime - Current simulation time
     * @param {Object} config - Detection configuration
     * @returns {Array} Array of detected intersection events (stub returns empty)
     */
    detectOrbitIntersection(satellite1, satellite2, currentTime, config) {
        // TODO: Implement orbit intersection detection
        // This requires calculating where orbital planes intersect
        // and finding when both satellites are near those points
        logger.diagnostic('Orbit intersection detection not yet implemented', logger.CATEGORY.SATELLITE);
        return [];
    }

    /**
     * Batch detect events for multiple satellites
     *
     * @param {Array} satellites - Array of satellites
     * @param {Date} currentTime - Current simulation time
     * @param {string} eventType - 'latitude-crossing', 'latitude-apex', 'time-marker'
     * @param {Object} config - Event-specific configuration
     * @returns {Array} All detected events across all satellites
     */
    batchDetect(satellites, currentTime, eventType, config) {
        const allEvents = [];

        for (const satellite of satellites) {
            let events = [];

            switch (eventType) {
                case 'latitude-crossing':
                    events = this.detectLatitudeCrossing(satellite, currentTime, config);
                    break;
                case 'latitude-apex':
                    events = this.detectLatitudeApex(satellite, currentTime, config);
                    break;
                case 'time-marker':
                    events = this.detectTimeMarker(satellite, currentTime, config);
                    break;
                default:
                    logger.warning(`Unknown event type: ${eventType}`, logger.CATEGORY.SATELLITE);
            }

            allEvents.push(...events);
        }

        return allEvents;
    }
}

// Export singleton instance
const eventDetector = new EventDetector();

// Make available globally for debugging
if (typeof window !== 'undefined') {
    window.eventDetector = eventDetector;
}

export default eventDetector;
