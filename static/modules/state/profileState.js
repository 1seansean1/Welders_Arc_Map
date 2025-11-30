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
 * All user preferences are stored here and synced to backend
 */
const DEFAULT_SETTINGS = {
    // ============================================
    // APPEARANCE
    // ============================================
    theme: 'dark', // 'dark' or 'light'

    // ============================================
    // MAP VIEW
    // ============================================
    mapCenter: [0, 0],      // [lon, lat]
    mapZoom: 2,
    canvasWidth: 1920,      // Map canvas width in pixels
    canvasHeight: 1080,     // Map canvas height in pixels

    // ============================================
    // UI LAYOUT
    // ============================================
    panelExpanded: true,
    activeSection: 'satellites', // 'satellites', 'sensors', 'settings', etc.
    logPanelHeight: 150,

    // ============================================
    // GROUND TRACK SETTINGS
    // ============================================
    tailMinutes: 45,    // Minutes of track behind satellite (0-90)
    headMinutes: 0,     // Minutes of track ahead of satellite (0-90)

    // ============================================
    // GLOW DOT SETTINGS (equator crossing effects)
    // ============================================
    glowEnabled: true,
    glowSize: 1.0,           // Size multiplier (0.2-3.0)
    glowIntensity: 1.0,      // Brightness multiplier (0.1-2.0)
    glowFadeInMinutes: 5,    // Fade in duration (1-30 minutes)
    glowFadeOutMinutes: 5,   // Fade out duration (1-30 minutes)

    // ============================================
    // APEX TICK SETTINGS (latitude indicator)
    // ============================================
    apexTickEnabled: true,
    apexTickPulseSpeed: 1.0,   // Cycles per second (0.5-5.0)
    apexTickPulseWidth: 3.0,   // Degrees latitude (1-10)
    apexTickColor: '#ff6600',  // Hex color
    apexTickOpacity: 0.8,      // Opacity (0.1-1.0)

    // ============================================
    // SELECTED ITEMS (stored as IDs)
    // ============================================
    selectedSatellites: [],
    selectedSensors: [],
    activeWatchlistId: null,
    polarViewSensorId: null,   // Sensor selected for polar view

    // ============================================
    // VISIBILITY SETTINGS
    // ============================================
    visibleCatalogs: [],       // Catalog IDs with visibility enabled
    visibleWatchlists: [],     // Watchlist IDs with visibility enabled

    // ============================================
    // FUTURE: Authentik OAuth settings (stub)
    // ============================================
    // authProvider: null,     // 'local' or 'authentik'
    // authentikToken: null,   // OAuth token from Authentik

    // ============================================
    // FUTURE: Session settings (stub)
    // ============================================
    // sessionTimeout: null,   // Session timeout in minutes (null = no timeout)
    // lastActivity: null,     // Timestamp of last activity
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
     * Get headers with profile information for API requests
     * Used for backend logging to identify which profile made each request
     * @param {Object} additionalHeaders - Additional headers to include
     * @returns {Object} Headers object with profile info
     */
    getRequestHeaders(additionalHeaders = {}) {
        const headers = { ...additionalHeaders };
        if (this._state.currentProfile) {
            headers['X-Profile-ID'] = String(this._state.currentProfile.id);
            headers['X-Username'] = this._state.currentProfile.username || 'anonymous';
        }
        return headers;
    }

    /**
     * Wrapper for fetch that automatically includes profile headers
     * @param {string} url - URL to fetch
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} Fetch response
     */
    async fetchWithProfile(url, options = {}) {
        const headers = this.getRequestHeaders(options.headers || {});
        return fetch(url, { ...options, headers });
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
                method: 'POST',
                headers: this.getRequestHeaders()
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
            const response = await fetch(`${this._apiBase}/api/profiles`, { headers: this.getRequestHeaders() });
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
            const response = await fetch(`${this._apiBase}/api/profiles/${profileId}/settings`, { headers: this.getRequestHeaders() });

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
                headers: this.getRequestHeaders({ 'Content-Type': 'application/json' }),
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
            const response = await fetch(`${this._apiBase}/api/profiles`, { headers: this.getRequestHeaders() });
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
                headers: this.getRequestHeaders({ 'Content-Type': 'application/json' }),
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
                method: 'DELETE',
                headers: this.getRequestHeaders()
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
    // AUTHENTIK OAUTH (STUB - Future Implementation)
    // ============================================

    /**
     * Initialize Authentik OAuth login flow
     * STUB: To be implemented when Authentik integration is ready
     * 
     * @param {string} authentikUrl - Authentik server URL
     * @param {string} clientId - OAuth client ID
     * @returns {Promise<boolean>} True if redirect initiated
     */
    async loginWithAuthentik(authentikUrl, clientId) {
        // STUB: Future implementation will:
        // 1. Redirect to Authentik login page
        // 2. Handle OAuth callback with authorization code
        // 3. Exchange code for tokens
        // 4. Create/update local profile with Authentik user info
        logger.warning('Authentik OAuth not yet implemented', logger.CATEGORY.PANEL);
        return false;
    }

    /**
     * Handle Authentik OAuth callback
     * STUB: To be implemented when Authentik integration is ready
     * 
     * @param {string} authorizationCode - OAuth authorization code from callback
     * @returns {Promise<boolean>} True if login successful
     */
    async handleAuthentikCallback(authorizationCode) {
        // STUB: Future implementation
        logger.warning('Authentik callback handler not yet implemented', logger.CATEGORY.PANEL);
        return false;
    }

    /**
     * Refresh Authentik OAuth token
     * STUB: To be implemented when Authentik integration is ready
     * 
     * @returns {Promise<boolean>} True if token refreshed
     */
    async refreshAuthentikToken() {
        // STUB: Future implementation
        return false;
    }

    // ============================================
    // SESSION MANAGEMENT (STUB - Future Implementation)
    // ============================================

    /**
     * Start session timeout monitoring
     * STUB: To be implemented when session timeout feature is ready
     * 
     * @param {number} timeoutMinutes - Session timeout in minutes
     */
    startSessionTimeout(timeoutMinutes) {
        // STUB: Future implementation will:
        // 1. Store timeout duration
        // 2. Start activity monitoring
        // 3. Auto-logout after inactivity
        logger.diagnostic('Session timeout not yet implemented', logger.CATEGORY.PANEL);
    }

    /**
     * Reset session activity timer
     * STUB: To be implemented when session timeout feature is ready
     */
    resetSessionActivity() {
        // STUB: Future implementation will reset the inactivity timer
    }

    /**
     * Stop session timeout monitoring
     * STUB: To be implemented when session timeout feature is ready
     */
    stopSessionTimeout() {
        // STUB: Future implementation
    }

    /**
     * Check if session has expired
     * STUB: To be implemented when session timeout feature is ready
     * 
     * @returns {boolean} True if session expired
     */
    isSessionExpired() {
        // STUB: Always returns false until implemented
        return false;
    }

    // ============================================
    // MULTI-USER (STUB - Future Implementation)
    // ============================================

    /**
     * Switch to a different user profile
     * STUB: To be implemented for multi-user support
     * 
     * @param {number} profileId - Profile ID to switch to
     * @returns {Promise<boolean>} True if switch successful
     */
    async switchProfile(profileId) {
        // STUB: Future implementation will:
        // 1. Save current profile settings
        // 2. Load new profile and its settings
        // 3. Apply new settings to UI
        logger.warning('Profile switching not yet implemented', logger.CATEGORY.PANEL);
        return false;
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
            const response = await fetch(`${this._apiBase}/api/roles`, { headers: this.getRequestHeaders() });
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
