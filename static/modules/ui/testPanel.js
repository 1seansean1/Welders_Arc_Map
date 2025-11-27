/**
 * Test Panel UI Module - Hypothesis-Driven Testing
 *
 * Provides UI for running automated tests following
 * scientific debugging methodology. Includes:
 * - Test list with hypothesis IDs
 * - Expandable detail view (click row)
 * - Ablation testing controls
 * - Result persistence and history
 * - Export functionality (JSON/CSV)
 */

import logger from '../utils/logger.js';
import { mapTests, TEST_HYPOTHESES } from '../map/automated-tests.js';
import { testResults } from '../test/testResults.js';
import { TEST_REGISTRY as ALL_HYPOTHESES } from '../test/testRegistry.js';

// Test list - maps UI IDs to hypothesis IDs and test functions
const TEST_LIST = [
    // Map tests (existing)
    { id: 'zoom-offset', hypId: 'H-DRIFT-1', fn: () => mapTests.testInitialZoomOffset() },
    { id: 'time-sync', hypId: 'H-TIME-1', fn: () => mapTests.testTimeSync() },
    { id: 'pan-sync', hypId: 'H-SYNC-PAN', fn: () => mapTests.testPanSync() },
    { id: 'zoom-sync', hypId: 'H-SYNC-ZOOM', fn: () => mapTests.testZoomSync() },
    { id: 'rapid-pan', hypId: 'H-PERF-1', fn: () => mapTests.testRapidPan() },
    { id: 'batching', hypId: 'H-BATCH-1', fn: () => mapTests.testSetPropsBatching() },
    // State tests (new)
    { id: 'state-immutable', hypId: 'H-STATE-1', fn: () => runRegistryTest('H-STATE-1') },
    { id: 'state-selection', hypId: 'H-STATE-2', fn: () => runRegistryTest('H-STATE-2') },
    { id: 'state-pending', hypId: 'H-STATE-3', fn: () => runRegistryTest('H-STATE-3') },
    { id: 'state-sort', hypId: 'H-STATE-4', fn: () => runRegistryTest('H-STATE-4') },
    // Event tests (new)
    { id: 'event-delivery', hypId: 'H-EVENT-1', fn: () => runRegistryTest('H-EVENT-1') },
    { id: 'event-once', hypId: 'H-EVENT-2', fn: () => runRegistryTest('H-EVENT-2') },
    // UI tests (new)
    { id: 'ui-panel', hypId: 'H-UI-1', fn: () => runRegistryTest('H-UI-1') },
    { id: 'ui-sections', hypId: 'H-UI-2', fn: () => runRegistryTest('H-UI-2') },
    { id: 'ui-highlight', hypId: 'H-UI-4', fn: () => runRegistryTest('H-UI-4') },
    // Validation tests (new)
    { id: 'valid-coords', hypId: 'H-VALID-1', fn: () => runRegistryTest('H-VALID-1') },
    { id: 'valid-tle', hypId: 'H-VALID-2', fn: () => runRegistryTest('H-VALID-2') },
    // Satellite tests (new)
    { id: 'sat-selection', hypId: 'H-SAT-1', fn: () => runRegistryTest('H-SAT-1') },
    { id: 'sat-propagation', hypId: 'H-SAT-2', fn: () => runRegistryTest('H-SAT-2') },
    { id: 'chevron-bearing', hypId: 'H-CHEV-1', fn: () => runRegistryTest('H-CHEV-1') },
    { id: 'glow-crossing', hypId: 'H-GLOW-1', fn: () => runRegistryTest('H-GLOW-1') },
    { id: 'glow-fade', hypId: 'H-GLOW-2', fn: () => runRegistryTest('H-GLOW-2') },
    { id: 'glow-toggle', hypId: 'H-GLOW-3', fn: () => runRegistryTest('H-GLOW-3') }
];

let isRunning = false;
let expandedTestId = null;
let sortColumn = null;  // 'status', 'id', 'name'
let sortDirection = null;  // 'asc', 'desc', null

/**
 * Run a test from the registry
 */
