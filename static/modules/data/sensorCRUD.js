/**
 * Sensor CRUD Module - Sensor create, read, update, delete operations
 *
 * DEPENDENCIES:
 * - logger: Diagnostic logging
 * - sensorState: Sensor data management
 * - modals: Editor and confirm modals
 * - sensorTable: Table rendering
 * - deckgl: Map visualization updates
 *
 * Features:
 * - Add new sensors with validation
 * - Edit existing sensors
 * - Delete selected sensors with confirmation
 * - Button handler initialization
 */

import logger from '../utils/logger.js';
import sensorState from '../state/sensorState.js';
import { showConfirmModal, showEditorModal } from '../ui/modals.js';
import { renderSensorTable } from '../ui/sensorTable.js';
import { updateDeckOverlay } from '../map/deckgl.js';

// ============================================
// SENSOR CRUD OPERATIONS
// ============================================

/**
 * Initialize sensor data
 * sensorState already contains default sensors, just render the UI
 */
export function initializeSensors() {
    renderSensorTable();
    logger.success('Sensors initialized', logger.CATEGORY.SENSOR, { count: sensorState.getSensorCount() });
}

/**
 * Add new sensor
 * Opens modal for adding new sensor
 */
export function addSensor() {
    const startTime = Date.now();

    showEditorModal(null, (data) => {
        const result = sensorState.addSensor({
            name: data.name,
            lat: data.lat,
            lon: data.lon,
            alt: data.alt,
            fovAltitude: data.fovAltitude
        });

        if (result.success) {
            renderSensorTable();
            updateDeckOverlay(); // Update map visualization

            logger.success(
                `Sensor "${result.sensor.name}" added`,
                logger.CATEGORY.SENSOR,
                {
                    id: result.sensor.id,
                    lat: result.sensor.lat.toFixed(2),
                    lon: result.sensor.lon.toFixed(2),
                    duration: `${Date.now() - startTime}ms`
                }
            );
        } else {
            logger.error('Failed to add sensor', logger.CATEGORY.SENSOR, result.errors);
        }
    });
}

/**
 * Edit active sensor (blue highlighted row)
 * Opens modal for editing the currently highlighted sensor
 */
export function editSensor() {
    // Find the active (blue highlighted) sensor
    const editingState = sensorState.getEditingState();
    const activeSensor = sensorState.getSensorById(editingState.activeRowId);

    if (!activeSensor) {
        logger.warning('No sensor selected for edit', logger.CATEGORY.SENSOR);
        return;
    }

    const original = { ...activeSensor };

    showEditorModal(activeSensor, (data) => {
        const result = sensorState.updateSensor(activeSensor.id, {
            name: data.name,
            lat: data.lat,
            lon: data.lon,
            alt: data.alt,
            fovAltitude: data.fovAltitude
        });

        if (result.success) {
            renderSensorTable();
            updateDeckOverlay(); // Update map visualization

            // Track what changed
            const changes = [];
            if (original.name !== data.name) changes.push(`name: ${original.name}→${data.name}`);
            if (original.lat !== data.lat) changes.push(`lat: ${original.lat.toFixed(2)}→${data.lat.toFixed(2)}`);
            if (original.lon !== data.lon) changes.push(`lon: ${original.lon.toFixed(2)}→${data.lon.toFixed(2)}`);
            if (original.alt !== data.alt) changes.push(`alt: ${original.alt}→${data.alt}`);

            logger.success(
                `Sensor "${data.name}" updated`,
                logger.CATEGORY.SENSOR,
                {
                    id: activeSensor.id,
                    changes: changes.length > 0 ? changes.join('; ') : 'none'
                }
            );
        } else {
            logger.error('Failed to update sensor', logger.CATEGORY.SENSOR, result.errors);
        }
    });
}

/**
 * Delete selected sensors
 * Shows custom confirmation modal, then deletes if confirmed
 */
export function deleteSensor() {
    const selectedSensors = sensorState.getSelectedSensors();

    if (selectedSensors.length === 0) {
        logger.warning('No sensors selected for deletion', logger.CATEGORY.SENSOR);
        return;
    }

    // Show custom confirmation modal
    showConfirmModal(selectedSensors, () => {
        const count = selectedSensors.length;
        const names = selectedSensors.map(s => s.name).join(', ');
        const ids = selectedSensors.map(s => s.id);

        // Remove selected sensors
        sensorState.deleteSensors(ids);

        // Re-render table
        renderSensorTable();

        // Update map visualization
        updateDeckOverlay();

        logger.success(
            `Deleted ${count} sensor(s)`,
            logger.CATEGORY.SENSOR,
            { sensors: names }
        );
    });
}

// ============================================
// BUTTON INITIALIZATION
// ============================================

/**
 * Initialize sensor button handlers
 * Attaches event listeners to CRUD buttons
 */
export function initializeSensorButtons() {
    const addBtn = document.getElementById('sensor-add-btn');
    const editBtn = document.getElementById('sensor-edit-btn');
    const deleteBtn = document.getElementById('sensor-delete-btn');

    if (addBtn) {
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addSensor();
        });
    }

    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            editSensor();
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSensor();
        });
    }

    logger.success('Sensor button handlers initialized', logger.CATEGORY.SENSOR);
}
