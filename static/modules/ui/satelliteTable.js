/**
 * Satellite Table Module - Table rendering and row interactions
 *
 * DEPENDENCIES:
 * - satelliteState: Satellite data and selection state
 * - listState: User list management
 * - logger: Diagnostic logging
 *
 * Features:
 * - Dynamic table rendering
 * - Column sorting (noradId, name) - 3-click cycle: asc → desc → default
 * - Select all/none via checkbox header
 * - Checkbox selection for map visibility
 * - Row selection (single click to highlight)
 * - Double-click to edit
 * - Watchlist toggle (star icon)
 * - Add to List dropdown
 */

import satelliteState from '../state/satelliteState.js';
import listState from '../state/listState.js';
import logger from '../utils/logger.js';

// ============================================
// DEPENDENCIES (injected during initialization)
// ============================================

let editSatelliteCallback = null;
let updateMapCallback = null;

// ============================================
// TABLE RENDERING
// ============================================

/**
 * Render satellite table
 * Updates table body with current satellite data
 */
export function renderSatelliteTable() {
    const tbody = document.querySelector('#satellite-table tbody');
    if (!tbody) return;

    // Clear existing rows
    tbody.innerHTML = '';

    // Get sorted satellites
    const satellites = getSortedSatellites();

    // Render each satellite
    satellites.forEach((sat, index) => {
        const row = createSatelliteRow(sat, index);
        tbody.appendChild(row);
    });

    // Update column header indicators
    updateColumnHeaderIndicators();

    logger.diagnostic('Satellite table rendered', logger.CATEGORY.SATELLITE, { count: satellites.length });
}

/**
 * Create satellite table row
 * Returns a <tr> element for a satellite
 *
 * @param {Object} sat - Satellite object
 * @param {number} index - Row index
 * @returns {HTMLTableRowElement} Table row element
 */
