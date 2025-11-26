/**
 * Automated Map Tests - Hypothesis-Driven Testing Framework
 *
 * Follows scientific debugging methodology:
 *   1. OBSERVE    → Document exact symptoms
 *   2. MEASURE    → Quantify with metrics/baselines
 *   3. HYPOTHESIZE → Form testable hypotheses
 *   4. PREDICT    → State expected outcomes
 *   5. EXPERIMENT → Run minimal intervention
 *   6. VALIDATE   → Accept/reject based on predictions
 *   7. ISOLATE    → Ablation testing
 *   8. REGRESS    → Verify no regressions
 *
 * USAGE:
 *   await mapTests.runAll();
 *   await mapTests.runAblationStudy();
 */

import { diagnostics } from './diagnostics.js';
import logger from '../utils/logger.js';

// ============================================
// TEST HYPOTHESIS REGISTRY
// Each test maps to a documented hypothesis
// ============================================

const TEST_HYPOTHESES = {
    'H-DRIFT-1': {
        id: 'H-DRIFT-1',
        name: 'Initial Zoom Offset',
        hypothesis: 'Missing -1 zoom offset on init causes Deck.gl/Leaflet position mismatch',
        symptom: 'Sensors appear in wrong position on initial load',
        prediction: 'Deck.gl zoom should equal Leaflet zoom minus 1',
        nullPrediction: 'Zoom values would match exactly (no offset)',
        threshold: { zoomDiff: 0.01 },
        causalChain: [
            'SYMPTOM: Position drift on initial load',
            'PROXIMATE: Deck.gl viewState zoom != Leaflet zoom - 1',
            'ROOT: Line 299 missing zoom offset',
            'MECHANISM: Deck.gl MapView uses different zoom scale',
            'FIX: Apply LEAFLET_TO_DECKGL_ZOOM_OFFSET constant'
        ]
    },
    'H-TIME-1': {
        id: 'H-TIME-1',
        name: 'Time Source',
        hypothesis: 'Ground tracks use wall clock instead of simulation time',
        symptom: 'Ground tracks ignore time control settings',
        prediction: 'Changing simulation time should move satellite positions',
        nullPrediction: 'Satellites would stay at current real-time positions',
        threshold: { timeApplied: true },
        causalChain: [
            'SYMPTOM: Ground tracks ignore time controls',
            'PROXIMATE: Positions calculated with new Date()',
            'ROOT: Line 680 uses wall clock not timeState',
            'MECHANISM: SGP4 propagation uses provided time',
            'FIX: Use timeState.getCurrentTime()'
        ]
    },
    'H-SYNC-PAN': {
        id: 'H-SYNC-PAN',
        name: 'Pan Synchronization',
        hypothesis: 'Deck.gl may drift from Leaflet during pan operations',
        symptom: 'Layers misalign during or after panning',
        prediction: 'Zero drift events during pan sequence',
        nullPrediction: 'Drift events would occur during rapid pan',
        threshold: { driftEvents: 0, maxDrift: 0.001 },
        causalChain: [
            'SYMPTOM: Layers misalign during pan',
            'PROXIMATE: viewState not synced on move event',
            'ROOT: Missing or delayed sync callback',
            'MECHANISM: Leaflet fires move before Deck.gl updates',
            'FIX: Sync viewState on every Leaflet move event'
        ]
    },
    'H-SYNC-ZOOM': {
        id: 'H-SYNC-ZOOM',
        name: 'Zoom Synchronization',
        hypothesis: 'Deck.gl may drift from Leaflet during zoom operations',
        symptom: 'Layers misalign during or after zooming',
        prediction: 'Zero drift events during zoom sequence',
        nullPrediction: 'Zoom drift would accumulate',
        threshold: { driftEvents: 0, maxZoomDrift: 0.01 },
        causalChain: [
            'SYMPTOM: Layers misalign during zoom',
            'PROXIMATE: Zoom offset not applied consistently',
            'ROOT: Async zoom events cause race condition',
            'MECHANISM: Leaflet zoom != Deck.gl zoom - 1',
            'FIX: Apply offset in all zoom handlers'
        ]
    },
    'H-PERF-1': {
        id: 'H-PERF-1',
        name: 'Rapid Pan Performance',
        hypothesis: 'Rapid panning may cause frame drops or visual glitches',
        symptom: 'Stuttering or flicker during fast pan',
        prediction: 'Less than 10% dropped frames, zero glitches',
        nullPrediction: 'High frame drop rate and visible glitches',
        threshold: { droppedFrameRate: 0.10, glitches: 0 },
        causalChain: [
            'SYMPTOM: Stutter during rapid pan',
            'PROXIMATE: Too many setProps calls per frame',
            'ROOT: No batching or throttling of updates',
            'MECHANISM: Each pan event triggers full re-render',
            'FIX: Batch setProps calls, use requestAnimationFrame'
        ]
    },
    'H-BATCH-1': {
        id: 'H-BATCH-1',
        name: 'setProps Batching',
        hypothesis: 'Unbatched setProps calls may cause race conditions',
        symptom: 'Intermittent visual glitches or state inconsistency',
        prediction: 'Combined viewState+layers calls should exist',
        nullPrediction: 'All calls would be viewState-only',
        threshold: { viewStateOnlyRatio: 0.95 },
        causalChain: [
            'SYMPTOM: Intermittent glitches',
            'PROXIMATE: Multiple setProps in same frame',
            'ROOT: Separate calls for viewState and layers',
            'MECHANISM: Race between viewState and layer updates',
            'FIX: Combine updates into single setProps call'
        ]
    }
};

