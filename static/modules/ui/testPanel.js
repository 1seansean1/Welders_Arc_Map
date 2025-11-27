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
import { diagnostics } from '../map/diagnostics.js';
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
let showHistory = false;

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
 * Create test panel HTML
 */
function createTestPanelHTML() {
    const lastRun = testResults.getLastRun();
    const runCount = testResults.getRunCount();

    return `
        <div class="test-panel">
            <!-- Action buttons row -->
            <div class="sensor-actions" style="margin-bottom: 6px;">
                <button class="sensor-action-btn sensor-add-btn" id="run-all-tests-btn">Run All</button>
                <button class="sensor-action-btn sensor-edit-btn" id="run-ablation-btn">Ablation</button>
                <button class="sensor-action-btn sensor-delete-btn" id="save-baseline-btn">Baseline</button>
            </div>

            <!-- Test table -->
            <div class="sensor-table-wrapper" style="max-height: 220px;">
                <table class="sensor-table" id="test-table">
                    <thead>
                        <tr>
                            <th class="col-status" style="width: 28px;">St</th>
                            <th class="col-hypid" style="width: 72px; text-align: left; padding-left: 4px;">ID</th>
                            <th class="col-testname" style="text-align: left;">Name</th>
                            <th class="col-run" style="width: 32px;">Run</th>
                        </tr>
                    </thead>
                    <tbody id="test-table-body">
                        ${TEST_LIST.map(test => {
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

            <!-- History summary -->
            <div class="test-history-bar">
                <span class="history-label">History:</span>
                <span class="history-info" id="history-info">
                    ${lastRun ?
                        `<span class="${lastRun.summary?.failed > 0 ? 'fail-text' : 'pass-text'}">${lastRun.summary?.passed}/${lastRun.summary?.total}</span>` :
                        '<span class="text-muted">none</span>'}
                </span>
                <span class="history-status" id="test-status">Ready</span>
            </div>

            <!-- History action buttons -->
            <div class="sensor-actions">
                <button class="sensor-action-btn" id="toggle-history-btn">${runCount} runs</button>
                <button class="sensor-action-btn" id="export-json-btn">JSON</button>
                <button class="sensor-action-btn" id="export-csv-btn">CSV</button>
                <button class="sensor-action-btn" id="clear-history-btn">Clear</button>
            </div>

            <!-- History detail (hidden by default) -->
            <div class="test-history-detail" id="history-detail" style="display: none;">
                ${createHistoryDetailHTML()}
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

            /* History detail panel */
            .test-history-detail {
                max-height: 60px;
                overflow-y: auto;
                background: var(--bg-primary);
                border: 1px solid var(--border-color);
                border-radius: 2px;
            }

            .history-run-item {
                display: flex;
                justify-content: space-between;
                padding: 2px 4px;
                font-size: 7px;
                font-family: var(--font-mono);
                color: var(--text-secondary);
                border-bottom: 1px solid #2a2a2a;
            }

            .history-run-item:last-child {
                border-bottom: none;
            }
        </style>
    `;
}

/**
 * Format timestamp for display (compact)
 */
function formatTimestamp(isoString) {
    const date = new Date(isoString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${mins}`;
}

/**
 * Create history detail HTML
 */
function createHistoryDetailHTML() {
    const runs = testResults.getAllRuns().slice(0, 10);

    if (runs.length === 0) {
        return '<div class="history-run-item">No history</div>';
    }

    return runs.map(run => {
        const passRate = run.summary ? ((run.summary.passed / run.summary.total) * 100).toFixed(0) : 0;
        const statusClass = run.summary?.failed > 0 ? 'fail-text' : 'pass-text';

        return `
            <div class="history-run-item">
                <span>${formatTimestamp(run.timestamp)}</span>
                <span class="${statusClass}">${run.summary?.passed}/${run.summary?.total} (${passRate}%)</span>
            </div>
        `;
    }).join('');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    document.getElementById('run-all-tests-btn')?.addEventListener('click', runAllTests);
    document.getElementById('run-ablation-btn')?.addEventListener('click', runAblation);
    document.getElementById('save-baseline-btn')?.addEventListener('click', saveBaseline);
    document.getElementById('toggle-history-btn')?.addEventListener('click', toggleHistory);
    document.getElementById('export-json-btn')?.addEventListener('click', () => testResults.download('json'));
    document.getElementById('export-csv-btn')?.addEventListener('click', () => testResults.download('csv'));
    document.getElementById('clear-history-btn')?.addEventListener('click', () => {
        testResults.clearHistory();
        updateHistoryDisplay();
    });

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
 * Toggle history detail view
 */
function toggleHistory() {
    showHistory = !showHistory;
    const detailEl = document.getElementById('history-detail');
    if (detailEl) {
        detailEl.style.display = showHistory ? 'block' : 'none';
        if (showHistory) detailEl.innerHTML = createHistoryDetailHTML();
    }
}

/**
 * Update history display
 */
function updateHistoryDisplay() {
    const lastRun = testResults.getLastRun();
    const runCount = testResults.getRunCount();

    const historyInfo = document.getElementById('history-info');
    if (historyInfo) {
        if (lastRun) {
            const statusClass = lastRun.summary?.failed > 0 ? 'fail-text' : 'pass-text';
            historyInfo.innerHTML = `<span class="${statusClass}">${lastRun.summary?.passed}/${lastRun.summary?.total}</span>`;
        } else {
            historyInfo.innerHTML = '<span class="text-muted">none</span>';
        }
    }

    const toggleBtn = document.getElementById('toggle-history-btn');
    if (toggleBtn) toggleBtn.textContent = `${runCount} runs`;

    if (showHistory) {
        const detailEl = document.getElementById('history-detail');
        if (detailEl) detailEl.innerHTML = createHistoryDetailHTML();
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

/**
 * Run ablation study
 */
async function runAblation() {
    if (isRunning) return;

    isRunning = true;
    updateStatus('Ablation...');
    disableButtons(true);

    logger.info('=== ABLATION STUDY ===', logger.CATEGORY.SYNC);

    try {
        const results = await mapTests.runAblationStudy();

        if (results.ablation.hasBaseline) {
            if (results.ablation.improved) {
                logger.success('[ABLATION] Improvement confirmed vs baseline', logger.CATEGORY.SYNC);
                updateStatus('Ablation: PASS');
            } else {
                logger.warning('[ABLATION] No improvement vs baseline', logger.CATEGORY.SYNC);
                updateStatus('Ablation: CHECK');
            }
        } else {
            logger.warning('[ABLATION] No baseline - save baseline first', logger.CATEGORY.SYNC);
            updateStatus('No baseline');
        }
    } catch (error) {
        logger.error(`[ABLATION ERROR] ${error.message}`, logger.CATEGORY.SYNC);
        updateStatus('Ablation: ERR');
    }

    disableButtons(false);
    isRunning = false;
}

/**
 * Save current state as baseline
 */
function saveBaseline() {
    updateStatus('Recording...');
    diagnostics.startRecording();

    logger.info('[BASELINE] Recording 1s of metrics...', logger.CATEGORY.SYNC);

    setTimeout(() => {
        const report = diagnostics.stopRecording();
        diagnostics.saveAsBaseline(report);
        updateStatus('Baseline saved');
        logger.success('[BASELINE] Saved for ablation comparison', logger.CATEGORY.SYNC);
    }, 1000);
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
    ['run-all-tests-btn', 'run-ablation-btn', 'save-baseline-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = disabled;
    });
    document.querySelectorAll('.test-run-btn').forEach(btn => btn.disabled = disabled);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default { initTestPanel };
