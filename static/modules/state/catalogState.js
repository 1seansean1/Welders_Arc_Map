/**
 * Catalog State Module - Manages satellite catalogs
 *
 * DEPENDENCIES: eventBus.js, logger.js
 * PATTERN: Encapsulated state with controlled mutations
 *
 * Features:
 * - Catalog CRUD operations
 * - Each catalog contains multiple satellites with TLE data
 * - Visibility toggle per catalog
 * - Default "Celestrak" catalog with API fetch
 * - Persistence to localStorage
 *
 * Events Emitted:
 * - catalog:added - New catalog added
 * - catalog:updated - Catalog properties updated
 * - catalog:deleted - Catalog removed
 * - catalog:visibility:changed - Catalog visibility toggled
 * - catalog:satellites:loaded - Satellites loaded into catalog
 */

import eventBus from '../events/eventBus.js';
import logger from '../utils/logger.js';

const STORAGE_KEY = 'wa_map_catalogs';
const CELESTRAK_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';

/**
 * CatalogState class - Encapsulates catalog state management
 */
class CatalogState {
    constructor() {
        this._state = {
            catalogs: [],
            nextCatalogId: 1,
            activeRowId: null,
            celestrakLoaded: false
        };

        // Load from localStorage first
        this._loadFromStorage();

        logger.log('Catalog State initialized', logger.CATEGORY.DATA);
    }

