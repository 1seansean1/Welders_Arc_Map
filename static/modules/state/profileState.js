/**
 * Profile State Module - Manages user profiles and settings
 *
 * DEPENDENCIES: eventBus.js, logger.js, config.js
 * PATTERN: Encapsulated state with backend sync
 *
 * Features:
 * - Current profile tracking
 * - Per-profile settings persistence
 * - Backend API integration
 * - Role/permission stubs
 *
 * Events Emitted:
 * - profile:changed - Active profile changed
 * - profile:settings:changed - Profile settings updated
 * - profile:login - User logged in
 * - profile:logout - User logged out
 * - profile:error - Error occurred
 *
 * Usage:
 *   import profileState from './modules/state/profileState.js';
 *
 *   // Get current profile
 *   const profile = profileState.getCurrentProfile();
 *
 *   // Login
 *   await profileState.login('username', 'password');
 *
 *   // Save/load settings
 *   await profileState.saveSettings({ mapZoom: 5 });
 *   const settings = profileState.getSettings();
 */

import eventBus from '../events/eventBus.js';
import logger from '../utils/logger.js';
import { CONFIG } from '../../config.js';

/**
 * Default settings for new profiles
 */
const DEFAULT_SETTINGS = {
    // Map view defaults
    mapCenter: [0, 0],
    mapZoom: 2,

    // UI preferences
    panelExpanded: true,
    activeSection: 'satellites',
    logPanelHeight: 150,

    // Time settings
    tailMinutes: 45,
    headMinutes: 0,
    glowEnabled: true,
    glowIntensity: 1.0,
    apexTickEnabled: true,

    // Selected items (stored as IDs)
    selectedSatellites: [],
    selectedSensors: [],
    activeWatchlistId: null
};

/**
 * ProfileState class - Encapsulates user profile state
 */
class ProfileState {
    constructor() {
        // Private state
        this._state = {
            currentProfile: null,
            settings: { ...DEFAULT_SETTINGS },
            isLoading: false,
            lastError: null,
            roles: []
        };

        this._apiBase = CONFIG.api.baseUrl;

        logger.log('Profile State initialized', logger.CATEGORY.SYSTEM);
    }

    /**
     * Get current profile (read-only copy)
     * @returns {Object|null} Current profile or null if not logged in
     */
    getCurrentProfile() {
        if (!this._state.currentProfile) return null;
        return { ...this._state.currentProfile };
    }

    /**
     * Get current profile ID
     * @returns {number|null} Profile ID or null
     */
    getProfileId() {
        return this._state.currentProfile?.id || null;
    }

    /**
     * Get current username
     * @returns {string|null} Username or null
     */
    getUsername() {
        return this._state.currentProfile?.username || null;
    }

    /**
     * Get current display name
     * @returns {string|null} Display name or null
     */
    getDisplayName() {
        return this._state.currentProfile?.display_name || null;
    }

    /**
     * Get current role
     * @returns {string} Role name (defaults to 'user')
     */
    getRole() {
        return this._state.currentProfile?.role || 'user';
    }

    /**
     * Check if user is logged in
     * @returns {boolean} True if logged in
     */
    isLoggedIn() {
        return this._state.currentProfile !== null;
    }

    /**
     * Get current settings (read-only copy)
     * @returns {Object} Settings object
     */
    getSettings() {
        return { ...this._state.settings };
    }

    /**
     * Get a specific setting value
     * @param {string} key - Setting key
     * @param {*} defaultValue - Default value if not set
     * @returns {*} Setting value
     */
    getSetting(key, defaultValue = null) {
        return this._state.settings.hasOwnProperty(key)
            ? this._state.settings[key]
            : defaultValue;
    }

    /**
     * Check if currently loading
     * @returns {boolean} True if loading
     */
    isLoading() {
        return this._state.isLoading;
    }

    /**
     * Get last error
     * @returns {string|null} Last error message or null
     */
    getLastError() {
        return this._state.lastError;
    }

    // ============================================
    // AUTHENTICATION METHODS
    // ============================================