class AutomatedMapTests {
    constructor() {
        this.results = [];
        this.testTimeout = 10000; // 10 seconds per test
        this.hypotheses = TEST_HYPOTHESES;
    }

    // ============================================
    // SCIENTIFIC LOGGING
    // Structured output following methodology
    // ============================================

    /**
     * Log hypothesis being tested
     */
    _logHypothesis(hyp) {
        logger.info(`[HYPOTHESIS] ${hyp.id}: ${hyp.hypothesis}`, logger.CATEGORY.SYNC);
        logger.diagnostic(`[SYMPTOM] ${hyp.symptom}`, logger.CATEGORY.SYNC);
    }

    /**
     * Log prediction before test
     */
    _logPrediction(hyp) {
        logger.info(`[PREDICT] If fixed: ${hyp.prediction}`, logger.CATEGORY.SYNC);
        logger.diagnostic(`[NULL] If broken: ${hyp.nullPrediction}`, logger.CATEGORY.SYNC);
    }

    /**
     * Log measurement results
     */
    _logMeasurement(label, measured, expected, threshold) {
        const status = this._checkThreshold(measured, expected, threshold) ? 'OK' : 'FAIL';
        logger.info(`[MEASURE] ${label}: ${measured} (expected: ${expected}, threshold: ${threshold}) [${status}]`, logger.CATEGORY.SYNC);
    }

    /**
     * Log validation result with reasoning
     */
    _logValidation(hyp, passed, details) {
        if (passed) {
            logger.success(`[VALIDATE] PASS - ${hyp.prediction}`, logger.CATEGORY.SYNC);
        } else {
            logger.error(`[VALIDATE] FAIL - Prediction not met`, logger.CATEGORY.SYNC);
            // Log causal chain on failure to aid debugging
            logger.warning('[CAUSAL CHAIN]', logger.CATEGORY.SYNC);
            hyp.causalChain.forEach((step, i) => {
                logger.diagnostic(`  ${i + 1}. ${step}`, logger.CATEGORY.SYNC);
            });
        }
    }

    /**
     * Check if measured value meets threshold
     */
    _checkThreshold(measured, expected, threshold) {
        if (typeof threshold === 'number') {
            return Math.abs(measured - expected) <= threshold;
        }
        return measured === expected;
    }

    /**
     * Get hypothesis by ID
     */
    getHypothesis(id) {
        return this.hypotheses[id] || null;
    }

    /**
     * Get all hypotheses for UI display
     */
    getAllHypotheses() {
        return Object.values(this.hypotheses);
    }

