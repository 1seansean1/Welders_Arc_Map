/**
 * Modal Controller Module - Sensor and Satellite editor/confirm modals
 *
 * DEPENDENCIES:
 * - logger: Diagnostic logging
 *
 * Features:
 * - Sensor confirmation modal (deletion)
 * - Sensor editor modal (add/edit)
 * - Satellite confirmation modal (deletion)
 * - Satellite editor modal (add/edit)
 * - Click outside to close
 * - Callback-based API for modal results
 * - Input validation with user-friendly error messages
 *
 * USAGE:
 *   showEditorModal(sensor, (data) => { ... save data ... });
 *   showConfirmModal(sensors, () => { ... delete sensors ... });
 */

import logger from '../utils/logger.js';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parse Two-Line Element (TLE) data for satellites
 * TLE FORMAT:
 * Line 1: 69 characters starting with "1 "
 * Line 2: 69 characters starting with "2 "
 * NORAD ID: Columns 3-7 on both lines (must match)
 * Checksum: Column 69 on each line
 *
 * @param {string} tleText - Raw TLE text (2 lines)
 * @returns {Object} {valid: boolean, error?: string, noradId?: number, tleLine1?: string, tleLine2?: string}
 */
function parseTLE(tleText) {
    const lines = tleText.trim().split('\n').map(l => l.trim());

    // Must have exactly 2 lines
    if (lines.length !== 2) {
        return { valid: false, error: 'TLE must contain exactly 2 lines' };
    }

    const line1 = lines[0];
    const line2 = lines[1];

    // Validate line lengths
    if (line1.length !== 69) {
        return { valid: false, error: `Line 1 must be 69 characters (got ${line1.length})` };
    }
    if (line2.length !== 69) {
        return { valid: false, error: `Line 2 must be 69 characters (got ${line2.length})` };
    }

    // Validate line numbers
    if (!line1.startsWith('1 ')) {
        return { valid: false, error: 'Line 1 must start with "1 "' };
    }
    if (!line2.startsWith('2 ')) {
        return { valid: false, error: 'Line 2 must start with "2 "' };
    }

    // Extract NORAD IDs (columns 3-7, indices 2-6)
    const noradId1 = line1.substring(2, 7).trim();
    const noradId2 = line2.substring(2, 7).trim();

    // NORAD IDs must match
    if (noradId1 !== noradId2) {
        return { valid: false, error: `NORAD ID mismatch (Line 1: ${noradId1}, Line 2: ${noradId2})` };
    }

    // Parse NORAD ID as integer
    const noradId = parseInt(noradId1, 10);
    if (isNaN(noradId)) {
        return { valid: false, error: `Invalid NORAD ID: ${noradId1}` };
    }

    return {
        valid: true,
        noradId: noradId,
        tleLine1: line1,
        tleLine2: line2
    };
}

// ============================================
// SENSOR MODALS
// ============================================

/**
 * Show sensor confirmation modal (for deletion)
 * Custom styled confirmation dialog for deletions
 *
 * @param {Array} sensors - Array of sensor objects to delete
 * @param {Function} onConfirm - Callback when delete is confirmed
 */
export function showConfirmModal(sensors, onConfirm) {
    const overlay = document.getElementById('confirm-modal-overlay');
    const sensorsList = document.getElementById('confirm-modal-sensors');

    // Populate sensor names
    const names = sensors.map(s => s.name).join(', ');
    sensorsList.textContent = names;

    // Show modal
    overlay.classList.add('visible');

    // Get button references
    const cancelBtn = document.getElementById('confirm-modal-cancel');
    const deleteBtn = document.getElementById('confirm-modal-delete');

    const closeModal = () => {
        overlay.classList.remove('visible');
        cancelBtn.removeEventListener('click', handleCancel);
        deleteBtn.removeEventListener('click', handleDelete);
        overlay.removeEventListener('click', handleOverlayClick);
    };

    const handleCancel = () => {
        closeModal();
        logger.diagnostic('Deletion cancelled', logger.CATEGORY.SENSOR);
    };

    const handleDelete = () => {
        closeModal();
        onConfirm();
    };

    const handleOverlayClick = (e) => {
        if (e.target === overlay) {
            handleCancel();
        }
    };

    // Prevent event propagation to avoid panel collapse
    overlay.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    cancelBtn.addEventListener('click', handleCancel);
    deleteBtn.addEventListener('click', handleDelete);
    overlay.addEventListener('click', handleOverlayClick);
}

