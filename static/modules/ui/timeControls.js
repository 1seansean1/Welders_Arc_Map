/**
 * Time Controls Module - Start/stop time inputs, Flatpickr, and pending state management
 *
 * DEPENDENCIES:
 * - timeState: Time range state management
 * - logger: Diagnostic logging
 * - time utils: formatDateTimeLocal
 * - controlPanel: setCalendarJustClosed (prevents panel collapse when calendar closes)
 *
 * Features:
 * - Start/stop datetime inputs with Flatpickr
 * - NOW buttons to set current time
 * - Arrow buttons to increment/decrement by 1 day
 * - Pending state with Apply/Cancel buttons
 * - Orange border visual feedback for pending changes
 * - Integration with Flatpickr calendar
 *
 * MOBILE BEHAVIOR:
 * - Touch-friendly calendar interface
 * - Visual feedback on button clicks
 *
 * PERFORMANCE:
 * - Lazy-loaded Flatpickr (only initializes when needed)
 * - O(1) date arithmetic for arrow buttons
 */

import timeState from '../state/timeState.js';
import eventBus from '../events/eventBus.js';
import logger from '../utils/logger.js';
import { formatDateTimeLocal } from '../utils/time.js';
import { setCalendarJustClosed } from './controlPanel.js';

// ============================================
// DOM ELEMENTS
// ============================================

const startTimeInput = document.getElementById('start-time');
const stopTimeInput = document.getElementById('stop-time');
const timeArrowBtns = document.querySelectorAll('.time-arrow-btn');
const timeNowBtns = document.querySelectorAll('.time-now-btn');
const timeActionsDiv = document.getElementById('time-actions');
const timeCancelBtn = document.getElementById('time-cancel-btn');
const timeApplyBtn = document.getElementById('time-apply-btn');

// Track duration controls
const trackTailSlider = document.getElementById('track-tail-slider');
const trackTailInput = document.getElementById('track-tail-input');
const trackHeadSlider = document.getElementById('track-head-slider');
const trackHeadInput = document.getElementById('track-head-input');

// Time slider controls
const timeSlider = document.getElementById('time-slider');
const timeStepSelect = document.getElementById('time-step-select');
const timeStepBackBtn = document.getElementById('time-step-back');
const timeStepForwardBtn = document.getElementById('time-step-forward');
const timeSliderNowBtn = document.getElementById('time-slider-now');

// ============================================
// STATE
// ============================================

// Flatpickr instances
let startPicker, stopPicker;

// ============================================
// TIME CONTROLS INITIALIZATION
// ============================================

/**
 * Initialize time controls with default values
 * Sets time window centered on NOW (-12h to +12h for 24h total)
 * This places NOW at the middle of the slider (position 0.5)
 */
export function initializeTimeControls() {
    const now = new Date();
    const windowHours = 24; // Total window size
    const halfWindowMs = (windowHours / 2) * 60 * 60 * 1000;
    const startDefault = new Date(now.getTime() - halfWindowMs);
    const stopDefault = new Date(now.getTime() + halfWindowMs);

    timeState.setCurrentTime(now);
    timeState.setStartTime(startDefault);
    timeState.setStopTime(stopDefault);
    timeState.applyTimeChanges(); // Commit the initial values

    startTimeInput.value = formatDateTimeLocal(startDefault);
    stopTimeInput.value = formatDateTimeLocal(stopDefault);
}

/**
 * Initialize Flatpickr datetime pickers
 * Replaces native datetime-local with dark-themed picker
 *
 * MOBILE: Touch-friendly calendar interface
 * PERFORMANCE: Lazy-loaded, only initializes when needed
 */
export function initializeFlatpickr() {
    // Configure start time picker
    startPicker = flatpickr(startTimeInput, {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        time_24hr: true,
        theme: "dark",
        allowInput: true,  // Allow manual typing
        onChange: (selectedDates) => {
            if (selectedDates.length > 0) {
                timeState.setStartTime(selectedDates[0]);
                setPendingState();
            }
        },
        onClose: () => {
            // Set flag to prevent panel collapse on this click
            setCalendarJustClosed();
        }
    });

    // Configure stop time picker
    stopPicker = flatpickr(stopTimeInput, {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        time_24hr: true,
        theme: "dark",
        allowInput: true,  // Allow manual typing
        onChange: (selectedDates) => {
            if (selectedDates.length > 0) {
                timeState.setStopTime(selectedDates[0]);
                setPendingState();
            }
        },
        onClose: () => {
            // Set flag to prevent panel collapse on this click
            setCalendarJustClosed();
        }
    });

    logger.success('Flatpickr initialized', logger.CATEGORY.DATA);
}

// ============================================
// PENDING STATE MANAGEMENT
// ============================================

/**
 * Set pending state and show orange borders
 */
function setPendingState() {
    // Note: timeState tracks pending changes internally

    // Add orange borders to time inputs only
    startTimeInput.classList.add('pending');
    stopTimeInput.classList.add('pending');

    // Show Cancel/Apply buttons (make them fully visible)
    timeActionsDiv.classList.add('visible');

    logger.diagnostic('Time changes pending', logger.CATEGORY.DATA);
}

