/**
 * Test Results Persistence Module
 *
 * Stores and retrieves test results from localStorage.
 * Provides historical tracking, regression detection, and export.
 *
 * Storage Format:
 *   - Key: 'wa_map_test_results'
 *   - Max runs: 50 (older runs pruned)
 *   - Version: 1.0 (for migration support)
 */

import logger from '../utils/logger.js';

const STORAGE_KEY = 'wa_map_test_results';
const STORAGE_VERSION = '1.0';
const MAX_RUNS = 50;

class TestResults {
    constructor() {
        this.currentRun = null;
        this._loadFromStorage();
    }

    /**
     * Load results from localStorage
     */
    _loadFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                if (data.version === STORAGE_VERSION) {
                    this.runs = data.runs || [];
                } else {
                    // Version mismatch - reset
                    logger.warning('[TEST] Storage version mismatch, resetting history', logger.CATEGORY.SYNC);
                    this.runs = [];
                }
            } else {
                this.runs = [];
            }
        } catch (e) {
            logger.error('[TEST] Failed to load results: ' + e.message, logger.CATEGORY.SYNC);
            this.runs = [];
        }
    }

    /**
     * Save results to localStorage
     */
    _saveToStorage() {
        try {
            const data = {
                version: STORAGE_VERSION,
                runs: this.runs.slice(0, MAX_RUNS) // Keep only latest
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            logger.error('[TEST] Failed to save results: ' + e.message, logger.CATEGORY.SYNC);
        }
    }

    /**
     * Start a new test run
     * @returns {string} Run ID
     */
    startRun() {
        const timestamp = new Date();
        const id = `run-${timestamp.toISOString().replace(/[:.]/g, '-')}`;

        this.currentRun = {
            id,
            timestamp: timestamp.toISOString(),
            startTime: performance.now(),
            environment: {
                userAgent: navigator.userAgent,
                screenSize: `${window.innerWidth}x${window.innerHeight}`,
                devicePixelRatio: window.devicePixelRatio
            },
            results: [],
            summary: null
        };

        logger.info(`[TEST] Started run: ${id}`, logger.CATEGORY.SYNC);
        return id;
    }

    /**
     * Add a test result to current run
     * @param {Object} result - Test result object
     */
    addResult(result) {
        if (!this.currentRun) {
            this.startRun();
        }

        this.currentRun.results.push({
            ...result,
            duration: result.duration || 0
        });
    }

    /**
     * Finish current run and save
     * @returns {Object} Run summary
     */
    finishRun() {
        if (!this.currentRun) return null;

        const endTime = performance.now();
        this.currentRun.duration = Math.round(endTime - this.currentRun.startTime);

        // Calculate summary
        const results = this.currentRun.results;
        this.currentRun.summary = {
            total: results.length,
            passed: results.filter(r => r.passed).length,
            failed: results.filter(r => !r.passed).length,
            skipped: results.filter(r => r.details?.skipped).length
        };

        // Add to runs (newest first)
        this.runs.unshift(this.currentRun);

        // Prune old runs
        if (this.runs.length > MAX_RUNS) {
            this.runs = this.runs.slice(0, MAX_RUNS);
        }

        // Save
        this._saveToStorage();

        // Detect regressions
        const regressions = this.detectRegressions();
        if (regressions.length > 0) {
            logger.warning(`[TEST] ${regressions.length} regression(s) detected!`, logger.CATEGORY.SYNC);
            regressions.forEach(r => {
                logger.error(`[REGRESSION] ${r.hypothesisId}: was PASS, now FAIL`, logger.CATEGORY.SYNC);
            });
        }

        const run = this.currentRun;
        this.currentRun = null;

        logger.info(`[TEST] Run complete: ${run.summary.passed}/${run.summary.total} passed`, logger.CATEGORY.SYNC);
        return run;
    }

    /**
     * Get the most recent run
     * @returns {Object|null} Most recent run
     */
    getLastRun() {
        return this.runs[0] || null;
    }

    /**
     * Get all runs
     * @returns {Array} All stored runs
     */
    getAllRuns() {
        return this.runs;
    }

    /**
     * Get runs count
     * @returns {number} Number of stored runs
     */
    getRunCount() {
        return this.runs.length;
    }

    /**
     * Get run by ID
     * @param {string} id - Run ID
     * @returns {Object|null} Run or null
     */
    getRunById(id) {
        return this.runs.find(r => r.id === id) || null;
    }

    /**
     * Detect regressions by comparing current to previous run
     * @returns {Array} List of regressions
     */
    detectRegressions() {
        if (this.runs.length < 2) return [];

        const current = this.runs[0];
        const previous = this.runs[1];
        const regressions = [];

        for (const result of current.results) {
            const prev = previous.results.find(r => r.hypothesisId === result.hypothesisId);

            if (prev && prev.passed && !result.passed) {
                regressions.push({
                    hypothesisId: result.hypothesisId,
                    name: result.name,
                    type: 'pass_to_fail',
                    previous: prev,
                    current: result
                });
            }
        }

        return regressions;
    }

    /**
     * Get pass rate trend (last N runs)
     * @param {number} count - Number of runs to include
     * @returns {Array} Array of pass rates
     */
    getPassRateTrend(count = 10) {
        return this.runs.slice(0, count).map(run => ({
            id: run.id,
            timestamp: run.timestamp,
            passRate: run.summary ? run.summary.passed / run.summary.total : 0,
            passed: run.summary?.passed || 0,
            total: run.summary?.total || 0
        }));
    }

    /**
     * Get test history for a specific hypothesis
     * @param {string} hypothesisId - Hypothesis ID
     * @param {number} count - Number of runs to check
     * @returns {Array} History of pass/fail for this test
     */
    getTestHistory(hypothesisId, count = 10) {
        const history = [];

        for (const run of this.runs.slice(0, count)) {
            const result = run.results.find(r => r.hypothesisId === hypothesisId);
            if (result) {
                history.push({
                    runId: run.id,
                    timestamp: run.timestamp,
                    passed: result.passed,
                    details: result.details
                });
            }
        }

        return history;
    }

    /**
     * Export all runs as JSON
     * @returns {string} JSON string
     */
    exportJSON() {
        return JSON.stringify({
            version: STORAGE_VERSION,
            exportedAt: new Date().toISOString(),
            runs: this.runs
        }, null, 2);
    }

    /**
     * Export summary as CSV
     * @returns {string} CSV string
     */
    exportCSV() {
        const headers = ['Run ID', 'Timestamp', 'Duration (ms)', 'Total', 'Passed', 'Failed', 'Pass Rate'];
        const rows = this.runs.map(run => [
            run.id,
            run.timestamp,
            run.duration,
            run.summary?.total || 0,
            run.summary?.passed || 0,
            run.summary?.failed || 0,
            run.summary ? ((run.summary.passed / run.summary.total) * 100).toFixed(1) + '%' : 'N/A'
        ]);

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    /**
     * Download export file
     * @param {string} format - 'json' or 'csv'
     */
    download(format = 'json') {
        const content = format === 'csv' ? this.exportCSV() : this.exportJSON();
        const filename = `test-results-${new Date().toISOString().slice(0, 10)}.${format}`;
        const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        logger.success(`[TEST] Exported ${filename}`, logger.CATEGORY.SYNC);
    }

    /**
     * Clear all stored results
     */
    clearHistory() {
        this.runs = [];
        this._saveToStorage();
        logger.info('[TEST] History cleared', logger.CATEGORY.SYNC);
    }

    /**
     * Compare two runs
     * @param {string} runId1 - First run ID
     * @param {string} runId2 - Second run ID
     * @returns {Object} Comparison result
     */
    compareRuns(runId1, runId2) {
        const run1 = this.getRunById(runId1);
        const run2 = this.getRunById(runId2);

        if (!run1 || !run2) {
            return { error: 'Run not found' };
        }

        const comparison = {
            run1: { id: run1.id, timestamp: run1.timestamp, summary: run1.summary },
            run2: { id: run2.id, timestamp: run2.timestamp, summary: run2.summary },
            differences: []
        };

        // Find differences
        for (const r1 of run1.results) {
            const r2 = run2.results.find(r => r.hypothesisId === r1.hypothesisId);

            if (!r2) {
                comparison.differences.push({
                    hypothesisId: r1.hypothesisId,
                    name: r1.name,
                    change: 'added',
                    run1: r1.passed,
                    run2: null
                });
            } else if (r1.passed !== r2.passed) {
                comparison.differences.push({
                    hypothesisId: r1.hypothesisId,
                    name: r1.name,
                    change: r1.passed ? 'improved' : 'regressed',
                    run1: r1.passed,
                    run2: r2.passed
                });
            }
        }

        return comparison;
    }
}

// Export singleton
export const testResults = new TestResults();

// Make available globally
if (typeof window !== 'undefined') {
    window.testResults = testResults;
}

export default testResults;