async function runRegistryTest(hypId) {
    const hyp = ALL_HYPOTHESES[hypId];
    if (!hyp || !hyp.testFn) {
        return { passed: false, error: 'Test not implemented', hypothesisId: hypId };
    }

    // Log hypothesis
    logger.info(`[HYPOTHESIS] ${hyp.id}: ${hyp.hypothesis}`, logger.CATEGORY.SYNC);
    logger.info(`[PREDICT] ${hyp.prediction}`, logger.CATEGORY.SYNC);

    try {
        const result = await hyp.testFn();

        // Log result
        if (result.passed) {
            logger.success(`[VALIDATE] PASS - ${hyp.prediction}`, logger.CATEGORY.SYNC);
        } else if (result.skipped) {
            logger.info(`[SKIP] ${result.reason || 'Skipped'}`, logger.CATEGORY.SYNC);
        } else {
            logger.error(`[VALIDATE] FAIL - Prediction not met`, logger.CATEGORY.SYNC);
        }

        return {
            ...result,
            hypothesisId: hypId,
            name: `${hyp.id}: ${hyp.name}`
        };
    } catch (error) {
        logger.error(`[ERROR] ${hyp.id}: ${error.message}`, logger.CATEGORY.SYNC);
        return { passed: false, error: error.message, hypothesisId: hypId };
    }
}

/**
 * Initialize test panel UI
 */
export function initTestPanel() {
    const contentSection = document.getElementById('content-tests');
    if (!contentSection) {
        logger.warning('Tests content section not found', logger.CATEGORY.SYNC);
        return;
    }

    contentSection.innerHTML = createTestPanelHTML();
    setupEventListeners();
    logger.info('Test panel initialized', logger.CATEGORY.SYNC);
}

/**
 * Get hypothesis info for a test
 */
function getHypothesis(hypId) {
    return ALL_HYPOTHESES[hypId] || TEST_HYPOTHESES[hypId] || { id: hypId, name: hypId, hypothesis: 'Unknown' };
}

/**
 * Get sort indicator for column header
 */
function getSortIndicator(column) {
    if (sortColumn !== column) return '';
    return sortDirection === 'asc' ? ' ▲' : sortDirection === 'desc' ? ' ▼' : '';
}

/**
 * Get sorted test list based on current sort state
 */