    /**
     * Load catalogs from localStorage
     * @private
     */
    _loadFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                this._state.catalogs = data.catalogs || [];
                this._state.nextCatalogId = data.nextCatalogId || 1;
                logger.diagnostic('Catalogs loaded from storage', logger.CATEGORY.DATA, { count: this._state.catalogs.length });
            }
        } catch (error) {
            logger.warning('Failed to load catalogs from storage', logger.CATEGORY.DATA);
        }
    }

    /**
     * Save catalogs to localStorage
     * @private
     */
    _saveToStorage() {
        try {
            const data = {
                catalogs: this._state.catalogs,
                nextCatalogId: this._state.nextCatalogId
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            logger.diagnostic('Catalogs saved to storage', logger.CATEGORY.DATA);
        } catch (error) {
            logger.warning('Failed to save catalogs to storage', logger.CATEGORY.DATA);
        }
    }

    /**
     * Get all catalogs (read-only copy)
     * @returns {Array} Array of catalog objects
     */
    getAllCatalogs() {
        return JSON.parse(JSON.stringify(this._state.catalogs));
    }

    /**
     * Get catalog by ID
     * @param {number} id - Catalog ID
     * @returns {Object|null} Catalog object or null if not found
     */
    getCatalogById(id) {
        const catalog = this._state.catalogs.find(c => c.id === id);
        return catalog ? JSON.parse(JSON.stringify(catalog)) : null;
    }

    /**
     * Get all satellites from visible catalogs
     * @returns {Array} Array of satellite objects from visible catalogs
     */
    getVisibleSatellites() {
        const satellites = [];
        this._state.catalogs
            .filter(c => c.visible !== false)
            .forEach(catalog => {
                catalog.satellites.forEach(sat => {
                    satellites.push({
                        ...sat,
                        catalogId: catalog.id,
                        catalogName: catalog.name
                    });
                });
            });
        return satellites;
    }

    /**
     * Get total satellite count across all catalogs
     * @returns {number} Total satellite count
     */
    getTotalSatelliteCount() {
        return this._state.catalogs.reduce((sum, c) => sum + c.satellites.length, 0);
    }

    /**
     * Create a new catalog
     * @param {string} name - Catalog name
     * @param {Array} satellites - Array of satellite objects
     * @returns {Object} Created catalog
     */
    createCatalog(name, satellites = []) {
        const catalog = {
            id: this._state.nextCatalogId++,
            name: name.trim(),
            satellites: satellites,
            visible: true,
            createdAt: new Date().toISOString()
        };

        this._state.catalogs.push(catalog);
        this._saveToStorage();

        logger.success(`Catalog "${name}" created with ${satellites.length} satellites`, logger.CATEGORY.DATA);

        eventBus.emit('catalog:added', { catalog: { ...catalog } });

        return { ...catalog };
    }

    /**
     * Delete a catalog by ID
     * @param {number} id - Catalog ID
     * @returns {boolean} True if deleted
     */
    deleteCatalog(id) {
        const index = this._state.catalogs.findIndex(c => c.id === id);
        if (index === -1) return false;

        const catalog = this._state.catalogs[index];
        this._state.catalogs.splice(index, 1);
        this._saveToStorage();

        logger.success(`Catalog "${catalog.name}" deleted`, logger.CATEGORY.DATA);

        eventBus.emit('catalog:deleted', { id, name: catalog.name });

        return true;
    }

    /**
     * Set catalog visibility
     * @param {number} id - Catalog ID
     * @param {boolean} visible - Visibility state
     */
    setCatalogVisibility(id, visible) {
        const catalog = this._state.catalogs.find(c => c.id === id);
        if (!catalog) return;

        catalog.visible = visible;
        this._saveToStorage();

        logger.diagnostic(`Catalog "${catalog.name}" visibility: ${visible}`, logger.CATEGORY.DATA);

        eventBus.emit('catalog:visibility:changed', { id, visible });
    }

    /**
     * Get active row ID (for highlighting)
     * @returns {number|null} Active row ID
     */
    getActiveRowId() {
        return this._state.activeRowId;
    }

    /**
     * Set active row ID
     * @param {number|null} id - Row ID to highlight
     */
    setActiveRow(id) {
        this._state.activeRowId = id;
    }

    /**
     * Parse multi-satellite TLE text
     * Format: name line, TLE line 1, TLE line 2, repeat
     * @param {string} tleText - Raw TLE text
     * @returns {Object} {valid: boolean, satellites: Array, errors: Array}
     */
    parseTLEBatch(tleText) {
        const lines = tleText.trim().split('\n').map(l => l.trimEnd());
        const satellites = [];
        const errors = [];

        let i = 0;
        while (i < lines.length) {
            // Skip empty lines
            if (!lines[i] || lines[i].trim() === '') {
                i++;
                continue;
            }

            // Need at least 3 lines (name, line1, line2)
            if (i + 2 >= lines.length) {
                errors.push(`Incomplete TLE at line ${i + 1}`);
                break;
            }

            const nameLine = lines[i];
            const line1 = lines[i + 1];
            const line2 = lines[i + 2];

            // Validate TLE lines
            if (!line1.startsWith('1 ')) {
                errors.push(`Line ${i + 2}: Expected TLE line 1 starting with "1 "`);
                i++;
                continue;
            }
            if (!line2.startsWith('2 ')) {
                errors.push(`Line ${i + 3}: Expected TLE line 2 starting with "2 "`);
                i++;
                continue;
            }

            // Extract NORAD ID
            const noradId = parseInt(line1.substring(2, 7).trim(), 10);
            if (isNaN(noradId)) {
                errors.push(`Invalid NORAD ID at line ${i + 2}`);
                i += 3;
                continue;
            }

            satellites.push({
                name: nameLine.trim(),
                noradId: noradId,
                tleLine1: line1,
                tleLine2: line2
            });

            i += 3;
        }

        return {
            valid: errors.length === 0 && satellites.length > 0,
            satellites,
            errors
        };
    }

    /**
     * Fetch satellites from Celestrak API
     * @returns {Promise<Object>} {success: boolean, count: number, error?: string}
     */
    async fetchCelestrak() {
        // Check if Celestrak already exists
        const existing = this._state.catalogs.find(c => c.name === 'Celestrak');
        if (existing) {
            logger.diagnostic('Celestrak catalog already exists', logger.CATEGORY.DATA);
            return { success: true, count: existing.satellites.length, cached: true };
        }

        try {
            logger.info('Fetching Celestrak active satellites...', logger.CATEGORY.DATA);

            const response = await fetch(CELESTRAK_URL);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const tleText = await response.text();
            const result = this.parseTLEBatch(tleText);

            if (!result.valid && result.satellites.length === 0) {
                throw new Error('Failed to parse TLE data');
            }

            // Create the Celestrak catalog
            this.createCatalog('Celestrak', result.satellites);
            this._state.celestrakLoaded = true;

            logger.success(`Celestrak loaded: ${result.satellites.length} satellites`, logger.CATEGORY.DATA);

            return { success: true, count: result.satellites.length };
        } catch (error) {
            logger.error('Failed to fetch Celestrak', logger.CATEGORY.DATA, { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if Celestrak has been loaded
     * @returns {boolean}
     */
    isCelestrakLoaded() {
        return this._state.celestrakLoaded || this._state.catalogs.some(c => c.name === 'Celestrak');
    }
}

// Export singleton instance
const catalogState = new CatalogState();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
    window.catalogState = catalogState;
}

export default catalogState;
