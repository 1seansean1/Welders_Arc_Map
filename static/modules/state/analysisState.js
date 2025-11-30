/**
 * Analysis State Module - Manages analysis tools state
 *
 * DEPENDENCIES: eventBus.js, logger.js
 * PATTERN: Encapsulated state with controlled mutations
 *
 * Features:
 * - Polar plot visibility toggle
 * - Selected sensor for polar view tracking
 * - Lambert transfer analysis state
 * - Analysis checkbox states
 * - Event emissions on changes
 *
 * Events Emitted:
 * - analysis:polarplot:toggled - Polar plot visibility changed
 * - analysis:sensor:selected - Sensor selected for polar view
 * - analysis:sensor:deselected - Sensor deselected from polar view
 * - analysis:lambert:enabled - Lambert analysis panel toggled
 * - analysis:lambert:satellites:changed - Chaser/target selection changed
 * - analysis:lambert:computed - Transfer solution computed
 * - analysis:lambert:cleared - Transfer results cleared
 *
 * Usage:
 *   import analysisState from './modules/state/analysisState.js';
 *
 *   // Toggle polar plot
 *   analysisState.setPolarPlotEnabled(true);
 *
 *   // Select sensor for polar view
 *   analysisState.setPolarViewSensor(sensorId);
 *
 *   // Lambert transfer analysis
 *   analysisState.setLambertEnabled(true);
 *   analysisState.setLambertSatellites(chaserId, targetId);
 *   analysisState.setLambertResults(transferData);
 */

import eventBus from '../events/eventBus.js';
import logger from '../utils/logger.js';

/**
 * AnalysisState class - Encapsulates analysis tools state
 */
class AnalysisState {
    constructor() {
        // Private state
        this._state = {
            // Polar plot state
            polarPlotEnabled: false,
            polarViewSensorId: null,  // ID of sensor selected for polar view

            // Lambert transfer analysis state
            lambertEnabled: false,
            lambertChaserId: null,      // Chaser satellite ID
            lambertTargetId: null,      // Target satellite ID
            lambertTofSeconds: 3600,    // Time of flight (default 1 hour)
            lambertDepartureTime: null, // Departure time (null = use current sim time)
            lambertM: 0,                // Revolution count (0-3)
            lambertResults: null,       // Computed transfer solution
            lambertArcPoints: [],       // Transfer arc for visualization
        };

        logger.log('Analysis State initialized', logger.CATEGORY.UI);
    }

    // ============================================
    // POLAR PLOT STATE
    // ============================================

    /**
     * Check if polar plot is enabled
     * @returns {boolean} True if polar plot is visible
     */
    isPolarPlotEnabled() {
        return this._state.polarPlotEnabled;
    }

    /**
     * Set polar plot enabled state
     * @param {boolean} enabled - Whether polar plot should be visible
     */
    setPolarPlotEnabled(enabled) {
        const wasEnabled = this._state.polarPlotEnabled;
        this._state.polarPlotEnabled = !!enabled;

        if (wasEnabled !== this._state.polarPlotEnabled) {
            logger.log(`Polar plot ${enabled ? 'enabled' : 'disabled'}`, logger.CATEGORY.UI);

            eventBus.emit('analysis:polarplot:toggled', {
                enabled: this._state.polarPlotEnabled
            });

            // If disabling, also clear the selected sensor
            if (!enabled && this._state.polarViewSensorId !== null) {
                this.clearPolarViewSensor();
            }
        }
    }

    /**
     * Toggle polar plot enabled state
     * @returns {boolean} New enabled state
     */
    togglePolarPlot() {
        this.setPolarPlotEnabled(!this._state.polarPlotEnabled);
        return this._state.polarPlotEnabled;
    }

    // ============================================
    // POLAR VIEW SENSOR SELECTION
    // ============================================

    /**
     * Get the sensor ID selected for polar view
     * @returns {number|null} Sensor ID or null if none selected
     */
    getPolarViewSensorId() {
        return this._state.polarViewSensorId;
    }

    /**
     * Set the sensor for polar view
     * @param {number} sensorId - Sensor ID to select
     */
    setPolarViewSensor(sensorId) {
        const previousId = this._state.polarViewSensorId;

        // If clicking the same sensor, deselect it
        if (previousId === sensorId) {
            this.clearPolarViewSensor();
            return;
        }

        this._state.polarViewSensorId = sensorId;

        // Emit deselect for previous sensor if any
        if (previousId !== null) {
            eventBus.emit('analysis:sensor:deselected', {
                sensorId: previousId
            });
        }

        logger.log(`Polar view sensor selected: ${sensorId}`, logger.CATEGORY.SENSOR);

        eventBus.emit('analysis:sensor:selected', {
            sensorId: sensorId,
            previousSensorId: previousId
        });
    }

