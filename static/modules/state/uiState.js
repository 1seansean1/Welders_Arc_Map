/**
 * UI State Module - Manages user interface state
 *
 * DEPENDENCIES: eventBus.js
 * PATTERN: Encapsulated state with controlled mutations
 *
 * Features:
 * - Panel expansion/collapse state
 * - Active section tracking
 * - Mobile device detection
 * - Event emissions on state changes
 * - Read-only state access
 *
 * Events Emitted:
 * - state:ui:changed - When any UI state changes
 * - ui:panel:opened - When panel is expanded
 * - ui:panel:closed - When panel is collapsed
 * - ui:section:changed - When active section changes
 *
 * Usage:
 *   import uiState from './modules/state/uiState.js';
 *
 *   // Get state
 *   const state = uiState.getUIState();
 *   const isMobile = uiState.isMobile();
 *
 *   // Set state (triggers events)
 *   uiState.setPanelExpanded(true);
 *   uiState.setActiveSection('sensors');
 */

import eventBus from '../events/eventBus.js';
import logger from '../utils/logger.js';

/**
 * UIState class - Encapsulates UI state management
 */
class UIState {
    constructor() {
        // Private state object
        this._state = {
            panelExpanded: false,
            activeSection: 'time', // 'time', 'sensors', 'satellites', 'settings'
            isMobile: window.innerWidth < 768
        };

        // Set up window resize listener for mobile detection
        this._setupResizeListener();

        logger.log('UI State initialized', logger.CATEGORY.SYSTEM);
    }

    /**
     * Set up window resize listener for mobile detection
     * @private
     */
    _setupResizeListener() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            // Debounce resize events
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const wasMobile = this._state.isMobile;
                const isMobile = window.innerWidth < 768;

                if (wasMobile !== isMobile) {
                    this._state.isMobile = isMobile;
                    logger.log(`Mobile state changed: ${isMobile}`, logger.CATEGORY.UI);

                    // Emit state change event
                    this._emitStateChange('isMobile', isMobile);

                    // Auto-collapse panel on mobile
                    if (isMobile && this._state.panelExpanded) {
                        this.setPanelExpanded(false);
                    }
                }
            }, 250);
        });
    }

    /**
     * Emit state change event
     * @private
     * @param {string} key - State key that changed
     * @param {*} value - New value
     */
    _emitStateChange(key, value) {
        eventBus.emit('state:ui:changed', {
            key,
            value,
            state: this.getUIState()
        });
    }

    /**
     * Get complete UI state (read-only copy)
     * @returns {Object} Copy of UI state
     */
    getUIState() {
        // Return a copy to prevent direct mutation
        return {
            panelExpanded: this._state.panelExpanded,
            activeSection: this._state.activeSection,
            isMobile: this._state.isMobile
        };
    }

    /**
     * Check if device is mobile
     * @returns {boolean} True if mobile device
     */
    isMobile() {
        return this._state.isMobile;
    }

    /**
     * Get panel expansion state
     * @returns {boolean} True if panel is expanded
     */
    isPanelExpanded() {
        return this._state.panelExpanded;
    }

    /**
     * Get active section
     * @returns {string} Active section name
     */
    getActiveSection() {
        return this._state.activeSection;
    }

    /**
     * Set panel expansion state
     * @param {boolean} expanded - True to expand, false to collapse
     * @returns {boolean} New state
     */
    setPanelExpanded(expanded) {
        if (typeof expanded !== 'boolean') {
            logger.log('setPanelExpanded: argument must be boolean', logger.CATEGORY.ERROR);
            return this._state.panelExpanded;
        }

        const oldValue = this._state.panelExpanded;
        if (oldValue === expanded) {
            return expanded; // No change
        }

        this._state.panelExpanded = expanded;
        logger.log(`Panel ${expanded ? 'expanded' : 'collapsed'}`, logger.CATEGORY.UI);

        // Emit specific panel event
        eventBus.emit(expanded ? 'ui:panel:opened' : 'ui:panel:closed', {
            expanded
        });

        // Emit generic state change event
        this._emitStateChange('panelExpanded', expanded);

        return expanded;
    }

    /**
     * Toggle panel expansion state
     * @returns {boolean} New state
     */
    togglePanelExpanded() {
        return this.setPanelExpanded(!this._state.panelExpanded);
    }

    /**
     * Set active section
     * @param {string} section - Section name ('time', 'sensors', 'satellites', 'settings')
     * @returns {string} New active section
     */
    setActiveSection(section) {
        if (typeof section !== 'string') {
            logger.log('setActiveSection: argument must be string', logger.CATEGORY.ERROR);
            return this._state.activeSection;
        }

        // Validate section name
        const validSections = ['time', 'sensors', 'satellites', 'settings'];
        if (!validSections.includes(section)) {
            logger.log(`setActiveSection: invalid section "${section}"`, logger.CATEGORY.ERROR);
            return this._state.activeSection;
        }

        const oldValue = this._state.activeSection;
        if (oldValue === section) {
            return section; // No change
        }

        this._state.activeSection = section;
        logger.log(`Active section changed: ${oldValue} → ${section}`, logger.CATEGORY.UI);

        // Emit specific section change event
        eventBus.emit('ui:section:changed', {
            oldSection: oldValue,
            newSection: section
        });

        // Emit generic state change event
        this._emitStateChange('activeSection', section);

        return section;
    }

    /**
     * Reset UI state to defaults
     */
    reset() {
        const oldState = { ...this._state };

        this._state.panelExpanded = false;
        this._state.activeSection = 'time';
        // Note: isMobile is not reset as it's environment-dependent

        logger.log('UI state reset to defaults', logger.CATEGORY.UI);

        // Emit events for changes
        if (oldState.panelExpanded !== this._state.panelExpanded) {
            eventBus.emit('ui:panel:closed', { expanded: false });
            this._emitStateChange('panelExpanded', false);
        }

        if (oldState.activeSection !== this._state.activeSection) {
            eventBus.emit('ui:section:changed', {
                oldSection: oldState.activeSection,
                newSection: 'time'
            });
            this._emitStateChange('activeSection', 'time');
        }
    }

    /**
     * Get UI state as JSON (for debugging/storage)
     * @returns {string} JSON representation of state
     */
    toJSON() {
        return JSON.stringify(this.getUIState(), null, 2);
    }

    /**
     * Load UI state from object
     * @param {Object} stateObj - State object to load
     * @returns {boolean} True if successful
     */
    fromObject(stateObj) {
        if (!stateObj || typeof stateObj !== 'object') {
            logger.log('fromObject: invalid state object', logger.CATEGORY.ERROR);
            return false;
        }

        let changed = false;

        if (typeof stateObj.panelExpanded === 'boolean') {
            this.setPanelExpanded(stateObj.panelExpanded);
            changed = true;
        }

        if (typeof stateObj.activeSection === 'string') {
            this.setActiveSection(stateObj.activeSection);
            changed = true;
        }

        if (changed) {
            logger.log('UI state loaded from object', logger.CATEGORY.UI);
        }

        return changed;
    }
}

// Export singleton instance
const uiState = new UIState();

// Make it available globally for debugging (optional)
if (typeof window !== 'undefined') {
    window.uiState = uiState;
}

export default uiState;
