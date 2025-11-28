/**
 * Catalog Table Module - Table rendering for satellite catalogs
 *
 * DEPENDENCIES:
 * - catalogState: Catalog data management
 * - logger: Diagnostic logging
 *
 * Features:
 * - Dynamic table rendering of catalogs
 * - Checkbox column for catalog visibility
 * - Satellite count display
 * - Row selection (single click to highlight)
 * - Delete selected catalog
 */

import catalogState from '../state/catalogState.js';
import logger from '../utils/logger.js';
import eventBus from '../events/eventBus.js';
import { showCatalogAddModal } from './modals.js';

let updateMapCallback = null;

/**
 * Render catalog table
 * Updates table body with all catalogs
 */
export function renderCatalogTable() {
    const tbody = document.querySelector('#catalog-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const catalogs = catalogState.getAllCatalogs();

    catalogs.forEach((catalog, index) => {
        const row = createCatalogRow(catalog, index);
        tbody.appendChild(row);
    });

    logger.diagnostic('Catalog table rendered', logger.CATEGORY.DATA, { count: catalogs.length });
}

/**
 * Create catalog table row
 * @param {Object} catalog - Catalog object
 * @param {number} index - Row index
 * @returns {HTMLTableRowElement} Table row element
 */
function createCatalogRow(catalog, index) {
    const tr = document.createElement('tr');
    tr.dataset.catalogId = catalog.id;
    tr.dataset.index = index;

    // Check if this row is active
    if (catalogState.getActiveRowId() === catalog.id) {
        tr.classList.add('selected');
    }

    // Row click handler - highlight row
    tr.addEventListener('click', (e) => {
        // Don't select if clicking directly on checkbox
        if (e.target.type === 'checkbox') return;

        // Remove highlight from all rows
        const allRows = document.querySelectorAll('#catalog-table tbody tr');
        allRows.forEach(row => row.classList.remove('selected'));

        // Add highlight to this row
        tr.classList.add('selected');
        catalogState.setActiveRow(catalog.id);

        logger.diagnostic('Catalog row selected', logger.CATEGORY.DATA, { name: catalog.name, id: catalog.id });
    });

    // Checkbox column (for catalog visibility)
    const tdSel = document.createElement('td');
    tdSel.style.cssText = 'text-align: center; padding: 4px;';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = catalog.visible !== false;
    checkbox.style.cssText = 'cursor: pointer;';
    checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        catalogState.setCatalogVisibility(catalog.id, checkbox.checked);
        if (updateMapCallback) updateMapCallback();
        logger.diagnostic('Catalog visibility changed', logger.CATEGORY.DATA, {
            name: catalog.name,
            visible: checkbox.checked
        });
    });
    tdSel.appendChild(checkbox);
    tr.appendChild(tdSel);

    // Name column
    const tdName = document.createElement('td');
    tdName.style.cssText = 'padding: 4px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; text-align: left;';
    tdName.textContent = catalog.name;
    tdName.title = catalog.name;
    tr.appendChild(tdName);

    // Satellite count column
    const tdCount = document.createElement('td');
    tdCount.style.cssText = 'padding: 4px 8px; text-align: center;';
    tdCount.textContent = catalog.satellites.length;
    tdCount.title = `${catalog.satellites.length} satellite(s) in this catalog`;
    tr.appendChild(tdCount);

    return tr;
}

/**
 * Initialize catalog table
 * Sets up event listeners and buttons
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onMapUpdate - Callback when map needs update
 */
export function initializeCatalogTable(options = {}) {
    updateMapCallback = options.onMapUpdate || null;

    // Listen for catalog changes to re-render
    eventBus.on('catalog:added', () => {
        renderCatalogTable();
        if (updateMapCallback) updateMapCallback();
    });
    eventBus.on('catalog:deleted', () => {
        renderCatalogTable();
        if (updateMapCallback) updateMapCallback();
    });
    eventBus.on('catalog:visibility:changed', () => {
        if (updateMapCallback) updateMapCallback();
    });

    // Initialize +Cat button
    const addCatBtn = document.getElementById('catalog-add-btn');
    if (addCatBtn) {
        addCatBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showCatalogAddModal((data) => {
                catalogState.createCatalog(data.name, data.satellites);
                logger.success(`Catalog "${data.name}" created with ${data.satellites.length} satellites`, logger.CATEGORY.DATA);
            });
        });
    }

    // Initialize Delete button
    const deleteCatBtn = document.getElementById('catalog-delete-btn');
    if (deleteCatBtn) {
        deleteCatBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Find selected row
            const selectedRow = document.querySelector('#catalog-table tbody tr.selected');
            if (!selectedRow) {
                logger.warning('No catalog selected for deletion', logger.CATEGORY.DATA);
                return;
            }
            const catalogId = parseInt(selectedRow.dataset.catalogId, 10);
            const catalog = catalogState.getCatalogById(catalogId);
            if (!catalog) return;

            // Confirm deletion
            if (confirm(`Delete catalog "${catalog.name}" with ${catalog.satellites.length} satellites?`)) {
                catalogState.deleteCatalog(catalogId);
            }
        });
    }

    // Initial render
    renderCatalogTable();

    // Fetch Celestrak if not already loaded
    if (!catalogState.isCelestrakLoaded()) {
        catalogState.fetchCelestrak().then(result => {
            if (result.success && !result.cached) {
                renderCatalogTable();
                if (updateMapCallback) updateMapCallback();
            }
        });
    }

    logger.success('Catalog table initialized', logger.CATEGORY.DATA);
}

export default { renderCatalogTable, initializeCatalogTable };
