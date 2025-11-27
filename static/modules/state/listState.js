/**
 * List State Module - Manages user-created satellite lists
 *
 * DEPENDENCIES: eventBus.js, logger.js
 * PATTERN: Encapsulated state with localStorage persistence
 *
 * Features:
 * - User list CRUD operations (Create, Read, Update, Delete)
 * - Add/remove satellites from lists
 * - Toggle list visibility (checked = show on map)
 * - Persistence to localStorage
 * - Event emissions on changes
 *
 * Events Emitted:
 * - list:created - New list created
 * - list:deleted - List deleted
 * - list:renamed - List name changed
 * - list:satellite:added - Satellite added to list
 * - list:satellite:removed - Satellite removed from list
 * - list:visibility:changed - List visibility toggled
 * - list:changed - Generic list change (for re-renders)
 *
 * Usage:
 *   import listState from './modules/state/listState.js';
 *
 *   // Create list
 *   const list = listState.createList('My Favorites');
 *
 *   // Add satellite to list
 *   listState.addSatelliteToList(list.id, satelliteId);
 *
 *   // Get all visible satellite IDs (from checked lists)
 *   const visibleIds = listState.getVisibleSatelliteIds();
 */

import eventBus from '../events/eventBus.js';
import logger from '../utils/logger.js';

const STORAGE_KEY = 'wa_map_user_lists';

/**
 * ListState class - Encapsulates user list state management
 */
class ListState {
    constructor() {
        // Private state
        this._state = {
            lists: [],
            nextListId: 1
        };

        // Load from localStorage
        this._loadFromStorage();

        logger.log('List State initialized', logger.CATEGORY.SYSTEM, { listCount: this._state.lists.length });
    }

    // ============================================
    // PERSISTENCE
    // ============================================