function createSatelliteRow(sat, index) {
    const tr = document.createElement('tr');
    tr.dataset.satelliteId = sat.id;
    tr.dataset.index = index;

    // Apply blue highlight if this is the active row
    const editingState = satelliteState.getEditingState();
    if (editingState.activeRowId === sat.id) {
        tr.classList.add('selected');
    }

    // Row click handler - sets this as the active (blue highlighted) row
    tr.addEventListener('click', (e) => {
        // Don't toggle if clicking directly on checkbox or button
        if (e.target.type === 'checkbox' || e.target.tagName === 'BUTTON' || e.target.tagName === 'svg' || e.target.tagName === 'polygon') return;

        // Set this row as the active row
        satelliteState.setActiveRow(sat.id);

        // Remove blue highlight from all rows
        const allRows = document.querySelectorAll('#satellite-table tbody tr');
        allRows.forEach(row => row.classList.remove('selected'));

        // Add blue highlight to this row
        tr.classList.add('selected');

        logger.diagnostic('Satellite activated', logger.CATEGORY.SATELLITE, { name: sat.name, id: sat.id });
    });

    // Row double-click handler - opens edit modal
    tr.addEventListener('dblclick', (e) => {
        // Don't open if clicking directly on checkbox or button
        if (e.target.type === 'checkbox' || e.target.tagName === 'BUTTON' || e.target.tagName === 'svg' || e.target.tagName === 'polygon') return;

        // Set this row as active
        satelliteState.setActiveRow(sat.id);

        // Open edit modal for this satellite
        if (editSatelliteCallback) {
            editSatelliteCallback(sat.id);
        }
    });

    // Checkbox column
    const tdSel = document.createElement('td');
    tdSel.style.cssText = 'text-align: center; padding: 4px;';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = sat.selected;
    checkbox.style.cursor = 'pointer';
    checkbox.addEventListener('change', (e) => {
        e.stopPropagation(); // Prevent row click
        satelliteState.toggleSatelliteSelection(sat.id);
        logger.diagnostic('Satellite checkbox toggled', logger.CATEGORY.SATELLITE, {
            name: sat.name,
            selected: !sat.selected
        });

        // Update map visualization
        if (updateMapCallback) {
            updateMapCallback();
        }
    });
    tdSel.appendChild(checkbox);
    tr.appendChild(tdSel);

    // NORAD ID column
    const tdNorad = document.createElement('td');
    tdNorad.style.cssText = 'padding: 4px 8px;';
    tdNorad.textContent = sat.noradId;
    tr.appendChild(tdNorad);

    // Name column
    const tdName = document.createElement('td');
    tdName.style.cssText = 'padding: 4px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;';
    tdName.textContent = sat.name;
    tdName.title = sat.name; // Show full name on hover
    tr.appendChild(tdName);

    // Watchlist (star) column
    const tdStar = document.createElement('td');
    tdStar.style.cssText = 'text-align: center; padding: 4px;';

    const starBtn = document.createElement('button');
    starBtn.style.cssText = 'background: none; border: none; cursor: pointer; padding: 0; line-height: 1; display: flex; align-items: center; justify-content: center;';
    starBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="${sat.watchlisted ? '#9dd4ff' : 'none'}" stroke="${sat.watchlisted ? '#9dd4ff' : '#666'}" stroke-width="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>`;
    starBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent row click
        satelliteState.toggleSatelliteWatchlist(sat.id);
        renderSatelliteTable(); // Re-render to update star state
        logger.diagnostic('Satellite watchlist toggled', logger.CATEGORY.SATELLITE, {
            name: sat.name,
            watchlisted: !sat.watchlisted
        });
    });
    tdStar.appendChild(starBtn);
    tr.appendChild(tdStar);

    // Add to List column
    const tdList = document.createElement('td');
    tdList.style.cssText = 'text-align: center; padding: 4px;';

    const lists = listState.getAllLists();
    const inLists = listState.getListsContainingSatellite(sat.id);

    if (lists.length === 0) {
        // No lists exist yet - show disabled button
        const noListBtn = document.createElement('button');
        noListBtn.style.cssText = 'background: none; border: none; cursor: help; color: var(--text-muted); font-size: 10px; padding: 2px 4px;';
        noListBtn.textContent = '+';
        noListBtn.title = 'Create a list first in the Lists panel';
        tdList.appendChild(noListBtn);
    } else {
        // Show dropdown to add to list
        const listSelect = document.createElement('select');
        listSelect.style.cssText = 'padding: 1px 2px; font-size: 9px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--text-muted); border-radius: 2px; cursor: pointer; max-width: 50px;';

        // Placeholder option
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = inLists.length > 0 ? `(${inLists.length})` : '+';
        placeholder.disabled = true;
        placeholder.selected = true;
        listSelect.appendChild(placeholder);

        // Add option for each list
        lists.forEach(list => {
            const opt = document.createElement('option');
            opt.value = list.id;
            const isInList = inLists.some(l => l.id === list.id);
            opt.textContent = isInList ? `✓ ${list.name}` : list.name;
            opt.style.cssText = isInList ? 'background: var(--bg-tertiary);' : '';
            listSelect.appendChild(opt);
        });

        listSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            const listId = parseInt(e.target.value);
            if (listId) {
                const isInList = listState.getListsContainingSatellite(sat.id).some(l => l.id === listId);
                if (isInList) {
                    listState.removeSatelliteFromList(listId, sat.id);
                    logger.info(`Removed ${sat.name} from list`, logger.CATEGORY.DATA);
                } else {
                    listState.addSatelliteToList(listId, sat.id);
                    logger.info(`Added ${sat.name} to list`, logger.CATEGORY.DATA);
                }
                renderSatelliteTable(); // Re-render to update list indicator

                // Update map visualization
                if (updateMapCallback) {
                    updateMapCallback();
                }
            }
            listSelect.selectedIndex = 0; // Reset to placeholder
        });

        listSelect.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent row click
        });

        tdList.appendChild(listSelect);
    }
    tr.appendChild(tdList);

    return tr;
}

