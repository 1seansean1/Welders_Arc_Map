/**
 * Sensor Table Module - Table rendering, sorting, and row interactions
 *
 * DEPENDENCIES:
 * - sensorState: Sensor data and selection state
 * - logger: Diagnostic logging
 *
 * Features:
 * - Dynamic table rendering
 * - Column sorting (name, lat, lon, alt)
 * - Select all/none functionality
 * - Row selection and activation
 * - Double-click to edit
 * - Sort state indicators (▲/▼)
 *
 * PERFORMANCE: O(n) where n = number of sensors
 * MOBILE: Compact table fits in 224px panel width
 */

import sensorState from '../state/sensorState.js';
import logger from '../utils/logger.js';

// ============================================
// DEPENDENCIES (injected during initialization)
// ============================================

let editSensorCallback = null;
let updateMapCallback = null;

// ============================================
// TABLE RENDERING
// ============================================

/**
 * Render sensor table
 * Updates table body with current sensor data
 *
 * PERFORMANCE: O(n) where n = number of sensors
 * MOBILE: Compact table fits in 224px panel width
 */
export function renderSensorTable() {
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
 * Create sensor table row
 * Returns a <tr> element for a sensor
 *
 * @param {Object} sensor - Sensor object { id, name, lat, lon, alt, selected }
 * @param {number} index - Row index in array
 * @returns {HTMLTableRowElement} Table row element
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
        if (editSensorCallback) {
            editSensorCallback();
        }
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
        if (updateMapCallback) {
            updateMapCallback();
        }
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
// SORTING
// ============================================

/**
 * Get sorted sensors based on current sort state
 * Returns a copy of the sensors array, sorted if needed
 *
 * @returns {Array} Sorted sensor array
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
 *
 * @param {string} columnName - Column name ('sel', 'name', 'lat', 'lon', 'alt')
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

// ============================================
// SELECTION
// ============================================

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
    if (updateMapCallback) {
        updateMapCallback();
    }
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize sensor table
 * Sets up column header click handlers and dependencies
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onEdit - Callback when editing sensor
 * @param {Function} options.onMapUpdate - Callback when map needs update
 */
export function initializeSensorTable(options = {}) {
    // Store callbacks
    editSensorCallback = options.onEdit || null;
    updateMapCallback = options.onMapUpdate || null;

    // Initialize column header click handlers
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

    logger.success('Sensor table initialized', logger.CATEGORY.SENSOR);
}
