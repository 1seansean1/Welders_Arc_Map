/**
 * Map Time Bar Module - Compact time controls at bottom of map
 *
 * DEPENDENCIES:
 * - timeState: Time simulation state management
 * - eventBus: Event communication
 * - logger: Diagnostic logging
 * - flatpickr: Datetime picker library (global)
 *
 * Features:
 * - Compact responsive design (hides elements on narrow widths)
 * - Flatpickr datetime pickers for start/stop (same as control panel)
 * - Play/Stop button for real-time mode
 * - Rewind/Fast Forward animation buttons
 * - Step size and speed selectors
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
// Stop button removed - play/pause toggle is sufficient
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
let startPicker = null;        // Flatpickr instance for start input
let stopPicker = null;         // Flatpickr instance for stop input
const STEP_REPEAT_DELAY = 400;  // ms before repeat starts
const STEP_REPEAT_RATE = 150;   // ms between repeats
const REAL_TIME_UPDATE_MS = 1000;  // 1 second updates in real-time mode
const ANIMATION_UPDATE_MS = 1000;  // Animation updates every 1 real second
const WHEEL_THROTTLE_MS = 50;   // Minimum ms between wheel jog events

// ============================================
// REAL-TIME MODE
// ============================================

/**
 * Start real-time mode - resume time progression from current position
 * Does NOT reset to NOW - just starts advancing time from where it is
 */
