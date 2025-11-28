/**
 * Satellite State Module - Manages satellite state and TLE data
 *
 * DEPENDENCIES: eventBus.js, logger.js, validation.js
 * PATTERN: Encapsulated state with controlled mutations
 *
 * Features:
 * - Satellite CRUD operations
 * - Selection management
 * - Watchlist (star) management
 * - Default satellites (18 satellites: Amateur radio, ISS, Starlink, GPS, GLONASS)
 * - TLE data validation and management
 * - Event emissions on changes
 *
 * Events Emitted:
 * - satellite:added - New satellite added
 * - satellite:updated - Satellite properties updated
 * - satellite:removed - Satellite deleted
 * - satellite:selection:changed - Selection state changed
 * - satellite:watchlist:changed - Watchlist state changed
 * - satellite:cleared - All satellites removed
 *
 * Usage:
 *   import satelliteState from './modules/state/satelliteState.js';
 *
 *   // Get satellites
 *   const satellites = satelliteState.getAllSatellites();
 *   const satellite = satelliteState.getSatelliteById(1);
 *
 *   // Add satellite
 *   satelliteState.addSatellite({
 *       name: 'Test Sat',
 *       tle1: '1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927',
 *       tle2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537'
 *   });
 */

import eventBus from '../events/eventBus.js';
import logger from '../utils/logger.js';
import { validateSatellite, validateTLE } from '../utils/validation.js';

/**
 * Default satellites - 18 satellites including amateur radio, ISS, Starlink, GPS, GLONASS
 */
