/**
 * Time State Module - Manages time simulation state
 *
 * DEPENDENCIES: eventBus.js, logger.js
 * PATTERN: Encapsulated state with pending changes mechanism
 *
 * Features:
 * - Current simulation time
 * - Start/stop time range
 * - Lookback duration
 * - Pending changes tracking (apply/cancel)
 * - Event emissions on changes
 *
 * Events Emitted:
 * - time:changed - Current time changed
 * - time:range:changed - Start/stop time changed
 * - time:pending:changed - Pending changes state changed
 * - time:applied - Pending changes applied/committed
 * - time:cancelled - Pending changes cancelled
 *
 * Usage:
 *   import timeState from './modules/state/timeState.js';
 *
 *   // Get time state
 *   const state = timeState.getTimeState();
 *   const currentTime = timeState.getCurrentTime();
 *
 *   // Set times (marks as pending)
 *   timeState.setStartTime(new Date());
 *   timeState.setStopTime(new Date());
 *
 *   // Apply or cancel changes
 *   timeState.applyTimeChanges();
 *   timeState.cancelTimeChanges();
 */

import eventBus from '../events/eventBus.js';
import logger from '../utils/logger.js';

/**
 * TimeState class - Encapsulates time simulation state
 */
class TimeState {
    constructor() {
        // Private state
        this._state = {
            currentTime: new Date(),
            startTime: null,
            stopTime: null,
            lookbackHours: 24, // Default lookback duration

            // Pending changes tracking
            hasPendingChanges: false,
            committedStartTime: null,
            committedStopTime: null
        };

        logger.log('Time State initialized', logger.CATEGORY.SYSTEM);
    }

    /**
     * Get complete time state (read-only copy)
     * @returns {Object} Copy of time state
     */
    getTimeState() {
        return {
            currentTime: new Date(this._state.currentTime),
            startTime: this._state.startTime ? new Date(this._state.startTime) : null,
            stopTime: this._state.stopTime ? new Date(this._state.stopTime) : null,
            lookbackHours: this._state.lookbackHours,
            hasPendingChanges: this._state.hasPendingChanges,
            committedStartTime: this._state.committedStartTime ? new Date(this._state.committedStartTime) : null,
            committedStopTime: this._state.committedStopTime ? new Date(this._state.committedStopTime) : null
        };
    }

    /**
     * Get current simulation time
     * @returns {Date} Current time
     */
    getCurrentTime() {
        return new Date(this._state.currentTime);
    }

    /**
     * Get start time
     * @returns {Date|null} Start time or null
     */
    getStartTime() {
        return this._state.startTime ? new Date(this._state.startTime) : null;
    }

    /**
     * Get stop time
     * @returns {Date|null} Stop time or null
     */
    getStopTime() {
        return this._state.stopTime ? new Date(this._state.stopTime) : null;
    }

    /**
     * Get lookback hours
     * @returns {number} Lookback hours
     */
    getLookbackHours() {
        return this._state.lookbackHours;
    }

    /**
     * Check if there are pending changes
     * @returns {boolean} True if pending changes exist
     */
    hasPendingChanges() {
        return this._state.hasPendingChanges;
    }

    /**
     * Get committed start time
     * @returns {Date|null} Committed start time or null
     */
    getCommittedStartTime() {
        return this._state.committedStartTime ? new Date(this._state.committedStartTime) : null;
    }

    /**
     * Get committed stop time
     * @returns {Date|null} Committed stop time or null
     */
    getCommittedStopTime() {
        return this._state.committedStopTime ? new Date(this._state.committedStopTime) : null;
    }

    /**
     * Set current simulation time
     * @param {Date} time - New current time
     */
    setCurrentTime(time) {
        if (!(time instanceof Date) || isNaN(time)) {
            logger.log('setCurrentTime: invalid date', logger.CATEGORY.ERROR);
            return;
        }

        this._state.currentTime = new Date(time);
        logger.log(`Current time set: ${time.toISOString()}`, logger.CATEGORY.TIME);

        eventBus.emit('time:changed', {
            currentTime: new Date(this._state.currentTime)
        });
    }

