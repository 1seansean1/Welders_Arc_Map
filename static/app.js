/**
 * Satellite Visualization System - Frontend Application
 *
 * PERFORMANCE TARGETS:
 * - 60 FPS rendering
 * - <16ms frame time
 * - Smooth panel animations (CSS transform, GPU-accelerated)
 *
 * MOBILE COMPATIBILITY:
 * - Touch event support for panel interactions
 * - Responsive breakpoints (768px tablet, 480px mobile)
 * - Panel overlays map on mobile instead of shifting
 * - Reduced update frequency on mobile to save battery
 * - Touch-friendly button sizes (44x44px minimum)
 */

// ============================================
// MODULE IMPORTS
// ============================================

import logger from './modules/utils/logger.js';
import { formatDateTimeLocal, addDays, addHours, getUTCNow } from './modules/utils/time.js';
import { calculateFOVCircle, degreesToRadians, radiansToDegrees, EARTH_RADIUS_KM } from './modules/utils/geometry.js';

// State modules
import eventBus from './modules/events/eventBus.js';
import uiState from './modules/state/uiState.js';
import sensorState from './modules/state/sensorState.js';
import satelliteState from './modules/state/satelliteState.js';
import timeState from './modules/state/timeState.js';

// Data modules
import { calculateGroundTrack } from './modules/data/propagation.js';
import websocketManager from './modules/data/websocket.js';

// ============================================
// STATE MANAGEMENT
// ============================================
// State is now managed through dedicated modules:
// - uiState: Panel expansion, active section, mobile detection
// - sensorState: Sensor CRUD, selection, sorting
// - satelliteState: Satellite CRUD, selection, watchlist
// - timeState: Current time, time ranges, pending changes

// ============================================
// CONTROL PANEL LOGIC
// ============================================

const panel = document.getElementById('control-panel');
const collapseBtn = document.getElementById('collapse-btn');
const navButtons = document.querySelectorAll('.nav-btn');
const mapContainer = document.getElementById('map-container');

/**
 * Toggle panel expand/collapse
 * MOBILE: Uses CSS transform for 60fps animation
 */
function togglePanel(forceState = null) {
    const newState = forceState !== null ? forceState : !uiState.isPanelExpanded();
    uiState.setPanelExpanded(newState);

    if (uiState.isPanelExpanded()) {
        panel.classList.add('expanded');
    } else {
        panel.classList.remove('expanded');

        // Clear nav button highlighting when panel collapses
        navButtons.forEach(btn => btn.classList.remove('active'));
    }

    // Update collapse button title (icons toggle via CSS)
    collapseBtn.title = uiState.isPanelExpanded() ? 'Collapse panel' : 'Expand panel';
}

/**
 * Expand panel when clicking on collapsed panel
 * MOBILE: Works with touch events
 */
panel.addEventListener('click', (e) => {
    // Only expand if panel is collapsed and not clicking a button
    if (!uiState.isPanelExpanded() && !e.target.closest('button')) {
        togglePanel(true);
    }
});

/**
 * Collapse button click handler
 */
collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent panel click event
    togglePanel();
});

/**
 * Click outside panel to collapse (desktop only)
 * MOBILE: User must click collapse button explicitly
 *
 * NOTE: Also handles clicks on Deck.gl canvas element
 * NOTE: Ignores the click that closes a Flatpickr calendar (panel stays open)
 */
function handleClickOutside(e) {
    // Don't collapse panel if clicking on Flatpickr calendar
    if (e.target.closest('.flatpickr-calendar')) {
        return;
    }

    // Don't collapse panel if a calendar just closed (this click closed it)
    if (calendarJustClosed) {
        calendarJustClosed = false;
        return;
    }

    // Check if click is outside the panel
    if (!panel.contains(e.target) && uiState.isPanelExpanded() && !uiState.isMobile()) {
        togglePanel(false);
    }
}

// Add listener to document to catch all clicks
document.addEventListener('click', handleClickOutside);

// MOBILE: Handle touch events
if ('ontouchstart' in window) {
    document.addEventListener('touchstart', (e) => {
        // Don't collapse panel if touching Flatpickr calendar
        if (e.target.closest('.flatpickr-calendar')) {
            return;
        }

        // Don't collapse panel if a calendar just closed
        if (calendarJustClosed) {
            calendarJustClosed = false;
            return;
        }

        if (!panel.contains(e.target) && uiState.isPanelExpanded() && !uiState.isMobile()) {
            togglePanel(false);
        }
    }, { passive: true });
}

/**
 * Navigation button click handler
 * Switches active section and updates content area
 *
 * MOBILE: When panel is collapsed, clicking button expands panel
 * MOBILE: When panel is expanded, clicking button switches sections
 */
navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent any parent handlers

        const section = btn.dataset.section;
        const wasExpanded = uiState.isPanelExpanded();

        // If panel is collapsed, expand it
        if (!wasExpanded) {
            togglePanel(true);
        }

        // If clicking the already-active section while panel was expanded, collapse the panel
        if (section === uiState.getActiveSection() && wasExpanded) {
            togglePanel(false);
            return;
        }

        // Update active button
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Switch content
        switchContent(section);

        uiState.setActiveSection(section);
    });

    // MOBILE: Add hover effect on touch
    btn.addEventListener('touchstart', () => {
        btn.style.background = 'var(--bg-tertiary)';
    }, { passive: true });

    btn.addEventListener('touchend', () => {
        setTimeout(() => {
            if (!btn.classList.contains('active')) {
                btn.style.background = 'transparent';
            }
        }, 150);
    }, { passive: true });
});

/**
 * Switch content section
 * Hides all sections except the selected one
 */
function switchContent(section) {
    const allSections = document.querySelectorAll('[id^="content-"]');
    allSections.forEach(s => s.style.display = 'none');

    const targetSection = document.getElementById(`content-${section}`);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
}

// ============================================
// SENSOR CONTROLS
// ============================================

// Default sensor data is now managed in sensorState module

// Default satellite data is now managed in satelliteState module

/**
 * Initialize sensor data
 * sensorState already contains default sensors, just render the UI
 */
function initializeSensors() {
    renderSensorTable();
    initializeSensorTableHeaders();
    logger.success('Sensors initialized', logger.CATEGORY.SENSOR, { count: sensorState.getSensorCount() });
}

/**
 * Initialize satellite data
 * satelliteState already contains default satellites, just render the UI
 */
function initializeSatellites() {
    renderSatelliteTable();
    logger.success('Satellites initialized', logger.CATEGORY.SATELLITE, { count: satelliteState.getSatelliteCount() });
}

/**
 * Initialize column header click handlers for sorting
 * Maps column classes to column names and adds click listeners
 */
function initializeSensorTableHeaders() {
    const headers = document.querySelectorAll('.sensor-table th');

    // Map column classes to column names
    const columnMap = {
        'col-sel': 'sel',
        'col-name': 'name',
        'col-lat': 'lat',
        'col-lon': 'lon',
        'col-alt': 'alt'
    };

    headers.forEach(header => {
        // Find which column this header represents
        const columnClass = Array.from(header.classList).find(cls => cls.startsWith('col-'));
        const columnName = columnMap[columnClass];

        if (columnName) {
            header.addEventListener('click', () => {
                handleColumnHeaderClick(columnName);
            });
        }
    });

    logger.success('Column header sort handlers initialized', logger.CATEGORY.SENSOR);
}

/**
 * Render sensor table
 * Updates table body with current sensor data
 *
 * PERFORMANCE: O(n) where n = number of sensors
 * MOBILE: Compact table fits in 224px panel width
 */
function renderSensorTable() {
    const tbody = document.getElementById('sensor-table-body');
    if (!tbody) return;

    // Clear existing rows
    tbody.innerHTML = '';

    // Get sorted sensors (if sort is active)
    const displaySensors = getSortedSensors();

    // Render each sensor
    displaySensors.forEach((sensor, index) => {
        const row = createSensorRow(sensor, index);
        tbody.appendChild(row);
    });

    // Update column header indicators
    updateColumnHeaderIndicators();

    logger.diagnostic('Sensor table rendered', logger.CATEGORY.SENSOR, { count: sensorState.getSensorCount() });
}

/**
 * Update column header text with sort indicators
 * Shows ▲ for ascending, ▼ for descending
 */
function updateColumnHeaderIndicators() {
    const headers = document.querySelectorAll('.sensor-table th');
    const columnMap = {
        'col-sel': 'sel',
        'col-name': 'name',
        'col-lat': 'lat',
        'col-lon': 'lon',
        'col-alt': 'alt'
    };

    const labelMap = {
        'sel': 'Sel',
        'name': 'Name',
        'lat': 'Lat',
        'lon': 'Lon',
        'alt': 'Alt'
    };

    headers.forEach(header => {
        const columnClass = Array.from(header.classList).find(cls => cls.startsWith('col-'));
        const columnName = columnMap[columnClass];

        if (columnName) {
            let text = labelMap[columnName];

            // Add sort indicator if this column is sorted
            const sortState = sensorState.getSortState();
            if (sortState.column === columnName) {
                text += sortState.direction === 'asc' ? ' ▲' : ' ▼';
            }

            header.textContent = text;
        }
    });
}