    /**
     * Load lists from localStorage
     * @private
     */
    _loadFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                this._state.lists = data.lists || [];
                this._state.nextListId = data.nextListId || 1;
                logger.diagnostic('Lists loaded from storage', logger.CATEGORY.DATA, { count: this._state.lists.length });
            }
        } catch (e) {
            logger.log('Failed to load lists from storage', logger.CATEGORY.ERROR, { error: e.message });
        }
    }

    /**
     * Save lists to localStorage
     * @private
     */
    _saveToStorage() {
        try {
            const data = {
                lists: this._state.lists,
                nextListId: this._state.nextListId
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            logger.diagnostic('Lists saved to storage', logger.CATEGORY.DATA, { count: this._state.lists.length });
        } catch (e) {
            logger.log('Failed to save lists to storage', logger.CATEGORY.ERROR, { error: e.message });
        }
    }

    // ============================================
    // LIST CRUD
    // ============================================

    /**
     * Get all lists (read-only copy)
     * @returns {Array} Array of list objects
     */
    getAllLists() {
        return JSON.parse(JSON.stringify(this._state.lists));
    }

    /**
     * Get list by ID
     * @param {number} id - List ID
     * @returns {Object|null} List object or null if not found
     */
    getListById(id) {
        const list = this._state.lists.find(l => l.id === id);
        return list ? { ...list, satelliteIds: [...list.satelliteIds] } : null;
    }

    /**
     * Get list count
     * @returns {number} Total number of lists
     */
    getListCount() {
        return this._state.lists.length;
    }

    /**
     * Create a new list
     * @param {string} name - List name
     * @returns {Object} Created list object
     */
    createList(name) {
        const trimmedName = (name || 'New List').trim();

        const newList = {
            id: this._state.nextListId++,
            name: trimmedName,
            satelliteIds: [],
            visible: true,
            createdAt: new Date().toISOString()
        };

        this._state.lists.push(newList);
        this._saveToStorage();

        logger.log(`List created: ${newList.name}`, logger.CATEGORY.DATA);

        eventBus.emit('list:created', { list: { ...newList } });
        eventBus.emit('list:changed', { action: 'created', listId: newList.id });

        return { ...newList };
    }

    /**
     * Delete a list
     * @param {number} id - List ID to delete
     * @returns {boolean} True if deleted
     */
    deleteList(id) {
        const index = this._state.lists.findIndex(l => l.id === id);
        if (index === -1) {
            return false;
        }

        const deletedList = this._state.lists.splice(index, 1)[0];
        this._saveToStorage();

        logger.log(`List deleted: ${deletedList.name}`, logger.CATEGORY.DATA);

        eventBus.emit('list:deleted', { listId: id, listName: deletedList.name });
        eventBus.emit('list:changed', { action: 'deleted', listId: id });

        return true;
    }

    /**
     * Rename a list
     * @param {number} id - List ID
     * @param {string} newName - New name
     * @returns {boolean} True if renamed
     */
    renameList(id, newName) {
        const list = this._state.lists.find(l => l.id === id);
        if (!list) {
            return false;
        }

        const trimmedName = (newName || '').trim();
        if (!trimmedName) {
            logger.log('List name cannot be empty', logger.CATEGORY.ERROR);
            return false;
        }

        const oldName = list.name;
        list.name = trimmedName;
        this._saveToStorage();

        logger.log(`List renamed: ${oldName} → ${trimmedName}`, logger.CATEGORY.DATA);

        eventBus.emit('list:renamed', { listId: id, oldName, newName: trimmedName });
        eventBus.emit('list:changed', { action: 'renamed', listId: id });

        return true;
    }

    // ============================================
    // SATELLITE MANAGEMENT
    // ============================================

    /**
     * Add satellite to list
     * @param {number} listId - List ID
     * @param {number} satelliteId - Satellite ID
     * @returns {boolean} True if added
     */
    addSatelliteToList(listId, satelliteId) {
        const list = this._state.lists.find(l => l.id === listId);
        if (!list) {
            logger.log(`List not found: ${listId}`, logger.CATEGORY.ERROR);
            return false;
        }

        // Don't add duplicates
        if (list.satelliteIds.includes(satelliteId)) {
            logger.diagnostic(`Satellite ${satelliteId} already in list ${list.name}`, logger.CATEGORY.DATA);
            return false;
        }

        list.satelliteIds.push(satelliteId);
        this._saveToStorage();

        logger.log(`Satellite ${satelliteId} added to list ${list.name}`, logger.CATEGORY.DATA);

        eventBus.emit('list:satellite:added', { listId, satelliteId });
        eventBus.emit('list:changed', { action: 'satellite:added', listId, satelliteId });

        return true;
    }

    /**
     * Remove satellite from list
     * @param {number} listId - List ID
     * @param {number} satelliteId - Satellite ID
     * @returns {boolean} True if removed
     */
    removeSatelliteFromList(listId, satelliteId) {
        const list = this._state.lists.find(l => l.id === listId);
        if (!list) {
            logger.log(`List not found: ${listId}`, logger.CATEGORY.ERROR);
            return false;
        }

        const index = list.satelliteIds.indexOf(satelliteId);
        if (index === -1) {
            return false;
        }

        list.satelliteIds.splice(index, 1);
        this._saveToStorage();

        logger.log(`Satellite ${satelliteId} removed from list ${list.name}`, logger.CATEGORY.DATA);

        eventBus.emit('list:satellite:removed', { listId, satelliteId });
        eventBus.emit('list:changed', { action: 'satellite:removed', listId, satelliteId });

        return true;
    }

    /**
     * Get lists containing a satellite
     * @param {number} satelliteId - Satellite ID
     * @returns {Array} Array of list objects containing the satellite
     */
    getListsContainingSatellite(satelliteId) {
        return this._state.lists
            .filter(l => l.satelliteIds.includes(satelliteId))
            .map(l => ({ ...l, satelliteIds: [...l.satelliteIds] }));
    }

    /**
     * Check if satellite is in any list
     * @param {number} satelliteId - Satellite ID
     * @returns {boolean} True if in at least one list
     */
    isSatelliteInAnyList(satelliteId) {
        return this._state.lists.some(l => l.satelliteIds.includes(satelliteId));
    }

    // ============================================
    // VISIBILITY
    // ============================================

    /**
     * Toggle list visibility
     * @param {number} id - List ID
     * @returns {boolean|null} New visibility state, or null if not found
     */
    toggleListVisibility(id) {
        const list = this._state.lists.find(l => l.id === id);
        if (!list) {
            return null;
        }

        list.visible = !list.visible;
        this._saveToStorage();

        logger.log(`List ${list.name} visibility: ${list.visible ? 'shown' : 'hidden'}`, logger.CATEGORY.DATA);

        eventBus.emit('list:visibility:changed', { listId: id, visible: list.visible });
        eventBus.emit('list:changed', { action: 'visibility', listId: id, visible: list.visible });

        return list.visible;
    }

    /**
     * Set list visibility
     * @param {number} id - List ID
     * @param {boolean} visible - Visibility state
     * @returns {boolean} True if set
     */
    setListVisibility(id, visible) {
        const list = this._state.lists.find(l => l.id === id);
        if (!list) {
            return false;
        }

        if (list.visible !== visible) {
            list.visible = visible;
            this._saveToStorage();

            logger.log(`List ${list.name} visibility set: ${visible ? 'shown' : 'hidden'}`, logger.CATEGORY.DATA);

            eventBus.emit('list:visibility:changed', { listId: id, visible });
            eventBus.emit('list:changed', { action: 'visibility', listId: id, visible });
        }

        return true;
    }

    /**
     * Get all satellite IDs from visible lists (union)
     * @returns {Array<number>} Array of unique satellite IDs
     */
    getVisibleSatelliteIds() {
        const ids = new Set();

        this._state.lists
            .filter(l => l.visible)
            .forEach(l => {
                l.satelliteIds.forEach(satId => ids.add(satId));
            });

        return Array.from(ids);
    }

    /**
     * Get visible lists
     * @returns {Array} Array of visible list objects
     */
    getVisibleLists() {
        return this._state.lists
            .filter(l => l.visible)
            .map(l => ({ ...l, satelliteIds: [...l.satelliteIds] }));
    }

    // ============================================
    // UTILITIES
    // ============================================

    /**
     * Clear all lists
     */
    clearAllLists() {
        const count = this._state.lists.length;
        this._state.lists = [];
        this._state.nextListId = 1;
        this._saveToStorage();

        logger.log(`Cleared all ${count} lists`, logger.CATEGORY.DATA);
        eventBus.emit('list:changed', { action: 'cleared' });
    }

    /**
     * Export lists as JSON
     * @returns {string} JSON string
     */
    exportToJSON() {
        return JSON.stringify(this._state.lists, null, 2);
    }

    /**
     * Import lists from JSON
     * @param {string} json - JSON string
     * @returns {boolean} True if imported successfully
     */
    importFromJSON(json) {
        try {
            const lists = JSON.parse(json);
            if (!Array.isArray(lists)) {
                throw new Error('Invalid format: expected array');
            }

            // Validate and import
            lists.forEach(list => {
                if (list.name && Array.isArray(list.satelliteIds)) {
                    this.createList(list.name);
                    const newList = this._state.lists[this._state.lists.length - 1];
                    list.satelliteIds.forEach(satId => {
                        this.addSatelliteToList(newList.id, satId);
                    });
                    if (list.visible === false) {
                        this.setListVisibility(newList.id, false);
                    }
                }
            });

            logger.log(`Imported ${lists.length} lists`, logger.CATEGORY.DATA);
            return true;
        } catch (e) {
            logger.log('Failed to import lists', logger.CATEGORY.ERROR, { error: e.message });
            return false;
        }
    }
}

// Export singleton instance
const listState = new ListState();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
    window.listState = listState;
}

export default listState;