    /**
     * Set start time (marks as pending change)
     * @param {Date|null} time - New start time
     */
    setStartTime(time) {
        if (time !== null && (!(time instanceof Date) || isNaN(time))) {
            logger.log('setStartTime: invalid date', logger.CATEGORY.ERROR);
            return;
        }

        this._state.startTime = time ? new Date(time) : null;
        this._markAsPending();

        logger.log(`Start time set: ${time ? time.toISOString() : 'null'} (pending)`, logger.CATEGORY.TIME);

        eventBus.emit('time:range:changed', {
            startTime: this._state.startTime ? new Date(this._state.startTime) : null,
            stopTime: this._state.stopTime ? new Date(this._state.stopTime) : null,
            pending: true
        });
    }

    /**
     * Set stop time (marks as pending change)
     * @param {Date|null} time - New stop time
     */
    setStopTime(time) {
        if (time !== null && (!(time instanceof Date) || isNaN(time))) {
            logger.log('setStopTime: invalid date', logger.CATEGORY.ERROR);
            return;
        }

        this._state.stopTime = time ? new Date(time) : null;
        this._markAsPending();

        logger.log(`Stop time set: ${time ? time.toISOString() : 'null'} (pending)`, logger.CATEGORY.TIME);

        eventBus.emit('time:range:changed', {
            startTime: this._state.startTime ? new Date(this._state.startTime) : null,
            stopTime: this._state.stopTime ? new Date(this._state.stopTime) : null,
            pending: true
        });
    }

    /**
     * Set lookback hours
     * @param {number} hours - Number of hours to look back
     */
    setLookbackHours(hours) {
        if (typeof hours !== 'number' || hours <= 0) {
            logger.log('setLookbackHours: must be positive number', logger.CATEGORY.ERROR);
            return;
        }

        this._state.lookbackHours = hours;
        logger.log(`Lookback hours set: ${hours}`, logger.CATEGORY.TIME);
    }

    /**
     * Set time range (both start and stop)
     * @param {Date|null} startTime - Start time
     * @param {Date|null} stopTime - Stop time
     */
    setTimeRange(startTime, stopTime) {
        // Validate dates
        if (startTime !== null && (!(startTime instanceof Date) || isNaN(startTime))) {
            logger.log('setTimeRange: invalid start date', logger.CATEGORY.ERROR);
            return;
        }
        if (stopTime !== null && (!(stopTime instanceof Date) || isNaN(stopTime))) {
            logger.log('setTimeRange: invalid stop date', logger.CATEGORY.ERROR);
            return;
        }

        // Validate range (start must be before stop)
        if (startTime && stopTime && startTime > stopTime) {
            logger.log('setTimeRange: start time must be before stop time', logger.CATEGORY.ERROR);
            return;
        }

        this._state.startTime = startTime ? new Date(startTime) : null;
        this._state.stopTime = stopTime ? new Date(stopTime) : null;
        this._markAsPending();

        logger.log(`Time range set: ${startTime ? startTime.toISOString() : 'null'} to ${stopTime ? stopTime.toISOString() : 'null'} (pending)`, logger.CATEGORY.TIME);

        eventBus.emit('time:range:changed', {
            startTime: this._state.startTime ? new Date(this._state.startTime) : null,
            stopTime: this._state.stopTime ? new Date(this._state.stopTime) : null,
            pending: true
        });
    }