/**
 * Get sorted sensors based on current sort state
 * Returns a copy of the sensors array, sorted if needed
 */
function getSortedSensors() {
    const sortState = sensorState.getSortState();

    // If no sort is active, return original order
    if (!sortState.column || !sortState.direction) {
        return sensorState.getAllSensors();
    }

    // Create a copy for sorting
    const sorted = sensorState.getAllSensors();

    const column = sortState.column;
    const direction = sortState.direction;

    sorted.sort((a, b) => {
        let valA, valB;

        // Get values based on column
        if (column === 'name') {
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
        } else if (column === 'lat') {
            valA = a.lat;
            valB = b.lat;
        } else if (column === 'lon') {
            valA = a.lon;
            valB = b.lon;
        } else if (column === 'alt') {
            valA = a.alt;
            valB = b.alt;
        }

        // Compare values
        let comparison = 0;
        if (typeof valA === 'string') {
            comparison = valA.localeCompare(valB);
        } else {
            comparison = valA - valB;
        }

        // Apply direction
        return direction === 'asc' ? comparison : -comparison;
    });

    return sorted;
}

/**
 * Handle column header click for sorting
 * Cycles through: default → ascending → descending → default
 * Special case for checkbox column: toggles select all/none
 */
function handleColumnHeaderClick(columnName) {
    // Special handling for checkbox column
    if (columnName === 'sel') {
        toggleSelectAll();
        return;
    }

    const sortState = sensorState.getSortState();

    // Cycle through sort states
    if (sortState.column === columnName) {
        if (sortState.direction === 'asc') {
            // asc → desc
            sensorState.setSortState(columnName, 'desc');
        } else if (sortState.direction === 'desc') {
            // desc → default (no sort)
            sensorState.setSortState(null, null);
        }
    } else {
        // New column → start with ascending
        sensorState.setSortState(columnName, 'asc');
    }

    // Re-render table with new sort
    renderSensorTable();
    const newSortState = sensorState.getSortState();
    logger.diagnostic('Sensor table sorted', logger.CATEGORY.SENSOR, {
        column: columnName,
        direction: newSortState.direction || 'default'
    });
}

/**
 * Toggle select all/none for sensor checkboxes
 * 1st click: select all, 2nd click: deselect all
 */
function toggleSelectAll() {
    // Check if all are currently selected
    const sensors = sensorState.getAllSensors();
    const allSelected = sensors.every(s => s.selected);

    if (allSelected) {
        // Deselect all
        sensorState.deselectAll();
        logger.diagnostic('All sensors deselected', logger.CATEGORY.SENSOR);
    } else {
        // Select all
        sensorState.selectAll();
        logger.diagnostic('All sensors selected', logger.CATEGORY.SENSOR, { count: sensorState.getSensorCount() });
    }

    // Re-render table and update map
    renderSensorTable();
    updateDeckOverlay();
}

/**
 * Create sensor table row
 * Returns a <tr> element for a sensor
 *
 * PARAMETERS:
 * - sensor: Sensor object { id, name, lat, lon, alt, selected }
 * - index: Row index in array
 */
function createSensorRow(sensor, index) {
    const tr = document.createElement('tr');
    tr.dataset.sensorId = sensor.id;
    tr.dataset.index = index;

    // Apply blue highlight if this is the active row
    const editingState = sensorState.getEditingState();
    if (editingState.activeRowId === sensor.id) {
        tr.classList.add('selected');
    }

    // Row click handler - sets this as the active (blue highlighted) row
    tr.addEventListener('click', (e) => {
        // Don't toggle if clicking directly on checkbox
        if (e.target.type === 'checkbox') return;

        // Set this row as the active row
        sensorState.setActiveRow(sensor.id);

        // Remove blue highlight from all rows
        const allRows = document.querySelectorAll('.sensor-table tbody tr');
        allRows.forEach(row => row.classList.remove('selected'));

        // Add blue highlight to this row
        tr.classList.add('selected');

        logger.diagnostic('Sensor activated', logger.CATEGORY.SENSOR, { name: sensor.name, id: sensor.id });
    });

    // Row double-click handler - opens edit modal
    tr.addEventListener('dblclick', (e) => {
        // Don't open if clicking directly on checkbox
        if (e.target.type === 'checkbox') return;

        // Set this row as active
        sensorState.setActiveRow(sensor.id);

        // Open edit modal for this sensor
        editSensor();
    });

    // Checkbox column
    const tdSel = document.createElement('td');
    tdSel.className = 'col-sel';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'sensor-checkbox';
    checkbox.checked = sensor.selected;
    checkbox.addEventListener('change', (e) => {
        e.stopPropagation(); // Prevent row click
        const newState = sensorState.toggleSensorSelection(sensor.id);
        // NOTE: Do NOT modify tr.classList here - blue highlight is controlled by activeRowId only
        logger.diagnostic('Sensor checkbox toggled', logger.CATEGORY.SENSOR, {
            name: sensor.name,
            selected: newState
        });

        // Update map visualization when selection changes
        updateDeckOverlay();
    });
    tdSel.appendChild(checkbox);
    tr.appendChild(tdSel);

    // Name column
    const tdName = document.createElement('td');
    tdName.className = 'col-name';
    tdName.textContent = sensor.name;
    tr.appendChild(tdName);

    // Latitude column
    const tdLat = document.createElement('td');
    tdLat.className = 'col-lat';
    tdLat.textContent = sensor.lat.toFixed(1);
    tr.appendChild(tdLat);

    // Longitude column
    const tdLon = document.createElement('td');
    tdLon.className = 'col-lon';
    tdLon.textContent = sensor.lon.toFixed(1);
    tr.appendChild(tdLon);

    // Altitude column
    const tdAlt = document.createElement('td');
    tdAlt.className = 'col-alt';
    tdAlt.textContent = Math.round(sensor.alt);
    tr.appendChild(tdAlt);

    return tr;
}

// ============================================
// MODAL CONTROLS
// ============================================

/**
 * Show confirmation modal
 * Custom styled confirmation dialog for deletions
 */
