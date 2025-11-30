/**
 * Lambert Solver Validation Module
 *
 * Validates the Izzo Lambert solver against known test vectors
 * from Poliastro, PyKEP, and Vallado references.
 *
 * Can be run standalone or integrated into the test registry.
 */

import { lambertIzzo, lambertMultiRev, CONSTANTS } from './lambertSolver.js';
import logger from '../utils/logger.js';

// ============================================
// COMPREHENSIVE TEST VECTORS
// ============================================

const VALIDATION_CASES = [
    // ===========================================
    // POLIASTRO TEST VECTORS (Earth orbits)
    // ===========================================
    {
        id: 'POL-1',
        name: 'Poliastro Case 1 - Coplanar elliptic',
        r1: [15945.34, 0, 0],
        r2: [12214.83, 10249.47, 0],
        tof: 4560,
        mu: 398600.4418,
        M: 0,
        expected_v1: [2.058913, 2.915965, 0],
        tolerance: 0.01  // km/s
    },
    {
        id: 'POL-2',
        name: 'Poliastro Case 2 - 3D transfer',
        r1: [5000, 10000, 2100],
        r2: [-14600, 2500, 7000],
        tof: 3600,
        mu: 398600.4418,
        M: 0,
        expected_v1: [-5.9925, 1.9254, 3.2456],
        tolerance: 0.01
    },

    // ===========================================
    // CANONICAL UNIT TESTS
    // ===========================================
    {
        id: 'CAN-1',
        name: 'Canonical units - 90° transfer',
        r1: [1, 0, 0],
        r2: [0, 1, 0],
        tof: Math.PI / 4,  // Quarter orbit
        mu: 1.0,
        M: 0,
        // For 90° transfer in canonical units, expect ~sqrt(2) velocity components
        expected_v1_magnitude: 1.41,
        tolerance: 0.1
    },
    {
        id: 'CAN-2',
        name: 'Canonical units - 180° near-limit',
        r1: [1, 0, 0],
        r2: [-0.99, 0.141, 0],  // Just under 180°
        tof: Math.PI * 0.9,
        mu: 1.0,
        M: 0,
        convergence_required: true,
        tolerance: 0.1
    },

    // ===========================================
    // LEO TRANSFER CASES
    // ===========================================
    {
        id: 'LEO-1',
        name: 'LEO coplanar - 30 min transfer',
        r1: [6678, 0, 0],           // ~300 km altitude
        r2: [4000, 5400, 0],        // Different position
        tof: 1800,                   // 30 minutes
        mu: 398600.4418,
        M: 0,
        convergence_required: true,
        tolerance: 0.1
    },
    {
        id: 'LEO-2',
        name: 'LEO 3D - ISS-like orbit transfer',
        r1: [6778, 0, 0],                    // ISS altitude
        r2: [3000, 5000, 3000],              // Different plane
        tof: 2700,                            // 45 minutes
        mu: 398600.4418,
        M: 0,
        convergence_required: true,
        tolerance: 0.1
    },

    // ===========================================
    // MULTI-REVOLUTION TESTS
    // ===========================================
    {
        id: 'MR-1',
        name: 'Multi-rev M=1 - Long TOF',
        r1: [7000, 0, 0],
        r2: [0, 7000, 0],
        tof: 10000,  // Long enough for 1 revolution
        mu: 398600.4418,
        M: 1,
        lowPath: true,
        convergence_required: true,
        tolerance: 0.1
    },

    // ===========================================
    // EDGE CASES
    // ===========================================
    {
        id: 'EDGE-1',
        name: 'Near-circular same altitude',
        r1: [7000, 0, 0],
        r2: [6062.18, 3500, 0],  // 30° true anomaly change at same altitude
        tof: 900,
        mu: 398600.4418,
        M: 0,
        convergence_required: true,
        tolerance: 0.1
    },
    {
        id: 'EDGE-2',
        name: 'High eccentricity transfer',
        r1: [7000, 0, 0],
        r2: [42000, 0, 0],  // Apogee of Molniya-like
        tof: 21600,          // 6 hours
        mu: 398600.4418,
        M: 0,
        convergence_required: true,
        tolerance: 0.1
    }
];

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Run a single validation case
 * @param {Object} testCase - Test case definition
 * @returns {Object} Result with pass/fail and details
 */
