/**
 * Sensor State Module - Manages ground sensor state
 *
 * DEPENDENCIES: eventBus.js, logger.js, validation.js
 * PATTERN: Encapsulated state with controlled mutations
 *
 * Features:
 * - Sensor CRUD operations
 * - Selection management
 * - Sort state management
 * - Default sensors (12 major cities)
 * - Event emissions on changes
 * - Validation integration
 *
 * Events Emitted:
 * - sensor:added - New sensor added
 * - sensor:updated - Sensor properties updated
 * - sensor:removed - Sensor deleted
 * - sensor:selection:changed - Selection state changed
 * - sensor:cleared - All sensors removed
 * - sensor:sort:changed - Sort state changed
 *
 * Usage:
 *   import sensorState from './modules/state/sensorState.js';
 *
 *   // Get sensors
 *   const sensors = sensorState.getAllSensors();
 *   const sensor = sensorState.getSensorById(1);
 *
 *   // Add sensor
 *   sensorState.addSensor({ name: 'Test', lat: 47.6, lon: -122.3, alt: 100, fovAltitude: 500 });
 *
 *   // Update sensor
 *   sensorState.updateSensor(1, { name: 'Updated Name' });
 *
 *   // Delete sensors
 *   sensorState.deleteSensors([1, 2, 3]);
 */

import eventBus from '../events/eventBus.js';
import logger from '../utils/logger.js';
import { validateSensor } from '../utils/validation.js';

/**
 * Default sensors - 12 major cities around the world
 * All sensors start selected with 500km FOV altitude
 */
const defaultSensors = [
    { id: 1, name: 'Tokyo', lat: 35.7, lon: 139.7, alt: 40, selected: false, fovAltitude: 500, iconType: 'donut' },
    { id: 2, name: 'New York', lat: 40.7, lon: -74.0, alt: 10, selected: true, fovAltitude: 500, iconType: 'donut' },
    { id: 3, name: 'London', lat: 51.5, lon: -0.1, alt: 11, selected: false, fovAltitude: 500, iconType: 'donut' },
    { id: 4, name: 'Paris', lat: 48.9, lon: 2.4, alt: 35, selected: false, fovAltitude: 500, iconType: 'donut' },
    { id: 5, name: 'Beijing', lat: 39.9, lon: 116.4, alt: 43, selected: false, fovAltitude: 500, iconType: 'donut' },
    { id: 6, name: 'Sydney', lat: -33.9, lon: 151.2, alt: 58, selected: true, fovAltitude: 500, iconType: 'donut' },
    { id: 7, name: 'Dubai', lat: 25.3, lon: 55.3, alt: 5, selected: false, fovAltitude: 500, iconType: 'donut' },
    { id: 8, name: 'Mumbai', lat: 19.1, lon: 72.9, alt: 14, selected: false, fovAltitude: 500, iconType: 'donut' },
    { id: 9, name: 'São Paulo', lat: -23.5, lon: -46.6, alt: 760, selected: false, fovAltitude: 500, iconType: 'donut' },
    { id: 10, name: 'Moscow', lat: 55.8, lon: 37.6, alt: 156, selected: false, fovAltitude: 500, iconType: 'donut' },
    { id: 11, name: 'Cairo', lat: 30.0, lon: 31.2, alt: 23, selected: false, fovAltitude: 500, iconType: 'donut' },
    { id: 12, name: 'Singapore', lat: 1.3, lon: 103.8, alt: 15, selected: false, fovAltitude: 500, iconType: 'donut' }
];

/**
 * SensorState class - Encapsulates sensor state management
 */
class SensorState {
    constructor() {
        // Private state
        this._state = {
            sensors: [],
            nextSensorId: 13, // Start after default 12 sensors

            // UI editing state
            editingRow: null, // Row ID being edited (null = not editing)
            editBuffer: null,  // Temporary storage for edits
            activeRowId: null,  // Currently highlighted row (blue background)

            // Sort state
            currentSortColumn: null,  // null = default order, or column name ('name', 'lat', 'lon', 'alt')
            currentSortDirection: null  // null = default, 'asc' = ascending, 'desc' = descending
        };

        // Initialize with default sensors (deep copy)
        this._state.sensors = JSON.parse(JSON.stringify(defaultSensors));

        logger.log('Sensor State initialized with 12 default sensors', logger.CATEGORY.SENSOR);
    }

    /**
     * Get all sensors (read-only copy)
     * @returns {Array} Array of sensor objects
     */
    getAllSensors() {
        // Return deep copy to prevent mutation
        return JSON.parse(JSON.stringify(this._state.sensors));
    }

