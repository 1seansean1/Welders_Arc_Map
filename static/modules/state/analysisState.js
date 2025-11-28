/**
 * Analysis State Module - Manages analysis tools state
 *
 * DEPENDENCIES: eventBus.js, logger.js
 * PATTERN: Encapsulated state with controlled mutations
 *
 * Features:
 * - Polar plot visibility toggle
 * - Selected sensor for polar view tracking
 * - Analysis checkbox states
 * - Event emissions on changes
 *
 * Events Emitted:
 * - analysis:polarplot:toggled - Polar plot visibility changed
 * - analysis:sensor:selected - Sensor selected for polar view
 * - analysis:sensor:deselected - Sensor deselected from polar view
 *
 * Usage:
 *   import analysisState from './modules/state/analysisState.js';
 *
 *   // Toggle polar plot
 *   analysisState.setPolarPlotEnabled(true);
 *
 *   // Select sensor for polar view
 *   analysisState.setPolarViewSensor(sensorId);
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

            // Future analysis tools can add their state here
            // e.g., coverageMapEnabled: false,
            //       passListEnabled: false,
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
    // STATE EXPORT (for persistence)
    // ============================================

    /**
     * Export state for persistence
     * @returns {Object} Serializable state object
     */
    exportState() {
        return {
            polarPlotEnabled: this._state.polarPlotEnabled,
            polarViewSensorId: this._state.polarViewSensorId
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
        }
    }

    /**
     * Reset to initial state
     */
    reset() {
        this._state.polarPlotEnabled = false;
        this._state.polarViewSensorId = null;
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
