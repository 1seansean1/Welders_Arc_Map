/**
 * Satellite CRUD Module - Satellite create, read, update, delete operations
 *
 * DEPENDENCIES:
 * - logger: Diagnostic logging
 * - satelliteState: Satellite data management
 * - modals: Editor and confirm modals
 * - satelliteTable: Table rendering
 * - deckgl: Map visualization updates
 *
 * Features:
 * - Add new satellites with TLE data
 * - Edit existing satellites
 * - Delete selected satellites with confirmation
 * - Toggle satellite selection (for ground track display)
 * - Toggle watchlist status
 * - Button handler initialization
 */

import logger from '../utils/logger.js';
import satelliteState from '../state/satelliteState.js';
import listState from '../state/listState.js';
import { showSatelliteEditorModal, showSatelliteConfirmModal, showSatelliteAddModal, showListEditorModal } from '../ui/modals.js';
import { renderSatelliteTable } from '../ui/satelliteTable.js';
import { updateDeckOverlay } from '../map/deckgl.js';

// ============================================
// SATELLITE CRUD OPERATIONS
// ============================================

/**
 * Initialize satellite data
 * satelliteState already contains default satellites, just render the UI
 */
export function initializeSatellites() {
    renderSatelliteTable();
    logger.success('Satellites initialized', logger.CATEGORY.SATELLITE, { count: satelliteState.getSatelliteCount() });
}

/**
 * Add new satellite
 */
export function addSatellite() {
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
 * @param {string} satelliteId - ID of satellite to edit
 */
export function editSatellite(satelliteId) {
    const satellite = satelliteState.getSatelliteById(satelliteId);
    if (!satellite) return;

    showSatelliteEditorModal(satellite, (data) => {
        const result = satelliteState.updateSatellite(satelliteId, {
            name: data.name,
            noradId: data.noradId,
            tleLine1: data.tleLine1,
            tleLine2: data.tleLine2,
            watchColor: data.watchColor
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
export function deleteSatellites() {
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

// ============================================
// SATELLITE SELECTION & WATCHLIST
// ============================================

/**
 * Toggle satellite selection
 * @param {string} satelliteId - ID of satellite to toggle
 */
export function toggleSatelliteSelection(satelliteId) {
    satelliteState.toggleSatelliteSelection(satelliteId);
    renderSatelliteTable();

    // Update map to show/hide ground track
    updateDeckOverlay();
}

/**
 * Toggle satellite watchlist status
 * @param {string} satelliteId - ID of satellite to toggle
 */
export function toggleSatelliteWatchlist(satelliteId) {
    const satellite = satelliteState.getSatelliteById(satelliteId);
    if (!satellite) return;

    const newState = satelliteState.toggleSatelliteWatchlist(satelliteId);
    renderSatelliteTable();

    logger.diagnostic(
        `Satellite "${satellite.name}" ${newState ? 'added to' : 'removed from'} watchlist`,
        logger.CATEGORY.SATELLITE
    );
}

// ============================================
// BUTTON INITIALIZATION
// ============================================

/**
 * Initialize satellite button handlers
 * Sets up click handlers for add, edit, delete buttons
 */
export function initializeSatelliteButtons() {
    const addSatBtn = document.getElementById('satellite-add-btn');
    const addListBtn = document.getElementById('list-add-btn');

    // +Sat button - opens satellite add modal with color and list
    if (addSatBtn) {
        addSatBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showSatelliteAddModal((data) => {
                // Add satellite
                const result = satelliteState.addSatellite({
                    name: data.name,
                    noradId: data.noradId,
                    tleLine1: data.tleLine1,
                    tleLine2: data.tleLine2,
                    watchColor: data.watchColor || 'grey',
                    watchlisted: true,
                    selected: true
                });

                if (result.success) {
                    // If list was selected, add to that list
                    if (data.listId) {
                        listState.addSatelliteToList(data.listId, result.satellite.id);
                    }
                    renderSatelliteTable();
                    updateDeckOverlay();
                    logger.success('Satellite "' + result.satellite.name + '" added', logger.CATEGORY.SATELLITE);
                } else {
                    logger.error('Failed to add satellite', logger.CATEGORY.SATELLITE, result.errors);
                }
            });
        });
    }

    // +List button - opens list editor modal
    if (addListBtn) {
        addListBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showListEditorModal(null, (data) => {
                // Create new list
                const list = listState.createList(data.name);

                // Add selected satellites to the list
                data.satelliteIds.forEach(satId => {
                    listState.addSatelliteToList(list.id, satId);
                });

                updateDeckOverlay();
                logger.success('List "' + data.name + '" created with ' + data.satelliteIds.length + ' satellites', logger.CATEGORY.DATA);
            });
        });
    }

    logger.success('Satellite button handlers initialized', logger.CATEGORY.SATELLITE);
}