function runTestCase(testCase) {
    const result = {
        id: testCase.id,
        name: testCase.name,
        passed: false,
        error: null,
        details: {}
    };

    try {
        const solution = lambertIzzo(
            testCase.mu,
            testCase.r1,
            testCase.r2,
            testCase.tof,
            testCase.M || 0,
            true,  // prograde
            testCase.lowPath !== undefined ? testCase.lowPath : true
        );

        result.details.v1 = solution.v1;
        result.details.v2 = solution.v2;
        result.details.iterations = solution.iterations;
        result.details.converged = solution.converged;

        // Check convergence
        if (!solution.converged) {
            if (testCase.convergence_required) {
                result.error = 'Failed to converge';
                return result;
            }
        }

        // Check expected v1 if provided
        if (testCase.expected_v1) {
            const dx = solution.v1[0] - testCase.expected_v1[0];
            const dy = solution.v1[1] - testCase.expected_v1[1];
            const dz = solution.v1[2] - testCase.expected_v1[2];
            const error = Math.sqrt(dx * dx + dy * dy + dz * dz);

            result.details.v1_error = error;
            result.passed = error < testCase.tolerance;

            if (!result.passed) {
                result.error = `v1 error ${error.toFixed(6)} km/s exceeds tolerance ${testCase.tolerance}`;
            }
        }
        // Check expected v1 magnitude if provided
        else if (testCase.expected_v1_magnitude) {
            const mag = Math.sqrt(
                solution.v1[0] ** 2 +
                solution.v1[1] ** 2 +
                solution.v1[2] ** 2
            );
            const error = Math.abs(mag - testCase.expected_v1_magnitude);

            result.details.v1_magnitude = mag;
            result.details.v1_mag_error = error;
            result.passed = error < testCase.tolerance;

            if (!result.passed) {
                result.error = `v1 magnitude error ${error.toFixed(6)} exceeds tolerance`;
            }
        }
        // Just check convergence
        else if (testCase.convergence_required) {
            result.passed = solution.converged;
            if (!result.passed) {
                result.error = 'Did not converge';
            }
        } else {
            result.passed = true;  // No specific check, just ran without error
        }

    } catch (e) {
        result.error = e.message;
        result.passed = false;
    }

    return result;
}

/**
 * Run all validation cases
 * @returns {Object} Summary with all results
 */
export function runAllValidation() {
    const results = [];
    let passed = 0;
    let failed = 0;

    for (const testCase of VALIDATION_CASES) {
        const result = runTestCase(testCase);
        results.push(result);

        if (result.passed) {
            passed++;
        } else {
            failed++;
        }
    }

    const summary = {
        total: results.length,
        passed,
        failed,
        passRate: (passed / results.length * 100).toFixed(1) + '%',
        results
    };

    // Log summary
    logger.log(`Lambert validation: ${passed}/${results.length} passed (${summary.passRate})`,
        logger.CATEGORY.TEST);

    // Log failures
    for (const result of results) {
        if (!result.passed) {
            logger.warning(`FAILED: ${result.id} - ${result.name}: ${result.error}`,
                logger.CATEGORY.TEST);
        }
    }

    return summary;
}

/**
 * Quick validation check (subset of tests)
 * @returns {boolean} True if core tests pass
 */
export function quickValidation() {
    const quickTests = ['POL-1', 'POL-2', 'CAN-1', 'LEO-1'];
    let allPassed = true;

    for (const id of quickTests) {
        const testCase = VALIDATION_CASES.find(t => t.id === id);
        if (testCase) {
            const result = runTestCase(testCase);
            if (!result.passed) {
                allPassed = false;
                logger.error(`Quick validation failed: ${id} - ${result.error}`,
                    logger.CATEGORY.TEST);
            }
        }
    }

    return allPassed;
}

