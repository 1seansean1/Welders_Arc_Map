/**
 * Current Time Display Module - Shows simulation time on map overlay
 *
 * DEPENDENCIES:
 * - timeState: Current simulation time
 * - eventBus: Time change events
 * - logger: Diagnostic logging
 *
 * Features:
 * - Displays current simulation time in map overlay
 * - Updates on time:changed events
 * - Formatted as HH:MM:SS UTC with date
 */

import timeState from '../state/timeState.js';
import eventBus from '../events/eventBus.js';
import logger from '../utils/logger.js';

// DOM Elements
const timeValueElement = document.getElementById('current-time-value');
const timeLabelElement = document.getElementById('current-time-label');

/**
 * Format time for display
 * @param {Date} date - Date to format
 * @returns {string} Formatted time string
 */
function formatTimeDisplay(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return '--:--:-- UTC';
    }

    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');

    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}Z`;
}

/**
 * Update the time display with current simulation time
 */
function updateTimeDisplay() {
    const currentTime = timeState.getCurrentTime();
    if (timeValueElement) {
        timeValueElement.textContent = formatTimeDisplay(currentTime);
    }
}

/**
 * Initialize the current time display
 */
export function initializeCurrentTimeDisplay() {
    if (!timeValueElement) {
        logger.warning('Current time display element not found', logger.CATEGORY.UI);
        return;
    }

    // Initial update
    updateTimeDisplay();

    // Subscribe to time changes
    eventBus.on('time:changed', () => {
        updateTimeDisplay();
    });

    // Also update when time is applied
    eventBus.on('time:applied', () => {
        updateTimeDisplay();
    });

    logger.success('Current time display initialized', logger.CATEGORY.UI);
}

// Auto-initialize when module loads
initializeCurrentTimeDisplay();

export default {
    updateTimeDisplay,
    initializeCurrentTimeDisplay
};
