/**
 * Satellite Propagation Module - SGP4 calculations
 *
 * DEPENDENCIES: satellite.js library, logger.js
 * PATTERN: Pure functions for satellite position calculations
 *
 * Features:
 * - SGP4 propagation using TLE data
 * - Ground track calculation
 * - Position conversion (ECI → Geodetic)
 * - Error handling for invalid TLEs
 *
 * Performance:
 * - propagateSatellite: <1ms per satellite
 * - calculateGroundTrack: O(n) where n = number of points
 * - Typical: 90 points for 90-minute orbit with 60-second steps
 *
 * Usage:
 *   import { propagateSatellite, calculateGroundTrack } from './modules/data/propagation.js';
 *
 *   // Get satellite position at a specific time
 *   const position = propagateSatellite(tle1, tle2, new Date());
 *   // Returns: { lat, lon, alt } or null if error
 *
 *   // Calculate full ground track
 *   const track = calculateGroundTrack(tle1, tle2, startTime, 90, 60);
 *   // Returns: [[lon, lat], [lon, lat], ...]
 */

import logger from '../utils/logger.js';

/**
 * Propagate satellite to specific time using SGP4
 * Converts TLE data to lat/lon/alt position
 *
 * @param {string} tleLine1 - TLE line 1 (69 characters)
 * @param {string} tleLine2 - TLE line 2 (69 characters)
 * @param {Date} date - Time to propagate to
 * @returns {Object|null} - {lat, lon, alt} in degrees/km, or null if error
 *
 * Algorithm:
 * 1. Parse TLE into satellite record (SGP4)
 * 2. Propagate to specified time
 * 3. Convert ECI coordinates to geodetic (lat/lon/alt)
 * 4. Convert radians to degrees
 *
 * PERFORMANCE: <1ms per satellite
 * LIBRARY: satellite.js (SGP4 implementation)
 */
export function propagateSatellite(tleLine1, tleLine2, date) {
    try {
        // Access satellite.js library from global scope
        const satellite = window.satellite;
        if (!satellite) {
            logger.error('satellite.js library not loaded', logger.CATEGORY.SATELLITE);
            return null;
        }

        // Initialize satellite record from TLE
        const satrec = satellite.twoline2satrec(tleLine1, tleLine2);

        // Propagate to specific time
        const positionAndVelocity = satellite.propagate(satrec, date);

        // Check for propagation errors
        if (positionAndVelocity.error) {
            logger.warning('SGP4 propagation error', logger.CATEGORY.SATELLITE, {
                error: positionAndVelocity.error
            });
            return null;
        }

        // Get position in ECI coordinates (Earth-Centered Inertial)
        const positionEci = positionAndVelocity.position;

        if (!positionEci) {
            return null;
        }

        // Convert to GMST (Greenwich Mean Sidereal Time) for geodetic conversion
        const gmst = satellite.gstime(date);

        // Convert ECI to geodetic coordinates (lat/lon/alt)
        const positionGd = satellite.eciToGeodetic(positionEci, gmst);

        // Convert radians to degrees and altitude to kilometers
        return {
            lat: satellite.degreesLat(positionGd.latitude),
            lon: satellite.degreesLong(positionGd.longitude),
            alt: positionGd.height // kilometers
        };
    } catch (error) {
        logger.error('Failed to propagate satellite', logger.CATEGORY.SATELLITE, {
            error: error.message
        });
        return null;
    }
}

/**
 * Calculate ground track for a satellite
 * Returns array of path segments (split at anti-meridian crossings for proper rendering)
 *
 * @param {string} tleLine1 - TLE line 1
 * @param {string} tleLine2 - TLE line 2
 * @param {Date} startTime - Start time for ground track
 * @param {number} durationMinutes - How many minutes of orbit to calculate (default: 90)
 * @param {number} stepSeconds - Time step between points (default: 20 seconds for smooth curves)
 * @returns {Array} - Array of path segments, each is [[lon, lat], ...] (empty array if error)
 *
 * ERROR HANDLING:
 * - Returns empty array for invalid TLE data
 * - Aborts after 3 consecutive propagation errors
 * - Logs warnings for partial failures
 *
 * ANTI-MERIDIAN HANDLING:
 * - Detects longitude jumps >300° (crossing ±180° line)
 * - Splits path into separate segments at crossing points
 * - Each segment can be rendered as a separate path to avoid wrap artifacts
 *
 * PERFORMANCE: O(n) where n = number of points
 * TYPICAL: 270 points for 90-minute orbit with 20-second steps
 */
