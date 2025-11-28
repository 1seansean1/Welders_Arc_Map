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
import listState from '../state/listState.js';
import satelliteState from '../state/satelliteState.js';
import catalogState from '../state/catalogState.js';
import { CatalogVirtualScroller, ListPickerVirtualScroller } from './virtualScroller.js';

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
 * Opens modal with form for satellite data (name, TLE, and color)
 *
 * @param {Object|null} satellite - Satellite object to edit, or null for add
 * @param {Function} onSave - Callback when save is clicked, receives {name, noradId, tleLine1, tleLine2, watchColor}
 */
export function showSatelliteEditorModal(satellite = null, onSave) {
    const overlay = document.getElementById('satellite-editor-modal-overlay');
    const title = document.getElementById('satellite-editor-modal-title');
    const form = document.getElementById('satellite-editor-modal-form');
    const nameInput = document.getElementById('satellite-editor-input-name');
    const tleInput = document.getElementById('satellite-editor-input-tle');
    const colorPicker = document.getElementById('satellite-editor-color-picker');

    // Track selected color
    let selectedColor = satellite?.watchColor || 'grey';

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

    // Initialize color picker
    colorPicker.querySelectorAll('.modal-color-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.color === selectedColor) {
            btn.classList.add('active');
        }
    });

    // Show modal
    overlay.classList.add('visible');

    // Focus first input
    setTimeout(() => nameInput.focus(), 100);

    const cancelBtn = document.getElementById('satellite-editor-modal-cancel');

    const handleColorClick = (e) => {
        if (e.target.classList.contains('modal-color-btn')) {
            colorPicker.querySelectorAll('.modal-color-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            selectedColor = e.target.dataset.color;
        }
    };
    colorPicker.addEventListener('click', handleColorClick);

    const closeModal = () => {
        overlay.classList.remove('visible');
        form.removeEventListener('submit', handleSubmit);
        cancelBtn.removeEventListener('click', handleCancel);
        overlay.removeEventListener('click', handleOverlayClick);
        colorPicker.removeEventListener('click', handleColorClick);
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
            tleLine2: tleResult.tleLine2,
            watchColor: selectedColor
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
// SATELLITE ADD MODAL (with Color and List)
// ============================================

export function showSatelliteAddModal(onSave) {
    const overlay = document.getElementById('satellite-add-modal-overlay');
    const form = document.getElementById('satellite-add-modal-form');
    const nameInput = document.getElementById('satellite-add-input-name');
    const tleInput = document.getElementById('satellite-add-input-tle');
    const colorPicker = document.getElementById('satellite-add-color-picker');
    const listSelect = document.getElementById('satellite-add-input-list');

    nameInput.value = '';
    tleInput.value = '';
    let selectedColor = 'grey';
    colorPicker.querySelectorAll('.modal-color-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.color === 'grey') btn.classList.add('active');
    });

    listSelect.innerHTML = '<option value="">(None)</option>';
    listState.getAllLists().forEach(list => {
        const opt = document.createElement('option');
        opt.value = list.id;
        opt.textContent = list.name;
        listSelect.appendChild(opt);
    });

    overlay.classList.add('visible');
    setTimeout(() => nameInput.focus(), 100);

    const cancelBtn = document.getElementById('satellite-add-modal-cancel');

    const handleColorClick = (e) => {
        if (e.target.classList.contains('modal-color-btn')) {
            colorPicker.querySelectorAll('.modal-color-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            selectedColor = e.target.dataset.color;
        }
    };
    colorPicker.addEventListener('click', handleColorClick);

    const closeModal = () => {
        overlay.classList.remove('visible');
        form.removeEventListener('submit', handleSubmit);
        cancelBtn.removeEventListener('click', handleCancel);
        colorPicker.removeEventListener('click', handleColorClick);
    };

    const handleCancel = () => { closeModal(); logger.diagnostic('Satellite add cancelled', logger.CATEGORY.SATELLITE); };

    const handleSubmit = (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        const tleText = tleInput.value.trim();
        const listId = listSelect.value ? parseInt(listSelect.value) : null;
        if (!name) { alert('Name is required'); nameInput.focus(); return; }
        const tleResult = parseTLE(tleText);
        if (!tleResult.valid) { alert('TLE Error: ' + tleResult.error); tleInput.focus(); return; }
        closeModal();
        onSave({ name, noradId: tleResult.noradId, tleLine1: tleResult.tleLine1, tleLine2: tleResult.tleLine2, watchColor: selectedColor, listId });
    };

    overlay.addEventListener('click', (e) => { e.stopPropagation(); });
    form.addEventListener('submit', handleSubmit);
    cancelBtn.addEventListener('click', handleCancel);
}

// ============================================
// LIST EDITOR MODAL (with Satellite Picker)
// ============================================

export function showListEditorModal(list = null, onSave) {
    const startTime = performance.now();

    const overlay = document.getElementById('list-editor-modal-overlay');
    const title = document.getElementById('list-editor-modal-title');
    const form = document.getElementById('list-editor-modal-form');
    const nameInput = document.getElementById('list-editor-input-name');
    const picker = document.getElementById('list-editor-satellite-picker');
    const searchInput = document.getElementById('list-editor-search');
    const satCountSpan = document.getElementById('list-editor-sat-count');
    const selectedOnlyCheckbox = document.getElementById('list-editor-selected-only');

    title.textContent = list ? 'Edit List' : 'Create List';
    nameInput.value = list ? list.name : '';

    // ========================================
    // BUILD SATELLITE LIST FROM ALL CATALOGS
    // ========================================
    const allCatalogSatellites = [];
    const seenNoradIds = new Set();

    // Get all catalogs and aggregate satellites
    const catalogs = catalogState.getAllCatalogs();
    for (const catalog of catalogs) {
        for (const sat of catalog.satellites) {
            // Deduplicate by NORAD ID (keep first occurrence)
            if (!seenNoradIds.has(sat.noradId)) {
                seenNoradIds.add(sat.noradId);
                allCatalogSatellites.push({
                    ...sat,
                    catalogId: catalog.id,
                    catalogName: catalog.name
                });
            }
        }
    }

    // ========================================
    // BUILD NORAD ID TO SATELLITE STATE ID MAP
    // ========================================
    const noradToSatId = new Map();
    const satIdToNorad = new Map();
    for (const sat of satelliteState.getAllSatellites()) {
        noradToSatId.set(sat.noradId, sat.id);
        satIdToNorad.set(sat.id, sat.noradId);
    }

    // Get currently checked NORAD IDs from existing list
    const currentNoradIds = new Set();
    if (list) {
        for (const satId of list.satelliteIds) {
            const noradId = satIdToNorad.get(satId);
            if (noradId !== undefined) {
                currentNoradIds.add(noradId);
            }
        }
    }

    // ========================================
    // VIRTUAL SCROLLER SETUP
    // ========================================
    let virtualScroller = null;
    let debounceTimer = null;

    const updateCount = () => {
        if (virtualScroller && satCountSpan) {
            const count = virtualScroller.getCheckedCount();
            const stats = virtualScroller.getStats();
            if (stats.filteredRows === stats.totalRows) {
                satCountSpan.textContent = count + ' selected of ' + stats.totalRows;
            } else {
                satCountSpan.textContent = count + ' selected (' + stats.filteredRows + '/' + stats.totalRows + ' shown)';
            }
        }
    };

    if (picker) {
        virtualScroller = new ListPickerVirtualScroller(picker, {
            checkedNoradIds: Array.from(currentNoradIds),
            onCheckChange: (noradId, checked, sat) => {
                updateCount();
                // If in selected-only mode and unchecking, need to refilter
                if (!checked && virtualScroller.showSelectedOnly) {
                    virtualScroller.refilter();
                }
            }
        });

        virtualScroller.setData(allCatalogSatellites);

        // When editing existing list, show selected satellites first
        if (list && currentNoradIds.size > 0) {
            virtualScroller.setSelectedOnly(true);
            if (selectedOnlyCheckbox) selectedOnlyCheckbox.checked = true;
        }
        updateCount();
    }

    // ========================================
    // SEARCH WITH DEBOUNCING
    // ========================================
    const handleSearch = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = searchInput ? searchInput.value : '';
            if (virtualScroller) virtualScroller.filter(query);
            updateCount();
        }, 150);
    };

    if (searchInput) {
        searchInput.value = '';
        searchInput.addEventListener('input', handleSearch);
    }

    // ========================================
    // SELECTED ONLY TOGGLE
    // ========================================
    const handleSelectedOnlyChange = () => {
        if (virtualScroller) {
            virtualScroller.setSelectedOnly(selectedOnlyCheckbox.checked);
            updateCount();
        }
    };

    if (selectedOnlyCheckbox) {
        if (!list) selectedOnlyCheckbox.checked = false; // Reset for new list
        selectedOnlyCheckbox.addEventListener('change', handleSelectedOnlyChange);
    }

    overlay.classList.add('visible');
    setTimeout(() => nameInput.focus(), 100);

    const cancelBtn = document.getElementById('list-editor-modal-cancel');

    const closeModal = () => {
        overlay.classList.remove('visible');
        if (virtualScroller) virtualScroller.destroy();
        clearTimeout(debounceTimer);
        form.removeEventListener('submit', handleSubmit);
        cancelBtn.removeEventListener('click', handleCancel);
        if (searchInput) searchInput.removeEventListener('input', handleSearch);
        if (selectedOnlyCheckbox) selectedOnlyCheckbox.removeEventListener('change', handleSelectedOnlyChange);
    };

    const handleCancel = () => { closeModal(); logger.diagnostic('List edit cancelled', logger.CATEGORY.DATA); };

    const handleSubmit = (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) { alert('List name is required'); nameInput.focus(); return; }

        // Convert checked NORAD IDs to satellite state IDs
        // For satellites not yet in state, we need to add them first
        const checkedNoradIds = virtualScroller ? virtualScroller.getCheckedNoradIds() : new Set();
        const selectedIds = [];

        for (const noradId of checkedNoradIds) {
            let satId = noradToSatId.get(noradId);
            if (satId === undefined) {
                // Satellite not in state yet - find it in catalog data and add to state
                const catalogSat = allCatalogSatellites.find(s => s.noradId === noradId);
                if (catalogSat) {
                    const newSat = satelliteState.addSatellite({
                        name: catalogSat.name,
                        noradId: catalogSat.noradId,
                        tleLine1: catalogSat.tleLine1,
                        tleLine2: catalogSat.tleLine2,
                        watchColor: catalogSat.watchColor || 'grey'
                    });
                    satId = newSat.id;
                    noradToSatId.set(noradId, satId);
                }
            }
            if (satId !== undefined) {
                selectedIds.push(satId);
            }
        }

        closeModal();
        onSave({ name, satelliteIds: selectedIds });

        const openTime = performance.now() - startTime;
        logger.diagnostic('List modal saved in ' + openTime.toFixed(1) + 'ms (' + selectedIds.length + ' satellites)', logger.CATEGORY.DATA);
    };

    overlay.addEventListener('click', (e) => { e.stopPropagation(); });
    form.addEventListener('submit', handleSubmit);
    cancelBtn.addEventListener('click', handleCancel);

    const openTime = performance.now() - startTime;
    logger.diagnostic('List modal opened in ' + openTime.toFixed(1) + 'ms (' + allCatalogSatellites.length + ' satellites)', logger.CATEGORY.DATA);
}


