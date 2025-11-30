/**
 * Lambert Panel Module - UI for Lambert transfer analysis
 *
 * DEPENDENCIES: analysisState.js, satelliteState.js, listState.js, timeState.js, eventBus.js, logger.js, transferCalculator.js
 * PATTERN: Event-driven UI with state synchronization
 *
 * Features:
 * - Chaser/target satellite selection from visible satellites
 * - Time of flight (TOF) slider and input
 * - Revolution count (M) button selection
 * - Compute transfer button
 * - Results display (delta-V values)
 * - Status/error messaging
 * - Event-driven updates
 *
 * Events Subscribed:
 * - analysis:lambert:enabled - Panel visibility toggle
 * - analysis:lambert:computed - Display computed results
 * - analysis:lambert:cleared - Clear results display
 * - satellite:loaded - Update satellite dropdowns
 * - list:visibility:changed - Update satellite dropdowns
 */

import eventBus from '../events/eventBus.js';
import logger from '../utils/logger.js';
import analysisState from '../state/analysisState.js';
import satelliteState from '../state/satelliteState.js';
import listState from '../state/listState.js';
import timeState from '../state/timeState.js';
import { computeTransfer, generateTransferArcPath } from '../analysis/transferCalculator.js';

// DOM element references
let container = null;
let placeholder = null;
let chaserSelect = null;
let targetSelect = null;
let tofSlider = null;
let tofInput = null;
let tofDisplay = null;
let revButtons = null;
let computeBtn = null;
let resultsDiv = null;
let statusDiv = null;

// Result value elements
let departureDvEl = null;
let arrivalDvEl = null;
let totalDvEl = null;
let transferTypeEl = null;
let iterationsEl = null;

// Checkbox element (in analysis panel)
let checkbox = null;

/**
 * Initialize the Lambert panel
 */
export function initializeLambertPanel() {
    // Get container elements
    container = document.getElementById('lambert-panel-container');
    placeholder = document.getElementById('lambert-placeholder');

    if (!container) {
        logger.warning('Lambert panel container not found', logger.CATEGORY.UI);
        return false;
    }

    // Get control elements
    chaserSelect = document.getElementById('lambert-chaser-select');
    targetSelect = document.getElementById('lambert-target-select');
    tofSlider = document.getElementById('lambert-tof-slider');
    tofInput = document.getElementById('lambert-tof-input');
    tofDisplay = document.getElementById('lambert-tof-display');
    revButtons = document.querySelectorAll('.lambert-rev-btn');
    computeBtn = document.getElementById('lambert-compute-btn');
    resultsDiv = document.getElementById('lambert-results');
    statusDiv = document.getElementById('lambert-status');

    // Get result value elements
    departureDvEl = document.getElementById('lambert-departure-dv');
    arrivalDvEl = document.getElementById('lambert-arrival-dv');
    totalDvEl = document.getElementById('lambert-total-dv');
    transferTypeEl = document.getElementById('lambert-transfer-type');
    iterationsEl = document.getElementById('lambert-iterations');

    // Get checkbox
    checkbox = document.getElementById('analysis-lambert');

    // Set up event handlers
    setupEventHandlers();

    // Subscribe to events
    setupEventListeners();

    logger.log('Lambert panel initialized', logger.CATEGORY.UI);
    return true;
}

/**
 * Set up UI event handlers
 */
function setupEventHandlers() {
    // Checkbox toggle
    if (checkbox) {
        checkbox.addEventListener('change', () => {
            analysisState.setLambertEnabled(checkbox.checked);
        });
    }

    // Chaser selection
    if (chaserSelect) {
        chaserSelect.addEventListener('change', () => {
            const id = chaserSelect.value || null;
            analysisState.setLambertChaser(id);
            updateComputeButton();
        });
    }

    // Target selection
    if (targetSelect) {
        targetSelect.addEventListener('change', () => {
            const id = targetSelect.value || null;
            analysisState.setLambertTarget(id);
            updateComputeButton();
        });
    }

    // TOF slider
    if (tofSlider) {
        tofSlider.addEventListener('input', () => {
            const value = parseInt(tofSlider.value, 10);
            tofInput.value = value;
            analysisState.setLambertTof(value);
            updateTofDisplay(value);
        });
    }

    // TOF input
    if (tofInput) {
        tofInput.addEventListener('change', () => {
            let value = parseInt(tofInput.value, 10);
            // Clamp to valid range
            value = Math.max(60, Math.min(604800, value || 3600));
            tofInput.value = value;
            tofSlider.value = Math.min(86400, value);
            analysisState.setLambertTof(value);
            updateTofDisplay(value);
        });
    }

    // Revolution buttons
    if (revButtons) {
        revButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const m = parseInt(btn.dataset.m, 10);
                analysisState.setLambertM(m);
                updateRevButtons(m);
            });
        });
    }

    // Compute button
    if (computeBtn) {
        computeBtn.addEventListener('click', handleCompute);
    }
}