const defaultSatellites = [
    {
        id: 1,
        name: 'AO-07',
        noradId: 7530,
        tleLine1: '1 07530U 74089B   25328.63325197 -.00000040  00000-0  41462-4 0  9995',
        tleLine2: '2 07530 101.9973 334.7103 0012252 160.6151 316.0496 12.53693653334888',
        selected: false,
        watchlisted: false,
        watchColor: 'grey'  // 'grey' | 'red' | 'blue'
    },
    {
        id: 2,
        name: 'UO-11',
        noradId: 14781,
        tleLine1: '1 14781U 84021B   25328.66253352  .00001879  00000-0  20018-3 0  9997',
        tleLine2: '2 14781  97.7788 291.9758 0008716 131.8357 228.3606 14.90050575226665',
        selected: false,
        watchlisted: false,
        watchColor: 'grey'  // 'grey' | 'red' | 'blue'
    },
    {
        id: 3,
        name: 'AO-27',
        noradId: 22825,
        tleLine1: '1 22825U 93061C   25328.67770117  .00000155  00000-0  76280-4 0  9992',
        tleLine2: '2 22825  98.7168  30.9001 0008029 347.9707  12.1282 14.30867005677751',
        selected: false,
        watchlisted: false,
        watchColor: 'grey'  // 'grey' | 'red' | 'blue'
    },
    {
        id: 4,
        name: 'FO-29',
        noradId: 24278,
        tleLine1: '1 24278U 96046B   25328.65866373 -.00000024  00000-0  14798-4 0  9992',
        tleLine2: '2 24278  98.5474 200.2186 0348829 266.9954  89.1225 13.53261232445509',
        selected: false,
        watchlisted: false,
        watchColor: 'grey'  // 'grey' | 'red' | 'blue'
    },
    {
        id: 5,
        name: 'GO-32',
        noradId: 25397,
        tleLine1: '1 25397U 98043D   25328.51312778  .00000102  00000-0  64392-4 0  9995',
        tleLine2: '2 25397  98.9906 311.3060 0002394  85.3934 274.7517 14.24369423422192',
        selected: false,
        watchlisted: false,
        watchColor: 'grey'  // 'grey' | 'red' | 'blue'
    },
    {
        id: 6,
        name: 'ISS',
        noradId: 25544,
        tleLine1: '1 25544U 98067A   25328.54472231  .00014120  00000-0  26353-3 0  9998',
        tleLine2: '2 25544  51.6316 232.5414 0003895 163.7073 196.4042 15.49046550540034',
        selected: false,
        watchlisted: false,
        watchColor: 'grey'  // 'grey' | 'red' | 'blue'
    },
    {
        id: 7,
        name: 'STARLINK-1008',
        noradId: 44714,
        tleLine1: '1 44714U 19074B   25328.94319468 -.00000606  00000+0 -21797-4 0  9998',
        tleLine2: '2 44714  53.0556 296.8401 0001385  98.0066 262.1081 15.06385986332966',
        selected: true,
        watchlisted: false
    },
    {
        id: 8,
        name: 'STARLINK-1011',
        noradId: 44717,
        tleLine1: '1 44717U 19074E   25328.95352045  .00631300  20175-3  93240-3 0  9999',
        tleLine2: '2 44717  53.0444 263.8732 0002501 109.2764 250.8538 16.04408418333425',
        selected: false,
        watchlisted: false,
        watchColor: 'grey'  // 'grey' | 'red' | 'blue'
    },
    {
        id: 9,
        name: 'STARLINK-1012',
        noradId: 44718,
        tleLine1: '1 44718U 19074F   25328.92107844  .00002207  00000+0  16702-3 0  9999',
        tleLine2: '2 44718  53.0550 296.9433 0001550  81.2238 278.8927 15.06392614332957',
        selected: false,
        watchlisted: false,
        watchColor: 'grey'  // 'grey' | 'red' | 'blue'
    },
    {
        id: 10,
        name: 'STARLINK-1017',
        noradId: 44723,
        tleLine1: '1 44723U 19074L   25328.61120294  .00048318  00000+0  24266-2 0  9991',
        tleLine2: '2 44723  53.0523 293.3290 0005002  34.1557 325.9757 15.16828388332983',
        selected: false,
        watchlisted: false,
        watchColor: 'grey'  // 'grey' | 'red' | 'blue'
    },
    {
        id: 11,
        name: 'STARLINK-1019',
        noradId: 44724,
        tleLine1: '1 44724U 19074M   25328.93994605  .00173374  00000+0  26843-2 0  9996',
        tleLine2: '2 44724  53.0539 291.4658 0002130  93.4344 266.6909 15.52955184333031',
        selected: false,
        watchlisted: false,
        watchColor: 'grey'  // 'grey' | 'red' | 'blue'
    },
    {
        id: 12,
        name: 'GPS BIIR-2 (PRN 13)',
        noradId: 24876,
        tleLine1: '1 24876U 97035A   25328.28519723  .00000044  00000+0  00000+0 0  9994',
        tleLine2: '2 24876  55.8862 106.5908 0096588  57.0386 303.8639  2.00563532207846',
        selected: false,
        watchlisted: false,
        watchColor: 'grey'  // 'grey' | 'red' | 'blue'
    },
    {
        id: 13,
        name: 'GPS BIIR-4 (PRN 20)',
        noradId: 26360,
        tleLine1: '1 26360U 00025A   25328.89436072 -.00000069  00000+0  00000+0 0  9997',
        tleLine2: '2 26360  55.0347  27.5601 0038683 240.2350 292.1594  2.00569260187174',
        selected: false,
        watchlisted: false,
        watchColor: 'grey'  // 'grey' | 'red' | 'blue'
    },
    {
        id: 14,
        name: 'GPS BIIR-5 (PRN 22)',
        noradId: 26407,
        tleLine1: '1 26407U 00040A   25328.88736902  .00000025  00000+0  00000+0 0  9991',
        tleLine2: '2 26407  54.8953 223.2790 0126997 301.4772  65.4421  2.00567703185857',
        selected: false,
        watchlisted: false,
        watchColor: 'grey'  // 'grey' | 'red' | 'blue'
    },
    {
        id: 15,
        name: 'COSMOS 2361',
        noradId: 25590,
        tleLine1: '1 25590U 98076A   25328.62868021  .00000071  00000+0  60348-4 0  9996',
        tleLine2: '2 25590  82.9349 357.4824 0030455 318.0128 189.5315 13.73214848348627',
        selected: false,
        watchlisted: false,
        watchColor: 'grey'  // 'grey' | 'red' | 'blue'
    },
    {
        id: 16,
        name: 'COSMOS 2378',
        noradId: 26818,
        tleLine1: '1 26818U 01023A   25328.92282861  .00000066  00000+0  53741-4 0  9994',
        tleLine2: '2 26818  82.9289  12.9356 0031638 255.9971 278.2569 13.74139809226789',
        selected: false,
        watchlisted: false,
        watchColor: 'grey'  // 'grey' | 'red' | 'blue'
    },
    {
        id: 17,
        name: 'COSMOS 2389',
        noradId: 27436,
        tleLine1: '1 27436U 02026A   25329.00848685  .00000036  00000+0  20795-4 0  9997',
        tleLine2: '2 27436  82.9490 320.1133 0047713 108.7796 271.3848 13.75151921179059',
        selected: false,
        watchlisted: false,
        watchColor: 'grey'  // 'grey' | 'red' | 'blue'
    },
    {
        id: 18,
        name: 'COSMOS 2398',
        noradId: 27818,
        tleLine1: '1 27818U 03023A   25328.99204600  .00000054  00000+0  42227-4 0  9993',
        tleLine2: '2 27818  82.9465 285.7785 0031730 159.6538 268.5026 13.72383294125734',
        selected: false,
        watchlisted: false
    }
];

