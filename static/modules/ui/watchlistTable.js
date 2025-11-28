/**
 * Watch List Table Module - Table rendering for user-created lists
 *
 * DEPENDENCIES:
 * - listState: User list management
 * - logger: Diagnostic logging
 *
 * Features:
 * - Dynamic table rendering of user lists
 * - Checkbox column for list visibility
 * - Double-click to edit/delete list
 * - Sorted by list name
 */

import listState from '../state/listState.js';
import logger from '../utils/logger.js';
import eventBus from '../events/eventBus.js';
import { showListEditorModal, showWatchlistConfirmModal } from './modals.js';

// ============================================
// DEPENDENCIES (injected during initialization)
// ============================================

let updateMapCallback = null;

// ============================================
// TABLE RENDERING
// ============================================

/**
 * Render watchlist table
 * Updates table body with user-created lists
 */
export function renderWatchlistTable() {
    const tbody = document.querySelector('#watchlist-table tbody');
    if (!tbody) return;

    // Clear existing rows
    tbody.innerHTML = '';

    // Get all lists
    const lists = listState.getAllLists();

    // Render each list
    lists.forEach((list, index) => {
        const row = createListRow(list, index);
        tbody.appendChild(row);
    });

    logger.diagnostic('Watch list table rendered', logger.CATEGORY.DATA, { count: lists.length });
}

/**
 * Create list table row
 * Returns a <tr> element for a user list
 *
 * @param {Object} list - List object
 * @param {number} index - Row index
 * @returns {HTMLTableRowElement} Table row element
 */
function createListRow(list, index) {
    const tr = document.createElement('tr');
    tr.dataset.listId = list.id;
    tr.dataset.index = index;

    // Row click handler - highlight row
    tr.addEventListener('click', (e) => {
        // Don't select if clicking directly on checkbox
        if (e.target.type === 'checkbox') return;

        // Remove highlight from all rows
        const allRows = document.querySelectorAll('#watchlist-table tbody tr');
        allRows.forEach(row => row.classList.remove('selected'));

        // Add highlight to this row
        tr.classList.add('selected');

        logger.diagnostic('List row selected', logger.CATEGORY.DATA, { name: list.name, id: list.id });
    });

    // Double-click to edit list
    tr.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        showListEditorModal(list, (data) => {
            if (data.delete) {
                // Delete the list
                listState.deleteList(list.id);
                renderWatchlistTable();
                if (updateMapCallback) updateMapCallback();
                logger.success(`List "${list.name}" deleted`, logger.CATEGORY.DATA);
            } else {
                // Update list name
                listState.renameList(list.id, data.name);
                // Update satellite assignments
                // First clear all satellites from list
                const currentSats = listState.getSatellitesInList(list.id);
                currentSats.forEach(satId => listState.removeSatelliteFromList(list.id, satId));
                // Then add the new ones
                data.satelliteIds.forEach(satId => listState.addSatelliteToList(list.id, satId));
                renderWatchlistTable();
                if (updateMapCallback) updateMapCallback();
                logger.success(`List "${data.name}" updated`, logger.CATEGORY.DATA);
            }
        });
    });

    // Checkbox column (for list visibility/selection)
    const tdSel = document.createElement('td');
    tdSel.style.cssText = 'text-align: center; padding: 4px;';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = list.visible !== false; // Default to visible
    checkbox.style.cssText = 'cursor: pointer;';
    checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        listState.setListVisibility(list.id, checkbox.checked);
        if (updateMapCallback) updateMapCallback();
        logger.diagnostic('List visibility changed', logger.CATEGORY.DATA, {
            name: list.name,
            visible: checkbox.checked
        });
    });
    tdSel.appendChild(checkbox);
    tr.appendChild(tdSel);

    // Name column
    const tdName = document.createElement('td');
    tdName.style.cssText = 'padding: 4px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; text-align: left;';
    tdName.textContent = list.name;
    tdName.title = list.name; // Show full name on hover
    tr.appendChild(tdName);

    // Satellite count column
    const tdCount = document.createElement('td');
    tdCount.style.cssText = 'padding: 4px 8px; text-align: center;';
    const satCount = listState.getSatellitesInList(list.id).length;
    tdCount.textContent = satCount;
    tdCount.title = `${satCount} satellite(s) in this list`;
    tr.appendChild(tdCount);

    return tr;
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize watchlist table
 * Sets up event listeners for list changes
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onMapUpdate - Callback when map needs update
 */
export function initializeWatchlistTable(options = {}) {
    // Store callbacks
    updateMapCallback = options.onMapUpdate || null;

    // Listen for list changes to re-render
    eventBus.on('list:changed', () => {
        renderWatchlistTable();
    });

    // Initialize +List button in watchlist section
    const addListBtn = document.getElementById('watchlist-add-list-btn');
    if (addListBtn) {
        addListBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showListEditorModal(null, (data) => {
                const list = listState.createList(data.name);
                data.satelliteIds.forEach(satId => {
                    listState.addSatelliteToList(list.id, satId);
                });
                renderWatchlistTable();
                if (updateMapCallback) updateMapCallback();
                logger.success('List "' + data.name + '" created with ' + data.satelliteIds.length + ' satellites', logger.CATEGORY.DATA);
            });
        });
    }

    // Initialize Delete button in watchlist section
    const deleteListBtn = document.getElementById('watchlist-delete-btn');
    if (deleteListBtn) {
        deleteListBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Find selected row
            const selectedRow = document.querySelector('#watchlist-table tbody tr.selected');
            if (!selectedRow) {
                logger.warning('No list selected for deletion', logger.CATEGORY.DATA);
                return;
            }
            const listId = parseInt(selectedRow.dataset.listId, 10);
            const list = listState.getListById(listId);
            if (!list) return;

            // Show custom confirmation modal
            showWatchlistConfirmModal(list.name, () => {
                listState.deleteList(listId);
                renderWatchlistTable();
                if (updateMapCallback) updateMapCallback();
                logger.success(`List "${list.name}" deleted`, logger.CATEGORY.DATA);
            });
        });
    }

    // Initial render
    renderWatchlistTable();

    logger.success('Watch list table initialized', logger.CATEGORY.DATA);
}

export default { renderWatchlistTable, initializeWatchlistTable };
