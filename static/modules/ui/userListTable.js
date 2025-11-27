/**
 * User List Table Module - Table rendering for user-created satellite lists
 *
 * DEPENDENCIES:
 * - listState: List data and visibility state
 * - satelliteState: Satellite data for adding to lists
 * - logger: Diagnostic logging
 * - eventBus: Event communication
 *
 * Features:
 * - Dynamic table rendering of user lists
 * - Checkbox to toggle list visibility (show/hide on map)
 * - Inline name editing
 * - Delete button per row
 * - "New List" button with inline input
 * - Expandable rows to show list contents
 */

import listState from '../state/listState.js';
import satelliteState from '../state/satelliteState.js';
import logger from '../utils/logger.js';
import eventBus from '../events/eventBus.js';

// ============================================
// DEPENDENCIES (injected during initialization)
// ============================================

let updateMapCallback = null;

// Track expanded list for showing contents
let expandedListId = null;

// ============================================
// TABLE RENDERING
// ============================================

/**
 * Render user list table
 * Updates table body with current lists
 */
export function renderUserListTable() {
    const tbody = document.querySelector('#userlist-table tbody');
    if (!tbody) return;

    // Clear existing rows
    tbody.innerHTML = '';

    // Get all lists
    const lists = listState.getAllLists();

    if (lists.length === 0) {
        // Show empty state
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 4;
        emptyCell.style.cssText = 'text-align: center; color: var(--text-muted); padding: 12px; font-size: 10px;';
        emptyCell.textContent = 'No lists yet. Click "+ New" to create one.';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
        return;
    }

    // Render each list
    lists.forEach((list, index) => {
        const row = createListRow(list, index);
        tbody.appendChild(row);

        // If this list is expanded, show its satellites
        if (expandedListId === list.id) {
            const expandedRow = createExpandedRow(list);
            tbody.appendChild(expandedRow);
        }
    });

    logger.diagnostic('User list table rendered', logger.CATEGORY.DATA, { count: lists.length });
}

/**
 * Create list table row
 * @param {Object} list - List object
 * @param {number} index - Row index
 * @returns {HTMLTableRowElement} Table row element
 */
