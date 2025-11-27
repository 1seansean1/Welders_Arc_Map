/**
 * Watch List Table Module - Table rendering for watchlisted satellites
 *
 * DEPENDENCIES:
 * - satelliteState: Satellite data and watchlist state
 * - logger: Diagnostic logging
 *
 * Features:
 * - Dynamic table rendering of watchlisted satellites
 * - Column sorting (noradId, name) - 3-click cycle: asc → desc → default
 * - Color button cycling (grey → red → blue → grey)
 * - Row click highlighting
 */

import satelliteState from '../state/satelliteState.js';
import logger from '../utils/logger.js';
import eventBus from '../events/eventBus.js';

// ============================================
// DEPENDENCIES (injected during initialization)
// ============================================

let updateMapCallback = null;

// Sort state for watchlist table (independent of satellite table)
let sortState = {
    column: null,
    direction: null
};

// ============================================
// COLOR DEFINITIONS
// ============================================

const WATCH_COLORS = {
    grey: { fill: '#666666', border: '#888888' },
    red: { fill: '#ff4444', border: '#ff6666' },
    blue: { fill: '#4488ff', border: '#66aaff' }
};

// ============================================
// TABLE RENDERING
// ============================================

/**
 * Render watchlist table
 * Updates table body with watchlisted satellites
 */
export function renderWatchlistTable() {
    const tbody = document.querySelector('#watchlist-table tbody');
    if (!tbody) return;

    // Clear existing rows
    tbody.innerHTML = '';

    // Get sorted watchlisted satellites
    const satellites = getSortedWatchlistedSatellites();

    // Render each satellite
    satellites.forEach((sat, index) => {
        const row = createWatchlistRow(sat, index);
        tbody.appendChild(row);
    });

    // Update column header indicators
    updateColumnHeaderIndicators();

    logger.diagnostic('Watchlist table rendered', logger.CATEGORY.SATELLITE, { count: satellites.length });
}

/**
 * Create watchlist table row
 * Returns a <tr> element for a watchlisted satellite
 *
 * @param {Object} sat - Satellite object
 * @param {number} index - Row index
 * @returns {HTMLTableRowElement} Table row element
 */
function createWatchlistRow(sat, index) {
    const tr = document.createElement('tr');
    tr.dataset.satelliteId = sat.id;
    tr.dataset.index = index;

    // Row click handler - highlight row
    tr.addEventListener('click', (e) => {
        // Don't toggle if clicking directly on color button
        if (e.target.classList.contains('watch-color-btn')) return;

        // Remove highlight from all rows
        const allRows = document.querySelectorAll('#watchlist-table tbody tr');
        allRows.forEach(row => row.classList.remove('selected'));

        // Add highlight to this row
        tr.classList.add('selected');

        logger.diagnostic('Watchlist row selected', logger.CATEGORY.SATELLITE, { name: sat.name, id: sat.id });
    });

    // Color button column
    const tdColor = document.createElement('td');
    tdColor.style.cssText = 'text-align: center; padding: 4px;';

    const colorBtn = document.createElement('button');
    colorBtn.className = 'watch-color-btn';
    const currentColor = sat.watchColor || 'grey';
    const colorDef = WATCH_COLORS[currentColor];
    colorBtn.style.cssText = `
        width: 14px;
        height: 14px;
        border: 2px solid ${colorDef.border};
        background: ${colorDef.fill};
        cursor: pointer;
        padding: 0;
        border-radius: 2px;
    `;
    colorBtn.title = `Color: ${currentColor} (click to cycle)`;

    colorBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent row click
        const newColor = satelliteState.cycleSatelliteWatchColor(sat.id);
        renderWatchlistTable(); // Re-render to update button color

        // Update map visualization
        if (updateMapCallback) {
            updateMapCallback();
        }

        logger.diagnostic('Watchlist color cycled', logger.CATEGORY.SATELLITE, {
            name: sat.name,
            color: newColor
        });
    });
    tdColor.appendChild(colorBtn);
    tr.appendChild(tdColor);

    // NORAD ID column
    const tdNorad = document.createElement('td');
    tdNorad.style.cssText = 'padding: 4px 8px; text-align: center;';
    tdNorad.textContent = sat.noradId;
    tr.appendChild(tdNorad);

    // Name column
    const tdName = document.createElement('td');
    tdName.style.cssText = 'padding: 4px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; text-align: left;';
    tdName.textContent = sat.name;
    tdName.title = sat.name; // Show full name on hover
    tr.appendChild(tdName);

    return tr;
}

