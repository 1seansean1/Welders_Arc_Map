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
 * - Rewind/Fast Forward animation buttons (step per second)
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

const container = document.getElementById('map-time-bar');
const playBtn = document.getElementById('map-time-play-btn');
const playIcon = document.getElementById('map-time-play-icon');
const stepSelect = document.getElementById('map-time-step-select');
const speedSelect = document.getElementById('map-time-speed-select');
const presetSelect = document.getElementById('map-time-preset-select');
const rewindBtn = document.getElementById('map-time-rewind');
const stepBackBtn = document.getElementById('map-time-step-back');
const stepForwardBtn = document.getElementById('map-time-step-forward');
const ffwdBtn = document.getElementById('map-time-ffwd');
const stopBtn = document.getElementById('map-time-stop-btn');
const timeSlider = document.getElementById('map-time-slider');
const nowBtn = document.getElementById('map-time-now-btn');
const startInput = document.getElementById('map-time-start');
const stopInput = document.getElementById('map-time-stop');

// ============================================
// STATE
// ============================================

let isRealTime = true;  // True = synced with wall clock
let realTimeInterval = null;  // Interval for real-time updates
let stepRepeatInterval = null;
let animationInterval = null;  // Interval for rewind/ffwd animation
let animationDirection = 0;    // -1 = rewind, 0 = stopped, 1 = fast forward
let lastWheelTime = 0;         // Timestamp of last wheel event (for throttling)
const STEP_REPEAT_DELAY = 400;  // ms before repeat starts
const STEP_REPEAT_RATE = 150;   // ms between repeats
const REAL_TIME_UPDATE_MS = 1000;  // 1 second updates in real-time mode
const ANIMATION_UPDATE_MS = 1000;  // Animation updates every 1 real second
const WHEEL_THROTTLE_MS = 50;   // Minimum ms between wheel jog events

// ============================================
// REAL-TIME MODE
// ============================================

/**
 * Start real-time mode - update time every second
 */
