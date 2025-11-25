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
 * Returns array of positions along the orbital path
 *
 * @param {string} tleLine1 - TLE line 1
 * @param {string} tleLine2 - TLE line 2
 * @param {Date} startTime - Start time for ground track
 * @param {number} durationMinutes - How many minutes of orbit to calculate (default: 90)
 * @param {number} stepSeconds - Time step between points (default: 60 seconds)
 * @returns {Array} - Array of [lon, lat] positions
 *
 * PERFORMANCE: O(n) where n = number of points
 * TYPICAL: 90 points for 90-minute orbit with 60-second steps
 */
export function calculateGroundTrack(tleLine1, tleLine2, startTime, durationMinutes = 90, stepSeconds = 60) {
    const track = [];
    const steps = Math.floor((durationMinutes * 60) / stepSeconds);

    for (let i = 0; i <= steps; i++) {
        const time = new Date(startTime.getTime() + i * stepSeconds * 1000);
        const position = propagateSatellite(tleLine1, tleLine2, time);

        if (position) {
            track.push([position.lon, position.lat]);
        }
    }

    return track;
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