    /**
     * Login with username and password
     * @param {string} username - Username
     * @param {string} password - Password
     * @returns {Promise<boolean>} True if successful
     */
    async login(username, password) {
        this._state.isLoading = true;
        this._state.lastError = null;

        try {
            const response = await fetch(`${this._apiBase}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Login failed');
            }

            const data = await response.json();
            this._state.currentProfile = data.profile;

            logger.success(`Logged in as ${username}`, logger.CATEGORY.PANEL);

            // Load settings for this profile
            await this.loadSettings();

            eventBus.emit('profile:login', {
                profile: this.getCurrentProfile()
            });

            eventBus.emit('profile:changed', {
                profile: this.getCurrentProfile()
            });

            return true;
        } catch (error) {
            this._state.lastError = error.message;
            logger.error(`Login failed: ${error.message}`, logger.CATEGORY.PANEL);

            eventBus.emit('profile:error', {
                action: 'login',
                error: error.message
            });

            return false;
        } finally {
            this._state.isLoading = false;
        }
    }

    /**
     * Logout current user
     */
    async logout() {
        try {
            await fetch(`${this._apiBase}/api/auth/logout`, {
                method: 'POST'
            });
        } catch (error) {
            // Ignore logout errors
        }

        const previousProfile = this._state.currentProfile;
        this._state.currentProfile = null;
        this._state.settings = { ...DEFAULT_SETTINGS };

        logger.info('Logged out', logger.CATEGORY.PANEL);

        eventBus.emit('profile:logout', {
            previousProfile
        });

        eventBus.emit('profile:changed', {
            profile: null
        });
    }

    /**
     * Load default profile (for auto-login)
     * @returns {Promise<boolean>} True if successful
     */
    async loadDefaultProfile() {
        this._state.isLoading = true;

        try {
            // Get list of profiles and use first one
            const response = await fetch(`${this._apiBase}/api/profiles`);
            if (!response.ok) throw new Error('Failed to fetch profiles');

            const data = await response.json();
            if (data.profiles && data.profiles.length > 0) {
                // Auto-select first profile (default)
                const profile = data.profiles[0];
                this._state.currentProfile = profile;

                logger.info(`Auto-loaded profile: ${profile.display_name}`, logger.CATEGORY.PANEL);

                // Load settings
                await this.loadSettings();

                eventBus.emit('profile:changed', {
                    profile: this.getCurrentProfile()
                });

                return true;
            }

            return false;
        } catch (error) {
            this._state.lastError = error.message;
            logger.warning(`Could not load default profile: ${error.message}`, logger.CATEGORY.PANEL);
            return false;
        } finally {
            this._state.isLoading = false;
        }
    }

    // ============================================
    // SETTINGS METHODS
    // ============================================

    /**
     * Load settings for current profile from backend
     * @returns {Promise<boolean>} True if successful
     */
    async loadSettings() {
        if (!this._state.currentProfile) {
            logger.warning('Cannot load settings: no profile', logger.CATEGORY.PANEL);
            return false;
        }

        try {
            const profileId = this._state.currentProfile.id;
            const response = await fetch(`${this._apiBase}/api/profiles/${profileId}/settings`);

            if (!response.ok) throw new Error('Failed to load settings');

            const data = await response.json();
            this._state.settings = {
                ...DEFAULT_SETTINGS,
                ...data.settings
            };

            logger.info('Profile settings loaded', logger.CATEGORY.PANEL);

            eventBus.emit('profile:settings:changed', {
                settings: this.getSettings()
            });

            return true;
        } catch (error) {
            this._state.lastError = error.message;
            logger.warning(`Settings load failed: ${error.message}`, logger.CATEGORY.PANEL);
            return false;
        }
    }

    /**
     * Save settings for current profile to backend
     * @param {Object} settingsUpdate - Settings to update (merged with existing)
     * @returns {Promise<boolean>} True if successful
     */
    async saveSettings(settingsUpdate = {}) {
        if (!this._state.currentProfile) {
            logger.warning('Cannot save settings: no profile', logger.CATEGORY.PANEL);
            return false;
        }

        try {
            // Merge updates with current settings
            this._state.settings = {
                ...this._state.settings,
                ...settingsUpdate
            };

            const profileId = this._state.currentProfile.id;
            const response = await fetch(`${this._apiBase}/api/profiles/${profileId}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: this._state.settings })
            });

            if (!response.ok) throw new Error('Failed to save settings');

            logger.success('Settings saved', logger.CATEGORY.PANEL);

            eventBus.emit('profile:settings:changed', {
                settings: this.getSettings()
            });

            return true;
        } catch (error) {
            this._state.lastError = error.message;
            logger.error(`Settings save failed: ${error.message}`, logger.CATEGORY.PANEL);
            return false;
        }
    }

    /**
     * Update a single setting (saves immediately)
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     * @returns {Promise<boolean>} True if successful
     */
    async updateSetting(key, value) {
        return this.saveSettings({ [key]: value });
    }

    /**
     * Reset settings to defaults
     * @returns {Promise<boolean>} True if successful
     */
    async resetSettings() {
        this._state.settings = { ...DEFAULT_SETTINGS };
        return this.saveSettings();
    }

    // ============================================
    // PROFILE MANAGEMENT
    // ============================================

    /**
     * Get all profiles
     * @returns {Promise<Array>} Array of profiles
     */
    async getProfiles() {
        try {
            const response = await fetch(`${this._apiBase}/api/profiles`);
            if (!response.ok) throw new Error('Failed to fetch profiles');

            const data = await response.json();
            return data.profiles || [];
        } catch (error) {
            this._state.lastError = error.message;
            logger.error(`Fetch profiles failed: ${error.message}`, logger.CATEGORY.PANEL);
            return [];
        }
    }

    /**
     * Create a new profile
     * @param {string} username - Username
     * @param {string} password - Password
     * @param {string} displayName - Display name
     * @returns {Promise<Object|null>} Created profile or null
     */
    async createProfile(username, password, displayName) {
        try {
            const response = await fetch(`${this._apiBase}/api/profiles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    password,
                    display_name: displayName
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Failed to create profile');
            }

            const data = await response.json();
            logger.success(`Profile created: ${username}`, logger.CATEGORY.PANEL);
            return data.profile;
        } catch (error) {
            this._state.lastError = error.message;
            logger.error(`Create profile failed: ${error.message}`, logger.CATEGORY.PANEL);
            return null;
        }
    }

    /**
     * Delete a profile
     * @param {number} profileId - Profile ID to delete
     * @returns {Promise<boolean>} True if successful
     */
    async deleteProfile(profileId) {
        try {
            const response = await fetch(`${this._apiBase}/api/profiles/${profileId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete profile');

            // If deleting current profile, logout
            if (this._state.currentProfile?.id === profileId) {
                await this.logout();
            }

            logger.success('Profile deleted', logger.CATEGORY.PANEL);
            return true;
        } catch (error) {
            this._state.lastError = error.message;
            logger.error(`Delete profile failed: ${error.message}`, logger.CATEGORY.PANEL);
            return false;
        }
    }

    // ============================================
    // ROLES (STUB)
    // ============================================

    /**
     * Get all roles
     * @returns {Promise<Array>} Array of roles
     */
    async getRoles() {
        try {
            const response = await fetch(`${this._apiBase}/api/roles`);
            if (!response.ok) throw new Error('Failed to fetch roles');

            const data = await response.json();
            this._state.roles = data.roles || [];
            return this._state.roles;
        } catch (error) {
            logger.warning(`Fetch roles failed: ${error.message}`, logger.CATEGORY.PANEL);
            return [];
        }
    }

    /**
     * Check if current user has permission (stub)
     * @param {string} permission - Permission to check
     * @returns {boolean} True if has permission
     */
    hasPermission(permission) {
        // Stub: always return true for now
        // Future: check role permissions
        return true;
    }

    // ============================================
    // UTILITIES
    // ============================================

    /**
     * Get state as JSON (for debugging/storage)
     * @returns {string} JSON representation of state
     */
    toJSON() {
        return JSON.stringify({
            currentProfile: this._state.currentProfile,
            settings: this._state.settings,
            isLoading: this._state.isLoading,
            lastError: this._state.lastError
        }, null, 2);
    }
}

// Export singleton instance
const profileState = new ProfileState();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
    window.profileState = profileState;
}

export default profileState;