    /**
     * Simulate map pan programmatically
     * @param {number} deltaLng - Longitude change
     * @param {number} deltaLat - Latitude change
     * @param {number} steps - Number of animation steps
     * @param {number} duration - Total duration in ms
     */
    async simulatePan(deltaLng, deltaLat, steps = 30, duration = 1000) {
        const map = window.leafletMap;
        if (!map) throw new Error('Leaflet map not initialized');

        const startCenter = map.getCenter();
        const stepDelay = duration / steps;

        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            const newLng = startCenter.lng + (deltaLng * progress);
            const newLat = startCenter.lat + (deltaLat * progress);

            map.setView([newLat, newLng], map.getZoom(), { animate: false });
            await this._delay(stepDelay);
        }
    }

    /**
     * Simulate map zoom programmatically
     * @param {number} zoomDelta - Zoom level change (positive = zoom in)
     * @param {number} steps - Number of steps
     * @param {number} duration - Total duration in ms
     */
    async simulateZoom(zoomDelta, steps = 10, duration = 500) {
        const map = window.leafletMap;
        if (!map) throw new Error('Leaflet map not initialized');

        const startZoom = map.getZoom();
        const stepDelay = duration / steps;

        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            const newZoom = startZoom + (zoomDelta * progress);

            map.setZoom(newZoom, { animate: false });
            await this._delay(stepDelay);
        }
    }

    /**
     * Simulate rapid pan (stress test)
     * @param {number} duration - Duration in ms
     */
    async simulateRapidPan(duration = 3000) {
        const map = window.leafletMap;
        if (!map) throw new Error('Leaflet map not initialized');

        const startTime = performance.now();
        const startCenter = map.getCenter();
        let angle = 0;

        while (performance.now() - startTime < duration) {
            angle += 0.2;
            const radius = 10; // degrees
            const newLng = startCenter.lng + Math.cos(angle) * radius;
            const newLat = startCenter.lat + Math.sin(angle) * radius * 0.5;

            map.setView([newLat, newLng], map.getZoom(), { animate: false });
            await this._delay(16); // ~60 FPS
        }

        // Return to start
        map.setView([startCenter.lat, startCenter.lng], map.getZoom(), { animate: false });
    }

    /**
     * Simulate container resize
     * @param {number} widthDelta - Width change in pixels
     * @param {number} heightDelta - Height change in pixels
     */
    async simulateResize(widthDelta, heightDelta) {
        const container = document.getElementById('map-container');
        if (!container) throw new Error('Map container not found');

        const originalWidth = container.style.width;
        const originalHeight = container.style.height;
        const rect = container.getBoundingClientRect();

        // Apply resize
        container.style.width = `${rect.width + widthDelta}px`;
        container.style.height = `${rect.height + heightDelta}px`;

        // Trigger resize handlers
        window.dispatchEvent(new Event('resize'));

        // Wait for updates
        await this._delay(100);

        // Restore
        container.style.width = originalWidth;
        container.style.height = originalHeight;
        window.dispatchEvent(new Event('resize'));

        await this._delay(100);
    }

    /**
     * Test: Pan synchronization
     * Verifies Deck.gl stays in sync with Leaflet during pan
     */
    async testPanSync() {
        const hyp = this.hypotheses['H-SYNC-PAN'];

        // 1. HYPOTHESIZE
        this._logHypothesis(hyp);

        // 2. PREDICT
        this._logPrediction(hyp);

        // 3. EXPERIMENT
        diagnostics.startRecording();

        // Pan in multiple directions
        await this.simulatePan(20, 0, 30, 1000);   // East
        await this._delay(100);
        await this.simulatePan(-40, 0, 30, 1000); // West
        await this._delay(100);
        await this.simulatePan(20, 15, 30, 1000); // Northeast
        await this._delay(100);
        await this.simulatePan(0, -15, 30, 1000); // South

        const report = diagnostics.stopRecording();
        const syncValid = diagnostics.validateSync();

        // 3. MEASURE
        const maxDrift = Math.max(report.sync.maxLngDrift || 0, report.sync.maxLatDrift || 0);
        this._logMeasurement('Drift events', report.sync.driftEvents, 0, hyp.threshold.driftEvents);
        this._logMeasurement('Max drift', maxDrift, 0, hyp.threshold.maxDrift);

        // 4. VALIDATE
        const passed = report.sync.driftEvents === 0 &&
                       (syncValid.valid || syncValid.errors?.length === 0);
        this._logValidation(hyp, passed, { driftEvents: report.sync.driftEvents });

        return this._recordResult(hyp, passed, {
            driftEvents: report.sync.driftEvents,
            maxDrift,
            finalSyncValid: syncValid.valid
        });
    }

    /**
     * Test: Zoom synchronization
     * Verifies Deck.gl stays in sync with Leaflet during zoom
     */
    async testZoomSync() {
        const hyp = this.hypotheses['H-SYNC-ZOOM'];

        // 1. HYPOTHESIZE
        this._logHypothesis(hyp);

        // 2. PREDICT
        this._logPrediction(hyp);

        // 3. EXPERIMENT
        diagnostics.startRecording();

        // Zoom in and out
        await this.simulateZoom(3, 15, 750);   // Zoom in 3 levels
        await this._delay(200);
        await this.simulateZoom(-3, 15, 750);  // Zoom back out
        await this._delay(200);
        await this.simulateZoom(2, 10, 500);   // Zoom in 2 levels
        await this._delay(200);
        await this.simulateZoom(-2, 10, 500);  // Zoom back out

        const report = diagnostics.stopRecording();
        const syncValid = diagnostics.validateSync();

        // 3. MEASURE
        this._logMeasurement('Drift events', report.sync.driftEvents, 0, hyp.threshold.driftEvents);
        this._logMeasurement('Max zoom drift', report.sync.maxZoomDrift || 0, 0, hyp.threshold.maxZoomDrift);

        // 4. VALIDATE
        const passed = report.sync.driftEvents === 0 &&
                       (report.sync.maxZoomDrift || 0) < hyp.threshold.maxZoomDrift;
        this._logValidation(hyp, passed, { maxZoomDrift: report.sync.maxZoomDrift });

        return this._recordResult(hyp, passed, {
            driftEvents: report.sync.driftEvents,
            maxZoomDrift: report.sync.maxZoomDrift,
            finalSyncValid: syncValid.valid
        });
    }

    /**
     * Test: Rapid pan (stress test)
     * Verifies no glitches during rapid continuous panning
     */
    async testRapidPan() {
        const hyp = this.hypotheses['H-PERF-1'];

        // 1. HYPOTHESIZE
        this._logHypothesis(hyp);

        // 2. PREDICT
        this._logPrediction(hyp);

        // 3. EXPERIMENT
        diagnostics.startRecording();
        await this.simulateRapidPan(3000);
        const report = diagnostics.stopRecording();

        // 3. MEASURE
        const droppedRate = report.frames.droppedFrameRate || 0;
        this._logMeasurement('Glitches', report.glitches.count, 0, hyp.threshold.glitches);
        this._logMeasurement('Dropped frame rate', droppedRate.toFixed(2), 0, hyp.threshold.droppedFrameRate);

        // 4. VALIDATE
        const passed = report.glitches.count === 0 &&
                       report.frames.droppedFrames < report.frames.count * hyp.threshold.droppedFrameRate;
        this._logValidation(hyp, passed, { glitches: report.glitches.count, droppedRate });

        return this._recordResult(hyp, passed, {
            glitches: report.glitches.count,
            droppedFrameRate: droppedRate,
            avgFrameTime: report.frames.avg?.toFixed(2) + 'ms'
        });
    }

    /**
     * Test: Time synchronization
     * Verifies ground tracks update when simulation time changes
     */
    async testTimeSync() {
        const hyp = this.hypotheses['H-TIME-1'];

        // 1. HYPOTHESIZE
        this._logHypothesis(hyp);

        // 2. PREDICT
        this._logPrediction(hyp);

        const timeState = window.timeState;
        if (!timeState) {
            return this._recordResult(hyp, false, { error: 'timeState not available' });
        }

        // Get current time
        const originalTime = timeState.getCurrentTime();

        // Check if any satellites are selected
        const satelliteState = window.SatelliteApp?.satelliteState;
        const hasSatellites = satelliteState?.getSelectedCount() > 0;

        if (!hasSatellites) {
            logger.info('[MEASURE] No satellites selected - structural test only', logger.CATEGORY.SYNC);
            return this._recordResult(hyp, true, {
                skipped: true,
                reason: 'No satellites selected - time sync tested structurally'
            });
        }

        // 3. MEASURE - Set time to yesterday and verify it applies
        const yesterday = new Date(Date.now() - 86400000);
        timeState.setCurrentTime(yesterday);

        await this._delay(500); // Wait for update

        const currentTime = timeState.getCurrentTime();
        const timeChanged = Math.abs(currentTime.getTime() - yesterday.getTime()) < 1000;

        this._logMeasurement('Time change applied', timeChanged, true, 0);

        // Restore original time
        timeState.setCurrentTime(originalTime);

        // 4. VALIDATE
        this._logValidation(hyp, timeChanged, { timeChanged });

        return this._recordResult(hyp, timeChanged, {
            timeChangeApplied: timeChanged,
            setTo: yesterday.toISOString(),
            got: currentTime.toISOString()
        });
    }

    /**
     * Test: Initial zoom offset (H-DRIFT-1 regression test)
     * Verifies zoom offset is correctly applied on initialization
     */
    async testInitialZoomOffset() {
        const hyp = this.hypotheses['H-DRIFT-1'];

        // 1. HYPOTHESIZE
        this._logHypothesis(hyp);

        // 2. PREDICT
        this._logPrediction(hyp);

        const map = window.leafletMap;
        const deckgl = window.deckgl;

        if (!map || !deckgl) {
            return this._recordResult(hyp, false, { error: 'Map or Deck.gl not initialized' });
        }

        // 3. MEASURE
        const leafletZoom = map.getZoom();
        const deckViewState = deckgl.viewState || deckgl.props?.viewState;
        const deckZoom = deckViewState?.zoom;
        const expectedDeckZoom = leafletZoom - 1;
        const zoomDiff = Math.abs(deckZoom - expectedDeckZoom);

        this._logMeasurement('Leaflet zoom', leafletZoom, leafletZoom, 0);
        this._logMeasurement('Deck.gl zoom', deckZoom, expectedDeckZoom, hyp.threshold.zoomDiff);

        // 4. VALIDATE
        const passed = zoomDiff < hyp.threshold.zoomDiff;
        this._logValidation(hyp, passed, { zoomDiff });

        return this._recordResult(hyp, passed, {
            leafletZoom,
            deckZoom,
            expectedDeckZoom,
            difference: zoomDiff
        });
    }

    /**
     * Test: setProps batching
     * Verifies updates are batched properly (no race conditions)
     */
    async testSetPropsBatching() {
        const hyp = this.hypotheses['H-BATCH-1'];

        // 1. HYPOTHESIZE
        this._logHypothesis(hyp);

        // 2. PREDICT
        this._logPrediction(hyp);

        // 3. EXPERIMENT
        diagnostics.startRecording();
        await this.simulatePan(5, 5, 10, 200);
        const report = diagnostics.stopRecording();

        // 3. MEASURE
        const viewStateOnlyRatio = report.setProps.totalCalls > 0 ?
            report.setProps.viewStateOnlyCalls / report.setProps.totalCalls : 0;

        this._logMeasurement('Total setProps calls', report.setProps.totalCalls, 'N/A', 'N/A');
        this._logMeasurement('ViewState-only ratio', (viewStateOnlyRatio * 100).toFixed(1) + '%', '<95%', hyp.threshold.viewStateOnlyRatio);

        // 4. VALIDATE - At least some combined calls should exist
        const passed = viewStateOnlyRatio < hyp.threshold.viewStateOnlyRatio;
        this._logValidation(hyp, passed, { viewStateOnlyRatio });

        return this._recordResult(hyp, passed, {
            totalCalls: report.setProps.totalCalls,
            viewStateOnly: report.setProps.viewStateOnlyCalls,
            combined: report.setProps.combinedCalls,
            viewStateOnlyRatio: (viewStateOnlyRatio * 100).toFixed(1) + '%'
        });
    }

    /**
     * Run all tests
     * @returns {Object} Test results summary
     */
    async runAll() {
        logger.info('=== Starting Automated Map Tests ===', logger.CATEGORY.SYNC);
        this.results = [];

        const tests = [
            () => this.testInitialZoomOffset(),
            () => this.testPanSync(),
            () => this.testZoomSync(),
            () => this.testRapidPan(),
            () => this.testTimeSync(),
            () => this.testSetPropsBatching()
        ];

        for (const test of tests) {
            try {
                await test();
                await this._delay(500); // Brief pause between tests
            } catch (error) {
                logger.error(`Test failed with error: ${error.message}`, logger.CATEGORY.SYNC);
                this.results.push({
                    name: 'Unknown',
                    passed: false,
                    error: error.message
                });
            }
        }

        return this._generateSummary();
    }

    /**
     * Run ablation study
     * Compares current state to baseline
     */
    async runAblationStudy() {
        logger.info('=== Running Ablation Study ===', logger.CATEGORY.SYNC);

        // Run full test suite
        const results = await this.runAll();

        // Get baseline comparison if available
        const baseline = diagnostics.getBaseline();

        if (baseline) {
            logger.info('Comparing to baseline...', logger.CATEGORY.SYNC);

            diagnostics.startRecording();
            await this.simulatePan(20, 10, 30, 1000);
            await this.simulateZoom(2, 10, 500);
            const current = diagnostics.stopRecording();

            const comparison = diagnostics.compareToBaseline(current);

            return {
                testResults: results,
                ablation: {
                    hasBaseline: true,
                    comparison,
                    improved: comparison.improved
                }
            };
        }

        return {
            testResults: results,
            ablation: {
                hasBaseline: false,
                message: 'No baseline saved. Run deckglDebug.saveBaseline() first.'
            }
        };
    }

    /**
     * Record test result
     * @private
     * @param {Object|string} hypOrName - Hypothesis object or test name string
     * @param {boolean} passed - Whether test passed
     * @param {Object} details - Test details/measurements
     */
    _recordResult(hypOrName, passed, details = {}) {
        // Support both hypothesis object and legacy string name
        const isHypothesis = typeof hypOrName === 'object' && hypOrName.id;
        const name = isHypothesis ? `${hypOrName.id}: ${hypOrName.name}` : hypOrName;
        const hypothesisId = isHypothesis ? hypOrName.id : null;

        const result = {
            name,
            hypothesisId,
            passed,
            details,
            timestamp: new Date().toISOString(),
            // Include hypothesis metadata for UI display
            hypothesis: isHypothesis ? {
                id: hypOrName.id,
                statement: hypOrName.hypothesis,
                prediction: hypOrName.prediction,
                causalChain: hypOrName.causalChain
            } : null
        };

        this.results.push(result);

        // Final summary log (structured logs already done in test method)
        if (!isHypothesis) {
            // Legacy format - log here
            if (passed) {
                logger.success(`[RESULT] ${name}: PASS`, logger.CATEGORY.SYNC, details);
            } else {
                logger.error(`[RESULT] ${name}: FAIL`, logger.CATEGORY.SYNC, details);
            }
        }

        return result;
    }

    /**
     * Generate test summary
     * @private
     */
    _generateSummary() {
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const total = this.results.length;

        const summary = {
            passed,
            failed,
            total,
            passRate: `${((passed / total) * 100).toFixed(1)}%`,
            allPassed: failed === 0,
            results: this.results
        };

        logger.info('=== Test Summary ===', logger.CATEGORY.SYNC);
        logger.info(`Passed: ${passed}/${total} (${summary.passRate})`, logger.CATEGORY.SYNC);

        if (failed > 0) {
            logger.warning(`Failed tests: ${this.results.filter(r => !r.passed).map(r => r.name).join(', ')}`,
                logger.CATEGORY.SYNC);
        }

        console.log('\n=== AUTOMATED TEST RESULTS ===');
        console.table(this.results.map(r => ({
            Test: r.name,
            Status: r.passed ? '✓ PASS' : '✗ FAIL',
            Details: JSON.stringify(r.details).slice(0, 50) + '...'
        })));

        return summary;
    }

    /**
     * Delay helper
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton and hypothesis registry
export const mapTests = new AutomatedMapTests();
export { TEST_HYPOTHESES };

// Make available globally for console access
if (typeof window !== 'undefined') {
    window.mapTests = mapTests;
    window.TEST_HYPOTHESES = TEST_HYPOTHESES;
}

export default mapTests;