/**
 * SatelliteState class - Encapsulates satellite state management
 */
class SatelliteState {
    constructor() {
        // Private state
        this._state = {
            satellites: [],
            nextSatelliteId: 19, // Start after default 18 satellites
            activeRowId: null,   // Currently highlighted row (blue background)

            // Sort state
            currentSortColumn: null,  // null = default order, or column name ('noradId', 'name')
            currentSortDirection: null  // null = default, 'asc' = ascending, 'desc' = descending
        };

        // Initialize with default satellites (deep copy)
        this._state.satellites = JSON.parse(JSON.stringify(defaultSatellites));

        logger.log('Satellite State initialized with 18 default satellites', logger.CATEGORY.SATELLITE);
    }

    /**
     * Get all satellites (read-only copy)
     * @returns {Array} Array of satellite objects
     */
    getAllSatellites() {
        // Return deep copy to prevent mutation
        return JSON.parse(JSON.stringify(this._state.satellites));
    }

    /**
     * Get satellite by ID
     * @param {number} id - Satellite ID
     * @returns {Object|null} Satellite object or null if not found
     */
    getSatelliteById(id) {
        const satellite = this._state.satellites.find(s => s.id === id);
        return satellite ? { ...satellite } : null;
    }

    /**
     * Get selected satellites
     * @returns {Array} Array of selected satellite objects
     */
    getSelectedSatellites() {
        return this._state.satellites
            .filter(s => s.selected)
            .map(s => ({ ...s }));
    }

    /**
     * Get watchlisted satellites
     * @returns {Array} Array of watchlisted (starred) satellite objects
     */
    getWatchlistedSatellites() {
        return this._state.satellites
            .filter(s => s.watchlisted)
            .map(s => ({ ...s }));
    }

    /**
     * Get satellite count
     * @returns {number} Total number of satellites
     */
    getSatelliteCount() {
        return this._state.satellites.length;
    }

    /**
     * Get selected satellite count
     * @returns {number} Number of selected satellites
     */
    getSelectedCount() {
        return this._state.satellites.filter(s => s.selected).length;
    }

    /**
     * Get watchlisted satellite count
     * @returns {number} Number of watchlisted satellites
     */
    getWatchlistedCount() {
        return this._state.satellites.filter(s => s.watchlisted).length;
    }

    /**
     * Add new satellite
     * @param {Object} satelliteData - Satellite data {name, tle1, tle2, noradId (optional)}
     * @returns {Object} {success: boolean, satellite: Object|null, errors: Object}
     */
    addSatellite(satelliteData) {
        // Validate satellite data
        const validation = validateSatellite(satelliteData);
        if (!validation.valid) {
            logger.log('Satellite validation failed', logger.CATEGORY.ERROR, validation.errors);
            return { success: false, satellite: null, errors: validation.errors };
        }

        // Extract NORAD ID from TLE if not provided
        const noradId = satelliteData.noradId || this._extractNoradId(validation.values.tle1);

        // Create new satellite with validated data
        const newSatellite = {
            id: this._state.nextSatelliteId++,
            name: validation.values.name,
            noradId: noradId,
            tleLine1: validation.values.tle1,
            tleLine2: validation.values.tle2,
            selected: false, // New satellites start not selected
            watchlisted: false
        };

        // Add to state
        this._state.satellites.push(newSatellite);

        logger.log(`Satellite added: ${newSatellite.name}`, logger.CATEGORY.SATELLITE);

        // Emit event
        eventBus.emit('satellite:added', {
            id: newSatellite.id,
            ...newSatellite
        });

        return { success: true, satellite: { ...newSatellite }, errors: {} };
    }