function getSortedTestList() {
    if (!sortColumn || !sortDirection) {
        return TEST_LIST;
    }

    const lastRun = testResults.getLastRun();
    const resultMap = {};
    if (lastRun?.results) {
        lastRun.results.forEach(r => {
            resultMap[r.hypothesisId] = r.passed ? 'pass' : 'fail';
        });
    }

    return [...TEST_LIST].sort((a, b) => {
        let valA, valB;

        switch (sortColumn) {
            case 'status':
                valA = resultMap[a.hypId] || '';
                valB = resultMap[b.hypId] || '';
                break;
            case 'id':
                valA = a.hypId;
                valB = b.hypId;
                break;
            case 'name':
                valA = getHypothesis(a.hypId).name;
                valB = getHypothesis(b.hypId).name;
                break;
            default:
                return 0;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

/**
 * Handle column header click for 3-click sorting
 */
function handleColumnSort(column) {
    if (sortColumn !== column) {
        // New column - start with ascending
        sortColumn = column;
        sortDirection = 'asc';
    } else {
        // Same column - cycle: asc -> desc -> none
        if (sortDirection === 'asc') {
            sortDirection = 'desc';
        } else if (sortDirection === 'desc') {
            sortDirection = null;
            sortColumn = null;
        }
    }

    // Re-render table body
    refreshTableBody();
}

/**
 * Create test panel HTML
 */
function createTestPanelHTML() {
    const lastRun = testResults.getLastRun();

    return `
        <div class="test-panel">
            <!-- Test table -->
            <div class="sensor-table-wrapper" style="max-height: 220px;">
                <table class="sensor-table" id="test-table">
                    <thead>
                        <tr>
                            <th class="col-status sortable-header" data-sort="status" style="width: 28px; cursor: pointer;">St${getSortIndicator('status')}</th>
                            <th class="col-hypid sortable-header" data-sort="id" style="width: 72px; text-align: left; padding-left: 4px; cursor: pointer;">ID${getSortIndicator('id')}</th>
                            <th class="col-testname sortable-header" data-sort="name" style="text-align: left; cursor: pointer;">Name${getSortIndicator('name')}</th>
                            <th class="col-run" style="width: 32px;">Run</th>
                        </tr>
                    </thead>
                    <tbody id="test-table-body">
                        ${getSortedTestList().map(test => {
                            const hyp = getHypothesis(test.hypId);
                            return `
                            <tr class="test-row" data-test-id="${test.id}">
                                <td class="col-status"><span class="test-status-icon" id="status-${test.id}">-</span></td>
                                <td class="col-hypid" style="text-align: left; padding-left: 4px;">${hyp.id}</td>
                                <td class="col-testname" style="text-align: left;">${hyp.name}</td>
                                <td class="col-run"><button class="test-run-btn" data-test-id="${test.id}">▶</button></td>
                            </tr>
                            <tr class="test-details-row" id="details-row-${test.id}" style="display: none;">
                                <td colspan="4" class="test-details-cell">
                                    <div class="test-details-content">
                                        <div class="test-detail-item"><span class="detail-label">H:</span> ${hyp.hypothesis}</div>
                                        <div class="test-detail-item"><span class="detail-label">P:</span> ${hyp.prediction}</div>
                                    </div>
                                </td>
                            </tr>
                        `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Status bar -->
            <div class="test-history-bar">
                <span class="history-label">Last:</span>
                <span class="history-info" id="history-info">
                    ${lastRun ?
                        `<span class="${lastRun.summary?.failed > 0 ? 'fail-text' : 'pass-text'}">${lastRun.summary?.passed}/${lastRun.summary?.total}</span>` :
                        '<span class="text-muted">none</span>'}
                </span>
                <span class="history-status" id="test-status">Ready</span>
            </div>

            <!-- Action buttons at bottom (matching Satellite/Sensor panels) -->
            <div class="sensor-actions">
                <button class="sensor-action-btn sensor-add-btn" id="run-all-tests-btn">Run All</button>
                <button class="sensor-action-btn" id="clear-history-btn">Clear</button>
                <button class="sensor-action-btn" id="download-report-btn">Download</button>
            </div>
        </div>

        <style>
            .test-panel {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            /* Status icon in table */
            .test-status-icon {
                display: inline-block;
                width: 18px;
                text-align: center;
                font-family: var(--font-mono);
                font-size: 8px;
                color: var(--text-muted);
            }

            .test-status-icon.pass { color: #7a7; }
            .test-status-icon.fail { color: #a77; }

            /* Run button in table */
            .test-run-btn {
                width: 22px;
                height: 16px;
                border: 1px solid var(--border-color);
                border-radius: 2px;
                background: var(--bg-tertiary);
                color: var(--text-secondary);
                font-size: 7px;
                cursor: pointer;
                padding: 0;
            }

            .test-run-btn:hover {
                border-color: var(--accent-blue-grey);
                color: var(--text-primary);
            }

            .test-run-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            /* Test row click styling */
            .test-row {
                cursor: pointer;
            }

            /* Details row */
            .test-details-row {
                background: var(--bg-secondary);
            }

            .test-details-cell {
                padding: 4px 6px !important;
                border-bottom: 1px solid var(--border-color) !important;
            }

            .test-details-content {
                font-size: 7px;
                line-height: 1.4;
            }

            .test-detail-item {
                color: var(--text-secondary);
                margin-bottom: 2px;
            }

            .test-detail-item .detail-label {
                color: var(--text-muted);
                font-weight: 600;
            }

            /* History bar */
            .test-history-bar {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 3px 4px;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 2px;
                font-size: 8px;
                font-family: var(--font-mono);
            }

            .history-label {
                color: var(--text-muted);
            }

            .history-info {
                flex: 1;
            }

            .history-status {
                color: var(--text-secondary);
            }

            .pass-text { color: #7a7; }
            .fail-text { color: #a77; }
            .text-muted { color: var(--text-muted); }

            /* Sortable headers */
            .sortable-header:hover {
                background: var(--bg-tertiary);
            }
        </style>
    `;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    document.getElementById('run-all-tests-btn')?.addEventListener('click', runAllTests);
    document.getElementById('clear-history-btn')?.addEventListener('click', () => {
        testResults.clearHistory();
        updateHistoryDisplay();
        // Reset all status indicators
        TEST_LIST.forEach(test => updateTestStatus(test.id, '', '-'));
    });
    document.getElementById('download-report-btn')?.addEventListener('click', downloadReport);

    // Column header sorting
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', () => {
            handleColumnSort(header.dataset.sort);
        });
    });

    setupTableEventListeners();
}

/**
 * Setup table row event listeners (called after table refresh)
 */
