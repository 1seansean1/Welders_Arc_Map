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

            // Ground track tail/head durations (in minutes)
            tailMinutes: 45,  // How far back to render ground track (default: 45 min)
            headMinutes: 0,   // How far forward to render ground track (default: 0 min)

            // Equator crossing glow settings
            glowEnabled: true,       // Whether to show equator crossing glow
            glowIntensity: 1.0,      // Glow brightness multiplier (0.1 - 2.0)
            glowFadeInMinutes: 5,    // Minutes BEFORE equator crossing to start fade in (1-30)
            glowFadeOutMinutes: 5,   // Minutes AFTER equator crossing to end fade out (1-30)

            // Time slider settings
            timeStepMinutes: 5,    // Step size for < > buttons (1, 5, 15, 30, 60)
            isRealTime: true,      // True = auto-update to current time
            playbackSpeed: 1,      // Playback multiplier (1x, 2x, etc.)

            // Pending changes tracking
            hasPendingChanges: false,
            committedStartTime: null,
            committedStopTime: null,

            // Seek points - named time bookmarks for navigation
            // Future use: AOS/LOS events, conjunction times, user bookmarks
            seekPoints: []
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
     * Get ground track tail duration (minutes)
     * @returns {number} Tail duration in minutes
     */
    getTailMinutes() {
        return this._state.tailMinutes;
    }

    /**
     * Get ground track head duration (minutes)
     * @returns {number} Head duration in minutes
     */
    getHeadMinutes() {
        return this._state.headMinutes;
    }

    /**
     * Set ground track tail duration (minutes)
     * @param {number} minutes - Tail duration in minutes (0-90)
     */
    setTailMinutes(minutes) {
        if (typeof minutes !== 'number' || minutes < 0 || minutes > 90) {
            logger.log('setTailMinutes: must be 0-90 minutes', logger.CATEGORY.ERROR);
            return;
        }

        this._state.tailMinutes = minutes;
        logger.log(`Tail duration set: ${minutes} minutes`, logger.CATEGORY.TIME);

        eventBus.emit('time:track:changed', {
            tailMinutes: this._state.tailMinutes,
            headMinutes: this._state.headMinutes
        });
    }

    /**
     * Set ground track head duration (minutes)
     * @param {number} minutes - Head duration in minutes (0-90)
     */
    setHeadMinutes(minutes) {
        if (typeof minutes !== 'number' || minutes < 0 || minutes > 90) {
            logger.log('setHeadMinutes: must be 0-90 minutes', logger.CATEGORY.ERROR);
            return;
        }

        this._state.headMinutes = minutes;
        logger.log(`Head duration set: ${minutes} minutes`, logger.CATEGORY.TIME);

        eventBus.emit('time:track:changed', {
            tailMinutes: this._state.tailMinutes,
            headMinutes: this._state.headMinutes
        });
    }

    /**
     * Get glow enabled state
     * @returns {boolean} True if glow is enabled
     */
    isGlowEnabled() {
        return this._state.glowEnabled;
    }

    /**
     * Get glow intensity multiplier
     * @returns {number} Glow intensity (0.1 - 2.0)
     */
    getGlowIntensity() {
        return this._state.glowIntensity;
    }

    /**
     * Set glow enabled state
     * @param {boolean} enabled - True to enable glow
     */
    setGlowEnabled(enabled) {
        if (typeof enabled !== 'boolean') {
            logger.log('setGlowEnabled: must be boolean', logger.CATEGORY.ERROR);
            return;
        }

        this._state.glowEnabled = enabled;
        logger.log(`Glow effect ${enabled ? 'enabled' : 'disabled'}`, logger.CATEGORY.TIME);

        eventBus.emit('time:glow:changed', {
            glowEnabled: this._state.glowEnabled,
            glowIntensity: this._state.glowIntensity
        });
    }

    /**
     * Set glow intensity multiplier
     * @param {number} intensity - Glow intensity (0.1 - 2.0)
     */
    setGlowIntensity(intensity) {
        if (typeof intensity !== 'number' || intensity < 0.1 || intensity > 2.0) {
            logger.log('setGlowIntensity: must be 0.1-2.0', logger.CATEGORY.ERROR);
            return;
        }

        this._state.glowIntensity = intensity;
        logger.log(`Glow intensity set: ${intensity}`, logger.CATEGORY.TIME);

        this._emitGlowChanged();
    }

    /**
     * Get glow fade-in duration in minutes (before crossing)
     * @returns {number} Fade-in duration in minutes (1-30)
     */
    getGlowFadeInMinutes() {
        return this._state.glowFadeInMinutes;
    }

    /**
     * Get glow fade-out duration in minutes (after crossing)
     * @returns {number} Fade-out duration in minutes (1-30)
     */
    getGlowFadeOutMinutes() {
        return this._state.glowFadeOutMinutes;
    }

    /**
     * Set glow fade-in duration in minutes (before crossing)
     * @param {number} minutes - Fade-in duration (1-30)
     */
    setGlowFadeInMinutes(minutes) {
        if (typeof minutes !== 'number' || minutes < 1 || minutes > 30) {
            logger.log('setGlowFadeInMinutes: must be 1-30 minutes', logger.CATEGORY.ERROR);
            return;
        }

        this._state.glowFadeInMinutes = minutes;
        logger.log(`Glow fade-in set: ${minutes} min before`, logger.CATEGORY.TIME);
        this._emitGlowChanged();
    }

    /**
     * Set glow fade-out duration in minutes (after crossing)
     * @param {number} minutes - Fade-out duration (1-30)
     */
    setGlowFadeOutMinutes(minutes) {
        if (typeof minutes !== 'number' || minutes < 1 || minutes > 30) {
            logger.log('setGlowFadeOutMinutes: must be 1-30 minutes', logger.CATEGORY.ERROR);
            return;
        }

        this._state.glowFadeOutMinutes = minutes;
        logger.log(`Glow fade-out set: ${minutes} min after`, logger.CATEGORY.TIME);
        this._emitGlowChanged();
    }

    /**
     * Emit glow changed event (internal helper)
     */
    _emitGlowChanged() {
        eventBus.emit('time:glow:changed', {
            glowEnabled: this._state.glowEnabled,
            glowIntensity: this._state.glowIntensity,
            glowFadeInMinutes: this._state.glowFadeInMinutes,
            glowFadeOutMinutes: this._state.glowFadeOutMinutes
        });
    }

    // ============================================
    // TIME SLIDER METHODS
    // ============================================

    /**
     * Get time step in minutes
     * @returns {number} Time step in minutes
     */
    getTimeStepMinutes() {
        return this._state.timeStepMinutes;
    }

    /**
     * Set time step in minutes
     * @param {number} minutes - Step size (1, 5, 15, 30, 60)
     */
    setTimeStepMinutes(minutes) {
        const validSteps = [1, 5, 15, 30, 60];
        if (!validSteps.includes(minutes)) {
            logger.log(`setTimeStepMinutes: must be one of ${validSteps.join(', ')}`, logger.CATEGORY.ERROR);
            return;
        }

        this._state.timeStepMinutes = minutes;
        logger.log(`Time step set: ${minutes} minutes`, logger.CATEGORY.TIME);

        eventBus.emit('time:step:changed', {
            timeStepMinutes: minutes
        });
    }

    /**
     * Valid playback rate multipliers
     * @type {number[]}
     */
    static VALID_PLAYBACK_RATES = [0.5, 1, 2, 4, 8, 16, 60, 600];

    /**
     * Get playback rate multiplier
     * @returns {number} Current playback rate (0.5x to 600x)
     */
    getPlaybackRate() {
        return this._state.playbackSpeed;
    }

    /**
     * Set playback rate multiplier
     * @param {number} rate - Playback rate (0.5, 1, 2, 4, 8, 16, 60, 600)
     */
    setPlaybackRate(rate) {
        if (!TimeState.VALID_PLAYBACK_RATES.includes(rate)) {
            logger.log(`setPlaybackRate: must be one of ${TimeState.VALID_PLAYBACK_RATES.join(', ')}`, logger.CATEGORY.ERROR);
            return;
        }

        this._state.playbackSpeed = rate;
        logger.log(`Playback rate set: ${rate}x`, logger.CATEGORY.TIME);

        eventBus.emit('time:playback:changed', {
            playbackRate: rate
        });
    }

    // ============================================
    // SEEK POINTS (STUB - Future Feature)
    // ============================================
    // Seek points are named time bookmarks for quick navigation.
    // Future use cases:
    // - Satellite pass AOS/LOS (Acquisition/Loss of Signal) times
    // - Conjunction/close approach events
    // - User-defined analysis bookmarks
    // - Analysis window start/end bounds
    // - Ground station contact windows

    /**
     * Get all seek points sorted chronologically
     * @returns {Array<{name: string, time: Date, type: string}>} Seek points
     */
    getSeekPoints() {
        return this._state.seekPoints
            .map(sp => ({ ...sp, time: new Date(sp.time) }))
            .sort((a, b) => a.time.getTime() - b.time.getTime());
    }

    /**
     * Add a seek point
     * @param {string} name - Unique name for the seek point
     * @param {Date} time - Time of the seek point
     * @param {string} [type='user'] - Type: 'user', 'aos', 'los', 'conjunction', etc.
     * @returns {boolean} True if added successfully
     */
    addSeekPoint(name, time, type = 'user') {
        if (!name || typeof name !== 'string') {
            logger.log('addSeekPoint: name required', logger.CATEGORY.ERROR);
            return false;
        }
        if (!(time instanceof Date) || isNaN(time)) {
            logger.log('addSeekPoint: valid date required', logger.CATEGORY.ERROR);
            return false;
        }

        // Remove existing point with same name
        this.removeSeekPoint(name);

        this._state.seekPoints.push({
            name,
            time: new Date(time),
            type
        });

        logger.log(`Seek point added: ${name} at ${time.toISOString()}`, logger.CATEGORY.TIME);
        eventBus.emit('time:seekpoints:changed', { seekPoints: this.getSeekPoints() });
        return true;
    }

    /**
     * Remove a seek point by name
     * @param {string} name - Name of seek point to remove
     * @returns {boolean} True if removed
     */
    removeSeekPoint(name) {
        const index = this._state.seekPoints.findIndex(sp => sp.name === name);
        if (index !== -1) {
            this._state.seekPoints.splice(index, 1);
            logger.log(`Seek point removed: ${name}`, logger.CATEGORY.TIME);
            eventBus.emit('time:seekpoints:changed', { seekPoints: this.getSeekPoints() });
            return true;
        }
        return false;
    }

    /**
     * Clear all seek points
     */
    clearSeekPoints() {
        this._state.seekPoints = [];
        logger.log('All seek points cleared', logger.CATEGORY.TIME);
        eventBus.emit('time:seekpoints:changed', { seekPoints: [] });
    }

    /**
     * Seek to a named point
     * @param {string} name - Name of seek point
     * @returns {boolean} True if found and seeked
     */
    seekToPoint(name) {
        const point = this._state.seekPoints.find(sp => sp.name === name);
        if (point) {
            this.setCurrentTime(new Date(point.time));
            logger.log(`Seeked to: ${name}`, logger.CATEGORY.TIME);
            return true;
        }
        logger.log(`Seek point not found: ${name}`, logger.CATEGORY.ERROR);
        return false;
    }

    /**
     * Seek to next point after current time
     * @returns {boolean} True if found and seeked
     */
    seekNext() {
        const currentMs = this._state.currentTime.getTime();
        const points = this.getSeekPoints();
        const next = points.find(sp => sp.time.getTime() > currentMs);
        if (next) {
            this.setCurrentTime(next.time);
            logger.log(`Seeked to next: ${next.name}`, logger.CATEGORY.TIME);
            return true;
        }
        logger.log('No seek points ahead', logger.CATEGORY.TIME);
        return false;
    }

    /**
     * Seek to previous point before current time
     * @returns {boolean} True if found and seeked
     */
    seekPrevious() {
        const currentMs = this._state.currentTime.getTime();
        const points = this.getSeekPoints().reverse();
        const prev = points.find(sp => sp.time.getTime() < currentMs);
        if (prev) {
            this.setCurrentTime(prev.time);
            logger.log(`Seeked to previous: ${prev.name}`, logger.CATEGORY.TIME);
            return true;
        }
        logger.log('No seek points behind', logger.CATEGORY.TIME);
        return false;
    }

    /**
     * Check if in real-time mode
     * @returns {boolean} True if tracking real time
     */
    isRealTime() {
        return this._state.isRealTime;
    }

    /**
     * Step current time forward or backward
     * @param {number} direction - 1 for forward, -1 for backward
     */
    stepTime(direction) {
        if (direction !== 1 && direction !== -1) {
            logger.log('stepTime: direction must be 1 or -1', logger.CATEGORY.ERROR);
            return;
        }

        // Exit real-time mode when manually stepping
        this._state.isRealTime = false;

        const stepMs = this._state.timeStepMinutes * 60 * 1000;
        const newTime = new Date(this._state.currentTime.getTime() + (direction * stepMs));

        // Clamp to start/stop range if set
        if (this._state.committedStartTime && newTime < this._state.committedStartTime) {
            this._state.currentTime = new Date(this._state.committedStartTime);
        } else if (this._state.committedStopTime && newTime > this._state.committedStopTime) {
            this._state.currentTime = new Date(this._state.committedStopTime);
        } else {
            this._state.currentTime = newTime;
        }

        logger.log(`Time stepped ${direction > 0 ? 'forward' : 'backward'}: ${this._state.currentTime.toISOString()}`, logger.CATEGORY.TIME);

        eventBus.emit('time:changed', {
            currentTime: new Date(this._state.currentTime),
            isRealTime: false
        });
    }

    /**
     * Set current time from slider position (0-1)
     * @param {number} position - Slider position (0 = start, 1 = stop)
     */
    setTimeFromSlider(position) {
        if (typeof position !== 'number' || position < 0 || position > 1) {
            logger.log('setTimeFromSlider: position must be 0-1', logger.CATEGORY.ERROR);
            return;
        }

        // Exit real-time mode when manually scrubbing
        this._state.isRealTime = false;

        const start = this._state.committedStartTime || this._state.startTime;
        const stop = this._state.committedStopTime || this._state.stopTime;

        if (!start || !stop) {
            logger.log('setTimeFromSlider: start/stop times not set', logger.CATEGORY.ERROR);
            return;
        }

        const range = stop.getTime() - start.getTime();
        const newTime = new Date(start.getTime() + (position * range));
        this._state.currentTime = newTime;

        eventBus.emit('time:changed', {
            currentTime: new Date(this._state.currentTime),
            isRealTime: false
        });
    }

    /**
     * Get slider position for current time (0-1)
     * @returns {number} Slider position (0 = start, 1 = stop)
     */
    getSliderPosition() {
        const start = this._state.committedStartTime || this._state.startTime;
        const stop = this._state.committedStopTime || this._state.stopTime;

        if (!start || !stop) return 0;

        const range = stop.getTime() - start.getTime();
        if (range <= 0) return 0;

        const position = (this._state.currentTime.getTime() - start.getTime()) / range;
        return Math.max(0, Math.min(1, position));
    }

    /**
     * Resume real-time mode (track current system time)
     */
    resumeRealTime() {
        this._state.isRealTime = true;
        this._state.currentTime = new Date();

        logger.log('Resumed real-time mode', logger.CATEGORY.TIME);

        eventBus.emit('time:changed', {
            currentTime: new Date(this._state.currentTime),
            isRealTime: true
        });
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
     * Initialize time state with default range centered on NOW
     * Window is split: half lookback, half lookforward
     * This places NOW at the middle of the slider (position 0.5)
     */
    initializeTimeState() {
        const now = new Date();
        // Split the window: half behind NOW, half ahead
        const halfWindowMs = (this._state.lookbackHours / 2) * 60 * 60 * 1000;
        const start = new Date(now.getTime() - halfWindowMs);
        const stop = new Date(now.getTime() + halfWindowMs);

        this._state.currentTime = new Date(now);
        this._state.startTime = start;
        this._state.stopTime = stop;
        this._state.committedStartTime = new Date(start);
        this._state.committedStopTime = new Date(stop);
        this._state.hasPendingChanges = false;

        logger.log(`Time state initialized (centered): ${start.toISOString()} to ${stop.toISOString()}`, logger.CATEGORY.TIME);

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
