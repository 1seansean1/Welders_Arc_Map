/**
 * Transfer Calculator Module - Lambert Solver Integration with satellite.js
 *
 * DEPENDENCIES: lambertSolver.js, satellite.js (global), logger.js
 * PATTERN: High-level functions for orbital transfer calculations
 *
 * Features:
 * - Extract ECI position/velocity from satellite.js propagation
 * - Compute orbital transfers between satellite pairs
 * - Calculate delta-V requirements (departure + arrival)
 * - Generate transfer arc points for visualization
 * - Time-of-flight optimization (minimum delta-V search)
 *
 * Usage:
 *   import { computeTransfer, findOptimalTransfer } from './modules/analysis/transferCalculator.js';
 *
 *   // Single transfer calculation
 *   const transfer = computeTransfer(chaserSat, targetSat, departureTime, tofSeconds);
 *   // Returns: { v1, v2, departureDV, arrivalDV, totalDV, converged, ... }
 *
 *   // Find optimal TOF for minimum delta-V
 *   const optimal = findOptimalTransfer(chaserSat, targetSat, departureTime, tofRange);
 */

import { lambertIzzo, lambertMultiRev, CONSTANTS } from './lambertSolver.js';
import logger from '../utils/logger.js';

// ============================================
// VECTOR UTILITIES
// ============================================

/**
 * Calculate vector magnitude
 * @param {number[]} v - 3D vector [x, y, z]
 * @returns {number} Magnitude
 */