function setupTableEventListeners() {
    // Individual test run buttons
    document.querySelectorAll('.test-run-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            runSingleTest(e.target.dataset.testId);
        });
    });

    // Row click to expand/collapse details
    document.querySelectorAll('.test-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.classList.contains('test-run-btn')) return;
            toggleDetails(row.dataset.testId);
        });
    });
}

/**
 * Update history display
 */
function updateHistoryDisplay() {
    const lastRun = testResults.getLastRun();

    const historyInfo = document.getElementById('history-info');
    if (historyInfo) {
        if (lastRun) {
            const statusClass = lastRun.summary?.failed > 0 ? 'fail-text' : 'pass-text';
            historyInfo.innerHTML = `<span class="${statusClass}">${lastRun.summary?.passed}/${lastRun.summary?.total}</span>`;
        } else {
            historyInfo.innerHTML = '<span class="text-muted">none</span>';
        }
    }
}

/**
 * Toggle detail view for a test
 */
function toggleDetails(testId) {
    const detailsRow = document.getElementById(`details-row-${testId}`);
    if (!detailsRow) return;

    // Collapse previously expanded row
    if (expandedTestId && expandedTestId !== testId) {
        const prevRow = document.getElementById(`details-row-${expandedTestId}`);
        if (prevRow) prevRow.style.display = 'none';
    }

    // Toggle current row
    const isHidden = detailsRow.style.display === 'none';
    detailsRow.style.display = isHidden ? 'table-row' : 'none';
    expandedTestId = isHidden ? testId : null;
}

/**
 * Refresh table body (for sorting)
 */