/**
 * Clear pending state and remove orange borders
 */
function clearPendingState() {
    // Note: timeState tracks pending changes internally

    // Remove orange borders from time inputs
    startTimeInput.classList.remove('pending');
    stopTimeInput.classList.remove('pending');

    // Subdue Cancel/Apply buttons (make them less visible)
    timeActionsDiv.classList.remove('visible');
}

/**
 * Apply pending time changes
 */
function applyTimeChanges() {
    // Commit the changes through timeState
    timeState.applyTimeChanges();

    clearPendingState();

    const startTime = timeState.getCommittedStartTime();
    const stopTime = timeState.getCommittedStopTime();
    const duration = (stopTime - startTime) / (1000 * 60 * 60); // hours

    logger.info(
        'Time range applied',
        logger.CATEGORY.DATA,
        {
            start: startTime.toISOString().slice(0, 16),
            stop: stopTime.toISOString().slice(0, 16),
            duration: `${duration.toFixed(1)}h`
        }
    );
}

/**
 * Cancel pending time changes and revert to committed values
 */
function cancelTimeChanges() {
    // Revert through timeState
    timeState.cancelTimeChanges();

    // Get committed values to update UI
    const committedStart = timeState.getCommittedStartTime();
    const committedStop = timeState.getCommittedStopTime();

    // Update Flatpickr instances (also updates input values)
    if (startPicker) {
        startPicker.setDate(committedStart, false);  // false = don't trigger onChange
    }
    if (stopPicker) {
        stopPicker.setDate(committedStop, false);  // false = don't trigger onChange
    }

    clearPendingState();

    logger.info(
        'Time changes cancelled',
        logger.CATEGORY.DATA,
        {
            reverted: committedStart.toISOString().slice(0, 16)
        }
    );
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Initialize event handlers
 * Sets up NOW buttons, arrow buttons, and Apply/Cancel buttons
 */
function initializeEventHandlers() {
    // NOW button handlers
    // Sets individual start or stop time to current time
    timeNowBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();

            const target = btn.dataset.target; // 'start' or 'stop'
            const now = new Date();
            const picker = target === 'start' ? startPicker : stopPicker;

            // Set to current time using Flatpickr
            if (picker) {
                picker.setDate(now, true);  // true = trigger onChange (which sets pending state)
            }

            // Visual feedback
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                btn.style.transform = 'scale(1)';
            }, 100);
        });
    });

    // Arrow button click handler
    // Increments/decrements time by 1 day
    // PERFORMANCE: O(1) - simple date arithmetic
    timeArrowBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();

            const target = btn.dataset.target; // 'start' or 'stop'
            const delta = parseInt(btn.dataset.delta); // -1 or 1
            const picker = target === 'start' ? startPicker : stopPicker;

            // Get current date from timeState
            const currentDate = new Date(target === 'start' ? timeState.getStartTime() : timeState.getStopTime());

            // Add/subtract 1 day (86400000 ms)
            currentDate.setDate(currentDate.getDate() + delta);

            // Update using Flatpickr
            if (picker) {
                picker.setDate(currentDate, true);  // true = trigger onChange (which sets pending state)
            }

            // Visual feedback
            btn.style.transform = 'scale(0.9)';
            setTimeout(() => {
                btn.style.transform = 'scale(1)';
            }, 100);
        });
    });

    // Time input change handler
    // Updates state when user manually changes time
    startTimeInput.addEventListener('change', (e) => {
        timeState.setStartTime(new Date(e.target.value));
        setPendingState();
    });

    stopTimeInput.addEventListener('change', (e) => {
        timeState.setStopTime(new Date(e.target.value));
        setPendingState();
    });

    // Cancel button handler
    // Reverts time changes to last committed values
    timeCancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelTimeChanges();
    });

    // Apply button handler
    // Commits pending time changes
    timeApplyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyTimeChanges();
    });
}

// Auto-initialize event handlers when module loads
initializeEventHandlers();

// ============================================
// TRACK DURATION CONTROLS
// ============================================

/**
 * Initialize track duration slider/input synchronization
 */
function initializeTrackDurationControls() {
    if (!trackTailSlider || !trackTailInput || !trackHeadSlider || !trackHeadInput) {
        logger.warning('Track duration controls not found', logger.CATEGORY.UI);
        return;
    }

    // Tail slider → input sync
    trackTailSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        trackTailInput.value = value;
        timeState.setTailMinutes(value);
    });

    // Tail input → slider sync
    trackTailInput.addEventListener('change', (e) => {
        let value = parseInt(e.target.value) || 0;
        value = Math.max(0, Math.min(90, value));
        trackTailInput.value = value;
        trackTailSlider.value = value;
        timeState.setTailMinutes(value);
    });

    // Head slider → input sync
    trackHeadSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        trackHeadInput.value = value;
        timeState.setHeadMinutes(value);
    });

    // Head input → slider sync
    trackHeadInput.addEventListener('change', (e) => {
        let value = parseInt(e.target.value) || 0;
        value = Math.max(0, Math.min(90, value));
        trackHeadInput.value = value;
        trackHeadSlider.value = value;
        timeState.setHeadMinutes(value);
    });

    logger.diagnostic('Track duration controls initialized', logger.CATEGORY.UI);
}