function createListRow(list, index) {
    const tr = document.createElement('tr');
    tr.dataset.listId = list.id;
    tr.dataset.index = index;

    // Row click to expand/collapse
    tr.addEventListener('click', (e) => {
        // Don't toggle if clicking on checkbox, input, or button
        if (e.target.type === 'checkbox' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

        // Toggle expanded state
        if (expandedListId === list.id) {
            expandedListId = null;
        } else {
            expandedListId = list.id;
        }
        renderUserListTable();
    });

    // Checkbox column (visibility toggle)
    const tdCheck = document.createElement('td');
    tdCheck.style.cssText = 'text-align: center; padding: 4px; width: 24px;';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = list.visible;
    checkbox.style.cursor = 'pointer';
    checkbox.title = list.visible ? 'Hide satellites from this list' : 'Show satellites from this list';
    checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        listState.toggleListVisibility(list.id);
        renderUserListTable();

        // Update map visualization
        if (updateMapCallback) {
            updateMapCallback();
        }
    });
    tdCheck.appendChild(checkbox);
    tr.appendChild(tdCheck);

    // Name column (editable)
    const tdName = document.createElement('td');
    tdName.style.cssText = 'padding: 4px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = list.name;
    nameSpan.title = `${list.name} (click row to expand)`;
    nameSpan.style.cursor = 'pointer';

    // Double-click to edit name
    nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        startNameEdit(tr, list);
    });

    tdName.appendChild(nameSpan);
    tr.appendChild(tdName);

    // Count column
    const tdCount = document.createElement('td');
    tdCount.style.cssText = 'padding: 4px 8px; text-align: center; width: 40px; color: var(--text-muted); font-size: 10px;';
    tdCount.textContent = list.satelliteIds.length;
    tdCount.title = `${list.satelliteIds.length} satellite(s)`;
    tr.appendChild(tdCount);

    // Delete column
    const tdDelete = document.createElement('td');
    tdDelete.style.cssText = 'text-align: center; padding: 4px; width: 30px;';

    const deleteBtn = document.createElement('button');
    deleteBtn.style.cssText = 'background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 2px 4px; font-size: 12px;';
    deleteBtn.textContent = 'X';
    deleteBtn.title = 'Delete list';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete list "${list.name}"?`)) {
            listState.deleteList(list.id);
            if (expandedListId === list.id) {
                expandedListId = null;
            }
            renderUserListTable();

            if (updateMapCallback) {
                updateMapCallback();
            }
        }
    });
    deleteBtn.addEventListener('mouseover', () => {
        deleteBtn.style.color = '#ff4444';
    });
    deleteBtn.addEventListener('mouseout', () => {
        deleteBtn.style.color = 'var(--text-muted)';
    });
    tdDelete.appendChild(deleteBtn);
    tr.appendChild(tdDelete);

    // Add expand indicator to name
    const expandIcon = expandedListId === list.id ? ' ▼' : ' ▶';
    nameSpan.textContent = list.name + expandIcon;

    return tr;
}

/**
 * Create expanded row showing list satellites
 * @param {Object} list - List object
 * @returns {HTMLTableRowElement} Expanded row element
 */
function createExpandedRow(list) {
    const tr = document.createElement('tr');
    tr.className = 'expanded-row';
    tr.style.cssText = 'background: var(--bg-secondary);';

    const td = document.createElement('td');
    td.colSpan = 4;
    td.style.cssText = 'padding: 8px; font-size: 10px;';

    if (list.satelliteIds.length === 0) {
        td.innerHTML = '<span style="color: var(--text-muted);">No satellites in this list. Use "Add to List" in the Satellites panel.</span>';
    } else {
        // Show satellite names
        const satellites = list.satelliteIds.map(id => {
            const sat = satelliteState.getSatelliteById(id);
            return sat ? sat.name : `ID: ${id}`;
        });

        const content = document.createElement('div');
        content.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px;';

        satellites.forEach((name, idx) => {
            const tag = document.createElement('span');
            tag.style.cssText = 'background: var(--bg-tertiary); padding: 2px 6px; border-radius: 3px; font-size: 9px;';
            tag.textContent = name;

            // Add remove button
            const removeBtn = document.createElement('button');
            removeBtn.style.cssText = 'background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 0 0 0 4px; font-size: 9px;';
            removeBtn.textContent = '×';
            removeBtn.title = `Remove ${name} from list`;
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                listState.removeSatelliteFromList(list.id, list.satelliteIds[idx]);
                renderUserListTable();
                if (updateMapCallback) {
                    updateMapCallback();
                }
            });
            tag.appendChild(removeBtn);

            content.appendChild(tag);
        });

        td.appendChild(content);
    }

    tr.appendChild(td);
    return tr;
}

/**
 * Start inline name editing
 * @param {HTMLTableRowElement} tr - Row element
 * @param {Object} list - List object
 */
function startNameEdit(tr, list) {
    const nameCell = tr.querySelector('td:nth-child(2)');
    if (!nameCell) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = list.name;
    input.style.cssText = 'width: 100%; padding: 2px 4px; font-size: 11px; background: var(--bg-primary); border: 1px solid var(--accent-blue-grey); color: var(--text-primary);';

    // Save on blur or Enter
    const save = () => {
        const newName = input.value.trim();
        if (newName && newName !== list.name) {
            listState.renameList(list.id, newName);
        }
        renderUserListTable();
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            save();
        } else if (e.key === 'Escape') {
            renderUserListTable();
        }
    });

    nameCell.innerHTML = '';
    nameCell.appendChild(input);
    input.focus();
    input.select();
}

// ============================================
// NEW LIST INPUT
// ============================================

/**
 * Show new list input
 */
export function showNewListInput() {
    logger.info('showNewListInput called', logger.CATEGORY.DATA);
    const container = document.getElementById('userlist-new-container');
    if (!container) {
        logger.warning('userlist-new-container not found', logger.CATEGORY.DATA);
        return;
    }
    logger.diagnostic('userlist-new-container found, creating input', logger.CATEGORY.DATA);

    container.innerHTML = '';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'List name...';
    input.style.cssText = 'width: calc(100% - 50px); padding: 4px 8px; font-size: 11px; background: var(--bg-primary); border: 1px solid var(--accent-blue-grey); color: var(--text-primary); border-radius: 3px;';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'OK';
    saveBtn.style.cssText = 'padding: 4px 8px; font-size: 11px; margin-left: 4px; background: var(--accent-blue-grey); color: var(--bg-primary); border: none; border-radius: 3px; cursor: pointer;';

    const save = () => {
        const name = input.value.trim();
        if (name) {
            listState.createList(name);
            renderUserListTable();
        }
        hideNewListInput();
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            save();
        } else if (e.key === 'Escape') {
            hideNewListInput();
        }
    });

    saveBtn.addEventListener('click', save);

    container.appendChild(input);
    container.appendChild(saveBtn);
    container.style.display = 'flex';
    container.style.marginTop = '8px';

    input.focus();
}

/**
 * Hide new list input
 */
export function hideNewListInput() {
    const container = document.getElementById('userlist-new-container');
    if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
    }
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize user list table
 * Sets up event listeners and initial render
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onMapUpdate - Callback when map needs update
 */
export function initializeUserListTable(options = {}) {
    // Store callbacks
    updateMapCallback = options.onMapUpdate || null;

    // Set up "New List" button
    const newBtn = document.getElementById('userlist-new-btn');
    if (newBtn) {
        logger.diagnostic('Found userlist-new-btn, attaching click handler', logger.CATEGORY.DATA);
        newBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            logger.info('New List button clicked', logger.CATEGORY.DATA);
            showNewListInput();
        });
    } else {
        logger.warning('userlist-new-btn not found in DOM', logger.CATEGORY.DATA);
    }

    // Listen for list changes to re-render
    eventBus.on('list:changed', () => {
        renderUserListTable();
    });

    // Initial render
    renderUserListTable();

    logger.success('User list table initialized', logger.CATEGORY.DATA);
}

export default { renderUserListTable, initializeUserListTable, showNewListInput };