    /**
     * Clear the polar view sensor selection
     */
    clearPolarViewSensor() {
        const previousId = this._state.polarViewSensorId;

        if (previousId !== null) {
            this._state.polarViewSensorId = null;

            logger.log('Polar view sensor cleared', logger.CATEGORY.SENSOR);

            eventBus.emit('analysis:sensor:deselected', {
                sensorId: previousId
            });
        }
    }

    /**
     * Check if a specific sensor is selected for polar view
     * @param {number} sensorId - Sensor ID to check
     * @returns {boolean} True if this sensor is selected for polar view
     */
    isSensorSelectedForPolarView(sensorId) {
        return this._state.polarViewSensorId === sensorId;
    }

    // ============================================
    // LAMBERT TRANSFER ANALYSIS STATE
    // ============================================

    /**
     * Check if Lambert analysis is enabled
     * @returns {boolean} True if Lambert panel is visible
     */
    isLambertEnabled() {
        return this._state.lambertEnabled;
    }

    /**
     * Set Lambert analysis enabled state
     * @param {boolean} enabled - Whether Lambert panel should be visible
     */
    setLambertEnabled(enabled) {
        const wasEnabled = this._state.lambertEnabled;
        this._state.lambertEnabled = !!enabled;

        if (wasEnabled !== this._state.lambertEnabled) {
            logger.log(`Lambert analysis ${enabled ? 'enabled' : 'disabled'}`, logger.CATEGORY.UI);

            eventBus.emit('analysis:lambert:enabled', {
                enabled: this._state.lambertEnabled
            });

            // If disabling, clear results but keep satellite selections
            if (!enabled && this._state.lambertResults !== null) {
                this.clearLambertResults();
            }
        }
    }

    /**
     * Toggle Lambert analysis enabled state
     * @returns {boolean} New enabled state
     */
    toggleLambert() {
        this.setLambertEnabled(!this._state.lambertEnabled);
        return this._state.lambertEnabled;
    }

    /**
     * Get chaser satellite ID
     * @returns {string|null} Chaser satellite ID or null
     */
    getLambertChaserId() {
        return this._state.lambertChaserId;
    }

    /**
     * Get target satellite ID
     * @returns {string|null} Target satellite ID or null
     */
    getLambertTargetId() {
        return this._state.lambertTargetId;
    }

    /**
     * Set both chaser and target satellites
     * @param {string|null} chaserId - Chaser satellite ID
     * @param {string|null} targetId - Target satellite ID
     */
    setLambertSatellites(chaserId, targetId) {
        const previousChaser = this._state.lambertChaserId;
        const previousTarget = this._state.lambertTargetId;

        this._state.lambertChaserId = chaserId;
        this._state.lambertTargetId = targetId;

        // Clear results when satellites change
        if (previousChaser !== chaserId || previousTarget !== targetId) {
            this._state.lambertResults = null;
            this._state.lambertArcPoints = [];

            logger.log(`Lambert satellites: chaser=${chaserId}, target=${targetId}`, logger.CATEGORY.ANALYSIS);

            eventBus.emit('analysis:lambert:satellites:changed', {
                chaserId,
                targetId,
                previousChaserId: previousChaser,
                previousTargetId: previousTarget
            });
        }
    }

    /**
     * Set chaser satellite (keeps current target)
     * @param {string|null} chaserId - Chaser satellite ID
     */
    setLambertChaser(chaserId) {
        this.setLambertSatellites(chaserId, this._state.lambertTargetId);
    }

    /**
     * Set target satellite (keeps current chaser)
     * @param {string|null} targetId - Target satellite ID
     */
    setLambertTarget(targetId) {
        this.setLambertSatellites(this._state.lambertChaserId, targetId);
    }

    /**
     * Get time of flight in seconds
     * @returns {number} Time of flight in seconds
     */
    getLambertTof() {
        return this._state.lambertTofSeconds;
    }

    /**
     * Set time of flight
     * @param {number} tofSeconds - Time of flight in seconds
     */
    setLambertTof(tofSeconds) {
        if (typeof tofSeconds === 'number' && tofSeconds > 0) {
            this._state.lambertTofSeconds = tofSeconds;
            // Clear results when TOF changes
            if (this._state.lambertResults !== null) {
                this.clearLambertResults();
            }
        }
    }

    /**
     * Get departure time
     * @returns {Date|null} Departure time or null (use sim time)
     */
    getLambertDepartureTime() {
        return this._state.lambertDepartureTime;
    }

    /**
     * Set departure time
     * @param {Date|null} departureTime - Departure time or null for current sim time
     */
    setLambertDepartureTime(departureTime) {
        this._state.lambertDepartureTime = departureTime;
        // Clear results when departure time changes
        if (this._state.lambertResults !== null) {
            this.clearLambertResults();
        }
    }

    /**
     * Get revolution count (M)
     * @returns {number} Revolution count 0-3
     */
    getLambertM() {
        return this._state.lambertM;
    }

