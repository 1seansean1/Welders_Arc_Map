/**
 * Time Utilities - Pure date/time helper functions
 *
 * DEPENDENCIES: None (pure utility functions)
 * PERFORMANCE: O(1) operations, no DOM access
 *
 * Features:
 * - Datetime-local format conversion
 * - Date arithmetic (add/subtract days)
 * - ISO 8601 parsing
 * - Log timestamp formatting
 * - UTC time utilities
 */

/**
 * Format date for datetime-local input
 * Format: YYYY-MM-DDTHH:mm
 * @param {Date} date - Date object to format
 * @returns {string} Formatted datetime string
 */
export function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Add days to a date
 * @param {Date} date - Base date
 * @param {number} days - Number of days to add (can be negative)
 * @returns {Date} New date object
 */
export function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Add hours to a date
 * @param {Date} date - Base date
 * @param {number} hours - Number of hours to add (can be negative)
 * @returns {Date} New date object
 */
export function addHours(date, hours) {
    const result = new Date(date);
    result.setTime(result.getTime() + (hours * 60 * 60 * 1000));
    return result;
}

/**
 * Get current UTC time
 * @returns {Date} Current date/time in UTC
 */
export function getUTCNow() {
    return new Date();
}

/**
 * Parse ISO 8601 datetime string
 * @param {string} isoString - ISO 8601 datetime string
 * @returns {Date} Parsed date object
 */
export function parseISOTime(isoString) {
    return new Date(isoString);
}

/**
 * Format timestamp for log display (HH:MM:SS.mmm)
 * @param {string|Date} timestamp - ISO string or Date object
 * @returns {string} Formatted time string
 */
export function formatLogTime(timestamp) {
    const time = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const timeStr = time.toTimeString().split(' ')[0] +
                    '.' +
                    time.getMilliseconds().toString().padStart(3, '0');
    return timeStr;
}

/**
 * Format date as ISO 8601 string
 * @param {Date} date - Date to format
 * @returns {string} ISO 8601 string
 */
export function toISOString(date) {
    return date.toISOString();
}

/**
 * Get timestamp in milliseconds
 * @param {Date} date - Date object (optional, defaults to now)
 * @returns {number} Unix timestamp in milliseconds
 */
export function getTimestamp(date = new Date()) {
    return date.getTime();
}

/**
 * Create date from Unix timestamp
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {Date} Date object
 */
export function fromTimestamp(timestamp) {
    return new Date(timestamp);
}

/**
 * Check if two dates are on the same day
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} True if same day
 */
export function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

/**
 * Get time difference in hours
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {number} Difference in hours
 */
export function hoursDifference(start, end) {
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

/**
 * Get time difference in days
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {number} Difference in days
 */
export function daysDifference(start, end) {
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Format duration in human-readable format
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., "2h 30m", "45s", "1d 3h")
 */
export function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}