// Auto-initialize track duration controls when module loads
initializeTrackDurationControls();

// ============================================
// TIME SLIDER CONTROLS
// ============================================

// Hold-to-repeat state for step buttons
let stepRepeatInterval = null;
const STEP_REPEAT_DELAY = 400;  // ms before repeat starts
const STEP_REPEAT_RATE = 150;   // ms between repeats

/**
 * Start hold-to-repeat stepping
 * @param {number} direction - 1 for forward, -1 for backward
 */
function startStepRepeat(direction) {
    // Clear any existing interval
    stopStepRepeat();

    // Initial step
    timeState.stepTime(direction);
    updateSliderFromState();

    // Start repeat after delay
    const repeatTimeout = setTimeout(() => {
        stepRepeatInterval = setInterval(() => {
            timeState.stepTime(direction);
            updateSliderFromState();
        }, STEP_REPEAT_RATE);
    }, STEP_REPEAT_DELAY);

    // Store timeout ID so we can clear it
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

/**
 * Initialize time slider controls
 * Sets up slider, step buttons, and Now button
 */
function initializeTimeSliderControls() {
    if (!timeSlider || !timeStepSelect || !timeStepBackBtn || !timeStepForwardBtn || !timeSliderNowBtn) {
        logger.warning('Time slider controls not found', logger.CATEGORY.UI);
        return;
    }

    // Step size select handler
    timeStepSelect.addEventListener('change', (e) => {
        const stepMinutes = parseInt(e.target.value);
        timeState.setTimeStepMinutes(stepMinutes);
    });

    // Step back button - hold-to-repeat
    timeStepBackBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        startStepRepeat(-1);

        // Visual feedback
        timeStepBackBtn.style.transform = 'scale(0.9)';
    });

    timeStepBackBtn.addEventListener('mouseup', () => {
        stopStepRepeat();
        timeStepBackBtn.style.transform = 'scale(1)';
    });

    timeStepBackBtn.addEventListener('mouseleave', () => {
        stopStepRepeat();
        timeStepBackBtn.style.transform = 'scale(1)';
    });

    // Touch support for mobile
    timeStepBackBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startStepRepeat(-1);
        timeStepBackBtn.style.transform = 'scale(0.9)';
    });

    timeStepBackBtn.addEventListener('touchend', () => {
        stopStepRepeat();
        timeStepBackBtn.style.transform = 'scale(1)';
    });

    // Step forward button - hold-to-repeat
    timeStepForwardBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        startStepRepeat(1);

        // Visual feedback
        timeStepForwardBtn.style.transform = 'scale(0.9)';
    });

    timeStepForwardBtn.addEventListener('mouseup', () => {
        stopStepRepeat();
        timeStepForwardBtn.style.transform = 'scale(1)';
    });

    timeStepForwardBtn.addEventListener('mouseleave', () => {
        stopStepRepeat();
        timeStepForwardBtn.style.transform = 'scale(1)';
    });

    // Touch support for mobile
    timeStepForwardBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startStepRepeat(1);
        timeStepForwardBtn.style.transform = 'scale(0.9)';
    });

    timeStepForwardBtn.addEventListener('touchend', () => {
        stopStepRepeat();
        timeStepForwardBtn.style.transform = 'scale(1)';
    });

    // Time slider input handler (during drag)
    timeSlider.addEventListener('input', (e) => {
        const position = parseInt(e.target.value) / 1000; // 0-1000 → 0-1
        timeState.setTimeFromSlider(position);
        updateSliderRealTimeClass();
    });

    // Now button handler
    timeSliderNowBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        timeState.resumeRealTime();
        updateSliderFromState();

        // Visual feedback
        timeSliderNowBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            timeSliderNowBtn.style.transform = 'scale(1)';
        }, 100);
    });

    // Initialize slider position
    updateSliderFromState();

    logger.diagnostic('Time slider controls initialized', logger.CATEGORY.UI);
}

/**
 * Update slider position from current time state
 */
function updateSliderFromState() {
    if (!timeSlider) return;

    const position = timeState.getSliderPosition();
    timeSlider.value = Math.round(position * 1000);
    updateSliderRealTimeClass();
}

/**
 * Update slider real-time class (green when tracking real time)
 */
function updateSliderRealTimeClass() {
    if (!timeSlider) return;

    if (timeState.isRealTime()) {
        timeSlider.classList.add('realtime');
    } else {
        timeSlider.classList.remove('realtime');
    }
}

// Auto-initialize time slider controls when module loads
initializeTimeSliderControls();

// Subscribe to time events for slider updates
eventBus.on('time:applied', () => {
    // When time range is applied, update slider position
    updateSliderFromState();
    updateSliderRealTimeClass();
});

eventBus.on('time:cancelled', () => {
    // When time changes are cancelled, update slider position
    updateSliderFromState();
    updateSliderRealTimeClass();
});

// Export for external use
export { updateSliderFromState };