function startRealTime() {
    // Stop any animation first
    stopAnimation();

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
 * Get playback speed multiplier from select
 */
function getPlaybackRate() {
    if (!speedSelect) return 1;
    return parseFloat(speedSelect.value) || 1;
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

    // Calculate repeat rate based on playback speed
    // Higher speed = faster repeating (shorter interval)
    // Clamp minimum to 50ms to prevent browser overload
    const speed = getPlaybackRate();
    const effectiveRate = Math.max(50, Math.floor(STEP_REPEAT_RATE / speed));

    // Start repeat after delay
    const repeatTimeout = setTimeout(() => {
        stepRepeatInterval = setInterval(() => {
            stepTime(direction);
        }, effectiveRate);
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
// ANIMATION CONTROLS (REWIND/FAST FORWARD)
// ============================================

/**
 * Start animation (rewind or fast forward)
 * @param {number} direction - -1 for rewind, 1 for fast forward
 */
function startAnimation(direction) {
    // If already animating in this direction, stop it (toggle behavior)
    if (animationDirection === direction) {
        stopAnimation();
        return;
    }

    // Stop any existing animation or real-time mode
    stopAnimation();
    if (isRealTime) {
        stopRealTime();
    }

    animationDirection = direction;

    // Update button appearance
    updateAnimationButtonState();
    updateStopButtonState();

    // Perform initial step
    stepTime(direction);

    // Calculate animation interval based on playback speed
    // Higher speed = faster updates (shorter interval)
    // Clamp minimum to 16ms (~60fps cap) to prevent browser overload
    const speed = getPlaybackRate();
    const effectiveInterval = Math.max(16, Math.floor(ANIMATION_UPDATE_MS / speed));

    // Start animation interval
    animationInterval = setInterval(() => {
        stepTime(direction);
    }, effectiveInterval);

    const directionName = direction > 0 ? 'Fast forward' : 'Rewind';
    const stepMinutes = getStepMinutes();
    const effectiveRate = stepMinutes * speed;
    logger.info(`${directionName} animation started (${effectiveRate}min/sec @ ${speed}x)`, logger.CATEGORY.TIME);
}

/**
 * Stop animation
 */
function stopAnimation() {
    if (animationInterval) {
        clearInterval(animationInterval);
        animationInterval = null;
    }
    animationDirection = 0;
    updateAnimationButtonState();
    updateStopButtonState();
}

/**
 * Update animation button appearance based on state
 */
function updateAnimationButtonState() {
    if (rewindBtn) {
        if (animationDirection === -1) {
            rewindBtn.classList.add('animating');
            rewindBtn.title = 'Stop rewind';
        } else {
            rewindBtn.classList.remove('animating');
            rewindBtn.title = 'Rewind animation';
        }
    }

    if (ffwdBtn) {
        if (animationDirection === 1) {
            ffwdBtn.classList.add('animating');
            ffwdBtn.title = 'Stop fast forward';
        } else {
            ffwdBtn.classList.remove('animating');
            ffwdBtn.title = 'Fast forward animation';
        }
    }
}

// ============================================
// MOUSE WHEEL JOG CONTROL
// ============================================

/**
 * Handle mouse wheel jog over map
 * Ctrl + wheel = scrub time forward/backward
 * @param {WheelEvent} e - Wheel event
 */
function handleWheelJog(e) {
    // Only activate when Ctrl key is held
    if (!e.ctrlKey) return;

    // Throttle wheel events to prevent overwhelming
    const now = Date.now();
    if (now - lastWheelTime < WHEEL_THROTTLE_MS) return;
    lastWheelTime = now;

    // Prevent map zoom when jogging
    e.preventDefault();
    e.stopPropagation();

    // Stop real-time mode when jogging
    if (isRealTime) {
        stopRealTime();
    }

    // Determine direction: wheel up (negative deltaY) = forward, wheel down = backward
    const direction = e.deltaY < 0 ? 1 : -1;

    // Step time
    stepTime(direction);
}

/**
 * Initialize wheel jog handler on map container
 */
function initializeWheelJog() {
    const mapContainer = document.getElementById('map-container');
    if (mapContainer) {
        mapContainer.addEventListener('wheel', handleWheelJog, { passive: false });
        logger.diagnostic('Wheel jog enabled (Ctrl+wheel to scrub time)', logger.CATEGORY.UI);
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
// TIME WINDOW PRESETS
// ============================================

/**
 * Apply a time window preset
 * @param {string} preset - Preset value (e.g., 'last-6h', 'next-24h')
 */
function applyPreset(preset) {
    if (!preset) return;

    // Stop real-time mode
    if (isRealTime) {
        stopRealTime();
    }

    const now = new Date();
    let start, stop;

    // Parse preset value
    const match = preset.match(/^(last|next)-(\d+)h$/);
    if (!match) {
        logger.error(`Invalid preset format: ${preset}`, logger.CATEGORY.TIME);
        return;
    }

    const direction = match[1];  // 'last' or 'next'
    const hours = parseInt(match[2], 10);
    const durationMs = hours * 60 * 60 * 1000;

    if (direction === 'last') {
        // Last X hours: start = now - X, stop = now
        start = new Date(now.getTime() - durationMs);
        stop = new Date(now);
    } else {
        // Next X hours: start = now, stop = now + X
        start = new Date(now);
        stop = new Date(now.getTime() + durationMs);
    }

    // Apply the time range (directly commit, no pending state)
    timeState.setTimeRange(start, stop);
    timeState.applyTimeChanges();

    // Set current time to appropriate position
    if (direction === 'last') {
        // For "last" windows, set to end (now)
        timeState.setCurrentTime(stop);
    } else {
        // For "next" windows, set to start (now)
        timeState.setCurrentTime(start);
    }

    // Update slider
    updateSliderFromState();

    logger.info(`Time window preset applied: ${preset} (${start.toISOString()} to ${stop.toISOString()})`, logger.CATEGORY.TIME);

    // Reset dropdown to placeholder
    if (presetSelect) {
        presetSelect.selectedIndex = 0;
    }

    // Update datetime inputs to reflect new range
    updateDateTimeInputs();
}

// ============================================
// DATETIME INPUTS
// ============================================

/**
 * Convert Date to datetime-local input format (YYYY-MM-DDTHH:mm)
 * @param {Date} date - Date to format
 * @returns {string} Formatted string for datetime-local input
 */
function dateToInputValue(date) {
    if (!date || !(date instanceof Date)) return '';
    // datetime-local expects local time, but we work in UTC
    // Format as ISO and take first 16 chars (YYYY-MM-DDTHH:mm)
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert datetime-local input value to Date (UTC)
 * @param {string} value - Input value (YYYY-MM-DDTHH:mm)
 * @returns {Date|null} Date object or null if invalid
 */
function inputValueToDate(value) {
    if (!value) return null;
    // Parse as UTC (append :00Z for seconds and timezone)
    const date = new Date(value + ':00Z');
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Update datetime inputs from current state
 */
function updateDateTimeInputs() {
    const state = timeState.getTimeState();

    if (startInput && state.startTime) {
        startInput.value = dateToInputValue(state.startTime);
    }

    if (stopInput && state.stopTime) {
        stopInput.value = dateToInputValue(state.stopTime);
    }
}

/**
 * Handle start datetime input change
 */
function handleStartInputChange() {
    const newStart = inputValueToDate(startInput.value);
    if (!newStart) return;

    const state = timeState.getTimeState();
    const stop = state.stopTime;

    // Validate: start must be before stop
    if (stop && newStart >= stop) {
        logger.error('Start time must be before stop time', logger.CATEGORY.TIME);
        // Revert to current state
        updateDateTimeInputs();
        return;
    }

    // Apply the new time range
    timeState.setTimeRange(newStart, stop);
    timeState.applyTimeChanges();

    // Stop real-time mode when manually setting window
    if (isRealTime) {
        stopRealTime();
    }

    // Update slider
    updateSliderFromState();

    logger.info(`Start time changed: ${newStart.toISOString()}`, logger.CATEGORY.TIME);
}

/**
 * Handle stop datetime input change
 */
function handleStopInputChange() {
    const newStop = inputValueToDate(stopInput.value);
    if (!newStop) return;

    const state = timeState.getTimeState();
    const start = state.startTime;

    // Validate: stop must be after start
    if (start && newStop <= start) {
        logger.error('Stop time must be after start time', logger.CATEGORY.TIME);
        // Revert to current state
        updateDateTimeInputs();
        return;
    }

    // Apply the new time range
    timeState.setTimeRange(start, newStop);
    timeState.applyTimeChanges();

    // Stop real-time mode when manually setting window
    if (isRealTime) {
        stopRealTime();
    }

    // Update slider
    updateSliderFromState();

    logger.info(`Stop time changed: ${newStop.toISOString()}`, logger.CATEGORY.TIME);
}

// ============================================
// STOP BUTTON
// ============================================

/**
 * Stop any running animation (does not return to real-time)
 */
function handleStopButton() {
    if (animationDirection !== 0) {
        stopAnimation();
        logger.info('Animation stopped', logger.CATEGORY.TIME);
    }
}

/**
 * Update stop button visual state
 */
function updateStopButtonState() {
    if (stopBtn) {
        if (animationDirection !== 0) {
            stopBtn.classList.add('active');
            stopBtn.disabled = false;
        } else {
            stopBtn.classList.remove('active');
            // Don't disable - user might want to click it anyway
        }
    }
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Initialize all event handlers
 */
function initializeEventHandlers() {
    // Block all mouse events from propagating to map underneath
    if (container) {
        const blockEvents = ['click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'wheel'];
        blockEvents.forEach(eventType => {
            container.addEventListener(eventType, (e) => {
                e.stopPropagation();
            });
        });
    }

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
            e.stopPropagation();
            const stepMinutes = parseFloat(e.target.value);
            timeState.setTimeStepMinutes(stepMinutes);
        });
    }

    // Speed multiplier select
    if (speedSelect) {
        speedSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            const speed = parseFloat(e.target.value);
            timeState.setPlaybackRate(speed);

            // If animating, restart animation with new speed
            if (animationDirection !== 0) {
                const currentDirection = animationDirection;
                stopAnimation();
                startAnimation(currentDirection);
            }
        });
    }

    // Time window preset select
    if (presetSelect) {
        presetSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            applyPreset(e.target.value);
        });
    }

    // Rewind animation button
    if (rewindBtn) {
        rewindBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startAnimation(-1);
        });
    }

    // Fast forward animation button
    if (ffwdBtn) {
        ffwdBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startAnimation(1);
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
        timeSlider.addEventListener('input', (e) => {
            e.stopPropagation();
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

    // Stop animation button
    if (stopBtn) {
        stopBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleStopButton();
        });
    }

    // Start datetime input
    if (startInput) {
        startInput.addEventListener('change', (e) => {
            e.stopPropagation();
            handleStartInputChange();
        });
    }

    // Stop datetime input
    if (stopInput) {
        stopInput.addEventListener('change', (e) => {
            e.stopPropagation();
            handleStopInputChange();
        });
    }

    // Listen for time changes to keep slider in sync
    eventBus.on('time:changed', () => {
        updateSliderFromState();
    });

    // Listen for time range changes to update datetime inputs
    eventBus.on('time:range:changed', () => {
        updateDateTimeInputs();
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
    initializeWheelJog();
    updatePlayButtonState();
    updateDateTimeInputs();
    updateStopButtonState();

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
