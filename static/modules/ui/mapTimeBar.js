/**
 * Map Time Bar Module - Time controls at bottom of map
 *
 * DEPENDENCIES:
 * - timeState: Time simulation state management
 * - eventBus: Event communication
 * - logger: Diagnostic logging
 *
 * Features:
 * - Play/Stop button for real-time mode
 * - Step size selector (1s, 10s, 30s, 1m, 5m, 15m, 30m, 1h)
 * - Step back/forward buttons with hold-to-repeat
 * - Time slider for scrubbing
 * - Now button to reset to current UTC
 */

import timeState from '../state/timeState.js';
import eventBus from '../events/eventBus.js';
import logger from '../utils/logger.js';

// ============================================
// DOM ELEMENTS
// ============================================

const playBtn = document.getElementById('map-time-play-btn');
const playIcon = document.getElementById('map-time-play-icon');
const stepSelect = document.getElementById('map-time-step-select');
const stepBackBtn = document.getElementById('map-time-step-back');
const stepForwardBtn = document.getElementById('map-time-step-forward');
const timeSlider = document.getElementById('map-time-slider');
const nowBtn = document.getElementById('map-time-now-btn');

// ============================================
// STATE
// ============================================

let isRealTime = true;  // True = synced with wall clock
let realTimeInterval = null;  // Interval for real-time updates
let stepRepeatInterval = null;
const STEP_REPEAT_DELAY = 400;  // ms before repeat starts
const STEP_REPEAT_RATE = 150;   // ms between repeats
const REAL_TIME_UPDATE_MS = 1000;  // 1 second updates in real-time mode

// ============================================
// REAL-TIME MODE
// ============================================

/**
 * Start real-time mode - update time every second
 */
function startRealTime() {
    isRealTime = true;

    // Clear any existing interval
    if (realTimeInterval) {
        clearInterval(realTimeInterval);
    }

    // Update to current time now
    timeState.setCurrentTime(new Date());

    // Start interval for 1-second updates
    realTimeInterval = setInterval(() => {
        timeState.setCurrentTime(new Date());
    }, REAL_TIME_UPDATE_MS);

    // Update button appearance
    updatePlayButtonState();

    logger.info('Real-time mode started', logger.CATEGORY.TIME);
}

/**
 * Stop real-time mode - enter simulation mode
 */
function stopRealTime() {
    isRealTime = false;

    // Clear the real-time interval
    if (realTimeInterval) {
        clearInterval(realTimeInterval);
        realTimeInterval = null;
    }

    // Update button appearance
    updatePlayButtonState();

    logger.info('Simulation mode - real-time stopped', logger.CATEGORY.TIME);
}

/**
 * Toggle between real-time and simulation mode
 */
function toggleRealTime() {
    if (isRealTime) {
        stopRealTime();
    } else {
        startRealTime();
    }
}

/**
 * Update the play/stop button appearance based on mode
 */
function updatePlayButtonState() {
    if (!playBtn || !playIcon) return;

    if (isRealTime) {
        // Real-time mode: show play icon, normal styling
        playIcon.textContent = '▶';
        playBtn.classList.remove('simulation-mode');
        playBtn.title = 'Playing real-time (click to pause)';
    } else {
        // Simulation mode: show stop icon, orange styling
        playIcon.textContent = '■';
        playBtn.classList.add('simulation-mode');
        playBtn.title = 'Simulation mode (click to return to real-time)';
    }
}

/**
 * Check if current simulation time matches wall clock time
 * If not, we're in simulation mode
 */
function checkTimeSync() {
    const simTime = timeState.getCurrentTime();
    const wallTime = new Date();
    const diffMs = Math.abs(simTime.getTime() - wallTime.getTime());

    // Allow 2 second tolerance for real-time
    const isInSync = diffMs < 2000;

    if (isInSync && !isRealTime) {
        // Time synced back up, but we're not in real-time mode
        // Don't auto-start, let user decide
    } else if (!isInSync && isRealTime) {
        // Time drifted from wall clock, stop real-time
        stopRealTime();
    }
}

// ============================================
// STEP CONTROLS
// ============================================

/**
 * Get step size in minutes from select
 */
function getStepMinutes() {
    if (!stepSelect) return 5;
    return parseFloat(stepSelect.value) || 5;
}

/**
 * Step time by current step size
 * @param {number} direction - 1 for forward, -1 for backward
 */
function stepTime(direction) {
    // Stop real-time when stepping manually
    if (isRealTime) {
        stopRealTime();
    }

    const stepMinutes = getStepMinutes();
    const stepMs = stepMinutes * 60 * 1000;
    const currentTime = timeState.getCurrentTime();
    const newTime = new Date(currentTime.getTime() + (direction * stepMs));

    timeState.setCurrentTime(newTime);
    updateSliderFromState();
}