    /**
     * Apply pending time changes (commit them)
     */
    applyTimeChanges() {
        if (!this._state.hasPendingChanges) {
            logger.log('No pending time changes to apply', logger.CATEGORY.TIME);
            return;
        }

        // Commit the changes
        this._state.committedStartTime = this._state.startTime ? new Date(this._state.startTime) : null;
        this._state.committedStopTime = this._state.stopTime ? new Date(this._state.stopTime) : null;
        this._state.hasPendingChanges = false;

        logger.log('Time changes applied (committed)', logger.CATEGORY.TIME);

        // Emit events
        eventBus.emit('time:applied', {
            startTime: this._state.committedStartTime ? new Date(this._state.committedStartTime) : null,
            stopTime: this._state.committedStopTime ? new Date(this._state.committedStopTime) : null
        });

        eventBus.emit('time:pending:changed', {
            hasPendingChanges: false
        });
    }

    /**
     * Cancel pending time changes (revert to committed values)
     */
    cancelTimeChanges() {
        if (!this._state.hasPendingChanges) {
            logger.log('No pending time changes to cancel', logger.CATEGORY.TIME);
            return;
        }

        // Revert to committed values
        this._state.startTime = this._state.committedStartTime ? new Date(this._state.committedStartTime) : null;
        this._state.stopTime = this._state.committedStopTime ? new Date(this._state.committedStopTime) : null;
        this._state.hasPendingChanges = false;

        logger.log('Time changes cancelled (reverted)', logger.CATEGORY.TIME);

        // Emit events
        eventBus.emit('time:cancelled', {
            startTime: this._state.startTime ? new Date(this._state.startTime) : null,
            stopTime: this._state.stopTime ? new Date(this._state.stopTime) : null
        });

        eventBus.emit('time:pending:changed', {
            hasPendingChanges: false
        });

        eventBus.emit('time:range:changed', {
            startTime: this._state.startTime ? new Date(this._state.startTime) : null,
            stopTime: this._state.stopTime ? new Date(this._state.stopTime) : null,
            pending: false
        });
    }

    /**
     * Initialize time state with default range (NOW to NOW + lookback)
     */
    initializeTimeState() {
        const now = new Date();
        const lookbackMs = this._state.lookbackHours * 60 * 60 * 1000;
        const start = new Date(now.getTime() - lookbackMs);

        this._state.currentTime = new Date(now);
        this._state.startTime = start;
        this._state.stopTime = new Date(now);
        this._state.committedStartTime = new Date(start);
        this._state.committedStopTime = new Date(now);
        this._state.hasPendingChanges = false;

        logger.log(`Time state initialized: ${start.toISOString()} to ${now.toISOString()}`, logger.CATEGORY.TIME);

        eventBus.emit('time:range:changed', {
            startTime: new Date(this._state.startTime),
            stopTime: new Date(this._state.stopTime),
            pending: false
        });

        eventBus.emit('time:changed', {
            currentTime: new Date(this._state.currentTime)
        });
    }

    /**
     * Reset to NOW
     */
    resetToNow() {
        const now = new Date();
        this.setCurrentTime(now);
        logger.log('Time reset to NOW', logger.CATEGORY.TIME);
    }

    /**
     * Mark state as having pending changes
     * @private
     */
    _markAsPending() {
        if (!this._state.hasPendingChanges) {
            this._state.hasPendingChanges = true;
            eventBus.emit('time:pending:changed', {
                hasPendingChanges: true
            });
        }
    }

    /**
     * Get time state as JSON (for debugging/storage)
     * @returns {string} JSON representation of state
     */
    toJSON() {
        return JSON.stringify({
            currentTime: this._state.currentTime.toISOString(),
            startTime: this._state.startTime ? this._state.startTime.toISOString() : null,
            stopTime: this._state.stopTime ? this._state.stopTime.toISOString() : null,
            lookbackHours: this._state.lookbackHours,
            hasPendingChanges: this._state.hasPendingChanges,
            committedStartTime: this._state.committedStartTime ? this._state.committedStartTime.toISOString() : null,
            committedStopTime: this._state.committedStopTime ? this._state.committedStopTime.toISOString() : null
        }, null, 2);
    }
}

// Export singleton instance
const timeState = new TimeState();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
    window.timeState = timeState;
}

export default timeState;