// ============================================
// SORTING
// ============================================

/**
 * Get sorted watchlisted satellites based on current sort state
 * @returns {Array} Sorted satellite array
 */
function getSortedWatchlistedSatellites() {
    // Get only watchlisted satellites
    const watchlisted = satelliteState.getWatchlistedSatellites();

    // If no sort is active, return original order
    if (!sortState.column || !sortState.direction) {
        return watchlisted;
    }

    // Create a copy for sorting
    const sorted = [...watchlisted];
    const column = sortState.column;
    const direction = sortState.direction;

    sorted.sort((a, b) => {
        let valA, valB;

        if (column === 'noradId') {
            valA = a.noradId;
            valB = b.noradId;
        } else if (column === 'name') {
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
        }

        let comparison = 0;
        if (typeof valA === 'string') {
            comparison = valA.localeCompare(valB);
        } else {
            comparison = valA - valB;
        }

        return direction === 'asc' ? comparison : -comparison;
    });

    return sorted;
}

/**
 * Handle column header click for sorting
 * Cycles: default → ascending → descending → default
 * @param {string} columnName - Column name ('color', 'noradId', 'name')
 */
function handleColumnHeaderClick(columnName) {
    // Color column is not sortable
    if (columnName === 'color') {
        return;
    }

    // Cycle through sort states
    if (sortState.column === columnName) {
        if (sortState.direction === 'asc') {
            sortState.direction = 'desc';
        } else if (sortState.direction === 'desc') {
            sortState.column = null;
            sortState.direction = null;
        }
    } else {
        sortState.column = columnName;
        sortState.direction = 'asc';
    }

    renderWatchlistTable();
    logger.diagnostic('Watchlist table sorted', logger.CATEGORY.SATELLITE, {
        column: columnName,
        direction: sortState.direction || 'default'
    });
}

/**
 * Update column header text with sort indicators
 */
function updateColumnHeaderIndicators() {
    const headers = document.querySelectorAll('#watchlist-table th');
    const columnMap = ['color', 'noradId', 'name'];
    const labelMap = {
        'color': '',
        'noradId': 'NORAD',
        'name': 'Name'
    };

    headers.forEach((header, index) => {
        const columnName = columnMap[index];
        if (!columnName) return;

        let text = labelMap[columnName];

        if (sortState.column === columnName) {
            text += sortState.direction === 'asc' ? ' ▲' : ' ▼';
        }

        header.textContent = text;
    });
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize watchlist table
 * Sets up header click handlers and event listeners
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onMapUpdate - Callback when map needs update
 */
export function initializeWatchlistTable(options = {}) {
    // Store callbacks
    updateMapCallback = options.onMapUpdate || null;

    // Initialize column header click handlers
    const headers = document.querySelectorAll('#watchlist-table th');
    const columnMap = ['color', 'noradId', 'name'];

    headers.forEach((header, index) => {
        const columnName = columnMap[index];
        if (columnName) {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                handleColumnHeaderClick(columnName);
            });
        }
    });

    // Listen for watchlist changes to re-render
    eventBus.on('satellite:watchlist:changed', () => {
        renderWatchlistTable();
    });

    // Listen for watch color changes to re-render
    eventBus.on('satellite:watchcolor:changed', () => {
        renderWatchlistTable();
        // Also update map
        if (updateMapCallback) {
            updateMapCallback();
        }
    });

    // Initial render
    renderWatchlistTable();

    logger.success('Watchlist table initialized', logger.CATEGORY.SATELLITE);
}

export default { renderWatchlistTable, initializeWatchlistTable };