// ============================================
// CATALOG ADD MODAL
// ============================================

/**
 * Show catalog add modal
 * Opens modal with form for creating a new catalog with TLE paste
 *
 * @param {Function} onSave - Callback when save is clicked, receives {name, satellites}
 */
export function showCatalogAddModal(onSave) {
    const overlay = document.getElementById('catalog-add-modal-overlay');
    const form = document.getElementById('catalog-add-modal-form');
    const nameInput = document.getElementById('catalog-add-input-name');
    const tleInput = document.getElementById('catalog-add-input-tle');

    // Reset form
    nameInput.value = '';
    tleInput.value = '';

    // Show modal
    overlay.classList.add('visible');

    // Focus name input
    setTimeout(() => nameInput.focus(), 100);

    const cancelBtn = document.getElementById('catalog-add-modal-cancel');

    const closeModal = () => {
        overlay.classList.remove('visible');
        form.removeEventListener('submit', handleSubmit);
        cancelBtn.removeEventListener('click', handleCancel);
        overlay.removeEventListener('click', handleOverlayClick);
    };

    const handleCancel = () => {
        closeModal();
        logger.diagnostic('Catalog add cancelled', logger.CATEGORY.DATA);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const name = nameInput.value.trim();
        const tleText = tleInput.value.trim();

        // Validate name
        if (!name) {
            alert('Catalog name is required');
            nameInput.focus();
            return;
        }

        // Parse TLE batch
        const satellites = [];
        if (tleText) {
            const lines = tleText.split('\n').map(l => l.trimEnd());
            let i = 0;
            while (i < lines.length) {
                // Skip empty lines
                if (!lines[i] || lines[i].trim() === '') {
                    i++;
                    continue;
                }

                // Need at least 3 lines
                if (i + 2 >= lines.length) {
                    alert(`Incomplete TLE data at line ${i + 1}. Each satellite needs 3 lines: name, line 1, line 2.`);
                    tleInput.focus();
                    return;
                }

                const nameLine = lines[i];
                const line1 = lines[i + 1];
                const line2 = lines[i + 2];

                // Validate TLE lines
                if (!line1.startsWith('1 ')) {
                    alert(`Line ${i + 2}: Expected TLE line 1 starting with "1 "`);
                    tleInput.focus();
                    return;
                }
                if (!line2.startsWith('2 ')) {
                    alert(`Line ${i + 3}: Expected TLE line 2 starting with "2 "`);
                    tleInput.focus();
                    return;
                }

                // Extract NORAD ID
                const noradId = parseInt(line1.substring(2, 7).trim(), 10);
                if (isNaN(noradId)) {
                    alert(`Invalid NORAD ID at line ${i + 2}`);
                    tleInput.focus();
                    return;
                }

                satellites.push({
                    name: nameLine.trim(),
                    noradId: noradId,
                    tleLine1: line1,
                    tleLine2: line2
                });

                i += 3;
            }
        }

        closeModal();
        onSave({ name, satellites });
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

    form.addEventListener('submit', handleSubmit);
    cancelBtn.addEventListener('click', handleCancel);
    overlay.addEventListener('click', handleOverlayClick);
}



// ============================================
// CATALOG EDIT MODAL (Two-Panel with Virtual Scrolling)
// ============================================

/**
 * Show catalog edit modal with virtual scrolling
 * Two-panel modal: left = virtualized satellite table, right = detail editor
 * Performance: <100ms open, 60fps scroll, <50ms search for 100K items
 *
 * @param {number} catalogId - ID of catalog to edit
 * @param {Function} onUpdate - Callback when catalog is updated
 */
export function showCatalogEditModal(catalogId, onUpdate) {
    const startTime = performance.now();

    const catalog = catalogState.getCatalogById(catalogId);
    if (!catalog) {
        logger.warning('Catalog not found: ' + catalogId, logger.CATEGORY.DATA);
        return;
    }

    const overlay = document.getElementById('catalog-edit-modal-overlay');
    const nameInput = document.getElementById('catalog-edit-name-input');
    const tableContainer = document.getElementById('catalog-edit-table-container');
    const searchInput = document.getElementById('catalog-edit-search');
    const satCountSpan = document.getElementById('catalog-edit-sat-count');
    const detailForm = document.getElementById('catalog-edit-detail-form');
    const detailName = document.getElementById('catalog-edit-sat-name');
    const detailNorad = document.getElementById('catalog-edit-sat-norad');
    const detailTle = document.getElementById('catalog-edit-sat-tle');
    const detailColorPicker = document.getElementById('catalog-edit-color-picker');
    const detailListContainer = document.getElementById('catalog-edit-lists-container');
    const detailSaveBtn = document.getElementById('catalog-edit-save-sat');
    const detailDeleteBtn = document.getElementById('catalog-edit-delete-sat');
    const closeBtn = document.getElementById('catalog-edit-close-btn');
    const saveNameBtn = document.getElementById('catalog-edit-save-name-btn');

    // State
    let selectedSatIndex = null;
    let selectedColor = 'grey';
    let virtualScroller = null;
    let debounceTimer = null;

    // Set catalog name
    nameInput.value = catalog.name;

    // ========================================
    // PRE-COMPUTE LOOKUP MAPS (O(n) once)
    // ========================================
    const noradToListCount = new Map();
    const noradToSatState = new Map();

    // Single pass through satelliteState
    const allSats = satelliteState.getAllSatellites();
    const satIdToNorad = new Map();
    for (const sat of allSats) {
        satIdToNorad.set(sat.id, sat.noradId);
        noradToSatState.set(sat.noradId, sat);
    }

    // Single pass through lists to count memberships
    const allLists = listState.getAllLists();
    for (const list of allLists) {
        for (const satId of list.satelliteIds) {
            const noradId = satIdToNorad.get(satId);
            if (noradId !== undefined) {
                noradToListCount.set(noradId, (noradToListCount.get(noradId) || 0) + 1);
            }
        }
    }

    // O(1) lookup function
    function getListCount(noradId) {
        return noradToListCount.get(noradId) || 0;
    }

    // ========================================
    // PREPARE DATA WITH ORIGINAL INDICES
    // ========================================
    const satellites = catalog.satellites.map((sat, idx) => ({
        ...sat,
        _originalIndex: idx
    }));

    // ========================================
    // VIRTUAL SCROLLER SETUP
    // ========================================
    if (tableContainer) {
        virtualScroller = new CatalogVirtualScroller(tableContainer, {
            onRowClick: (sat, originalIndex) => {
                selectedSatIndex = originalIndex;
                renderDetailPanel(sat, originalIndex);
            },
            getListCount: getListCount
        });

        virtualScroller.setData(satellites);
    }

    // Update satellite count display
    function updateSatCount() {
        if (satCountSpan && virtualScroller) {
            const stats = virtualScroller.getStats();
            if (stats.filteredRows === stats.totalRows) {
                satCountSpan.textContent = stats.totalRows + ' satellites';
            } else {
                satCountSpan.textContent = stats.filteredRows + ' / ' + stats.totalRows + ' satellites';
            }
        }
    }
    updateSatCount();

    // ========================================
    // SEARCH WITH DEBOUNCING
    // ========================================
    const handleSearch = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = searchInput ? searchInput.value : '';
            if (virtualScroller) virtualScroller.filter(query);
            updateSatCount();
            detailForm.style.display = 'none';
            selectedSatIndex = null;
        }, 150);
    };

    if (searchInput) {
        searchInput.value = '';
        searchInput.addEventListener('input', handleSearch);
    }

    // Render detail panel for selected satellite
    function renderDetailPanel(sat, index) {
        detailForm.style.display = 'block';

        detailName.value = sat.name;
        if (detailNorad) detailNorad.value = sat.noradId;
        detailTle.value = sat.tleLine1 + '\n' + sat.tleLine2;

        selectedColor = sat.watchColor || 'grey';
        detailColorPicker.querySelectorAll('.modal-color-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.color === selectedColor) {
                btn.classList.add('active');
            }
        });

        renderListMemberships(sat.noradId);
    }

    // Render list memberships with checkboxes
    function renderListMemberships(noradId) {
        detailListContainer.innerHTML = '';
        const sat = noradToSatState.get(noradId);

        if (allLists.length === 0) {
            detailListContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 11px;">No watch lists available</div>';
            return;
        }

        allLists.forEach(list => {
            const item = document.createElement('div');
            item.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 2px 0;';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = sat ? list.satelliteIds.includes(sat.id) : false;
            cb.disabled = !sat;
            cb.dataset.listId = list.id;

            const label = document.createElement('span');
            label.textContent = list.name;
            label.style.fontSize = '11px';

            item.appendChild(cb);
            item.appendChild(label);
            detailListContainer.appendChild(item);
        });
    }

    // Color picker handler
    const handleColorClick = (e) => {
        if (e.target.classList.contains('modal-color-btn')) {
            detailColorPicker.querySelectorAll('.modal-color-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            selectedColor = e.target.dataset.color;
        }
    };
    detailColorPicker.addEventListener('click', handleColorClick);

    // Save satellite detail
    const handleDetailSave = () => {
        if (selectedSatIndex === null) return;

        const newName = detailName.value.trim();
        const tleText = detailTle.value.trim();

        if (!newName) {
            alert('Satellite name is required');
            detailName.focus();
            return;
        }

        const tleResult = parseTLE(tleText);
        if (!tleResult.valid) {
            alert('TLE Error: ' + tleResult.error);
            detailTle.focus();
            return;
        }

        catalogState.updateCatalogSatellite(catalogId, selectedSatIndex, {
            name: newName,
            noradId: tleResult.noradId,
            tleLine1: tleResult.tleLine1,
            tleLine2: tleResult.tleLine2,
            watchColor: selectedColor
        });

        const currentCatalog = catalogState.getCatalogById(catalogId);
        const sat = currentCatalog.satellites[selectedSatIndex];
        const satInState = noradToSatState.get(sat.noradId);

        if (satInState) {
            detailListContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                const listId = parseInt(cb.dataset.listId);
                const isChecked = cb.checked;
                const currentlyInList = listState.getSatellitesInList(listId).includes(satInState.id);

                if (isChecked && !currentlyInList) {
                    listState.addSatelliteToList(listId, satInState.id);
                } else if (!isChecked && currentlyInList) {
                    listState.removeSatelliteFromList(listId, satInState.id);
                }
            });
        }

        const updatedCatalog = catalogState.getCatalogById(catalogId);
        const updatedSatellites = updatedCatalog.satellites.map((s, idx) => ({
            ...s,
            _originalIndex: idx
        }));
        if (virtualScroller) virtualScroller.setData(updatedSatellites);

        logger.success('Satellite updated: ' + newName, logger.CATEGORY.DATA);
    };
    detailSaveBtn.addEventListener('click', handleDetailSave);

    // Delete satellite
    const handleDetailDelete = () => {
        if (selectedSatIndex === null) return;

        const currentCatalog = catalogState.getCatalogById(catalogId);
        const sat = currentCatalog.satellites[selectedSatIndex];

        if (confirm('Delete satellite "' + sat.name + '" from this catalog?')) {
            catalogState.deleteCatalogSatellite(catalogId, selectedSatIndex);
            selectedSatIndex = null;
            detailForm.style.display = 'none';

            const updatedCatalog = catalogState.getCatalogById(catalogId);
            const updatedSatellites = updatedCatalog.satellites.map((s, idx) => ({
                ...s,
                _originalIndex: idx
            }));
            if (virtualScroller) virtualScroller.setData(updatedSatellites);
            updateSatCount();

            logger.success('Satellite deleted from catalog', logger.CATEGORY.DATA);
        }
    };
    detailDeleteBtn.addEventListener('click', handleDetailDelete);

    // Save catalog name
    const handleSaveName = () => {
        const newName = nameInput.value.trim();
        if (!newName) {
            alert('Catalog name is required');
            nameInput.focus();
            return;
        }
        catalogState.renameCatalog(catalogId, newName);
        logger.success('Catalog renamed to: ' + newName, logger.CATEGORY.DATA);
    };
    if (saveNameBtn) saveNameBtn.addEventListener('click', handleSaveName);

    // Close modal
    const closeModal = () => {
        overlay.classList.remove('visible');

        if (virtualScroller) virtualScroller.destroy();
        clearTimeout(debounceTimer);

        detailColorPicker.removeEventListener('click', handleColorClick);
        detailSaveBtn.removeEventListener('click', handleDetailSave);
        detailDeleteBtn.removeEventListener('click', handleDetailDelete);
        if (saveNameBtn) saveNameBtn.removeEventListener('click', handleSaveName);
        closeBtn.removeEventListener('click', closeModal);
        overlay.removeEventListener('click', handleOverlayClick);
        if (searchInput) searchInput.removeEventListener('input', handleSearch);

        if (onUpdate) onUpdate();
    };

    const handleOverlayClick = (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    };

    // Show modal
    overlay.classList.add('visible');
    detailForm.style.display = 'none';

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', handleOverlayClick);
    overlay.addEventListener('click', (e) => e.stopPropagation());

    // Log performance
    const openTime = performance.now() - startTime;
    logger.diagnostic('Catalog modal opened in ' + openTime.toFixed(1) + 'ms (' + satellites.length + ' satellites)', logger.CATEGORY.DATA);
}