/**
 * Show sensor editor modal (for add/edit)
 * Opens modal with form for sensor data
 *
 * @param {Object|null} sensor - Sensor object to edit, or null for add
 * @param {Function} onSave - Callback when save is clicked, receives {name, lat, lon, alt, fovAltitude}
 */
export function showEditorModal(sensor = null, onSave) {
    const overlay = document.getElementById('editor-modal-overlay');
    const title = document.getElementById('editor-modal-title');
    const form = document.getElementById('editor-modal-form');
    const nameInput = document.getElementById('editor-input-name');
    const latInput = document.getElementById('editor-input-lat');
    const lonInput = document.getElementById('editor-input-lon');
    const altInput = document.getElementById('editor-input-alt');
    const fovInput = document.getElementById('editor-input-fov');

    // Set title and populate fields
    if (sensor) {
        title.textContent = 'Edit Sensor';
        nameInput.value = sensor.name;
        latInput.value = sensor.lat;
        lonInput.value = sensor.lon;
        altInput.value = sensor.alt;
        fovInput.value = sensor.fovAltitude || 500;
    } else {
        title.textContent = 'Add Sensor';
        nameInput.value = '';
        latInput.value = '';
        lonInput.value = '';
        altInput.value = '';
        fovInput.value = '500';
    }

    // Show modal
    overlay.classList.add('visible');

    // Focus first input
    setTimeout(() => nameInput.focus(), 100);

    const cancelBtn = document.getElementById('editor-modal-cancel');

    const closeModal = () => {
        overlay.classList.remove('visible');
        form.removeEventListener('submit', handleSubmit);
        cancelBtn.removeEventListener('click', handleCancel);
        overlay.removeEventListener('click', handleOverlayClick);
    };

    const handleCancel = () => {
        closeModal();
        logger.diagnostic('Edit cancelled', logger.CATEGORY.SENSOR);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Extract and validate values
        const name = nameInput.value.trim();
        const lat = parseFloat(latInput.value);
        const lon = parseFloat(lonInput.value);
        const alt = parseFloat(altInput.value);
        const fovAltitude = parseFloat(fovInput.value);

        // Validate inputs
        if (!name) {
            alert('Name is required');
            nameInput.focus();
            return;
        }

        if (isNaN(lat) || lat < -90 || lat > 90) {
            alert('Latitude must be between -90 and 90');
            latInput.focus();
            return;
        }

        if (isNaN(lon) || lon < -180 || lon > 180) {
            alert('Longitude must be between -180 and 180');
            lonInput.focus();
            return;
        }

        if (isNaN(alt)) {
            alert('Altitude must be a number');
            altInput.focus();
            return;
        }

        if (isNaN(fovAltitude) || fovAltitude <= 0) {
            alert('FOV Altitude must be a positive number');
            fovInput.focus();
            return;
        }

        // Close modal and call save callback
        closeModal();
        onSave({ name, lat, lon, alt, fovAltitude });
    };

    const handleOverlayClick = (e) => {
        if (e.target === overlay) {
            handleCancel();
        }
    };

    // Prevent event propagation to avoid panel collapse
    overlay.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    form.addEventListener('submit', handleSubmit);
    cancelBtn.addEventListener('click', handleCancel);
    overlay.addEventListener('click', handleOverlayClick);
}

// ============================================
// SATELLITE MODALS
// ============================================

/**
 * Show satellite editor modal (for add/edit)
 * Opens modal with form for satellite data (name and TLE)
 *
 * @param {Object|null} satellite - Satellite object to edit, or null for add
 * @param {Function} onSave - Callback when save is clicked, receives {name, noradId, tleLine1, tleLine2}
 */