function refreshTableBody() {
    const tbody = document.getElementById('test-table-body');
    const thead = document.querySelector('#test-table thead tr');
    if (!tbody || !thead) return;

    // Update header sort indicators
    thead.innerHTML = `
        <th class="col-status sortable-header" data-sort="status" style="width: 28px; cursor: pointer;">St${getSortIndicator('status')}</th>
        <th class="col-hypid sortable-header" data-sort="id" style="width: 72px; text-align: left; padding-left: 4px; cursor: pointer;">ID${getSortIndicator('id')}</th>
        <th class="col-testname sortable-header" data-sort="name" style="text-align: left; cursor: pointer;">Name${getSortIndicator('name')}</th>
        <th class="col-run" style="width: 32px;">Run</th>
    `;

    // Re-attach header listeners
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', () => {
            handleColumnSort(header.dataset.sort);
        });
    });

    // Get current status from DOM before refreshing
    const statusMap = {};
    TEST_LIST.forEach(test => {
        const statusEl = document.getElementById(`status-${test.id}`);
        if (statusEl) {
            statusMap[test.id] = {
                text: statusEl.textContent,
                className: statusEl.className
            };
        }
    });

    // Regenerate table body
    tbody.innerHTML = getSortedTestList().map(test => {
        const hyp = getHypothesis(test.hypId);
        const status = statusMap[test.id] || { text: '-', className: 'test-status-icon' };
        return `
            <tr class="test-row" data-test-id="${test.id}">
                <td class="col-status"><span class="${status.className}" id="status-${test.id}">${status.text}</span></td>
                <td class="col-hypid" style="text-align: left; padding-left: 4px;">${hyp.id}</td>
                <td class="col-testname" style="text-align: left;">${hyp.name}</td>
                <td class="col-run"><button class="test-run-btn" data-test-id="${test.id}">▶</button></td>
            </tr>
            <tr class="test-details-row" id="details-row-${test.id}" style="display: none;">
                <td colspan="4" class="test-details-cell">
                    <div class="test-details-content">
                        <div class="test-detail-item"><span class="detail-label">H:</span> ${hyp.hypothesis}</div>
                        <div class="test-detail-item"><span class="detail-label">P:</span> ${hyp.prediction}</div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Reset expanded state and re-attach listeners
    expandedTestId = null;
    setupTableEventListeners();
}

/**
 * Download detailed test report
 */
function downloadReport() {
    const lastRun = testResults.getLastRun();
    const allRuns = testResults.getAllRuns();

    if (!lastRun) {
        logger.warning('No test results to download', logger.CATEGORY.SYNC);
        return;
    }

    // Build comprehensive report
    const report = {
        generated: new Date().toISOString(),
        summary: {
            lastRun: lastRun.timestamp,
            passed: lastRun.summary.passed,
            failed: lastRun.summary.failed,
            total: lastRun.summary.total,
            passRate: ((lastRun.summary.passed / lastRun.summary.total) * 100).toFixed(1) + '%',
            totalDuration: lastRun.results.reduce((sum, r) => sum + (r.duration || 0), 0) + 'ms'
        },
        tests: lastRun.results.map(result => {
            const hyp = getHypothesis(result.hypothesisId);
            return {
                id: result.hypothesisId,
                name: hyp.name,
                hypothesis: hyp.hypothesis,
                prediction: hyp.prediction,
                status: result.passed ? 'PASS' : 'FAIL',
                duration: result.duration + 'ms',
                details: result.details
            };
        }),
        history: {
            totalRuns: allRuns.length,
            runs: allRuns.slice(0, 10).map(run => ({
                timestamp: run.timestamp,
                passed: run.summary?.passed,
                failed: run.summary?.failed,
                total: run.summary?.total
            }))
        }
    };

    // Create and download file
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    logger.info('Test report downloaded', logger.CATEGORY.SYNC);
}

/**
 * Run all tests
 */
async function runAllTests() {
    if (isRunning) return;

    isRunning = true;
    updateStatus('Running...');
    disableButtons(true);

    logger.info('=== STARTING HYPOTHESIS TESTS ===', logger.CATEGORY.SYNC);

    // Start a new run
    testResults.startRun();

    // Reset all status indicators
    TEST_LIST.forEach(test => updateTestStatus(test.id, '', '...'));

    for (const test of TEST_LIST) {
        try {
            updateTestStatus(test.id, '', '...');
            const startTime = performance.now();
            const result = await test.fn();
            const duration = Math.round(performance.now() - startTime);

            // Add to results
            testResults.addResult({
                hypothesisId: test.hypId,
                name: result.name || `${test.hypId}: ${getHypothesis(test.hypId).name}`,
                passed: result.passed,
                details: result.details || result,
                duration
            });

            if (result.passed) {
                updateTestStatus(test.id, 'pass', 'OK');
            } else if (result.skipped) {
                updateTestStatus(test.id, '', 'SKIP');
            } else {
                updateTestStatus(test.id, 'fail', 'FAIL');
            }
        } catch (error) {
            updateTestStatus(test.id, 'fail', 'ERR');
            testResults.addResult({
                hypothesisId: test.hypId,
                name: `${test.hypId}: ${getHypothesis(test.hypId).name}`,
                passed: false,
                details: { error: error.message },
                duration: 0
            });
            logger.error(`[ERROR] ${test.hypId}: ${error.message}`, logger.CATEGORY.SYNC);
        }

        await delay(100);
    }

    // Finish run and save
    const run = testResults.finishRun();
    updateStatus(`${run.summary.passed}/${run.summary.total} Passed`);
    updateHistoryDisplay();

    logger.info(`=== TEST SUMMARY: ${run.summary.passed}/${run.summary.total} PASSED ===`, logger.CATEGORY.SYNC);

    disableButtons(false);
    isRunning = false;
}

/**
 * Run a single test
 */
async function runSingleTest(testId) {
    if (isRunning) return;

    const test = TEST_LIST.find(t => t.id === testId);
    if (!test) return;

    isRunning = true;
    updateTestStatus(testId, '', '...');
    disableButtons(true);

    try {
        const result = await test.fn();
        if (result.passed) {
            updateTestStatus(testId, 'pass', 'OK');
        } else if (result.skipped) {
            updateTestStatus(testId, '', 'SKIP');
        } else {
            updateTestStatus(testId, 'fail', 'FAIL');
        }
    } catch (error) {
        updateTestStatus(testId, 'fail', 'ERR');
        logger.error(`[ERROR] ${test.hypId}: ${error.message}`, logger.CATEGORY.SYNC);
    }

    disableButtons(false);
    isRunning = false;
}

function updateStatus(text) {
    const el = document.getElementById('test-status');
    if (el) el.textContent = text;
}

function updateTestStatus(testId, state, text) {
    const el = document.getElementById(`status-${testId}`);
    if (el) {
        el.textContent = text;
        el.className = 'test-status-icon' + (state ? ' ' + state : '');
    }
}

function disableButtons(disabled) {
    ['run-all-tests-btn', 'clear-history-btn', 'download-report-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = disabled;
    });
    document.querySelectorAll('.test-run-btn').forEach(btn => btn.disabled = disabled);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default { initTestPanel };