function startRealTime() {
    // Stop any animation first
    stopAnimation();

    isRealTime = true;

    // Clear any existing interval
    if (realTimeInterval) {
        clearInterval(realTimeInterval);
    }

    // Track the offset between sim time and wall time
    // so we can maintain it while advancing
    const simTime = timeState.getCurrentTime();
    const wallTime = new Date();
    const offsetMs = simTime.getTime() - wallTime.getTime();

    // Start interval for 1-second updates - maintain offset from wall time
    realTimeInterval = setInterval(() => {
        const now = new Date();
        const newSimTime = new Date(now.getTime() + offsetMs);
        timeState.setCurrentTime(newSimTime);
    }, REAL_TIME_UPDATE_MS);

    // Update button appearance
    updatePlayButtonState();

    logger.info('Real-time mode started (from current position)', logger.CATEGORY.TIME);
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
 * Update the play/pause button appearance based on mode
 * Real-time mode: show pause icon (‖) - click to freeze time
 * Paused/Simulation mode: show play icon (▶) - click to resume real-time
 */
function updatePlayButtonState() {
    if (!playBtn || !playIcon) return;

    if (isRealTime) {
        // Real-time mode: show pause icon (time is advancing)
        playIcon.textContent = '‖';
        playBtn.classList.remove('simulation-mode');
        playBtn.title = 'Real-time playing (click to pause)';
    } else {
        // Simulation/paused mode: show play icon (time is frozen)
        playIcon.textContent = '▶';
        playBtn.classList.add('simulation-mode');
        playBtn.title = 'Paused (click to resume real-time)';
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

    // IMPORTANT: Prevent map zoom immediately when Ctrl is held
    // Must happen BEFORE throttle check to prevent Leaflet from zooming
    e.preventDefault();
    e.stopPropagation();

    // Throttle wheel events to prevent overwhelming time updates
    // (event is already blocked from reaching Leaflet above)
    const now = Date.now();
    if (now - lastWheelTime < WHEEL_THROTTLE_MS) return;
    lastWheelTime = now;

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
        // Use capture phase to intercept event BEFORE Leaflet's handlers
        // This ensures Ctrl+wheel for time jog is processed before map zoom
        mapContainer.addEventListener('wheel', handleWheelJog, { passive: false, capture: true });
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
    // Explicitly set time to NOW first
    timeState.setCurrentTime(new Date());
    // Then start real-time mode (which will maintain offset of 0)
    startRealTime();
}

// ============================================
// TIME WINDOW PRESETS
// ============================================

/**
 * Apply a time window preset - all presets center on NOW
 * This places NOW at slider position 0.5 for equal forward/backward scrolling
 * @param {string} preset - Preset value (e.g., 'win-1h', 'win-6h', 'win-24h')
 */
function applyPreset(preset) {
    if (!preset) return;

    // Stop real-time mode
    if (isRealTime) {
        stopRealTime();
    }

    const now = new Date();
    let start, stop;

    // Parse preset value - format: win-Xh (X hour window centered on NOW)
    const match = preset.match(/^win-(\d+)h$/);
    if (!match) {
        logger.error(`Invalid preset format: ${preset}`, logger.CATEGORY.TIME);
        return;
    }

    const hours = parseInt(match[1], 10);
    const halfDurationMs = (hours / 2) * 60 * 60 * 1000;

    // Center window on NOW: half behind, half ahead
    start = new Date(now.getTime() - halfDurationMs);
    stop = new Date(now.getTime() + halfDurationMs);

    // Apply the time range (directly commit, no pending state)
    timeState.setTimeRange(start, stop);
    timeState.applyTimeChanges();

    // Set current time to NOW (center of window, slider position 0.5)
    timeState.setCurrentTime(now);

    // Update slider
    updateSliderFromState();

    logger.info(`Time window preset applied: ±${hours/2}h centered on NOW`, logger.CATEGORY.TIME);

    // Reset dropdown to placeholder
    if (presetSelect) {
        presetSelect.selectedIndex = 0;
    }

    // Update datetime inputs to reflect new range
    updateDateTimeInputs();
}

// ============================================
// DATETIME INPUTS WITH FLATPICKR
// ============================================

/**
 * Format Date to compact display (MM/DD HH:mm)
 * @param {Date} date - Date to format
 * @returns {string} Formatted string
 */
function formatCompactDateTime(date) {
    if (!date || !(date instanceof Date)) return '';
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
}

/**
 * Initialize Flatpickr datetime pickers for compact map time bar
 * Uses same style as control panel but with compact display format
 */
function initializeFlatpickr() {
    // Only initialize if flatpickr is available
    if (typeof flatpickr === 'undefined') {
        logger.warning('Flatpickr not available, datetime inputs disabled', logger.CATEGORY.UI);
        return;
    }

    // Common Flatpickr config
    const commonConfig = {
        enableTime: true,
        dateFormat: 'm/d H:i',  // Compact format: MM/DD HH:MM
        time_24hr: true,
        theme: 'dark',
        allowInput: false,  // Read-only input, use picker only
        clickOpens: true,   // Ensure clicking opens calendar
        disableMobile: true,  // Use Flatpickr on mobile too
        position: 'above',  // Open above the input (time bar is at bottom)
        static: false,      // Use default body append (better z-index behavior)
        onOpen: () => {
            // Ensure calendar is visible above time bar
            const calendars = document.querySelectorAll('.flatpickr-calendar');
            calendars.forEach(cal => {
                cal.style.zIndex = '10000';
            });
        },
        onClose: () => {
            // Blur the input to prevent keyboard on mobile
            document.activeElement?.blur();
        }
    };

    // Start time picker
    if (startInput) {
        startPicker = flatpickr(startInput, {
            ...commonConfig,
            onChange: (selectedDates) => {
                if (selectedDates.length > 0) {
                    handleStartDateSelected(selectedDates[0]);
                }
            }
        });
    }

    // Stop time picker
    if (stopInput) {
        stopPicker = flatpickr(stopInput, {
            ...commonConfig,
            onChange: (selectedDates) => {
                if (selectedDates.length > 0) {
                    handleStopDateSelected(selectedDates[0]);
                }
            }
        });
    }

    logger.diagnostic('Flatpickr initialized for map time bar', logger.CATEGORY.UI);

    // Add document-level double-click handler to close any open Flatpickr calendars
    document.addEventListener('dblclick', (e) => {
        // Don't close if double-clicking inside a calendar
        if (e.target.closest('.flatpickr-calendar')) return;

        // Close all open Flatpickr instances
        if (startPicker && startPicker.isOpen) {
            startPicker.close();
        }
        if (stopPicker && stopPicker.isOpen) {
            stopPicker.close();
        }
    });
}

/**
 * Handle start date selection from Flatpickr
 * @param {Date} selectedDate - Selected date (local time)
 */
function handleStartDateSelected(selectedDate) {
    // Convert to UTC (Flatpickr returns local time)
    const utcDate = new Date(Date.UTC(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        selectedDate.getHours(),
        selectedDate.getMinutes(),
        0, 0
    ));

    const state = timeState.getTimeState();
    const stop = state.stopTime;

    // Validate: start must be before stop
    if (stop && utcDate >= stop) {
        logger.error('Start time must be before stop time', logger.CATEGORY.TIME);
        updateDateTimeInputs();
        return;
    }

    // Apply the new time range
    timeState.setTimeRange(utcDate, stop);
    timeState.applyTimeChanges();

    // Stop real-time mode
    if (isRealTime) {
        stopRealTime();
    }

    updateSliderFromState();
    logger.info(`Start time changed: ${utcDate.toISOString()}`, logger.CATEGORY.TIME);
}

/**
 * Handle stop date selection from Flatpickr
 * @param {Date} selectedDate - Selected date (local time)
 */
function handleStopDateSelected(selectedDate) {
    // Convert to UTC (Flatpickr returns local time)
    const utcDate = new Date(Date.UTC(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        selectedDate.getHours(),
        selectedDate.getMinutes(),
        0, 0
    ));

    const state = timeState.getTimeState();
    const start = state.startTime;

    // Validate: stop must be after start
    if (start && utcDate <= start) {
        logger.error('Stop time must be after start time', logger.CATEGORY.TIME);
        updateDateTimeInputs();
        return;
    }

    // Apply the new time range
    timeState.setTimeRange(start, utcDate);
    timeState.applyTimeChanges();

    // Stop real-time mode
    if (isRealTime) {
        stopRealTime();
    }

    updateSliderFromState();
    logger.info(`Stop time changed: ${utcDate.toISOString()}`, logger.CATEGORY.TIME);
}

/**
 * Update datetime inputs from current state
 */
function updateDateTimeInputs() {
    const state = timeState.getTimeState();

    if (startInput && state.startTime) {
        // Update both display and Flatpickr
        const displayStr = formatCompactDateTime(state.startTime);
        startInput.value = displayStr;
        if (startPicker) {
            // Convert UTC to local for Flatpickr
            const localDate = new Date(
                state.startTime.getUTCFullYear(),
                state.startTime.getUTCMonth(),
                state.startTime.getUTCDate(),
                state.startTime.getUTCHours(),
                state.startTime.getUTCMinutes()
            );
            startPicker.setDate(localDate, false);  // false = don't trigger onChange
        }
    }

    if (stopInput && state.stopTime) {
        const displayStr = formatCompactDateTime(state.stopTime);
        stopInput.value = displayStr;
        if (stopPicker) {
            const localDate = new Date(
                state.stopTime.getUTCFullYear(),
                state.stopTime.getUTCMonth(),
                state.stopTime.getUTCDate(),
                state.stopTime.getUTCHours(),
                state.stopTime.getUTCMinutes()
            );
            stopPicker.setDate(localDate, false);
        }
    }
}

// Stop button removed - play/pause toggle is sufficient for user workflow

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

    // Note: datetime inputs use Flatpickr onChange handlers (see initializeFlatpickr)

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
    initializeFlatpickr();  // Initialize Flatpickr datetime pickers
    updatePlayButtonState();
    updateDateTimeInputs();

    // Start in real-time mode
    startRealTime();

    logger.diagnostic('Map time bar initialized', logger.CATEGORY.UI);
}

// Auto-initialize when module loads
initializeMapTimeBar();

// Expose on window for test access
window.mapTimeBar = {
    startRealTime,
    stopRealTime,
    toggleRealTime,
    isRealTime: () => isRealTime
};

export default {
    initializeMapTimeBar,
    startRealTime,
    stopRealTime,
    toggleRealTime,
    isRealTime: () => isRealTime
};