/**
 * Start hold-to-repeat stepping
 * @param {number} direction - 1 for forward, -1 for backward
 */
function startStepRepeat(direction) {
    stopStepRepeat();

    // Initial step
    stepTime(direction);

    // Start repeat after delay
    const repeatTimeout = setTimeout(() => {
        stepRepeatInterval = setInterval(() => {
            stepTime(direction);
        }, STEP_REPEAT_RATE);
    }, STEP_REPEAT_DELAY);

    stepRepeatInterval = repeatTimeout;
}

/**
 * Stop hold-to-repeat stepping
 */
function stopStepRepeat() {
    if (stepRepeatInterval) {
        clearTimeout(stepRepeatInterval);
        clearInterval(stepRepeatInterval);
        stepRepeatInterval = null;
    }
}

// ============================================
// SLIDER CONTROLS
// ============================================

/**
 * Update slider position based on current time
 */
function updateSliderFromState() {
    if (!timeSlider) return;

    const startTime = timeState.getCommittedStartTime() || timeState.getStartTime();
    const stopTime = timeState.getCommittedStopTime() || timeState.getStopTime();
    const currentTime = timeState.getCurrentTime();

    if (!startTime || !stopTime) return;

    const totalRange = stopTime.getTime() - startTime.getTime();
    if (totalRange <= 0) return;

    const currentOffset = currentTime.getTime() - startTime.getTime();
    const position = Math.max(0, Math.min(1000, (currentOffset / totalRange) * 1000));

    timeSlider.value = position;
}

/**
 * Update time from slider position
 */
function updateTimeFromSlider() {
    if (!timeSlider) return;

    // Stop real-time when scrubbing
    if (isRealTime) {
        stopRealTime();
    }

    const startTime = timeState.getCommittedStartTime() || timeState.getStartTime();
    const stopTime = timeState.getCommittedStopTime() || timeState.getStopTime();

    if (!startTime || !stopTime) return;

    const totalRange = stopTime.getTime() - startTime.getTime();
    const position = parseInt(timeSlider.value) / 1000;
    const newTime = new Date(startTime.getTime() + (position * totalRange));

    timeState.setCurrentTime(newTime);
}

/**
 * Reset to current UTC time (NOW)
 */
function resetToNow() {
    startRealTime();  // This sets current time to now and starts updates
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Initialize all event handlers
 */
function initializeEventHandlers() {
    // Play/Stop button
    if (playBtn) {
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleRealTime();
        });
    }

    // Step size select
    if (stepSelect) {
        stepSelect.addEventListener('change', (e) => {
            const stepMinutes = parseFloat(e.target.value);
            timeState.setTimeStepMinutes(stepMinutes);
        });
    }

    // Step back button - hold-to-repeat
    if (stepBackBtn) {
        stepBackBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startStepRepeat(-1);
            stepBackBtn.style.transform = 'scale(0.9)';
        });

        stepBackBtn.addEventListener('mouseup', () => {
            stopStepRepeat();
            stepBackBtn.style.transform = 'scale(1)';
        });

        stepBackBtn.addEventListener('mouseleave', () => {
            stopStepRepeat();
            stepBackBtn.style.transform = 'scale(1)';
        });

        // Touch support
        stepBackBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startStepRepeat(-1);
        }, { passive: false });

        stepBackBtn.addEventListener('touchend', () => {
            stopStepRepeat();
        });
    }

    // Step forward button - hold-to-repeat
    if (stepForwardBtn) {
        stepForwardBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startStepRepeat(1);
            stepForwardBtn.style.transform = 'scale(0.9)';
        });

        stepForwardBtn.addEventListener('mouseup', () => {
            stopStepRepeat();
            stepForwardBtn.style.transform = 'scale(1)';
        });

        stepForwardBtn.addEventListener('mouseleave', () => {
            stopStepRepeat();
            stepForwardBtn.style.transform = 'scale(1)';
        });

        // Touch support
        stepForwardBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startStepRepeat(1);
        }, { passive: false });

        stepForwardBtn.addEventListener('touchend', () => {
            stopStepRepeat();
        });
    }

    // Time slider
    if (timeSlider) {
        timeSlider.addEventListener('input', () => {
            updateTimeFromSlider();
        });
    }

    // Now button
    if (nowBtn) {
        nowBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetToNow();
        });
    }

    // Listen for time changes to keep slider in sync
    eventBus.on('time:changed', () => {
        updateSliderFromState();
    });
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the map time bar
 */
export function initializeMapTimeBar() {
    initializeEventHandlers();
    updatePlayButtonState();

    // Start in real-time mode
    startRealTime();

    logger.diagnostic('Map time bar initialized', logger.CATEGORY.UI);
}

// Auto-initialize when module loads
initializeMapTimeBar();

export default {
    initializeMapTimeBar,
    startRealTime,
    stopRealTime,
    toggleRealTime,
    isRealTime: () => isRealTime
};
