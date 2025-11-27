/**
 * Satellite Table Module - Table rendering and row interactions
 *
 * DEPENDENCIES:
 * - satelliteState: Satellite data and selection state
 * - logger: Diagnostic logging
 *
 * Features:
 * - Dynamic table rendering (NORAD, Name columns only)
 * - Column sorting (noradId, name) - 3-click cycle: asc -> desc -> default
 * - Row selection (single click to highlight)
 * - Double-click to edit
 */

import satelliteState from '../state/satelliteState.js';
import eventBus from '../events/eventBus.js';
import logger from '../utils/logger.js';

let editSatelliteCallback = null;
let updateMapCallback = null;

export function renderSatelliteTable() {
    const tbody = document.querySelector('#satellite-table tbody');
    if (\!tbody) return;
    tbody.innerHTML = '';
    const satellites = getSortedSatellites();
    satellites.forEach((sat, index) => {
        const row = createSatelliteRow(sat, index);
        tbody.appendChild(row);
    });
    updateColumnHeaderIndicators();
    logger.diagnostic('Satellite table rendered', logger.CATEGORY.SATELLITE, { count: satellites.length });
}

function createSatelliteRow(sat, index) {
    const tr = document.createElement('tr');
    tr.dataset.satelliteId = sat.id;
    tr.dataset.index = index;

    const editingState = satelliteState.getEditingState();
    if (editingState.activeRowId === sat.id) {
        tr.classList.add('selected');
    }

    tr.addEventListener('click', (e) => {
        satelliteState.setActiveRow(sat.id);
        const allRows = document.querySelectorAll('#satellite-table tbody tr');
        allRows.forEach(row => row.classList.remove('selected'));
        tr.classList.add('selected');
        logger.diagnostic('Satellite activated', logger.CATEGORY.SATELLITE, { name: sat.name, id: sat.id });
    });

    tr.addEventListener('dblclick', (e) => {
        satelliteState.setActiveRow(sat.id);
        if (editSatelliteCallback) {
            editSatelliteCallback(sat.id);
        }
    });

    const tdNorad = document.createElement('td');
    tdNorad.style.cssText = 'padding: 4px 8px;';
    tdNorad.textContent = sat.noradId;
    tr.appendChild(tdNorad);

    const tdName = document.createElement('td');
    tdName.style.cssText = 'padding: 4px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;';
    tdName.textContent = sat.name;
    tdName.title = sat.name;
    tr.appendChild(tdName);

    return tr;
}

function getSortedSatellites() {
    const sortState = satelliteState.getSortState();
    if (\!sortState.column || \!sortState.direction) {
        return satelliteState.getAllSatellites();
    }
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

function handleColumnHeaderClick(columnName) {
    const sortState = satelliteState.getSortState();
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

function updateColumnHeaderIndicators() {
    const headers = document.querySelectorAll('#satellite-table th');
    const columnMap = ['noradId', 'name'];
    const labelMap = { 'noradId': 'NORAD', 'name': 'Name' };
    headers.forEach((header, index) => {
        const columnName = columnMap[index];
        if (\!columnName) return;
        let text = labelMap[columnName];
        const sortState = satelliteState.getSortState();
        if (sortState.column === columnName) {
            text += sortState.direction === 'asc' ? ' ▲' : ' ▼';
        }
        header.textContent = text;
    });
}

export function initializeSatelliteTable(options = {}) {
    editSatelliteCallback = options.onEdit || null;
    updateMapCallback = options.onMapUpdate || null;
    const headers = document.querySelectorAll('#satellite-table th');
    const columnMap = ['noradId', 'name'];
    headers.forEach((header, index) => {
        const columnName = columnMap[index];
        if (columnName) {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                handleColumnHeaderClick(columnName);
            });
        }
    });
    renderSatelliteTable();
    eventBus.on('satellite:added', () => { renderSatelliteTable(); });
    eventBus.on('satellite:updated', () => { renderSatelliteTable(); });
    eventBus.on('satellite:deleted', () => { renderSatelliteTable(); });
    logger.success('Satellite table initialized', logger.CATEGORY.SATELLITE);
}

export default { renderSatelliteTable, initializeSatelliteTable };