function vectorMagnitude(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

/**
 * Subtract two vectors: a - b
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number[]} Result vector
 */
function vectorSubtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/**
 * Add two vectors: a + b
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number[]} Result vector
 */
function vectorAdd(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/**
 * Scale vector by scalar
 * @param {number[]} v - Vector
 * @param {number} s - Scalar
 * @returns {number[]} Scaled vector
 */
function vectorScale(v, s) {
    return [v[0] * s, v[1] * s, v[2] * s];
}

/**
 * Dot product of two vectors
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} Dot product
 */
function vectorDot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// ============================================
// SATELLITE.JS INTEGRATION
// ============================================

/**
 * Get ECI state (position and velocity) from satellite at given time
 *
 * @param {Object} satellite - Satellite object with tleLine1, tleLine2
 * @param {Date} date - Time to propagate to
 * @returns {Object|null} { position: [x,y,z], velocity: [vx,vy,vz] } in km and km/s, or null on error
 */
export function getECIState(satellite, date) {
    const sat = window.satellite;
    if (!sat) {
        logger.error('satellite.js library not loaded', logger.CATEGORY.SATELLITE);
        return null;
    }

    try {
        const satrec = sat.twoline2satrec(satellite.tleLine1, satellite.tleLine2);
        const pv = sat.propagate(satrec, date);

        if (!pv.position || !pv.velocity) {
            logger.warning('SGP4 propagation failed', logger.CATEGORY.SATELLITE, {
                satellite: satellite.name || satellite.id
            });
            return null;
        }

        return {
            position: [pv.position.x, pv.position.y, pv.position.z],
            velocity: [pv.velocity.x, pv.velocity.y, pv.velocity.z]
        };
    } catch (error) {
        logger.error('ECI state extraction failed', logger.CATEGORY.SATELLITE, {
            error: error.message
        });
        return null;
    }
}

/**
 * Get geodetic position (lat/lon/alt) from ECI state
 *
 * @param {number[]} positionEci - ECI position [x, y, z] in km
 * @param {Date} date - Time for GMST calculation
 * @returns {Object} { lat, lon, alt } in degrees and km
 */
export function eciToGeodetic(positionEci, date) {
    const sat = window.satellite;
    if (!sat) return null;

    const gmst = sat.gstime(date);
    const positionGd = sat.eciToGeodetic(
        { x: positionEci[0], y: positionEci[1], z: positionEci[2] },
        gmst
    );

    return {
        lat: sat.degreesLat(positionGd.latitude),
        lon: sat.degreesLong(positionGd.longitude),
        alt: positionGd.height
    };
}

// ============================================
// TRANSFER CALCULATION
// ============================================

/**
 * Compute orbital transfer between two satellites
 *
 * @param {Object} chaser - Chaser satellite object (with tleLine1, tleLine2)
 * @param {Object} target - Target satellite object
 * @param {Date} departureTime - When chaser initiates transfer
 * @param {number} tofSeconds - Time of flight in seconds
 * @param {Object} [options] - Optional parameters
 * @param {number} [options.M=0] - Number of revolutions
 * @param {boolean} [options.prograde=true] - Prograde transfer
 * @param {boolean} [options.lowPath=true] - Low energy path (for M>0)
 * @returns {Object|null} Transfer solution or null on failure
 */
export function computeTransfer(chaser, target, departureTime, tofSeconds, options = {}) {
    const { M = 0, prograde = true, lowPath = true } = options;

    // Get chaser state at departure
    const chaserState = getECIState(chaser, departureTime);
    if (!chaserState) {
        logger.error('Could not get chaser ECI state', logger.CATEGORY.SATELLITE);
        return null;
    }

    // Get target state at arrival
    const arrivalTime = new Date(departureTime.getTime() + tofSeconds * 1000);
    const targetState = getECIState(target, arrivalTime);
    if (!targetState) {
        logger.error('Could not get target ECI state', logger.CATEGORY.SATELLITE);
        return null;
    }

    try {
        // Solve Lambert problem
        const result = lambertIzzo(
            CONSTANTS.MU_EARTH,
            chaserState.position,
            targetState.position,
            tofSeconds,
            M,
            prograde,
            lowPath
        );

        // Calculate delta-V vectors
        const dv1_vec = vectorSubtract(result.v1, chaserState.velocity);
        const dv2_vec = vectorSubtract(targetState.velocity, result.v2);

        // Calculate delta-V magnitudes
        const departureDV = vectorMagnitude(dv1_vec);
        const arrivalDV = vectorMagnitude(dv2_vec);
        const totalDV = departureDV + arrivalDV;

        // Calculate transfer orbit characteristics
        const transferEnergy = vectorDot(result.v1, result.v1) / 2 -
            CONSTANTS.MU_EARTH / vectorMagnitude(chaserState.position);
        const semiMajorAxis = -CONSTANTS.MU_EARTH / (2 * transferEnergy);

        return {
            // Input echo
            departureTime,
            arrivalTime,
            tofSeconds,
            M,

            // Chaser state at departure
            chaserPosition: chaserState.position,
            chaserVelocity: chaserState.velocity,

            // Target state at arrival
            targetPosition: targetState.position,
            targetVelocity: targetState.velocity,

            // Lambert solution velocities
            v1: result.v1,  // Required velocity at departure
            v2: result.v2,  // Achieved velocity at arrival

            // Delta-V breakdown
            departureDV_vec: dv1_vec,
            arrivalDV_vec: dv2_vec,
            departureDV,
            arrivalDV,
            totalDV,

            // Transfer orbit characteristics
            semiMajorAxis,
            transferEnergy,

            // Solver metadata
            iterations: result.iterations,
            converged: result.converged
        };
    } catch (error) {
        logger.warning('Lambert solve failed', logger.CATEGORY.SATELLITE, {
            error: error.message,
            tof: tofSeconds,
            M
        });
        return null;
    }
}

/**
 * Find optimal transfer time (minimum delta-V) within a time range
 *
 * @param {Object} chaser - Chaser satellite
 * @param {Object} target - Target satellite
 * @param {Date} departureTime - Departure time
 * @param {Object} tofRange - { min: seconds, max: seconds, steps: number }
 * @param {Object} [options] - Lambert solver options
 * @returns {Object} { optimal: best transfer, all: array of all computed transfers }
 */
export function findOptimalTransfer(chaser, target, departureTime, tofRange, options = {}) {
    const { min = 600, max = 7200, steps = 50 } = tofRange;
    const stepSize = (max - min) / steps;

    const transfers = [];
    let optimal = null;
    let minDV = Infinity;

    for (let i = 0; i <= steps; i++) {
        const tof = min + i * stepSize;
        const transfer = computeTransfer(chaser, target, departureTime, tof, options);

        if (transfer && transfer.converged) {
            transfers.push(transfer);

            if (transfer.totalDV < minDV) {
                minDV = transfer.totalDV;
                optimal = transfer;
            }
        }
    }

    logger.diagnostic('Transfer optimization complete', logger.CATEGORY.SATELLITE, {
        computed: transfers.length,
        optimal: optimal ? `${optimal.totalDV.toFixed(3)} km/s at TOF=${optimal.tofSeconds}s` : 'none found'
    });

    return { optimal, all: transfers };
}

/**
 * Find all multi-revolution transfer options
 *
 * @param {Object} chaser - Chaser satellite
 * @param {Object} target - Target satellite
 * @param {Date} departureTime - Departure time
 * @param {number} tofSeconds - Time of flight
 * @param {number} [maxM=3] - Maximum revolutions to try
 * @returns {Array} Array of transfer solutions sorted by total delta-V
 */
export function findMultiRevTransfers(chaser, target, departureTime, tofSeconds, maxM = 3) {
    const solutions = [];

    for (let M = 0; M <= maxM; M++) {
        for (const lowPath of [true, false]) {
            if (M === 0 && !lowPath) continue;

            const transfer = computeTransfer(chaser, target, departureTime, tofSeconds, {
                M,
                lowPath
            });

            if (transfer && transfer.converged) {
                solutions.push({
                    ...transfer,
                    pathType: M === 0 ? 'direct' : (lowPath ? 'low' : 'high')
                });
            }
        }
    }

    // Sort by total delta-V
    solutions.sort((a, b) => a.totalDV - b.totalDV);

    return solutions;
}

// ============================================
// TRANSFER ARC GENERATION (for visualization)
// ============================================

/**
 * Generate transfer arc points for visualization
 * Propagates the transfer orbit from departure to arrival
 *
 * @param {Object} transfer - Transfer solution from computeTransfer
 * @param {number} [numPoints=60] - Number of arc points
 * @returns {Array} Array of { position: [x,y,z], geodetic: {lat, lon, alt}, time: Date }
 */
export function generateTransferArc(transfer, numPoints = 60) {
    if (!transfer || !transfer.converged) return [];

    const points = [];
    const { departureTime, tofSeconds, chaserPosition, v1 } = transfer;

    // Two-body propagation of transfer orbit
    const mu = CONSTANTS.MU_EARTH;
    const dt = tofSeconds / (numPoints - 1);

    let r = [...chaserPosition];
    let v = [...v1];

    for (let i = 0; i < numPoints; i++) {
        const time = new Date(departureTime.getTime() + i * dt * 1000);
        const geodetic = eciToGeodetic(r, time);

        points.push({
            position: [...r],
            geodetic,
            time,
            progress: i / (numPoints - 1)
        });

        // Simple two-body propagation using velocity Verlet
        // (For more accuracy, use RK4 or numerical integrator)
        if (i < numPoints - 1) {
            const r_mag = vectorMagnitude(r);
            const accel = vectorScale(r, -mu / (r_mag * r_mag * r_mag));

            // Half step velocity
            const v_half = vectorAdd(v, vectorScale(accel, dt / 2));

            // Full step position
            r = vectorAdd(r, vectorScale(v_half, dt));

            // Recalculate acceleration at new position
            const r_mag_new = vectorMagnitude(r);
            const accel_new = vectorScale(r, -mu / (r_mag_new * r_mag_new * r_mag_new));

            // Full step velocity
            v = vectorAdd(v_half, vectorScale(accel_new, dt / 2));
        }
    }

    return points;
}

/**
 * Generate transfer arc as geodetic coordinates for Deck.gl PathLayer
 *
 * @param {Object} transfer - Transfer solution
 * @param {number} [numPoints=60] - Number of points
 * @returns {Array} Array of [longitude, latitude, altitude] for PathLayer
 */
export function generateTransferArcPath(transfer, numPoints = 60) {
    const arc = generateTransferArc(transfer, numPoints);
    return arc.map(p => [p.geodetic.lon, p.geodetic.lat, p.geodetic.alt * 1000]); // alt in meters
}

// ============================================
// PORKCHOP PLOT DATA GENERATION
// ============================================

/**
 * Generate porkchop plot data (departure time vs TOF grid)
 *
 * @param {Object} chaser - Chaser satellite
 * @param {Object} target - Target satellite
 * @param {Object} grid - Grid parameters
 * @param {Date} grid.departureStart - Start of departure window
 * @param {Date} grid.departureEnd - End of departure window
 * @param {number} grid.departureSteps - Number of departure time samples
 * @param {number} grid.tofMin - Minimum TOF (seconds)
 * @param {number} grid.tofMax - Maximum TOF (seconds)
 * @param {number} grid.tofSteps - Number of TOF samples
 * @returns {Object} { data: 2D array of delta-V, departureTimes, tofValues, minDV, optimal }
 */
export function generatePorkchopData(chaser, target, grid) {
    const {
        departureStart,
        departureEnd,
        departureSteps = 50,
        tofMin = 600,
        tofMax = 7200,
        tofSteps = 50
    } = grid;

    const departureRange = departureEnd.getTime() - departureStart.getTime();
    const departureStep = departureRange / (departureSteps - 1);
    const tofStep = (tofMax - tofMin) / (tofSteps - 1);

    const data = [];
    const departureTimes = [];
    const tofValues = [];

    let minDV = Infinity;
    let optimal = null;

    // Generate TOF values
    for (let j = 0; j < tofSteps; j++) {
        tofValues.push(tofMin + j * tofStep);
    }

    // Generate grid
    for (let i = 0; i < departureSteps; i++) {
        const depTime = new Date(departureStart.getTime() + i * departureStep);
        departureTimes.push(depTime);

        const row = [];
        for (let j = 0; j < tofSteps; j++) {
            const tof = tofValues[j];
            const transfer = computeTransfer(chaser, target, depTime, tof);

            if (transfer && transfer.converged) {
                row.push(transfer.totalDV);

                if (transfer.totalDV < minDV) {
                    minDV = transfer.totalDV;
                    optimal = { departureTime: depTime, tof, transfer };
                }
            } else {
                row.push(null); // No solution
            }
        }
        data.push(row);
    }

    logger.log('Porkchop data generated', logger.CATEGORY.SATELLITE, {
        gridSize: `${departureSteps}x${tofSteps}`,
        minDV: minDV < Infinity ? `${minDV.toFixed(3)} km/s` : 'none'
    });

    return {
        data,
        departureTimes,
        tofValues,
        minDV: minDV < Infinity ? minDV : null,
        optimal
    };
}

// ============================================
// MODULE EXPORTS & DEBUG
// ============================================

// Make module available for debugging
if (typeof window !== 'undefined') {
    window.transferCalculator = {
        getECIState,
        eciToGeodetic,
        computeTransfer,
        findOptimalTransfer,
        findMultiRevTransfers,
        generateTransferArc,
        generateTransferArcPath,
        generatePorkchopData,
        // Vector utilities (for testing)
        vectorMagnitude,
        vectorSubtract,
        vectorAdd,
        vectorScale,
        vectorDot
    };

    logger.log('Transfer Calculator module loaded', logger.CATEGORY.SATELLITE);
}

export default {
    getECIState,
    eciToGeodetic,
    computeTransfer,
    findOptimalTransfer,
    findMultiRevTransfers,
    generateTransferArc,
    generateTransferArcPath,
    generatePorkchopData
};