    /**
     * Get sensor by ID
     * @param {number} id - Sensor ID
     * @returns {Object|null} Sensor object or null if not found
     */
    getSensorById(id) {
        const sensor = this._state.sensors.find(s => s.id === id);
        return sensor ? { ...sensor } : null;
    }

    /**
     * Get selected sensors
     * @returns {Array} Array of selected sensor objects
     */
    getSelectedSensors() {
        return this._state.sensors
            .filter(s => s.selected)
            .map(s => ({ ...s }));
    }

    /**
     * Get sensor count
     * @returns {number} Total number of sensors
     */
    getSensorCount() {
        return this._state.sensors.length;
    }

    /**
     * Get selected sensor count
     * @returns {number} Number of selected sensors
     */
    getSelectedCount() {
        return this._state.sensors.filter(s => s.selected).length;
    }

    /**
     * Add new sensor
     * @param {Object} sensorData - Sensor data {name, lat, lon, alt, fovAltitude}
     * @returns {Object} {success: boolean, sensor: Object|null, errors: Object}
     */
    addSensor(sensorData) {
        // Validate sensor data
        const validation = validateSensor(sensorData);
        if (!validation.valid) {
            logger.log('Sensor validation failed', logger.CATEGORY.ERROR, validation.errors);
            return { success: false, sensor: null, errors: validation.errors };
        }

        // Create new sensor with validated data
        const newSensor = {
            id: this._state.nextSensorId++,
            name: validation.values.name,
            lat: validation.values.lat,
            lon: validation.values.lon,
            alt: validation.values.alt,
            fovAltitude: validation.values.fovAltitude,
            selected: true, // New sensors start selected
            iconType: 'donut'
        };

        // Add to state
        this._state.sensors.push(newSensor);

        logger.log(`Sensor added: ${newSensor.name}`, logger.CATEGORY.SENSOR);

        // Emit event
        eventBus.emit('sensor:added', {
            id: newSensor.id,
            ...newSensor
        });

        return { success: true, sensor: { ...newSensor }, errors: {} };
    }

    /**
     * Update existing sensor
     * @param {number} id - Sensor ID
     * @param {Object} updates - Properties to update
     * @returns {Object} {success: boolean, sensor: Object|null, errors: Object}
     */
    updateSensor(id, updates) {
        const sensorIndex = this._state.sensors.findIndex(s => s.id === id);
        if (sensorIndex === -1) {
            logger.log(`Sensor not found: ${id}`, logger.CATEGORY.ERROR);
            return { success: false, sensor: null, errors: { id: 'Sensor not found' } };
        }

        const sensor = this._state.sensors[sensorIndex];
        const updatedSensor = { ...sensor, ...updates };

        // Validate updated sensor
        const validation = validateSensor(updatedSensor);
        if (!validation.valid) {
            logger.log('Sensor validation failed', logger.CATEGORY.ERROR, validation.errors);
            return { success: false, sensor: null, errors: validation.errors };
        }

        // Apply validated updates
        this._state.sensors[sensorIndex] = {
            ...sensor,
            name: validation.values.name,
            lat: validation.values.lat,
            lon: validation.values.lon,
            alt: validation.values.alt,
            fovAltitude: validation.values.fovAltitude
        };

        logger.log(`Sensor updated: ${validation.values.name}`, logger.CATEGORY.SENSOR);

        // Emit event
        eventBus.emit('sensor:updated', {
            id,
            ...this._state.sensors[sensorIndex]
        });

        return { success: true, sensor: { ...this._state.sensors[sensorIndex] }, errors: {} };
    }

    /**
     * Delete sensors by IDs
     * @param {Array<number>} ids - Array of sensor IDs to delete
     * @returns {number} Number of sensors deleted
     */
    deleteSensors(ids) {
        if (!Array.isArray(ids) || ids.length === 0) {
            return 0;
        }

        const beforeCount = this._state.sensors.length;
        this._state.sensors = this._state.sensors.filter(s => !ids.includes(s.id));
        const deletedCount = beforeCount - this._state.sensors.length;

        if (deletedCount > 0) {
            logger.log(`Deleted ${deletedCount} sensor(s)`, logger.CATEGORY.SENSOR);

            // Emit event for each deleted sensor
            ids.forEach(id => {
                eventBus.emit('sensor:removed', { id });
            });
        }

        return deletedCount;
    }