export function showSatelliteEditorModal(satellite = null, onSave) {
    const overlay = document.getElementById('satellite-editor-modal-overlay');
    const title = document.getElementById('satellite-editor-modal-title');
    const form = document.getElementById('satellite-editor-modal-form');
    const nameInput = document.getElementById('satellite-editor-input-name');
    const tleInput = document.getElementById('satellite-editor-input-tle');

    // Set title and populate fields
    if (satellite) {
        title.textContent = 'Edit Satellite';
        nameInput.value = satellite.name;
        tleInput.value = `${satellite.tleLine1}\n${satellite.tleLine2}`;
    } else {
        title.textContent = 'Add Satellite';
        nameInput.value = '';
        tleInput.value = '';
    }

    // Show modal
    overlay.classList.add('visible');

    // Focus first input
    setTimeout(() => nameInput.focus(), 100);

    const cancelBtn = document.getElementById('satellite-editor-modal-cancel');

    const closeModal = () => {
        overlay.classList.remove('visible');
        form.removeEventListener('submit', handleSubmit);
        cancelBtn.removeEventListener('click', handleCancel);
        overlay.removeEventListener('click', handleOverlayClick);
    };

    const handleCancel = () => {
        closeModal();
        logger.diagnostic('Satellite edit cancelled', logger.CATEGORY.SATELLITE);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Extract and validate values
        const name = nameInput.value.trim();
        const tleText = tleInput.value.trim();

        // Validate name
        if (!name) {
            alert('Name is required');
            nameInput.focus();
            return;
        }

        // Validate and parse TLE
        const tleResult = parseTLE(tleText);
        if (!tleResult.valid) {
            alert(`TLE Error: ${tleResult.error}`);
            tleInput.focus();
            return;
        }

        // Close modal and call save callback
        closeModal();
        onSave({
            name: name,
            noradId: tleResult.noradId,
            tleLine1: tleResult.tleLine1,
            tleLine2: tleResult.tleLine2
        });
    };

    const handleOverlayClick = (e) => {
        if (e.target === overlay) {
            handleCancel();
        }
    };

    // Prevent event propagation to avoid panel collapse
    overlay.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    form.addEventListener('submit', handleSubmit);
    cancelBtn.addEventListener('click', handleCancel);
    overlay.addEventListener('click', handleOverlayClick);
}

/**
 * Show satellite confirmation modal (for deletion)
 * Custom styled confirmation dialog for satellite deletions
 *
 * @param {Array} satellites - Array of satellite objects to delete
 * @param {Function} onConfirm - Callback when delete is confirmed
 */
export function showSatelliteConfirmModal(satellites, onConfirm) {
    const overlay = document.getElementById('satellite-confirm-modal-overlay');
    const satellitesList = document.getElementById('satellite-confirm-modal-list');

    // Populate satellite list
    satellitesList.innerHTML = satellites.map(s =>
        `<div class="modal-confirm-item">${s.name} (NORAD: ${s.noradId})</div>`
    ).join('');

    // Show modal
    overlay.classList.add('visible');

    const cancelBtn = document.getElementById('satellite-confirm-modal-cancel');
    const deleteBtn = document.getElementById('satellite-confirm-modal-delete');

    const closeModal = () => {
        overlay.classList.remove('visible');
        deleteBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        overlay.removeEventListener('click', handleOverlayClick);
    };

    const handleCancel = () => {
        closeModal();
        logger.diagnostic('Satellite deletion cancelled', logger.CATEGORY.SATELLITE);
    };

    const handleConfirm = () => {
        closeModal();
        onConfirm();
    };

    const handleOverlayClick = (e) => {
        if (e.target === overlay) {
            handleCancel();
        }
    };

    // Prevent event propagation
    overlay.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    deleteBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    overlay.addEventListener('click', handleOverlayClick);
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Export parseTLE for potential use by other modules
 */
export { parseTLE };