// ============================================
// SORTING
// ============================================

/**
 * Get sorted satellites based on current sort state
 * @returns {Array} Sorted satellite array
 */
function getSortedSatellites() {
    const sortState = satelliteState.getSortState();

    // If no sort is active, return original order
    if (!sortState.column || !sortState.direction) {
        return satelliteState.getAllSatellites();
    }

    // Create a copy for sorting
    const sorted = satelliteState.getAllSatellites();
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
 * @param {string} columnName - Column name ('sel', 'noradId', 'name', 'star')
 */
function handleColumnHeaderClick(columnName) {
    // Special handling for checkbox column
    if (columnName === 'sel') {
        toggleSelectAll();
        return;
    }

    // Star and List columns are not sortable
    if (columnName === 'star' || columnName === 'list') {
        return;
    }

    const sortState = satelliteState.getSortState();

    // Cycle through sort states
    if (sortState.column === columnName) {
        if (sortState.direction === 'asc') {
            satelliteState.setSortState(columnName, 'desc');
        } else if (sortState.direction === 'desc') {
            satelliteState.setSortState(null, null);
        }
    } else {
        satelliteState.setSortState(columnName, 'asc');
    }

    renderSatelliteTable();
    logger.diagnostic('Satellite table sorted', logger.CATEGORY.SATELLITE, {
        column: columnName,
        direction: satelliteState.getSortState().direction || 'default'
    });
}

/**
 * Update column header text with sort indicators
 */
function updateColumnHeaderIndicators() {
    const headers = document.querySelectorAll('#satellite-table th');
    const columnMap = ['sel', 'noradId', 'name', 'star', 'list'];
    const labelMap = {
        'sel': 'Sel',
        'noradId': 'NORAD',
        'name': 'Name',
        'star': '★',
        'list': 'List'
    };

    headers.forEach((header, index) => {
        const columnName = columnMap[index];
        if (!columnName) return;

        let text = labelMap[columnName];
        const sortState = satelliteState.getSortState();

        if (sortState.column === columnName) {
            text += sortState.direction === 'asc' ? ' ▲' : ' ▼';
        }

        header.textContent = text;
    });
}

// ============================================
// SELECTION
// ============================================

/**
 * Toggle select all/none for satellite checkboxes
 */
function toggleSelectAll() {
    const satellites = satelliteState.getAllSatellites();
    const allSelected = satellites.every(s => s.selected);

    if (allSelected) {
        satelliteState.deselectAll();
        logger.diagnostic('All satellites deselected', logger.CATEGORY.SATELLITE);
    } else {
        satelliteState.selectAll();
        logger.diagnostic('All satellites selected', logger.CATEGORY.SATELLITE, { count: satellites.length });
    }

    renderSatelliteTable();
    if (updateMapCallback) {
        updateMapCallback();
    }
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize satellite table
 * Sets up dependencies, header click handlers, and initial render
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onEdit - Callback when editing satellite (receives satelliteId)
 * @param {Function} options.onMapUpdate - Callback when map needs update
 */
export function initializeSatelliteTable(options = {}) {
    // Store callbacks
    editSatelliteCallback = options.onEdit || null;
    updateMapCallback = options.onMapUpdate || null;

    // Initialize column header click handlers
    const headers = document.querySelectorAll('#satellite-table th');
    const columnMap = ['sel', 'noradId', 'name', 'star'];

    headers.forEach((header, index) => {
        const columnName = columnMap[index];
        if (columnName) {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                handleColumnHeaderClick(columnName);
            });
        }
    });

    // Initial render
    renderSatelliteTable();

    logger.success('Satellite table initialized', logger.CATEGORY.SATELLITE);
}

export default { renderSatelliteTable, initializeSatelliteTable };