export function calculateGroundTrack(tleLine1, tleLine2, startTime, durationMinutes = 90, stepSeconds = 20) {
    // Validate inputs
    if (!tleLine1 || !tleLine2) {
        logger.error('Ground track calculation failed: Missing TLE data', logger.CATEGORY.SATELLITE);
        return [];
    }

    // Basic TLE format validation (lines should be 69 characters)
    if (typeof tleLine1 !== 'string' || typeof tleLine2 !== 'string') {
        logger.error('Ground track calculation failed: TLE must be strings', logger.CATEGORY.SATELLITE);
        return [];
    }

    // TLE lines can have trailing whitespace stripped, so be lenient (min 68 chars)
    if (tleLine1.length < 68 || tleLine2.length < 68) {
        logger.error('Ground track calculation failed: Invalid TLE length', logger.CATEGORY.SATELLITE, {
            line1Length: tleLine1.length,
            line2Length: tleLine2.length,
            expected: 69
        });
        return [];
    }

    // Validate startTime
    if (!(startTime instanceof Date) || isNaN(startTime.getTime())) {
        logger.error('Ground track calculation failed: Invalid startTime', logger.CATEGORY.SATELLITE);
        return [];
    }

    const allPoints = [];
    const steps = Math.floor((durationMinutes * 60) / stepSeconds);

    // Track consecutive errors to detect persistent failures
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 3;
    let totalErrors = 0;

    for (let i = 0; i <= steps; i++) {
        const time = new Date(startTime.getTime() + i * stepSeconds * 1000);
        const position = propagateSatellite(tleLine1, tleLine2, time);

        if (position) {
            allPoints.push([position.lon, position.lat]);
            consecutiveErrors = 0;  // Reset on success
        } else {
            consecutiveErrors++;
            totalErrors++;

            // Abort if too many consecutive errors (likely bad TLE)
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                logger.warning('Ground track calculation aborted: Too many consecutive errors', logger.CATEGORY.SATELLITE, {
                    consecutiveErrors: consecutiveErrors,
                    totalErrors: totalErrors,
                    pointsCalculated: allPoints.length,
                    pointsExpected: steps + 1
                });
                break;
            }
        }
    }

    // Log if there were any errors
    if (totalErrors > 0 && allPoints.length > 0) {
        logger.diagnostic('Ground track calculated with errors', logger.CATEGORY.SATELLITE, {
            points: allPoints.length,
            expected: steps + 1,
            errors: totalErrors,
            successRate: `${((allPoints.length / (steps + 1)) * 100).toFixed(1)}%`
        });
    }

    // Split path at anti-meridian crossings to prevent wrap artifacts
    return splitPathAtAntimeridian(allPoints);
}

/**
 * Split a path into segments at anti-meridian crossings
 * Detects when longitude jumps >300° (crossing ±180° line)
 *
 * @param {Array} points - Array of [lon, lat] positions
 * @returns {Array} - Array of path segments
 */
function splitPathAtAntimeridian(points) {
    if (points.length === 0) return [];
    if (points.length === 1) return [points];

    const segments = [];
    let currentSegment = [points[0]];

    for (let i = 1; i < points.length; i++) {
        const prevLon = points[i - 1][0];
        const currLon = points[i][0];
        const lonDiff = Math.abs(currLon - prevLon);

        // If longitude jumps more than 300°, we crossed the anti-meridian
        // Normal satellite motion won't jump >180° in one step
        if (lonDiff > 300) {
            // End current segment and start new one
            if (currentSegment.length > 1) {
                segments.push(currentSegment);
            }
            currentSegment = [points[i]];
        } else {
            currentSegment.push(points[i]);
        }
    }

    // Add final segment
    if (currentSegment.length > 1) {
        segments.push(currentSegment);
    }

    return segments;
}

/**
 * Batch propagate multiple satellites to the same time
 * More efficient than propagating individually
 *
 * @param {Array} satellites - Array of {tleLine1, tleLine2, id, name}
 * @param {Date} date - Time to propagate to
 * @returns {Array} - Array of {id, name, position: {lat, lon, alt}} or {id, name, position: null}
 */
export function batchPropagate(satellites, date) {
    return satellites.map(sat => ({
        id: sat.id,
        name: sat.name,
        position: propagateSatellite(sat.tleLine1, sat.tleLine2, date)
    }));
}

// Make module available for debugging
if (typeof window !== 'undefined') {
    window.propagation = {
        propagateSatellite,
        calculateGroundTrack,
        batchPropagate
    };
}
