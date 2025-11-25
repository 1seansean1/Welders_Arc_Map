/**
 * Event Bus - Centralized event communication system
 *
 * DEPENDENCIES: logger.js
 * PATTERN: Singleton pub/sub
 *
 * Features:
 * - Event subscription/unsubscription
 * - Event emission with data payload
 * - One-time event listeners
 * - Error handling to prevent listener crashes
 * - Debugging support with event logging
 *
 * Usage:
 *   import eventBus from './modules/events/eventBus.js';
 *
 *   // Subscribe to events
 *   eventBus.on('sensor:added', (data) => {
 *       console.log('Sensor added:', data);
 *   });
 *
 *   // Emit events
 *   eventBus.emit('sensor:added', { id: 1, name: 'Sensor 1' });
 *
 *   // Unsubscribe
 *   eventBus.off('sensor:added', handlerFunction);
 *
 *   // One-time subscription
 *   eventBus.once('map:loaded', () => {
 *       console.log('Map loaded!');
 *   });
 */

import logger from '../utils/logger.js';

/**
 * EventBus class - Manages event subscriptions and emissions
 */
class EventBus {
    constructor() {
        // Map of event names to arrays of listener functions
        // Format: { eventName: [listener1, listener2, ...] }
        this.listeners = new Map();

        // Track one-time listeners for cleanup
        this.onceListeners = new WeakMap();

        // Debug mode flag (set to true to log all events)
        this.debug = false;

        logger.log('Event Bus initialized', logger.CATEGORY.SYSTEM);
    }

    /**
     * Subscribe to an event
     * @param {string} eventName - Name of the event to listen for
     * @param {Function} listener - Callback function to invoke when event occurs
     * @returns {Function} The listener function (for easy unsubscribe)
     */
    on(eventName, listener) {
        if (typeof eventName !== 'string') {
            logger.log(`EventBus.on: eventName must be a string, got ${typeof eventName}`, logger.CATEGORY.ERROR);
            return listener;
        }

        if (typeof listener !== 'function') {
            logger.log(`EventBus.on: listener must be a function for event "${eventName}"`, logger.CATEGORY.ERROR);
            return listener;
        }

        // Create listener array if it doesn't exist
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }

        // Add listener to array
        this.listeners.get(eventName).push(listener);

        if (this.debug) {
            logger.log(`Event listener added: ${eventName} (${this.listeners.get(eventName).length} total)`, logger.CATEGORY.SYSTEM);
        }

        return listener;
    }

    /**
     * Unsubscribe from an event
     * @param {string} eventName - Name of the event
     * @param {Function} listener - The listener function to remove
     * @returns {boolean} True if listener was found and removed
     */
    off(eventName, listener) {
        if (!this.listeners.has(eventName)) {
            return false;
        }

        const listeners = this.listeners.get(eventName);
        const index = listeners.indexOf(listener);

        if (index === -1) {
            return false;
        }

        // Remove listener from array
        listeners.splice(index, 1);

        // Clean up empty listener arrays
        if (listeners.length === 0) {
            this.listeners.delete(eventName);
        }

        if (this.debug) {
            logger.log(`Event listener removed: ${eventName}`, logger.CATEGORY.SYSTEM);
        }

        return true;
    }

    /**
     * Subscribe to an event, but only fire once
     * @param {string} eventName - Name of the event to listen for
     * @param {Function} listener - Callback function to invoke when event occurs
     * @returns {Function} The wrapper function (for potential unsubscribe)
     */
    once(eventName, listener) {
        if (typeof listener !== 'function') {
            logger.log(`EventBus.once: listener must be a function for event "${eventName}"`, logger.CATEGORY.ERROR);
            return listener;
        }

        // Create a wrapper that unsubscribes after first call
        const onceWrapper = (...args) => {
            this.off(eventName, onceWrapper);
            listener(...args);
        };

        // Track the relationship for potential manual removal
        this.onceListeners.set(onceWrapper, listener);

        this.on(eventName, onceWrapper);

        return onceWrapper;
    }

    /**
     * Emit an event to all subscribers
     * @param {string} eventName - Name of the event to emit
     * @param {*} data - Data payload to pass to listeners (optional)
     * @returns {number} Number of listeners that were called
     */
    emit(eventName, data = null) {
        if (!this.listeners.has(eventName)) {
            if (this.debug) {
                logger.log(`Event emitted with no listeners: ${eventName}`, logger.CATEGORY.SYSTEM);
            }
            return 0;
        }

        const listeners = this.listeners.get(eventName);
        let callCount = 0;

        if (this.debug) {
            logger.log(`Event emitted: ${eventName} → ${listeners.length} listener(s)`, logger.CATEGORY.SYSTEM);
        }

        // Call each listener with error handling
        // Use slice() to create a copy in case listeners modify the array during iteration
        listeners.slice().forEach(listener => {
            try {
                listener(data);
                callCount++;
            } catch (error) {
                // Log error but continue calling other listeners
                logger.log(
                    `Error in event listener for "${eventName}": ${error.message}`,
                    logger.CATEGORY.ERROR
                );
                console.error(`Event listener error (${eventName}):`, error);
            }
        });

        return callCount;
    }

    /**
     * Remove all listeners for a specific event, or all events if no name provided
     * @param {string} eventName - Name of event to clear (optional, clears all if omitted)
     */
    clear(eventName = null) {
        if (eventName) {
            // Clear specific event
            if (this.listeners.has(eventName)) {
                const count = this.listeners.get(eventName).length;
                this.listeners.delete(eventName);
                logger.log(`Cleared ${count} listener(s) for event: ${eventName}`, logger.CATEGORY.SYSTEM);
            }
        } else {
            // Clear all events
            const totalListeners = Array.from(this.listeners.values())
                .reduce((sum, listeners) => sum + listeners.length, 0);
            this.listeners.clear();
            logger.log(`Cleared all event listeners (${totalListeners} total)`, logger.CATEGORY.SYSTEM);
        }
    }

    /**
     * Get number of listeners for an event
     * @param {string} eventName - Name of the event
     * @returns {number} Number of listeners
     */
    listenerCount(eventName) {
        if (!this.listeners.has(eventName)) {
            return 0;
        }
        return this.listeners.get(eventName).length;
    }

    /**
     * Get all registered event names
     * @returns {string[]} Array of event names
     */
    eventNames() {
        return Array.from(this.listeners.keys());
    }

    /**
     * Enable/disable debug mode
     * @param {boolean} enabled - True to enable debug logging
     */
    setDebug(enabled) {
        this.debug = enabled;
        logger.log(`Event Bus debug mode: ${enabled ? 'enabled' : 'disabled'}`, logger.CATEGORY.SYSTEM);
    }

    /**
     * Get statistics about the event bus
     * @returns {Object} Statistics object
     */
    getStats() {
        const stats = {
            totalEvents: this.listeners.size,
            totalListeners: 0,
            events: {}
        };

        for (const [eventName, listeners] of this.listeners) {
            stats.events[eventName] = listeners.length;
            stats.totalListeners += listeners.length;
        }

        return stats;
    }
}

// Export singleton instance
const eventBus = new EventBus();

// Make it available globally for debugging (optional)
if (typeof window !== 'undefined') {
    window.eventBus = eventBus;
}

export default eventBus;