    /**
     * Set revolution count
     * @param {number} m - Revolution count 0-3
     */
    setLambertM(m) {
        if (typeof m === 'number' && m >= 0 && m <= 3) {
            this._state.lambertM = Math.floor(m);
            // Clear results when M changes
            if (this._state.lambertResults !== null) {
                this.clearLambertResults();
            }
        }
    }

    /**
     * Get computed Lambert results
     * @returns {Object|null} Transfer solution or null
     */
    getLambertResults() {
        return this._state.lambertResults;
    }

    /**
     * Set computed Lambert results
     * @param {Object} results - Transfer solution from computeTransfer
     */
    setLambertResults(results) {
        this._state.lambertResults = results;

        if (results && results.arcPoints) {
            this._state.lambertArcPoints = results.arcPoints;
        }

        logger.log('Lambert transfer computed', logger.CATEGORY.ANALYSIS);

        eventBus.emit('analysis:lambert:computed', {
            results,
            chaserId: this._state.lambertChaserId,
            targetId: this._state.lambertTargetId
        });
    }

    /**
     * Get transfer arc points for visualization
     * @returns {Array} Array of [lng, lat, alt] points
     */
    getLambertArcPoints() {
        return this._state.lambertArcPoints;
    }

    /**
     * Clear Lambert results (keeps satellite selections)
     */
    clearLambertResults() {
        const hadResults = this._state.lambertResults !== null;

        this._state.lambertResults = null;
        this._state.lambertArcPoints = [];

        if (hadResults) {
            logger.log('Lambert results cleared', logger.CATEGORY.ANALYSIS);

            eventBus.emit('analysis:lambert:cleared', {
                chaserId: this._state.lambertChaserId,
                targetId: this._state.lambertTargetId
            });
        }
    }

    /**
     * Clear all Lambert state
     */
    clearLambert() {
        this._state.lambertChaserId = null;
        this._state.lambertTargetId = null;
        this._state.lambertResults = null;
        this._state.lambertArcPoints = [];
        this._state.lambertTofSeconds = 3600;
        this._state.lambertDepartureTime = null;
        this._state.lambertM = 0;

        logger.log('Lambert state cleared', logger.CATEGORY.ANALYSIS);

        eventBus.emit('analysis:lambert:satellites:changed', {
            chaserId: null,
            targetId: null,
            previousChaserId: null,
            previousTargetId: null
        });
    }

    /**
     * Check if Lambert analysis is ready to compute
     * @returns {boolean} True if both satellites are selected
     */
    isLambertReady() {
        return this._state.lambertChaserId !== null &&
               this._state.lambertTargetId !== null &&
               this._state.lambertChaserId !== this._state.lambertTargetId;
    }

    // ============================================
    // STATE EXPORT (for persistence)
    // ============================================

    /**
     * Export state for persistence
     * @returns {Object} Serializable state object
     */
    exportState() {
        return {
            polarPlotEnabled: this._state.polarPlotEnabled,
            polarViewSensorId: this._state.polarViewSensorId,
            lambertEnabled: this._state.lambertEnabled,
            lambertChaserId: this._state.lambertChaserId,
            lambertTargetId: this._state.lambertTargetId,
            lambertTofSeconds: this._state.lambertTofSeconds,
            lambertM: this._state.lambertM
            // Note: lambertResults and lambertArcPoints are transient, not persisted
        };
    }

    /**
     * Import state from persistence
     * @param {Object} state - Previously exported state
     */
    importState(state) {
        if (state) {
            if (typeof state.polarPlotEnabled === 'boolean') {
                this.setPolarPlotEnabled(state.polarPlotEnabled);
            }
            if (typeof state.polarViewSensorId === 'number') {
                this.setPolarViewSensor(state.polarViewSensorId);
            }
            if (typeof state.lambertEnabled === 'boolean') {
                this.setLambertEnabled(state.lambertEnabled);
            }
            if (state.lambertChaserId || state.lambertTargetId) {
                this.setLambertSatellites(state.lambertChaserId, state.lambertTargetId);
            }
            if (typeof state.lambertTofSeconds === 'number') {
                this.setLambertTof(state.lambertTofSeconds);
            }
            if (typeof state.lambertM === 'number') {
                this.setLambertM(state.lambertM);
            }
        }
    }

    /**
     * Reset to initial state
     */
    reset() {
        // Reset polar plot state
        this._state.polarPlotEnabled = false;
        this._state.polarViewSensorId = null;

        // Reset Lambert state
        this._state.lambertEnabled = false;
        this._state.lambertChaserId = null;
        this._state.lambertTargetId = null;
        this._state.lambertTofSeconds = 3600;
        this._state.lambertDepartureTime = null;
        this._state.lambertM = 0;
        this._state.lambertResults = null;
        this._state.lambertArcPoints = [];

        logger.log('Analysis state reset', logger.CATEGORY.UI);
    }
}

// Export singleton instance
const analysisState = new AnalysisState();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
    window.analysisState = analysisState;
}

export default analysisState;