// ============================================
// LOGIN MODAL
// ============================================

/**
 * Show login modal
 * Dismissible modal for user authentication
 *
 * @param {Function} onLogin - Callback when login is attempted, receives {username, password}
 * @param {Function} onSkip - Callback when skip/cancel is clicked
 */
export function showLoginModal(onLogin, onSkip) {
    const overlay = document.getElementById('login-modal-overlay');
    const form = document.getElementById('login-modal-form');
    const usernameInput = document.getElementById('login-input-username');
    const passwordInput = document.getElementById('login-input-password');
    const errorField = document.getElementById('login-error-field');
    const errorMessage = document.getElementById('login-error-message');

    // Reset form
    usernameInput.value = '';
    passwordInput.value = '';
    errorField.style.display = 'none';
    errorMessage.textContent = '';

    // Show modal
    overlay.classList.add('visible');

    // Focus username input
    setTimeout(() => usernameInput.focus(), 100);

    const cancelBtn = document.getElementById('login-modal-cancel');

    const closeModal = () => {
        overlay.classList.remove('visible');
        form.removeEventListener('submit', handleSubmit);
        cancelBtn.removeEventListener('click', handleCancel);
        overlay.removeEventListener('click', handleOverlayClick);
    };

    const handleCancel = () => {
        closeModal();
        logger.diagnostic('Login skipped', logger.CATEGORY.PANEL);
        if (onSkip) onSkip();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username) {
            errorField.style.display = 'block';
            errorMessage.textContent = 'Username is required';
            usernameInput.focus();
            return;
        }

        // Call login callback
        try {
            const success = await onLogin({ username, password });
            if (success) {
                closeModal();
            } else {
                errorField.style.display = 'block';
                errorMessage.textContent = 'Invalid username or password';
                passwordInput.focus();
                passwordInput.select();
            }
        } catch (error) {
            errorField.style.display = 'block';
            errorMessage.textContent = error.message || 'Login failed';
        }
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

    form.addEventListener('submit', handleSubmit);
    cancelBtn.addEventListener('click', handleCancel);
    overlay.addEventListener('click', handleOverlayClick);
}

/**
 * Show error in login modal
 * @param {string} message - Error message to display
 */
export function showLoginError(message) {
    const errorField = document.getElementById('login-error-field');
    const errorMessage = document.getElementById('login-error-message');
    if (errorField && errorMessage) {
        errorField.style.display = 'block';
        errorMessage.textContent = message;
    }
}

/**
 * Hide login modal programmatically
 */
export function hideLoginModal() {
    const overlay = document.getElementById('login-modal-overlay');
    if (overlay) {
        overlay.classList.remove('visible');
    }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Export parseTLE for potential use by other modules
 */
export { parseTLE };