    /**
     * Toggle sensor selection
     * @param {number} id - Sensor ID
     * @returns {boolean|null} New selection state, or null if not found
     */
    toggleSensorSelection(id) {
        const sensor = this._state.sensors.find(s => s.id === id);
        if (!sensor) {
            return null;
        }

        sensor.selected = !sensor.selected;
        logger.log(`Sensor ${sensor.name} ${sensor.selected ? 'selected' : 'deselected'}`, logger.CATEGORY.SENSOR);

        // Emit event
        eventBus.emit('sensor:selection:changed', {
            id,
            selected: sensor.selected
        });

        return sensor.selected;
    }

    /**
     * Select all sensors
     */
    selectAll() {
        let changeCount = 0;
        this._state.sensors.forEach(sensor => {
            if (!sensor.selected) {
                sensor.selected = true;
                changeCount++;
                eventBus.emit('sensor:selection:changed', {
                    id: sensor.id,
                    selected: true
                });
            }
        });

        if (changeCount > 0) {
            logger.log(`Selected all ${this._state.sensors.length} sensors`, logger.CATEGORY.SENSOR);
        }
    }

    /**
     * Deselect all sensors
     */
    deselectAll() {
        let changeCount = 0;
        this._state.sensors.forEach(sensor => {
            if (sensor.selected) {
                sensor.selected = false;
                changeCount++;
                eventBus.emit('sensor:selection:changed', {
                    id: sensor.id,
                    selected: false
                });
            }
        });

        if (changeCount > 0) {
            logger.log(`Deselected all sensors`, logger.CATEGORY.SENSOR);
        }
    }

    /**
     * Clear all sensors
     */
    clearAllSensors() {
        const count = this._state.sensors.length;
        this._state.sensors = [];
        logger.log(`Cleared all ${count} sensors`, logger.CATEGORY.SENSOR);

        eventBus.emit('sensor:cleared', { count });
    }

    /**
     * Reset to default sensors
     */
    resetToDefaults() {
        this._state.sensors = JSON.parse(JSON.stringify(defaultSensors));
        this._state.nextSensorId = 13;
        logger.log('Reset to 12 default sensors', logger.CATEGORY.SENSOR);

        eventBus.emit('sensor:cleared', { count: 12, reset: true });
    }

    /**
     * Get sort state
     * @returns {Object} {column: string|null, direction: string|null}
     */
    getSortState() {
        return {
            column: this._state.currentSortColumn,
            direction: this._state.currentSortDirection
        };
    }

    /**
     * Set sort state
     * @param {string|null} column - Column name ('name', 'lat', 'lon', 'alt') or null for default
     * @param {string|null} direction - 'asc', 'desc', or null for default
     */
    setSortState(column, direction) {
        const validColumns = ['name', 'lat', 'lon', 'alt'];
        const validDirections = ['asc', 'desc'];

        // Validate column
        if (column !== null && !validColumns.includes(column)) {
            logger.log(`Invalid sort column: ${column}`, logger.CATEGORY.ERROR);
            return;
        }

        // Validate direction
        if (direction !== null && !validDirections.includes(direction)) {
            logger.log(`Invalid sort direction: ${direction}`, logger.CATEGORY.ERROR);
            return;
        }

        this._state.currentSortColumn = column;
        this._state.currentSortDirection = direction;

        logger.log(`Sort state: ${column || 'default'} ${direction || ''}`, logger.CATEGORY.SENSOR);

        eventBus.emit('sensor:sort:changed', {
            column,
            direction
        });
    }

    /**
     * Get editing state
     * @returns {Object} {editingRow: number|null, activeRowId: number|null}
     */
    getEditingState() {
        return {
            editingRow: this._state.editingRow,
            activeRowId: this._state.activeRowId
        };
    }

    /**
     * Set editing row
     * @param {number|null} rowId - Row ID being edited, or null
     * @param {Object|null} buffer - Edit buffer data
     */
    setEditingRow(rowId, buffer = null) {
        this._state.editingRow = rowId;
        this._state.editBuffer = buffer ? { ...buffer } : null;
        logger.log(`Editing row: ${rowId || 'none'}`, logger.CATEGORY.SENSOR);
    }

    /**
     * Set active (highlighted) row
     * @param {number|null} rowId - Row ID to highlight, or null
     */
    setActiveRow(rowId) {
        this._state.activeRowId = rowId;
    }

    /**
     * Get edit buffer
     * @returns {Object|null} Edit buffer data
     */
    getEditBuffer() {
        return this._state.editBuffer ? { ...this._state.editBuffer } : null;
    }
}

// Export singleton instance
const sensorState = new SensorState();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
    window.sensorState = sensorState;
}

export default sensorState;