/**
 * Set up event bus listeners
 */
function setupEventListeners() {
    // Lambert enabled/disabled
    eventBus.on('analysis:lambert:enabled', ({ enabled }) => {
        setVisible(enabled);
        if (checkbox) {
            checkbox.checked = enabled;
        }
    });

    // Lambert results computed
    eventBus.on('analysis:lambert:computed', ({ results }) => {
        displayResults(results);
    });

    // Lambert results cleared
    eventBus.on('analysis:lambert:cleared', () => {
        hideResults();
    });

    // Satellite data loaded
    eventBus.on('satellite:loaded', () => {
        populateSatelliteDropdowns();
    });

    // List visibility changed
    eventBus.on('list:visibility:changed', () => {
        populateSatelliteDropdowns();
    });

    // List changed
    eventBus.on('list:changed', () => {
        populateSatelliteDropdowns();
    });

    // Satellites changed in state
    eventBus.on('analysis:lambert:satellites:changed', ({ chaserId, targetId }) => {
        if (chaserSelect) chaserSelect.value = chaserId || '';
        if (targetSelect) targetSelect.value = targetId || '';
        updateComputeButton();
    });
}

/**
 * Set panel visibility
 * @param {boolean} visible - Whether to show the panel
 */
function setVisible(visible) {
    if (container) {
        container.style.display = visible ? 'flex' : 'none';
    }
    if (placeholder) {
        placeholder.style.display = visible ? 'none' : 'flex';
    }

    if (visible) {
        populateSatelliteDropdowns();
        updateFromState();
    }
}

/**
 * Update UI from current state
 */
function updateFromState() {
    const tof = analysisState.getLambertTof();
    const m = analysisState.getLambertM();
    const chaserId = analysisState.getLambertChaserId();
    const targetId = analysisState.getLambertTargetId();

    if (tofSlider) tofSlider.value = Math.min(86400, tof);
    if (tofInput) tofInput.value = tof;
    updateTofDisplay(tof);
    updateRevButtons(m);

    if (chaserSelect) chaserSelect.value = chaserId || '';
    if (targetSelect) targetSelect.value = targetId || '';

    updateComputeButton();

    // Show results if available
    const results = analysisState.getLambertResults();
    if (results) {
        displayResults(results);
    }
}

/**
 * Populate satellite dropdowns with visible satellites
 */
function populateSatelliteDropdowns() {
    if (!chaserSelect || !targetSelect) return;

    // Get visible satellites from lists
    const visibleIds = listState.getVisibleSatelliteIds();
    const satellites = visibleIds
        .map(id => satelliteState.getSatelliteById(id))
        .filter(sat => sat !== null)
        .sort((a, b) => a.name.localeCompare(b.name));

    // Store current selections
    const currentChaser = chaserSelect.value;
    const currentTarget = targetSelect.value;

    // Clear and rebuild options
    const defaultOption = '<option value="">-- Select satellite --</option>';

    const options = satellites.map(sat =>
        `<option value="${sat.id}">${sat.name}</option>`
    ).join('');

    chaserSelect.innerHTML = defaultOption + options;
    targetSelect.innerHTML = defaultOption + options;

    // Restore selections if still valid
    if (satellites.some(s => s.id === currentChaser)) {
        chaserSelect.value = currentChaser;
    }
    if (satellites.some(s => s.id === currentTarget)) {
        targetSelect.value = currentTarget;
    }

    updateComputeButton();
}

/**
 * Update TOF display text
 * @param {number} seconds - TOF in seconds
 */
function updateTofDisplay(seconds) {
    if (!tofDisplay) return;

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        tofDisplay.textContent = `${hours}h ${minutes}m`;
    } else {
        tofDisplay.textContent = `${minutes}m`;
    }
}

/**
 * Update revolution button active states
 * @param {number} activeM - Active revolution count
 */