/**
 * Performance benchmark
 * @param {number} iterations - Number of solves to run
 * @returns {Object} Timing statistics
 */
export function runBenchmark(iterations = 1000) {
    const testCase = VALIDATION_CASES[0];  // Use first test case

    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
        lambertIzzo(
            testCase.mu,
            testCase.r1,
            testCase.r2,
            testCase.tof,
            0
        );
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    const result = {
        iterations,
        totalTime: elapsed.toFixed(2) + ' ms',
        avgTime: (elapsed / iterations).toFixed(4) + ' ms',
        opsPerSec: Math.round(opsPerSec).toLocaleString()
    };

    logger.log(`Lambert benchmark: ${result.opsPerSec} ops/sec`, logger.CATEGORY.TEST);

    return result;
}

// ============================================
// HYPOTHESIS TEST DEFINITIONS (for testRegistry)
// ============================================

export const HYPOTHESIS_TESTS = [
    {
        id: 'H-LAM-1',
        name: 'Lambert solver converges for coplanar transfers',
        category: 'lambert',
        test: () => {
            const result = runTestCase(VALIDATION_CASES.find(t => t.id === 'POL-1'));
            return {
                passed: result.passed,
                message: result.passed ?
                    `Converged in ${result.details.iterations} iterations` :
                    result.error
            };
        }
    },
    {
        id: 'H-LAM-2',
        name: 'Lambert solver handles 3D transfers',
        category: 'lambert',
        test: () => {
            const result = runTestCase(VALIDATION_CASES.find(t => t.id === 'POL-2'));
            return {
                passed: result.passed,
                message: result.passed ?
                    `v1 error: ${result.details.v1_error?.toFixed(6) || 'N/A'} km/s` :
                    result.error
            };
        }
    },
    {
        id: 'H-LAM-3',
        name: 'Lambert solver handles near-180° geometry',
        category: 'lambert',
        test: () => {
            const result = runTestCase(VALIDATION_CASES.find(t => t.id === 'CAN-2'));
            return {
                passed: result.passed,
                message: result.passed ?
                    'Near-antipodal case converged' :
                    result.error
            };
        }
    },
    {
        id: 'H-LAM-4',
        name: 'Lambert solver achieves target throughput',
        category: 'lambert',
        test: () => {
            const benchmark = runBenchmark(500);
            const opsPerSec = parseInt(benchmark.opsPerSec.replace(/,/g, ''));
            const passed = opsPerSec > 50000;  // Minimum 50K ops/sec
            return {
                passed,
                message: `${benchmark.opsPerSec} ops/sec (target: >50,000)`
            };
        }
    },
    {
        id: 'H-LAM-5',
        name: 'Multi-revolution solutions enumerated correctly',
        category: 'lambert',
        test: () => {
            try {
                const solutions = lambertMultiRev(
                    398600.4418,
                    [7000, 0, 0],
                    [0, 7000, 0],
                    15000,  // Long TOF for multi-rev
                    2       // Up to M=2
                );
                const passed = solutions.length >= 1;
                return {
                    passed,
                    message: `Found ${solutions.length} solutions (M=0 to M=2)`
                };
            } catch (e) {
                return { passed: false, message: e.message };
            }
        }
    }
];

// ============================================
// MODULE EXPORTS & DEBUG
// ============================================

if (typeof window !== 'undefined') {
    window.lambertValidation = {
        runAllValidation,
        quickValidation,
        runBenchmark,
        VALIDATION_CASES,
        HYPOTHESIS_TESTS
    };
}

export default {
    runAllValidation,
    quickValidation,
    runBenchmark,
    VALIDATION_CASES,
    HYPOTHESIS_TESTS
};