function showConfirmModal(sensors, onConfirm) {
    const overlay = document.getElementById('confirm-modal-overlay');
    const sensorsList = document.getElementById('confirm-modal-sensors');

    // Populate sensor names
    const names = sensors.map(s => s.name).join(', ');
    sensorsList.textContent = names;

    // Show modal
    overlay.classList.add('visible');

    // Cancel button
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
 * Show editor modal (for add/edit)
 * Opens modal with form for sensor data
 */
function showEditorModal(sensor = null, onSave) {
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

/**
 * Add new sensor
 * Opens modal for adding new sensor
 */
function addSensor() {
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
function editSensor() {
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
function deleteSensor() {
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
// SATELLITE MANAGEMENT
// ============================================

/**
 * TLE Validation and Parsing
 * Validates TLE format and extracts NORAD ID
 *
 * TLE FORMAT:
 * Line 1: 69 characters starting with "1 "
 * Line 2: 69 characters starting with "2 "
 * NORAD ID: Columns 3-7 on both lines (must match)
 * Checksum: Column 69 on each line
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

/**
 * Show satellite editor modal
 */
function showSatelliteEditorModal(satellite = null, onSave) {
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
 * Show satellite confirmation modal
 */
function showSatelliteConfirmModal(satellites, onConfirm) {
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

/**
 * Add new satellite
 */
function addSatellite() {
    const startTime = Date.now();

    showSatelliteEditorModal(null, (data) => {
        const result = satelliteState.addSatellite({
            name: data.name,
            noradId: data.noradId,
            tleLine1: data.tleLine1,
            tleLine2: data.tleLine2
        });

        if (result.success) {
            renderSatelliteTable();
            updateDeckOverlay(); // Update map visualization

            logger.success(
                `Satellite "${result.satellite.name}" added`,
                logger.CATEGORY.SATELLITE,
                {
                    id: result.satellite.id,
                    noradId: result.satellite.noradId,
                    duration: `${Date.now() - startTime}ms`
                }
            );
        } else {
            logger.error('Failed to add satellite', logger.CATEGORY.SATELLITE, result.errors);
        }
    });
}

/**
 * Edit satellite
 */
function editSatellite(satelliteId) {
    const satellite = satelliteState.getSatelliteById(satelliteId);
    if (!satellite) return;

    showSatelliteEditorModal(satellite, (data) => {
        const result = satelliteState.updateSatellite(satelliteId, {
            name: data.name,
            noradId: data.noradId,
            tleLine1: data.tleLine1,
            tleLine2: data.tleLine2
        });

        if (result.success) {
            renderSatelliteTable();
            updateDeckOverlay();

            logger.success(
                `Satellite "${result.satellite.name}" updated`,
                logger.CATEGORY.SATELLITE,
                { id: result.satellite.id, noradId: result.satellite.noradId }
            );
        } else {
            logger.error('Failed to update satellite', logger.CATEGORY.SATELLITE, result.errors);
        }
    });
}

/**
 * Delete selected satellites
 */
function deleteSatellites() {
    const selectedSatellites = satelliteState.getSelectedSatellites();

    if (selectedSatellites.length === 0) {
        logger.warning('No satellites selected for deletion', logger.CATEGORY.SATELLITE);
        return;
    }

    showSatelliteConfirmModal(selectedSatellites, () => {
        const count = selectedSatellites.length;
        const names = selectedSatellites.map(s => s.name).join(', ');
        const ids = selectedSatellites.map(s => s.id);

        // Remove selected satellites
        satelliteState.deleteSatellites(ids);

        // Re-render table
        renderSatelliteTable();

        // Update map visualization
        updateDeckOverlay();

        logger.success(
            `Deleted ${count} satellite(s)`,
            logger.CATEGORY.SATELLITE,
            { satellites: names }
        );
    });
}

/**
 * Toggle satellite watchlist status
 */
function toggleSatelliteWatchlist(satelliteId) {
    const satellite = satelliteState.getSatelliteById(satelliteId);
    if (!satellite) return;

    const newState = satelliteState.toggleSatelliteWatchlist(satelliteId);
    renderSatelliteTable();

    logger.diagnostic(
        `Satellite "${satellite.name}" ${newState ? 'added to' : 'removed from'} watchlist`,
        logger.CATEGORY.SATELLITE
    );
}

/**
 * Render satellite table
 */
function renderSatelliteTable() {
    const tbody = document.querySelector('#satellite-table tbody');
    if (!tbody) return;

    const satellites = satelliteState.getAllSatellites();
    tbody.innerHTML = satellites.map(sat => `
        <tr>
            <td style="text-align: center; padding: 4px;">
                <input type="checkbox"
                       ${sat.selected ? 'checked' : ''}
                       onchange="toggleSatelliteSelection(${sat.id})"
                       style="cursor: pointer;">
            </td>
            <td style="padding: 4px 8px; cursor: pointer;" onclick="editSatellite(${sat.id})">${sat.noradId}</td>
            <td style="padding: 4px 8px; cursor: pointer;" onclick="editSatellite(${sat.id})">${sat.name}</td>
            <td style="text-align: center; padding: 4px;">
                <button onclick="toggleSatelliteWatchlist(${sat.id})"
                        style="background: none; border: none; cursor: pointer; font-size: 14px; padding: 0; line-height: 1;">
                    ${sat.watchlisted ? '⭐' : '☆'}
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Toggle satellite selection
 */
function toggleSatelliteSelection(satelliteId) {
    satelliteState.toggleSatelliteSelection(satelliteId);
    renderSatelliteTable();

    // Update map to show/hide ground track
    updateDeckOverlay();
}

// ============================================
// SENSOR VISUALIZATION & FOV CALCULATIONS
// ============================================

/**
 * Update Deck.gl overlay with sensors, FOV, and satellite ground tracks
 * Renders only selected sensors and satellites on the map
 *
 * PERFORMANCE: O(n + m*k) where n = sensors, m = satellites, k = ground track points
 */
function updateDeckOverlay() {
    if (!window.deckgl) {
        logger.warning('Deck.gl not initialized', logger.CATEGORY.SATELLITE);
        return;
    }

    // Filter to only SELECTED sensors (checkbox = visibility control)
    const sensorsToRender = sensorState.getSelectedSensors();

    // Prepare sensor icon data (donut circles)
    const sensorIconData = sensorsToRender.map(sensor => ({
        position: [sensor.lon, sensor.lat],
        radius: 8000, // meters (visual size on map)
        color: [157, 212, 255], // Steel blue (#9dd4ff)
        sensor: sensor
    }));

    // Prepare FOV polygon data
    const fovPolygonData = sensorsToRender.map(sensor => {
        const polygon = calculateFOVCircle(sensor.lat, sensor.lon, sensor.fovAltitude);
        return {
            polygon: polygon,
            sensor: sensor
        };
    });

    // Create sensor icon layer (donut circles)
    const sensorLayer = new deck.ScatterplotLayer({
        id: 'sensor-icons',
        data: sensorIconData,
        coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,  // CRITICAL: Explicit WGS84 → Web Mercator
        wrapLongitude: true,  // CRITICAL: Render on all wrapped world copies
        pickable: true,
        opacity: 0.9,
        stroked: true,
        filled: true,
        radiusScale: 1,
        radiusMinPixels: 6,
        radiusMaxPixels: 12,
        lineWidthMinPixels: 2,
        getPosition: d => d.position,
        getRadius: d => d.radius,
        // Icon type: 'filled' = solid blue, 'donut' = blue ring (default), 'outline' = thin outline
        getFillColor: d => {
            if (d.sensor.iconType === 'filled') return d.color; // Solid fill
            if (d.sensor.iconType === 'donut') return [157, 212, 255, 0]; // Transparent center
            return [0, 0, 0, 0]; // Outline only - no fill
        },
        getLineColor: d => d.color,
        getLineWidth: d => d.sensor.iconType === 'outline' ? 1 : 2,
        // CRITICAL: Disable transitions to prevent glitching during pan/zoom
        transitions: {
            getPosition: 0,
            getRadius: 0,
            getFillColor: 0,
            getLineColor: 0
        },
        // Update triggers: only recreate when sensor data actually changes
        updateTriggers: {
            getPosition: sensorsToRender.map(s => `${s.id}-${s.lon}-${s.lat}`).join(','),
            getFillColor: sensorsToRender.map(s => `${s.id}-${s.iconType}`).join(',')
        },
        onHover: ({object}) => {
            if (object) {
                logger.diagnostic('Sensor hover', logger.CATEGORY.SENSOR, {
                    name: object.sensor.name,
                    lat: object.sensor.lat.toFixed(2),
                    lon: object.sensor.lon.toFixed(2)
                });
            }
        }
    });

    // Create FOV polygon layer
    const fovLayer = new deck.PolygonLayer({
        id: 'sensor-fov',
        data: fovPolygonData,
        coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,  // CRITICAL: Explicit WGS84 → Web Mercator
        wrapLongitude: true,  // CRITICAL: Render on all wrapped world copies
        pickable: false,
        stroked: true,
        filled: true,
        wireframe: false,
        lineWidthMinPixels: 1,
        getPolygon: d => d.polygon,
        getFillColor: [157, 212, 255, 30], // Semi-transparent steel blue
        getLineColor: [157, 212, 255, 120],
        getLineWidth: 1,
        // CRITICAL: Disable transitions to prevent glitching during pan/zoom
        transitions: {
            getPolygon: 0,
            getFillColor: 0,
            getLineColor: 0
        },
        // Update triggers: only recreate when FOV data actually changes
        updateTriggers: {
            getPolygon: sensorsToRender.map(s => `${s.id}-${s.lat}-${s.lon}-${s.fovAltitude}`).join(',')
        }
    });

    // Calculate ground tracks for selected satellites
    const satellitesToRender = satelliteState.getSelectedSatellites();
    const currentTime = new Date();

    // Prepare ground track data
    const groundTrackData = satellitesToRender.map((sat, index) => {
        // Calculate ground track: 90 minutes forward, 60-second steps
        const track = calculateGroundTrack(sat.tleLine1, sat.tleLine2, currentTime, 90, 60);

        // Assign different colors to each satellite
        const colors = [
            [0, 255, 100],    // Green
            [255, 100, 0],    // Orange
            [100, 100, 255],  // Blue
            [255, 255, 0],    // Yellow
            [255, 0, 255],    // Magenta
            [0, 255, 255],    // Cyan
        ];
        const color = colors[index % colors.length];

        return {
            path: track,
            name: sat.name,
            color: color,
            satellite: sat
        };
    });

    // Create ground track layer (PathLayer for orbital paths)
    const groundTrackLayer = new deck.PathLayer({
        id: 'satellite-ground-tracks',
        data: groundTrackData,
        coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,
        wrapLongitude: true,
        pickable: true,
        widthScale: 1,
        widthMinPixels: 2,
        widthMaxPixels: 3,
        getPath: d => d.path,
        getColor: d => [...d.color, 180], // Add alpha channel
        getWidth: 2,
        // Disable transitions to prevent glitching
        transitions: {
            getPath: 0,
            getColor: 0,
            getWidth: 0
        },
        // Update triggers
        updateTriggers: {
            getPath: satellitesToRender.map(s => `${s.id}-${s.tleLine1}`).join(',')
        },
        onHover: ({object}) => {
            if (object) {
                logger.diagnostic('Satellite ground track hover', logger.CATEGORY.SATELLITE, {
                    name: object.name,
                    noradId: object.satellite.noradId
                });
            }
        }
    });

    // Update Deck.gl overlay with all layers
    window.deckgl.setProps({
        layers: [fovLayer, sensorLayer, groundTrackLayer]
    });

    logger.info(`Map updated: ${sensorsToRender.length} sensor(s), ${satellitesToRender.length} satellite ground track(s)`);
}

// ============================================
// TIME CONTROLS
// ============================================

const startTimeInput = document.getElementById('start-time');
const stopTimeInput = document.getElementById('stop-time');
const timeArrowBtns = document.querySelectorAll('.time-arrow-btn');
const timeNowBtns = document.querySelectorAll('.time-now-btn');
const timeActionsDiv = document.getElementById('time-actions');
const timeCancelBtn = document.getElementById('time-cancel-btn');
const timeApplyBtn = document.getElementById('time-apply-btn');

// ============================================
// FLATPICKR INITIALIZATION
// ============================================

/**
 * Initialize Flatpickr datetime pickers
 * MOBILE: Touch-friendly calendar with dark theme
 */
let startPicker, stopPicker;

// Track if a calendar was just closed to prevent panel collapse
let calendarJustClosed = false;

/**
 * Initialize time controls with default values
 * Start = NOW - lookback
 * Stop = NOW
 */
function initializeTimeControls() {
    const now = new Date();
    const lookbackHours = 24; // Default lookback
    const startDefault = new Date(now.getTime() - (lookbackHours * 60 * 60 * 1000));

    timeState.setCurrentTime(now);
    timeState.setStartTime(startDefault);
    timeState.setStopTime(now);
    timeState.applyTimeChanges(); // Commit the initial values

    startTimeInput.value = formatDateTimeLocal(startDefault);
    stopTimeInput.value = formatDateTimeLocal(now);
}

/**
 * Initialize Flatpickr datetime pickers
 * Replaces native datetime-local with dark-themed picker
 *
 * MOBILE: Touch-friendly calendar interface
 * PERFORMANCE: Lazy-loaded, only initializes when needed
 */
function initializeFlatpickr() {
    // Configure start time picker
    startPicker = flatpickr(startTimeInput, {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        time_24hr: true,
        theme: "dark",
        allowInput: true,  // Allow manual typing
        onChange: (selectedDates) => {
            if (selectedDates.length > 0) {
                timeState.setStartTime(selectedDates[0]);
                setPendingState();
            }
        },
        onClose: () => {
            // Set flag to prevent panel collapse on this click
            calendarJustClosed = true;
        }
    });

    // Configure stop time picker
    stopPicker = flatpickr(stopTimeInput, {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        time_24hr: true,
        theme: "dark",
        allowInput: true,  // Allow manual typing
        onChange: (selectedDates) => {
            if (selectedDates.length > 0) {
                timeState.setStopTime(selectedDates[0]);
                setPendingState();
            }
        },
        onClose: () => {
            // Set flag to prevent panel collapse on this click
            calendarJustClosed = true;
        }
    });

    logger.success('Flatpickr initialized', logger.CATEGORY.DATA);
}

/**
 * Set pending state and show orange borders
 */
function setPendingState() {
    // Note: timeState tracks pending changes internally

    // Add orange borders to time inputs only
    startTimeInput.classList.add('pending');
    stopTimeInput.classList.add('pending');

    // Show Cancel/Apply buttons (make them fully visible)
    timeActionsDiv.classList.add('visible');

    logger.diagnostic('Time changes pending', logger.CATEGORY.DATA);
}

/**
 * Clear pending state and remove orange borders
 */
function clearPendingState() {
    // Note: timeState tracks pending changes internally

    // Remove orange borders from time inputs
    startTimeInput.classList.remove('pending');
    stopTimeInput.classList.remove('pending');

    // Subdue Cancel/Apply buttons (make them less visible)
    timeActionsDiv.classList.remove('visible');
}

/**
 * Apply pending time changes
 */
function applyTimeChanges() {
    // Commit the changes through timeState
    timeState.applyTimeChanges();

    clearPendingState();

    const startTime = timeState.getCommittedStartTime();
    const stopTime = timeState.getCommittedStopTime();
    const duration = (stopTime - startTime) / (1000 * 60 * 60); // hours

    logger.info(
        'Time range applied',
        logger.CATEGORY.DATA,
        {
            start: startTime.toISOString().slice(0, 16),
            stop: stopTime.toISOString().slice(0, 16),
            duration: `${duration.toFixed(1)}h`
        }
    );
}

/**
 * Cancel pending time changes and revert to committed values
 */
function cancelTimeChanges() {
    // Revert through timeState
    timeState.cancelTimeChanges();

    // Get committed values to update UI
    const committedStart = timeState.getCommittedStartTime();
    const committedStop = timeState.getCommittedStopTime();

    // Update Flatpickr instances (also updates input values)
    if (startPicker) {
        startPicker.setDate(committedStart, false);  // false = don't trigger onChange
    }
    if (stopPicker) {
        stopPicker.setDate(committedStop, false);  // false = don't trigger onChange
    }

    clearPendingState();

    logger.info(
        'Time changes cancelled',
        logger.CATEGORY.DATA,
        {
            reverted: committedStart.toISOString().slice(0, 16)
        }
    );
}

/**
 * NOW button handlers
 * Sets individual start or stop time to current time
 */
timeNowBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();

        const target = btn.dataset.target; // 'start' or 'stop'
        const now = new Date();
        const picker = target === 'start' ? startPicker : stopPicker;

        // Set to current time using Flatpickr
        if (picker) {
            picker.setDate(now, true);  // true = trigger onChange (which sets pending state)
        }

        // Visual feedback
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            btn.style.transform = 'scale(1)';
        }, 100);
    });
});

/**
 * Arrow button click handler
 * Increments/decrements time by 1 day
 *
 * PERFORMANCE: O(1) - simple date arithmetic
 */
timeArrowBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();

        const target = btn.dataset.target; // 'start' or 'stop'
        const delta = parseInt(btn.dataset.delta); // -1 or 1
        const picker = target === 'start' ? startPicker : stopPicker;

        // Get current date from timeState
        const currentDate = new Date(target === 'start' ? timeState.getStartTime() : timeState.getStopTime());

        // Add/subtract 1 day (86400000 ms)
        currentDate.setDate(currentDate.getDate() + delta);

        // Update using Flatpickr
        if (picker) {
            picker.setDate(currentDate, true);  // true = trigger onChange (which sets pending state)
        }

        // Visual feedback
        btn.style.transform = 'scale(0.9)';
        setTimeout(() => {
            btn.style.transform = 'scale(1)';
        }, 100);
    });
});

/**
 * Time input change handler
 * Updates state when user manually changes time
 */
startTimeInput.addEventListener('change', (e) => {
    timeState.setStartTime(new Date(e.target.value));
    setPendingState();
});

stopTimeInput.addEventListener('change', (e) => {
    timeState.setStopTime(new Date(e.target.value));
    setPendingState();
});

/**
 * Cancel button handler
 * Reverts time changes to last committed values
 */
timeCancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    cancelTimeChanges();
});

/**
 * Apply button handler
 * Commits pending time changes
 */
timeApplyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    applyTimeChanges();
});

// ============================================
// LEAFLET & DECK.GL INITIALIZATION
// ============================================

/**
 * Initialize Leaflet.js with CartoDB Dark Matter tiles
 *
 * PERFORMANCE:
 * - Raster tiles (pre-rendered, zero processing overhead)
 * - 2-5ms frame budget (vs 8-20ms for vector tiles)
 * - 15-25 MB memory usage (vs 80-120 MB for Mapbox)
 * - 39 KB bundle size (vs 500 KB for Mapbox)
 * - CDN-cached tiles for instant loading
 *
 * MOBILE:
 * - 60 FPS on all devices (even low-end)
 * - Native touch gesture support (pinch, pan)
 * - Minimal battery drain (less GPU work)
 *
 * NO API TOKEN REQUIRED:
 * - CartoDB Dark Matter is free for non-commercial use
 * - No signup, no authentication, works immediately
 * - Commercial use requires CARTO Enterprise license
 */
function initializeLeaflet() {
    logger.info('Initializing Leaflet map', logger.CATEGORY.MAP);

    // Initial view state - Western Pacific
    // Centered over the Western Pacific (wider Asia-Pacific view)
    const INITIAL_VIEW_STATE = {
        center: [30.0, 140.0],  // [latitude, longitude] - Western Pacific (note: Leaflet uses lat, lon)
        zoom: 1,  // Global view (zoomed all the way out)
        minZoom: 1,  // Very zoomed out
        maxZoom: 19  // Very zoomed in (street level)
    };

    // Detect device capability
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    try {
        // Create Leaflet map instance
        const map = L.map('map-container', {
            center: INITIAL_VIEW_STATE.center,
            zoom: INITIAL_VIEW_STATE.zoom,
            minZoom: INITIAL_VIEW_STATE.minZoom,
            maxZoom: INITIAL_VIEW_STATE.maxZoom,

            // Disable default controls (we'll add custom ones)
            zoomControl: false,
            attributionControl: false,

            // Performance optimizations - EXTREME SPEED
            preferCanvas: false,  // Use SVG (faster for raster tiles)
            fadeAnimation: true,  // Smooth fade-in (masks tile loading transitions)
            zoomAnimation: true,  // Keep smooth zoom (GPU-accelerated)
            markerZoomAnimation: true,  // Smooth marker transitions

            // MOBILE: Touch-friendly settings
            tap: true,  // Enable tap events on mobile
            tapTolerance: 15,  // Pixels of movement before canceling tap
            touchZoom: true,  // Pinch to zoom
            doubleClickZoom: true,
            scrollWheelZoom: true,
            boxZoom: true,  // Shift+drag to zoom to box
            keyboard: true,  // Arrow keys to pan

            // World behavior - allow infinite wrapping for smooth panning
            worldCopyJump: true,  // Allow jumping across meridian for smooth east/west wrapping

            // Vertical bounds - prevent dragging beyond poles (while allowing horizontal wrapping)
            maxBounds: [[-85, -Infinity], [85, Infinity]],  // Limit lat ±85° (Mercator limit), infinite lon
            maxBoundsViscosity: 1.0  // Hard stop at boundaries (1.0 = cannot drag beyond)
        });

        // Add CartoDB Dark Matter tiles (ultra-minimalistic dark theme)
        // Free for non-commercial use, no API token required
        const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '©OpenStreetMap, ©CARTO',
            subdomains: 'abcd',  // Use a, b, c, d subdomains for parallel loading
            maxZoom: 19,
            minZoom: 1,

            // Allow infinite tile wrapping for smooth panning
            noWrap: false,  // Allow horizontal wrapping (infinite worlds)

            // Performance optimizations
            updateWhenIdle: false,  // Update tiles while panning (smoother)
            updateWhenZooming: false,  // Don't update while zooming (faster)
            keepBuffer: 6,  // Keep 6 tile rows/cols around viewport (aggressive pre-loading)

            // Retina support
            detectRetina: !isMobileDevice,  // High-DPI on desktop only (save bandwidth on mobile)

            // Error handling
            errorTileUrl: '',  // Don't show error tiles (cleaner look)

            // Cross-origin
            crossOrigin: true
        });

        tileLayer.addTo(map);

        // Add minimal zoom control (top-right corner)
        L.control.zoom({
            position: 'topright'
        }).addTo(map);

        // No attribution control (minimalistic design)

        logger.success(
            'Leaflet map initialized',
            logger.CATEGORY.MAP,
            {
                zoom: INITIAL_VIEW_STATE.zoom,
                center: `${INITIAL_VIEW_STATE.center[0]},${INITIAL_VIEW_STATE.center[1]}`,
                mobile: isMobileDevice
            }
        );

        logger.diagnostic('Map configuration', logger.CATEGORY.MAP, {
            tiles: 'CartoDB Dark Matter',
            projection: 'Web Mercator',
            bundleSize: '39 KB'
        });

        // Make accessible globally
        window.leafletMap = map;

        return map;

    } catch (error) {
        logger.error(
            `Map initialization failed: ${error.message}`,
            logger.CATEGORY.MAP,
            { error: error.stack }
        );
        return null;
    }
}

/**
 * Initialize Deck.gl and overlay it on Leaflet map
 *
 * PERFORMANCE:
 * - GPU-accelerated rendering
 * - 60 FPS target
 * - Instanced rendering for satellites
 * - Separate WebGL context (map doesn't block satellite rendering)
 *
 * MOBILE:
 * - Lower quality on mobile devices
 * - Reduced update frequency
 * - Touch gesture support
 *
 * LEAFLET INTEGRATION:
 * - Uses deck.gl's Deck class with Leaflet adapter
 * - Independent rendering (satellites update even during map pan)
 * - Better performance than shared context
 */
function initializeDeckGL(map) {
    // Check if Deck.gl library is loaded
    if (typeof deck === 'undefined') {
        logger.error(
            'Deck.gl library not loaded',
            logger.CATEGORY.SATELLITE,
            { expected: 'window.deck', found: typeof deck }
        );
        return null;
    }

    logger.info('Initializing Deck.gl overlay', logger.CATEGORY.SATELLITE);

    try {
        // Get Leaflet map center and zoom for initial sync
        const leafletCenter = map.getCenter();
        const leafletZoom = map.getZoom();

        // Create Deck.gl instance
        // Note: Deck.gl with Leaflet uses separate WebGL context (better performance)
        const deckgl = new deck.Deck({
            // Let Deck.gl create its own canvas
            parent: document.getElementById('map-container'),

            // CRITICAL: Explicit MapView with world wrapping to match Leaflet's Web Mercator
            views: new deck.MapView({repeat: true}),

            // CRITICAL: Use viewState (controlled) not initialViewState (uncontrolled)
            // This ensures Deck.gl always uses our external view state
            viewState: {
                longitude: leafletCenter.lng,
                latitude: leafletCenter.lat,
                zoom: leafletZoom,
                pitch: 0,
                bearing: 0,
                transitionDuration: 0  // No transitions - instant updates
            },

            // Controller disabled (Leaflet handles interaction)
            controller: false,

            // CRITICAL: Match Leaflet's coordinate system (CSS pixels, not device pixels)
            // Setting to false ensures 1:1 coordinate mapping with Leaflet
            // Otherwise Deck.gl scales by devicePixelRatio (typically 2x on retina)
            useDevicePixels: false,

            // Performance settings
            _typedArrayManagerProps: {
                overAlloc: 1,
                poolSize: 0
            },

            // Add satellite layers
            layers: [
                new deck.ScatterplotLayer({
                    id: 'test-satellites',
                    data: satelliteState.getAllSatellites(),
                    coordinateSystem: deck.COORDINATE_SYSTEM.LNGLAT,  // CRITICAL: Explicit WGS84 → Web Mercator
                    wrapLongitude: true,  // CRITICAL: Render on all wrapped world copies
                    getPosition: d => [d.lon, d.lat],
                    getRadius: 100000,  // 100km radius
                    getFillColor: [0, 255, 100, 200],  // Green with transparency
                    getLineColor: [0, 255, 100, 255],
                    lineWidthMinPixels: 2,
                    stroked: true,
                    filled: true,
                    pickable: true,

                    // Show satellite name on hover
                    onHover: ({object}) => {
                        if (object) {
                            logger.diagnostic('Satellite hover', logger.CATEGORY.SATELLITE, {
                                name: object.name,
                                altitude: `${object.altitude}km`
                            });
                        }
                    }
                })
            ]
        });

        // Sync Deck.gl view with Leaflet map
        // Update Deck.gl whenever Leaflet map moves
        // CRITICAL: Leaflet and Deck.gl use IDENTICAL zoom levels for Web Mercator

        // Throttle variables for sync function (max 60 FPS = 16.67ms interval)
        let lastSyncTime = 0;
        let syncThrottleMs = 16; // 60 FPS max
        let pendingSyncFrame = null;

        const syncDeckWithLeaflet = () => {
            const now = performance.now();

            // Cancel any pending sync
            if (pendingSyncFrame) {
                cancelAnimationFrame(pendingSyncFrame);
                pendingSyncFrame = null;
            }

            // Throttle: only sync if enough time has passed since last sync
            const timeSinceLastSync = now - lastSyncTime;
            if (timeSinceLastSync < syncThrottleMs) {
                // Schedule sync for next frame
                pendingSyncFrame = requestAnimationFrame(syncDeckWithLeaflet);
                return;
            }

            lastSyncTime = now;

            const center = map.getCenter();
            const zoom = map.getZoom();

            // DIAGNOSTIC: Log sync event with structured context (reduced frequency)
            if (Math.random() < 0.1) { // Log only 10% of syncs to reduce noise
                logger.diagnostic(
                    'Leaflet→Deck sync',
                    logger.CATEGORY.SYNC,
                    {
                        lng: center.lng.toFixed(4),
                        lat: center.lat.toFixed(4),
                        zoom: zoom.toFixed(2)
                    }
                );
            }

            // Check canvas size
            const mapContainer = document.getElementById('map-container');
            const deckCanvas = deckgl.canvas;
            if (mapContainer && deckCanvas) {
                const containerRect = mapContainer.getBoundingClientRect();
                const canvasRect = deckCanvas.getBoundingClientRect();

                const widthDiff = Math.abs(containerRect.width - canvasRect.width);
                const heightDiff = Math.abs(containerRect.height - canvasRect.height);

                if (widthDiff > 1 || heightDiff > 1) {
                    logger.warning(
                        'Canvas size mismatch',
                        logger.CATEGORY.SYNC,
                        {
                            container: `${containerRect.width.toFixed(0)}×${containerRect.height.toFixed(0)}`,
                            canvas: `${canvasRect.width.toFixed(0)}×${canvasRect.height.toFixed(0)}`,
                            drift: `${widthDiff.toFixed(0)}×${heightDiff.toFixed(0)}`
                        }
                    );

                    // CRITICAL: Auto-fix canvas size mismatch by resizing Deck.gl canvas
                    deckgl.setProps({
                        width: containerRect.width,
                        height: containerRect.height
                    });
                    logger.diagnostic('Canvas size auto-corrected', logger.CATEGORY.SYNC, {
                        size: `${containerRect.width.toFixed(0)}×${containerRect.height.toFixed(0)}px`
                    });
                }
            }

            // CRITICAL: Set viewState with all transition controls disabled
            deckgl.setProps({
                viewState: {
                    longitude: center.lng,
                    latitude: center.lat,
                    zoom: zoom - 1,  // CRITICAL: Deck.gl MapView needs zoom - 1 for Leaflet compatibility
                    pitch: 0,
                    bearing: 0,
                    transitionDuration: 0,  // No animation
                    transitionInterpolator: null  // Force disable all interpolation
                }
            });

            // DIAGNOSTIC: Verify Deck.gl accepted the view state (only check occasionally)
            if (Math.random() < 0.05) { // Check only 5% of the time to reduce overhead
                setTimeout(() => {
                    const deckViewState = deckgl.viewState || deckgl.props.viewState;
                    if (deckViewState) {
                        // Check for drift (relaxed thresholds due to throttling)
                        const lngDrift = Math.abs(deckViewState.longitude - center.lng);
                        const latDrift = Math.abs(deckViewState.latitude - center.lat);
                        const zoomDrift = Math.abs(deckViewState.zoom - zoom);

                        // Higher thresholds to account for throttling delay
                        if (lngDrift > 0.01 || latDrift > 0.01 || zoomDrift > 0.01) {
                            logger.warning(
                                'Sync drift detected',
                                logger.CATEGORY.SYNC,
                                {
                                    lngDrift: lngDrift.toFixed(6),
                                    latDrift: latDrift.toFixed(6),
                                    zoomDrift: zoomDrift.toFixed(4)
                                }
                            );
                        }
                    }
                }, 0);
            }
        };

        // Listen to Leaflet map events
        map.on('move', syncDeckWithLeaflet);
        map.on('zoom', syncDeckWithLeaflet);

        // Initial sync
        syncDeckWithLeaflet();

        // Wait for Deck.gl to create its canvas, then set proper layering
        // This ensures the canvas appears ABOVE Leaflet tiles and has EXACT same dimensions
        requestAnimationFrame(() => {
            const deckCanvas = deckgl.canvas || document.querySelector('#map-container canvas');
            const mapContainer = document.getElementById('map-container');

            if (deckCanvas && mapContainer) {
                // CRITICAL: Canvas must exactly match container size for proper coordinate transforms
                const rect = mapContainer.getBoundingClientRect();

                deckCanvas.style.position = 'absolute';
                deckCanvas.style.left = '0';
                deckCanvas.style.top = '0';
                deckCanvas.style.width = '100%';
                deckCanvas.style.height = '100%';
                deckCanvas.style.zIndex = '400';  // Above Leaflet tiles (z-index 200) but below controls (z-index 1000)
                deckCanvas.style.pointerEvents = 'none';  // Let Leaflet handle all interaction

                logger.success('Deck.gl canvas positioned', logger.CATEGORY.SATELLITE, {
                    zIndex: 400,
                    size: `${rect.width.toFixed(0)}×${rect.height.toFixed(0)}px`
                });
            } else {
                logger.warning('Could not find Deck.gl canvas for styling', logger.CATEGORY.SATELLITE);
            }
        });

        logger.success(
            'Deck.gl initialized',
            logger.CATEGORY.SATELLITE,
            { satellites: satelliteState.getSatelliteCount() }
        );

        logger.diagnostic('Deck.gl configuration', logger.CATEGORY.SATELLITE, {
            context: 'Separate WebGL',
            controller: 'disabled',
            viewStateMode: 'controlled'
        });

        const initialView = deckgl.viewState || deckgl.props.viewState;
        logger.diagnostic('Coordinate system', logger.CATEGORY.SATELLITE, {
            projection: 'Web Mercator',
            view: 'MapView(repeat=true)',
            coordinateSystem: 'LNGLAT (WGS84→WebMercator)',
            wrapLongitude: 'true (render on all world copies)',
            initialView: `${initialView.longitude.toFixed(4)}°E, ${initialView.latitude.toFixed(4)}°N, zoom=${initialView.zoom.toFixed(2)}`
        });

        // Make accessible globally for layer updates
        window.deckgl = deckgl;

        return deckgl;

    } catch (error) {
        logger.error(
            `Deck.gl initialization failed: ${error.message}`,
            logger.CATEGORY.SATELLITE,
            { error: error.stack }
        );
        return null;
    }
}

// ============================================
// 4-PANE RESIZER
// ============================================

/**
 * Initialize 4-pane resizable grid with crosshair handle
 *
 * DESIGN PHILOSOPHY:
 * - Simple resize constraints (user has freedom)
 * - Map intelligently adapts to new container size
 * - No complex calculations during drag (smooth performance)
 * - Map auto-adjusts view to prevent white space
 *
 * PERFORMANCE:
 * - Lightweight drag handling (just update grid percentages)
 * - Map optimization happens AFTER drag completes
 * - Debounced for smooth 60fps during resize
 *
 * MOBILE:
 * - Touch events supported
 * - Minimum pane size prevents unusable layouts
 */
function initializePaneResizer() {
    const mainContainer = document.getElementById('main-container');
    const verticalHandle = document.getElementById('grid-resize-vertical');
    const horizontalHandle = document.getElementById('grid-resize-horizontal');
    const crosshairHandle = document.getElementById('grid-resize-crosshair');

    if (!mainContainer || !verticalHandle || !horizontalHandle || !crosshairHandle) {
        logger.warning('Pane resizer elements not found', logger.CATEGORY.PANEL);
        return;
    }

    let isDragging = false;
    let activeHandle = null; // 'vertical', 'horizontal', or 'crosshair'
    let currentHorizontalPercent = 65; // Match CSS grid-template-columns: 65% 35%
    let currentVerticalPercent = 60;   // Match CSS grid-template-rows: 60% 40%

    // Simple constraints - user-friendly ranges
    const MIN_PERCENT = 25;  // Minimum 25% (enough space for content)
    const MAX_PERCENT = 75;  // Maximum 75% (leave space for other panes)

    /**
     * Update handle positions based on current grid percentages
     */
    function updateHandlePositions() {
        verticalHandle.style.left = `calc(${currentHorizontalPercent}% - 6px)`;
        horizontalHandle.style.top = `calc(${currentVerticalPercent}% - 6px)`;
        crosshairHandle.style.left = `calc(${currentHorizontalPercent}% - 10px)`;
        crosshairHandle.style.top = `calc(${currentVerticalPercent}% - 10px)`;
    }

    // Set initial positions
    updateHandlePositions();

    // Track which handles are being hovered
    let hoverState = {
        vertical: false,
        horizontal: false,
        crosshair: false
    };

    // Show/hide crosshair synchronized with gradient bars
    const updateCrosshairVisibility = () => {
        const shouldShow = hoverState.vertical || hoverState.horizontal || hoverState.crosshair || isDragging;
        if (shouldShow) {
            crosshairHandle.classList.add('visible');
        } else {
            crosshairHandle.classList.remove('visible');
        }
    };

    // Vertical handle events
    verticalHandle.addEventListener('mouseenter', () => {
        hoverState.vertical = true;
        updateCrosshairVisibility();
    });
    verticalHandle.addEventListener('mouseleave', () => {
        hoverState.vertical = false;
        setTimeout(updateCrosshairVisibility, 10); // Small delay to allow crosshair hover to register
    });

    // Horizontal handle events
    horizontalHandle.addEventListener('mouseenter', () => {
        hoverState.horizontal = true;
        updateCrosshairVisibility();
    });
    horizontalHandle.addEventListener('mouseleave', () => {
        hoverState.horizontal = false;
        setTimeout(updateCrosshairVisibility, 10);
    });

    // Crosshair handle events
    crosshairHandle.addEventListener('mouseenter', () => {
        hoverState.crosshair = true;
        updateCrosshairVisibility();
        // Show both gradient lines when hovering over crosshair
        verticalHandle.classList.add('active');
        horizontalHandle.classList.add('active');
    });
    crosshairHandle.addEventListener('mouseleave', () => {
        hoverState.crosshair = false;
        setTimeout(updateCrosshairVisibility, 10);
        // Hide gradient lines when leaving crosshair (unless dragging)
        if (!isDragging) {
            verticalHandle.classList.remove('active');
            horizontalHandle.classList.remove('active');
        }
    });

    /**
     * Update crosshair glow based on cursor proximity
     * Glow intensity increases as cursor gets closer to center
     */
    function updateCrosshairGlow(e) {
        if (!crosshairHandle.classList.contains('visible')) return;

        // Get crosshair center position
        const rect = crosshairHandle.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Calculate distance from cursor to center
        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Map distance to glow intensity (0 to 1)
        // Max distance for full effect is 100px, min is 0px
        const maxDistance = 100;
        const intensity = Math.max(0, Math.min(1, 1 - (distance / maxDistance)));

        // Update CSS variable
        crosshairHandle.style.setProperty('--glow-intensity', intensity);
    }

    // Track mouse movement for proximity glow
    mainContainer.addEventListener('mousemove', updateCrosshairGlow, { passive: true });

    /**
     * Optimize map view after resize to prevent white space
     * Uses Leaflet's intelligent fitBounds to fill container optimally
     */
    function optimizeMapView() {
        const map = window.leafletMap;
        if (!map) return;

        const mapContainer = document.getElementById('map-container');
        const bounds = map.getBounds();
        const center = map.getCenter();
        const zoom = map.getZoom();

        // Get container dimensions
        const rect = mapContainer.getBoundingClientRect();
        const aspectRatio = rect.width / rect.height;

        // Mercator projection: optimal aspect ratio varies by latitude and zoom
        // For global view (zoom < 3), aspect ratio should be ~2:1
        // For regional views, it's more flexible

        if (aspectRatio > 2.2) {
            // Container is too wide - zoom in slightly to fill horizontal space
            // This prevents horizontal white space on sides
            map.setView(center, zoom + 0.3, { animate: true, duration: 0.3 });
        } else if (aspectRatio < 0.8) {
            // Container is too tall - zoom out slightly to fill vertical space
            map.setView(center, Math.max(1, zoom - 0.2), { animate: true, duration: 0.3 });
        } else {
            // Aspect ratio is reasonable - just ensure size is correct
            map.invalidateSize({ animate: true, duration: 0.3 });
        }

        // CRITICAL: Also resize Deck.gl canvas to match new map dimensions
        // Without this, coordinate transforms will be incorrect after pane resize
        if (window.deckgl) {
            window.deckgl.setProps({
                width: rect.width,
                height: rect.height
            });
            logger.diagnostic('Deck.gl canvas resized', logger.CATEGORY.SATELLITE, {
                size: `${rect.width.toFixed(0)}×${rect.height.toFixed(0)}px`
            });
        }

        logger.diagnostic('Map optimized', logger.CATEGORY.MAP, {
            size: `${rect.width.toFixed(0)}×${rect.height.toFixed(0)}px`,
            ratio: aspectRatio.toFixed(2)
        });
    }

    /**
     * Start dragging vertical handle (horizontal resize)
     */
    function handleVerticalDragStart(e) {
        isDragging = true;
        activeHandle = 'vertical';
        verticalHandle.classList.add('active');
        updateCrosshairVisibility(); // Keep crosshair visible during drag
        e.preventDefault();
    }

    /**
     * Start dragging horizontal handle (vertical resize)
     */
    function handleHorizontalDragStart(e) {
        isDragging = true;
        activeHandle = 'horizontal';
        horizontalHandle.classList.add('active');
        updateCrosshairVisibility(); // Keep crosshair visible during drag
        e.preventDefault();
    }

    /**
     * Start dragging crosshair (both horizontal and vertical resize)
     */
    function handleCrosshairDragStart(e) {
        isDragging = true;
        activeHandle = 'crosshair';
        crosshairHandle.classList.add('active');
        verticalHandle.classList.add('active');
        horizontalHandle.classList.add('active');
        updateCrosshairVisibility(); // Keep crosshair visible during drag
        e.preventDefault();
    }

    /**
     * Handle drag movement for all handles
     */
    function handleDragMove(e) {
        if (!isDragging) return;

        // Get current mouse/touch position
        let currentX, currentY;
        if (e.type === 'touchmove') {
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
        } else {
            currentX = e.clientX;
            currentY = e.clientY;
        }

        // Calculate new position relative to container
        const containerRect = mainContainer.getBoundingClientRect();
        const relativeX = currentX - containerRect.left;
        const relativeY = currentY - containerRect.top;

        if (activeHandle === 'vertical') {
            // Vertical handle controls horizontal split
            let horizontalPercent = (relativeX / containerRect.width) * 100;
            horizontalPercent = Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, horizontalPercent));
            currentHorizontalPercent = horizontalPercent;
            mainContainer.style.gridTemplateColumns = `${horizontalPercent}% ${100 - horizontalPercent}%`;
        } else if (activeHandle === 'horizontal') {
            // Horizontal handle controls vertical split
            let verticalPercent = (relativeY / containerRect.height) * 100;
            verticalPercent = Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, verticalPercent));
            currentVerticalPercent = verticalPercent;
            mainContainer.style.gridTemplateRows = `${verticalPercent}% ${100 - verticalPercent}%`;
        } else if (activeHandle === 'crosshair') {
            // Crosshair controls both splits simultaneously
            let horizontalPercent = (relativeX / containerRect.width) * 100;
            let verticalPercent = (relativeY / containerRect.height) * 100;
            horizontalPercent = Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, horizontalPercent));
            verticalPercent = Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, verticalPercent));
            currentHorizontalPercent = horizontalPercent;
            currentVerticalPercent = verticalPercent;
            mainContainer.style.gridTemplateColumns = `${horizontalPercent}% ${100 - horizontalPercent}%`;
            mainContainer.style.gridTemplateRows = `${verticalPercent}% ${100 - verticalPercent}%`;
        }

        // Update handle positions
        updateHandlePositions();
    }

    /**
     * Stop dragging
     */
    function handleDragEnd() {
        if (!isDragging) return;

        isDragging = false;
        verticalHandle.classList.remove('active');
        horizontalHandle.classList.remove('active');
        crosshairHandle.classList.remove('active');
        activeHandle = null;

        // Update crosshair visibility based on hover state
        updateCrosshairVisibility();

        // Optimize map view to fit new container size
        if (window.leafletMap) {
            setTimeout(() => {
                optimizeMapView();
            }, 50);
        }

        logger.diagnostic(
            'Grid resized',
            logger.CATEGORY.PANEL,
            {
                horizontal: `${currentHorizontalPercent.toFixed(1)}%`,
                vertical: `${currentVerticalPercent.toFixed(1)}%`
            }
        );
    }

    // Mouse events for vertical handle
    verticalHandle.addEventListener('mousedown', handleVerticalDragStart);

    // Mouse events for horizontal handle
    horizontalHandle.addEventListener('mousedown', handleHorizontalDragStart);

    // Mouse events for crosshair handle
    crosshairHandle.addEventListener('mousedown', handleCrosshairDragStart);

    // Global move/up events
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    // Touch events (mobile)
    verticalHandle.addEventListener('touchstart', handleVerticalDragStart, { passive: false });
    horizontalHandle.addEventListener('touchstart', handleHorizontalDragStart, { passive: false });
    crosshairHandle.addEventListener('touchstart', handleCrosshairDragStart, { passive: false });
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);

    logger.success('Grid border resizers initialized');
    logger.info('Hover over borders to see crosshair, drag to resize');
}

// ============================================
// LOG PANEL RESIZE FUNCTIONALITY
// ============================================

/**
 * Initialize log panel vertical resizer
 *
 * FUNCTIONALITY:
 * - Drag pill-shaped handle on top border of log panel
 * - Adjusts vertical split between content area and log panel
 * - Minimum 10% for either section (prevents unusable layouts)
 * - Maximum 90% for content area (ensures log remains accessible)
 * - Touch events supported for mobile
 *
 * PERFORMANCE:
 * - O(1) flex percentage updates
 * - No re-renders, direct style updates
 * - Smooth 60fps drag experience
 */
function initializeLogPanelResizer() {
    const bottomLeftPane = document.getElementById('pane-bottom-left');
    const contentArea = bottomLeftPane?.querySelector('.pane-content-area');
    const logArea = bottomLeftPane?.querySelector('.pane-log-area');
    const resizeHandle = document.getElementById('log-resize-handle');

    if (!bottomLeftPane || !contentArea || !logArea || !resizeHandle) {
        logger.warning('Log panel resizer elements not found', logger.CATEGORY.PANEL);
        return;
    }

    let isDragging = false;
    let currentLogHeight = 50; // Start at 50px (minimized)

    // Constraints for usable layouts
    const MIN_LOG_HEIGHT_PX = 50;  // Minimum pixels for log panel (1 row visible)
    const MIN_CONTENT_HEIGHT_PX = 50;  // Minimum pixels for content area above log panel
    const MAX_LOG_PERCENT = 90;  // Maximum 90% of pane height

    // Set initial log height to 50px (minimized)
    logArea.style.flex = `0 0 50px`;
    contentArea.style.flex = `1 1 auto`;

    /**
     * Start dragging
     */
    function handleDragStart(e) {
        isDragging = true;
        resizeHandle.classList.add('active');
        e.preventDefault();
    }

    /**
     * Handle drag movement
     * Updates log panel height in pixels (fixed height, independent of crosshair)
     * Enforces minimum log panel height (50px) and maximum (90% of pane)
     */
    function handleDragMove(e) {
        if (!isDragging) return;

        // Get current mouse/touch position
        let currentY;
        if (e.type === 'touchmove') {
            currentY = e.touches[0].clientY;
        } else {
            currentY = e.clientY;
        }

        // Calculate position relative to bottom-left pane
        const paneRect = bottomLeftPane.getBoundingClientRect();
        const relativeY = currentY - paneRect.top;

        // Calculate log height in pixels (distance from bottom)
        let logHeightPx = paneRect.height - relativeY;

        // Calculate maximum log height (90% of pane)
        const maxLogHeightPx = paneRect.height * (MAX_LOG_PERCENT / 100);

        // Calculate maximum log height based on minimum content area requirement
        const maxLogHeightByContent = paneRect.height - MIN_CONTENT_HEIGHT_PX;

        // Clamp to min/max constraints (respect both percentage and content area minimums)
        logHeightPx = Math.max(MIN_LOG_HEIGHT_PX, Math.min(maxLogHeightPx, maxLogHeightByContent, logHeightPx));

        // Update log area with fixed pixel height
        currentLogHeight = logHeightPx;
        logArea.style.flex = `0 0 ${logHeightPx}px`;
        // Content area takes remaining space
        contentArea.style.flex = `1 1 auto`;
    }

    /**
     * Stop dragging
     */
    function handleDragEnd() {
        if (!isDragging) return;

        isDragging = false;
        resizeHandle.classList.remove('active');

        logger.diagnostic(
            'Log panel resized',
            logger.CATEGORY.PANEL,
            { height: `${currentLogHeight.toFixed(0)}px` }
        );
    }

    // Mouse events
    resizeHandle.addEventListener('mousedown', handleDragStart);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    // Touch events (mobile)
    resizeHandle.addEventListener('touchstart', handleDragStart, { passive: false });
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);

    logger.success('Log panel resizer initialized');
}

// ============================================
// MAP MAXIMIZE FUNCTIONALITY
// ============================================

/**
 * Initialize map maximize/restore button
 *
 * FUNCTIONALITY:
 * - Toggles map between normal grid view and maximized fullscreen
 * - Keeps control panel visible in maximized mode
 * - Hides other 3 panes and crosshair when maximized
 * - Updates map size after toggle
 *
 * PERFORMANCE:
 * - CSS-only transitions (GPU-accelerated)
 * - Simple class toggle (no complex calculations)
 *
 * MOBILE:
 * - Touch-friendly button (44px on mobile)
 * - Works with responsive panel behavior
 */
function initializeMapMaximize() {
    const maximizeBtn = document.getElementById('map-maximize-btn');
    const mainContainer = document.getElementById('main-container');
    const maximizeIcon = document.getElementById('maximize-icon');

    if (!maximizeBtn || !mainContainer) {
        logger.warning('Map maximize button not found', logger.CATEGORY.PANEL);
        return;
    }

    let isMaximized = false;

    maximizeBtn.addEventListener('click', () => {
        isMaximized = !isMaximized;

        if (isMaximized) {
            // Maximize: hide other panes, show map fullscreen
            mainContainer.classList.add('maximized');
            maximizeIcon.textContent = '⊡';  // Restore icon
            maximizeBtn.title = 'Restore map';
            logger.diagnostic('Map maximized', logger.CATEGORY.MAP);
        } else {
            // Restore: show all panes in grid
            mainContainer.classList.remove('maximized');
            maximizeIcon.textContent = '⛶';  // Maximize icon
            maximizeBtn.title = 'Maximize map';
            logger.diagnostic('Map restored', logger.CATEGORY.MAP);
        }

        // Update map size after transition
        if (window.leafletMap) {
            setTimeout(() => {
                window.leafletMap.invalidateSize({ animate: true });

                // CRITICAL: Also resize Deck.gl canvas to match new map dimensions
                if (window.deckgl) {
                    const mapContainer = document.getElementById('map-container');
                    const rect = mapContainer.getBoundingClientRect();
                    window.deckgl.setProps({
                        width: rect.width,
                        height: rect.height
                    });
                    logger.diagnostic('Deck.gl canvas resized on maximize/restore', logger.CATEGORY.SATELLITE, {
                        size: `${rect.width.toFixed(0)}×${rect.height.toFixed(0)}px`
                    });
                }
            }, 50);
        }
    });

    logger.success('Map maximize button initialized', logger.CATEGORY.PANEL);
}

// ============================================
// RESPONSIVE HANDLING
// ============================================
// Mobile detection and panel auto-collapse is handled by uiState module
// Listen to uiState events if additional resize logic is needed

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize sensor button handlers
 * Attaches event listeners to CRUD buttons
 */
function initializeSensorButtons() {
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

/**
 * Initialize satellite button handlers
 * Sets up click handlers for add, edit, delete buttons
 */
function initializeSatelliteButtons() {
    const addBtn = document.getElementById('satellite-add-btn');
    const editBtn = document.getElementById('satellite-edit-btn');
    const deleteBtn = document.getElementById('satellite-delete-btn');

    if (addBtn) {
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addSatellite();
        });
    }

    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const selectedSatellites = satelliteState.getSelectedSatellites();
            if (selectedSatellites.length === 1) {
                editSatellite(selectedSatellites[0].id);
            } else if (selectedSatellites.length === 0) {
                logger.warning('Please select a satellite to edit', logger.CATEGORY.SATELLITE);
            } else {
                logger.warning('Please select only one satellite to edit', logger.CATEGORY.SATELLITE);
            }
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSatellites();
        });
    }

    logger.success('Satellite button handlers initialized', logger.CATEGORY.SATELLITE);
}

/**
 * Initialize application
 * Called when DOM is loaded
 */
function init() {
    // Initialize UI logger first
    logger.init();

    logger.info('Initializing Satellite Visualization System');
    logger.info(`Mobile device: ${uiState.isMobile()}`);
    logger.info(`Window size: ${window.innerWidth} × ${window.innerHeight}`);

    // Initialize time controls with default values
    initializeTimeControls();

    // Initialize Flatpickr datetime pickers
    initializeFlatpickr();

    // Initialize sensor data and controls
    initializeSensors();
    initializeSensorButtons();

    // Initialize satellite data and controls
    initializeSatellites();
    initializeSatelliteButtons();

    // Initialize Leaflet base map
    const map = initializeLeaflet();

    // Initialize Deck.gl overlay (if map loaded successfully)
    if (map) {
        // Leaflet map is ready immediately (no 'load' event needed)
        // Wait a frame to ensure DOM is fully updated
        requestAnimationFrame(() => {
            initializeDeckGL(map);

            // CRITICAL: Call updateDeckOverlay() to render sensor layers
            // Without this, sensors with selected=true won't appear until user toggles checkbox
            requestAnimationFrame(() => {
                updateDeckOverlay();
                logger.success('Map and visualization layers loaded', logger.CATEGORY.MAP);
            });
        });
    } else {
        logger.warning('Map initialization failed', logger.CATEGORY.MAP);
    }

    // Initialize 4-pane resizable grid
    initializePaneResizer();

    // Initialize log panel resizer
    initializeLogPanelResizer();

    // Initialize map maximize button
    initializeMapMaximize();

    // On mobile, start with panel collapsed
    if (uiState.isMobile()) {
        togglePanel(false);
    }

    logger.success('Initialization complete', logger.CATEGORY.PANEL);
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ============================================
// API COMMUNICATION (Placeholder)
// ============================================

/**
 * Fetch satellite data from backend
 *
 * PERFORMANCE: Cached, paginated
 * MOBILE: Reduced payload size
 */
async function fetchSatellites() {
    try {
        const response = await fetch('/api/satellites?limit=100');
        const data = await response.json();
        logger.success('Satellites loaded', logger.CATEGORY.DATA, { total: data.total });
        return data.satellites;
    } catch (error) {
        logger.error('Failed to fetch satellites', logger.CATEGORY.DATA, { error: error.message });
        return [];
    }
}

// Export for use in other modules (if needed)
window.SatelliteApp = {
    // State modules (read-only access)
    uiState,
    sensorState,
    satelliteState,
    timeState,
    // Functions
    togglePanel,
    fetchSatellites,
    websocketManager,
    // Debug helpers
    updateDeckOverlay,
    testSensors: () => {
        logger.info('Debug Info', logger.CATEGORY.SENSOR, {
            deckglReady: !!window.deckgl,
            totalSensors: sensorState.getSensorCount(),
            selectedSensors: sensorState.getSelectedCount()
        });
        logger.diagnostic('Sensor sample', logger.CATEGORY.SENSOR, {
            sample: JSON.stringify(sensorState.getAllSensors().slice(0, 3))
        });
        if (window.deckgl) {
            logger.success('Deck.gl is ready', logger.CATEGORY.SATELLITE);
            updateDeckOverlay();
        } else {
            logger.warning('Deck.gl not initialized yet', logger.CATEGORY.SATELLITE);
        }
    }
};
