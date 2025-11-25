/**
 * Satellite Table Module - Simple satellite table rendering
 *
 * DEPENDENCIES:
 * - satelliteState: Satellite data and selection state
 *
 * Features:
 * - Dynamic table rendering
 * - Checkbox selection (uses global toggleSatelliteSelection)
 * - Click to edit (uses global editSatellite)
 * - Watchlist toggle (uses global toggleSatelliteWatchlist)
 *
 * NOTE: This module uses inline HTML event handlers that reference global functions.
 * The functions toggleSatelliteSelection, editSatellite, and toggleSatelliteWatchlist
 * must be available on the window object.
 */

import satelliteState from '../state/satelliteState.js';

// ============================================
// TABLE RENDERING
// ============================================

/**
 * Render satellite table
 * Updates table body with current satellite data using template strings
 *
 * NOTE: Uses inline event handlers that reference global window functions:
 * - window.toggleSatelliteSelection(id)
 * - window.editSatellite(id)
 * - window.toggleSatelliteWatchlist(id)
 */
export function renderSatelliteTable() {
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