    /**
     * Update existing satellite
     * @param {number} id - Satellite ID
     * @param {Object} updates - Properties to update
     * @returns {Object} {success: boolean, satellite: Object|null, errors: Object}
     */
    updateSatellite(id, updates) {
        const satelliteIndex = this._state.satellites.findIndex(s => s.id === id);
        if (satelliteIndex === -1) {
            logger.log(`Satellite not found: ${id}`, logger.CATEGORY.ERROR);
            return { success: false, satellite: null, errors: { id: 'Satellite not found' } };
        }

        const satellite = this._state.satellites[satelliteIndex];
        const updatedSatellite = { ...satellite, ...updates };

        // Convert property names for validation (tleLine1 -> tle1, tleLine2 -> tle2)
        const validationData = {
            name: updatedSatellite.name,
            tle1: updatedSatellite.tleLine1,
            tle2: updatedSatellite.tleLine2
        };

        // Validate updated satellite
        const validation = validateSatellite(validationData);
        if (!validation.valid) {
            logger.log('Satellite validation failed', logger.CATEGORY.ERROR, validation.errors);
            return { success: false, satellite: null, errors: validation.errors };
        }

        // Apply validated updates (preserve all existing properties, then apply updates)
        this._state.satellites[satelliteIndex] = {
            ...satellite,
            ...updates,
            name: validation.values.name,
            tleLine1: validation.values.tle1,
            tleLine2: validation.values.tle2,
            noradId: updatedSatellite.noradId || this._extractNoradId(validation.values.tle1)
        };

        logger.log(`Satellite updated: ${validation.values.name}`, logger.CATEGORY.SATELLITE);

        // Emit event
        eventBus.emit('satellite:updated', {
            id,
            ...this._state.satellites[satelliteIndex]
        });

        return { success: true, satellite: { ...this._state.satellites[satelliteIndex] }, errors: {} };
    }

    /**
     * Delete satellites by IDs
     * @param {Array<number>} ids - Array of satellite IDs to delete
     * @returns {number} Number of satellites deleted
     */
    deleteSatellites(ids) {
        if (!Array.isArray(ids) || ids.length === 0) {
            return 0;
        }

        const beforeCount = this._state.satellites.length;
        this._state.satellites = this._state.satellites.filter(s => !ids.includes(s.id));
        const deletedCount = beforeCount - this._state.satellites.length;

        if (deletedCount > 0) {
            logger.log(`Deleted ${deletedCount} satellite(s)`, logger.CATEGORY.SATELLITE);

            // Emit event for each deleted satellite
            ids.forEach(id => {
                eventBus.emit('satellite:removed', { id });
            });
        }

        return deletedCount;
    }

    /**
     * Toggle satellite selection
     * @param {number} id - Satellite ID
     * @returns {boolean|null} New selection state, or null if not found
     */
    toggleSatelliteSelection(id) {
        const satellite = this._state.satellites.find(s => s.id === id);
        if (!satellite) {
            return null;
        }

        satellite.selected = !satellite.selected;
        logger.log(`Satellite ${satellite.name} ${satellite.selected ? 'selected' : 'deselected'}`, logger.CATEGORY.SATELLITE);

        // Emit event
        eventBus.emit('satellite:selection:changed', {
            id,
            selected: satellite.selected
        });

        return satellite.selected;
    }

    /**
     * Toggle satellite watchlist status
     * @param {number} id - Satellite ID
     * @returns {boolean|null} New watchlist state, or null if not found
     */
    toggleSatelliteWatchlist(id) {
        const satellite = this._state.satellites.find(s => s.id === id);
        if (!satellite) {
            return null;
        }

        satellite.watchlisted = !satellite.watchlisted;
        logger.log(`Satellite ${satellite.name} ${satellite.watchlisted ? 'added to' : 'removed from'} watchlist`, logger.CATEGORY.SATELLITE);

        // Emit event
        eventBus.emit('satellite:watchlist:changed', {
            id,
            watchlisted: satellite.watchlisted
        });

        return satellite.watchlisted;
    }

    /**
     * Cycle satellite watch color
     * Cycles: grey → red → blue → grey
     * @param {number} id - Satellite ID
     * @returns {string|null} New watch color, or null if not found
     */
    cycleSatelliteWatchColor(id) {
        const satellite = this._state.satellites.find(s => s.id === id);
        if (!satellite) {
            return null;
        }

        // Cycle: grey → red → blue → grey
        const colorCycle = { 'grey': 'red', 'red': 'blue', 'blue': 'grey' };
        const oldColor = satellite.watchColor || 'grey';
        satellite.watchColor = colorCycle[oldColor] || 'grey';

        logger.log(`Satellite ${satellite.name} watch color: ${satellite.watchColor}`, logger.CATEGORY.SATELLITE);

        // Emit event
        eventBus.emit('satellite:watchcolor:changed', {
            id,
            watchColor: satellite.watchColor
        });

        return satellite.watchColor;
    }