function updateRevButtons(activeM) {
    if (!revButtons) return;

    revButtons.forEach(btn => {
        const m = parseInt(btn.dataset.m, 10);
        btn.classList.toggle('active', m === activeM);
    });
}

/**
 * Update compute button enabled state
 */
function updateComputeButton() {
    if (!computeBtn) return;

    const ready = analysisState.isLambertReady();
    computeBtn.disabled = !ready;
}

/**
 * Handle compute button click
 */
async function handleCompute() {
    const chaserId = analysisState.getLambertChaserId();
    const targetId = analysisState.getLambertTargetId();

    if (!chaserId || !targetId) {
        showStatus('Please select both chaser and target satellites', 'error');
        return;
    }

    if (chaserId === targetId) {
        showStatus('Chaser and target must be different satellites', 'error');
        return;
    }

    // Get satellites
    const chaser = satelliteState.getSatelliteById(chaserId);
    const target = satelliteState.getSatelliteById(targetId);

    if (!chaser || !target) {
        showStatus('Could not find satellite data', 'error');
        return;
    }

    // Get parameters
    const tof = analysisState.getLambertTof();
    const m = analysisState.getLambertM();
    const departureTime = analysisState.getLambertDepartureTime() || timeState.getCurrentTime();

    // Show computing status
    showStatus('Computing transfer...', 'info');
    computeBtn.disabled = true;

    try {
        // Compute transfer
        const results = computeTransfer(chaser, target, departureTime, tof, {
            M: m,
            prograde: true,
            lowPath: true
        });

        if (!results.converged) {
            showStatus(`Solver did not converge (${results.iterations} iterations)`, 'error');
            computeBtn.disabled = false;
            return;
        }

        // Generate arc points for visualization
        const arcPoints = generateTransferArcPath(results, 60);
        results.arcPoints = arcPoints;
        results.lowPath = true;  // We always use lowPath in this version

        // Store results in state (this will trigger display via event)
        analysisState.setLambertResults(results);

        showStatus('Transfer computed successfully', 'success');

        logger.log(`Lambert transfer: ΔV=${results.totalDV.toFixed(3)} km/s`, logger.CATEGORY.ANALYSIS);

    } catch (error) {
        logger.error(`Lambert computation failed: ${error.message}`, logger.CATEGORY.ANALYSIS);
        showStatus(`Error: ${error.message}`, 'error');
    }

    computeBtn.disabled = false;
}

/**
 * Display computed results
 * @param {Object} results - Transfer results from computeTransfer
 */
function displayResults(results) {
    if (!resultsDiv || !results) return;

    // Format delta-V values
    if (departureDvEl) {
        departureDvEl.textContent = `${results.departureDV.toFixed(3)} km/s`;
    }
    if (arrivalDvEl) {
        arrivalDvEl.textContent = `${results.arrivalDV.toFixed(3)} km/s`;
    }
    if (totalDvEl) {
        totalDvEl.textContent = `${results.totalDV.toFixed(3)} km/s`;
    }
    if (transferTypeEl) {
        const type = results.M === 0 ? 'Direct' : `${results.M}-rev`;
        const path = results.lowPath ? 'low-path' : 'high-path';
        transferTypeEl.textContent = `${type} (${path})`;
    }
    if (iterationsEl) {
        iterationsEl.textContent = results.iterations.toString();
    }

    // Show results section
    resultsDiv.style.display = 'block';
}

/**
 * Hide results display
 */
function hideResults() {
    if (resultsDiv) {
        resultsDiv.style.display = 'none';
    }
}

/**
 * Show status message
 * @param {string} message - Status message
 * @param {string} type - Status type ('info', 'success', 'error')
 */
function showStatus(message, type = 'info') {
    if (!statusDiv) return;

    statusDiv.textContent = message;
    statusDiv.className = `lambert-status ${type}`;
    statusDiv.style.display = 'block';

    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            if (statusDiv.textContent === message) {
                statusDiv.style.display = 'none';
            }
        }, 3000);
    }
}

/**
 * Hide status message
 */
function hideStatus() {
    if (statusDiv) {
        statusDiv.style.display = 'none';
    }
}

// Export for debugging
if (typeof window !== 'undefined') {
    window.lambertPanel = {
        initialize: initializeLambertPanel,
        populateSatelliteDropdowns,
        setVisible
    };
}

export default {
    initialize: initializeLambertPanel,
    setVisible
};
