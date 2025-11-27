/**
 * Current Time Display Module - Shows UTC and simulation time on map overlay
 *
 * DEPENDENCIES:
 * - timeState: Current simulation time
 * - eventBus: Time change events
 * - logger: Diagnostic logging
 *
 * Features:
 * - Displays both UTC (wall clock) and Sim (simulation) time
 * - Positioned at top-left of map, adjacent to control panel
 * - Sim time turns orange when not matching UTC (simulation mode)
 * - Updates on time:changed events and 1-second interval for UTC
 */

import timeState from '../state/timeState.js';
import eventBus from '../events/eventBus.js';
import logger from '../utils/logger.js';

// DOM Elements
const utcTimeElement = document.getElementById('utc-time-value');
const simTimeElement = document.getElementById('sim-time-value');

// UTC update interval
let utcUpdateInterval = null;

/**
 * Format time for compact display (HH:MM:SS)
 * @param {Date} date - Date to format
 * @returns {string} Formatted time string
 */
function formatTimeCompact(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return '--:--:--';
    }

    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Check if simulation time is in sync with UTC (within 2 seconds)
 * @returns {boolean} True if in sync
 */
function isSimInSync() {
    const simTime = timeState.getCurrentTime();
    const utcTime = new Date();
    const diffMs = Math.abs(simTime.getTime() - utcTime.getTime());
    return diffMs < 2000;  // 2 second tolerance
}

/**
 * Update the UTC time display (wall clock)
 */
function updateUtcDisplay() {
    if (utcTimeElement) {
        utcTimeElement.textContent = formatTimeCompact(new Date());
    }
}

/**
 * Update the simulation time display
 */
function updateSimDisplay() {
    const simTime = timeState.getCurrentTime();
    if (simTimeElement) {
        simTimeElement.textContent = formatTimeCompact(simTime);

        // Add/remove sim-mode class based on sync status
        if (isSimInSync()) {
            simTimeElement.classList.remove('sim-mode');
        } else {
            simTimeElement.classList.add('sim-mode');
        }
    }
}

/**
 * Update both time displays
 */
function updateTimeDisplay() {
    updateUtcDisplay();
    updateSimDisplay();
}

/**
 * Initialize the current time display
 */
export function initializeCurrentTimeDisplay() {
    if (!utcTimeElement && !simTimeElement) {
        logger.warning('Time display elements not found', logger.CATEGORY.UI);
        return;
    }

    // Initial update
    updateTimeDisplay();

    // Start UTC update interval (every second)
    if (utcUpdateInterval) {
        clearInterval(utcUpdateInterval);
    }
    utcUpdateInterval = setInterval(updateUtcDisplay, 1000);

    // Subscribe to time changes for sim time
    eventBus.on('time:changed', () => {
        updateSimDisplay();
    });

    // Also update when time is applied
    eventBus.on('time:applied', () => {
        updateSimDisplay();
    });

    logger.success('Time display initialized (UTC + Sim)', logger.CATEGORY.UI);
}

// Auto-initialize when module loads
initializeCurrentTimeDisplay();

export default {
    updateTimeDisplay,
    initializeCurrentTimeDisplay
};