    /**
     * Get satellite watch color
     * @param {number} id - Satellite ID
     * @returns {string} Watch color ('grey', 'red', 'blue')
     */
    getSatelliteWatchColor(id) {
        const satellite = this._state.satellites.find(s => s.id === id);
        return satellite?.watchColor || 'grey';
    }

    /**
     * Select all satellites
     */
    selectAll() {
        let changeCount = 0;
        this._state.satellites.forEach(satellite => {
            if (!satellite.selected) {
                satellite.selected = true;
                changeCount++;
                eventBus.emit('satellite:selection:changed', {
                    id: satellite.id,
                    selected: true
                });
            }
        });

        if (changeCount > 0) {
            logger.log(`Selected all ${this._state.satellites.length} satellites`, logger.CATEGORY.SATELLITE);
        }
    }

    /**
     * Deselect all satellites
     */
    deselectAll() {
        let changeCount = 0;
        this._state.satellites.forEach(satellite => {
            if (satellite.selected) {
                satellite.selected = false;
                changeCount++;
                eventBus.emit('satellite:selection:changed', {
                    id: satellite.id,
                    selected: false
                });
            }
        });

        if (changeCount > 0) {
            logger.log(`Deselected all satellites`, logger.CATEGORY.SATELLITE);
        }
    }

    /**
     * Clear all satellites
     */
    clearAllSatellites() {
        const count = this._state.satellites.length;
        this._state.satellites = [];
        logger.log(`Cleared all ${count} satellites`, logger.CATEGORY.SATELLITE);

        eventBus.emit('satellite:cleared', { count });
    }

    /**
     * Reset to default satellites
     */
    resetToDefaults() {
        this._state.satellites = JSON.parse(JSON.stringify(defaultSatellites));
        this._state.nextSatelliteId = 19;
        logger.log('Reset to 18 default satellites', logger.CATEGORY.SATELLITE);

        eventBus.emit('satellite:cleared', { count: 18, reset: true });
    }

    /**
     * Extract NORAD ID from TLE line 1
     * @private
     * @param {string} tleLine1 - TLE line 1
     * @returns {number} NORAD catalog number
     */
    _extractNoradId(tleLine1) {
        // NORAD ID is in positions 2-6 of TLE line 1
        const noradStr = tleLine1.substring(2, 7).trim();
        return parseInt(noradStr, 10) || 0;
    }

    /**
     * Get editing state (active row for highlighting)
     * @returns {Object} {activeRowId: number|null}
     */
    getEditingState() {
        return {
            activeRowId: this._state.activeRowId
        };
    }

    /**
     * Set active (highlighted) row
     * @param {number|null} rowId - Row ID to highlight, or null
     */
    setActiveRow(rowId) {
        this._state.activeRowId = rowId;
    }

    /**
     * Get sort state
     * @returns {Object} {column: string|null, direction: string|null}
     */
    getSortState() {
        return {
            column: this._state.currentSortColumn,
            direction: this._state.currentSortDirection
        };
    }

    /**
     * Set sort state
     * @param {string|null} column - Column name ('noradId', 'name') or null for default
     * @param {string|null} direction - 'asc', 'desc', or null for default
     */
    setSortState(column, direction) {
        const validColumns = ['noradId', 'name'];
        const validDirections = ['asc', 'desc'];

        // Validate column
        if (column !== null && !validColumns.includes(column)) {
            logger.log(`Invalid sort column: ${column}`, logger.CATEGORY.ERROR);
            return;
        }

        // Validate direction
        if (direction !== null && !validDirections.includes(direction)) {
            logger.log(`Invalid sort direction: ${direction}`, logger.CATEGORY.ERROR);
            return;
        }

        this._state.currentSortColumn = column;
        this._state.currentSortDirection = direction;

        logger.log(`Sort state: ${column || 'default'} ${direction || ''}`, logger.CATEGORY.SATELLITE);

        eventBus.emit('satellite:sort:changed', { column, direction });
    }
}

// Export singleton instance
const satelliteState = new SatelliteState();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
    window.satelliteState = satelliteState;
}

export default satelliteState;
