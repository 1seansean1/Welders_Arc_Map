/**
 * Theme State Module - Manages light/dark theme preference
 *
 * DEPENDENCIES: eventBus.js, logger.js
 * PATTERN: Encapsulated state with localStorage persistence
 *
 * Features:
 * - Theme preference state (light/dark)
 * - localStorage persistence across sessions
 * - Event emissions on theme changes
 * - Applies theme to document on init and change
 *
 * Events Emitted:
 * - theme:changed - When theme changes (payload: { theme: 'light'|'dark' })
 *
 * Usage:
 *   import themeState from './modules/state/themeState.js';
 *
 *   // Get current theme
 *   const theme = themeState.getTheme();  // 'light' or 'dark'
 *
 *   // Toggle theme
 *   themeState.toggleTheme();
 *
 *   // Set specific theme
 *   themeState.setTheme('light');
 */

import eventBus from '../events/eventBus.js';
import logger from '../utils/logger.js';

const STORAGE_KEY = 'wa_map_theme';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

/**
 * ThemeState class - Encapsulates theme state management
 */
class ThemeState {
    constructor() {
        // Load saved theme or default to dark
        this._theme = this._loadSavedTheme();

        // Apply theme to document immediately
        this._applyTheme(this._theme);

        logger.log(`Theme State initialized: ${this._theme}`, logger.CATEGORY.SYSTEM);
    }

    /**
     * Load saved theme from localStorage
     * @returns {string} 'light' or 'dark'
     */
    _loadSavedTheme() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === THEME_LIGHT || saved === THEME_DARK) {
                return saved;
            }
        } catch (e) {
            logger.warning('Failed to load theme from localStorage', logger.CATEGORY.SYSTEM);
        }
        return THEME_DARK; // Default to dark
    }

    /**
     * Save theme to localStorage
     * @param {string} theme - 'light' or 'dark'
     */
    _saveTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            logger.warning('Failed to save theme to localStorage', logger.CATEGORY.SYSTEM);
        }
    }

    /**
     * Apply theme to document
     * @param {string} theme - 'light' or 'dark'
     */
    _applyTheme(theme) {
        if (theme === THEME_LIGHT) {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    /**
     * Get current theme
     * @returns {string} 'light' or 'dark'
     */
    getTheme() {
        return this._theme;
    }

    /**
     * Check if current theme is light
     * @returns {boolean}
     */
    isLightTheme() {
        return this._theme === THEME_LIGHT;
    }

    /**
     * Check if current theme is dark
     * @returns {boolean}
     */
    isDarkTheme() {
        return this._theme === THEME_DARK;
    }

    /**
     * Set theme
     * @param {string} theme - 'light' or 'dark'
     */
    setTheme(theme) {
        if (theme !== THEME_LIGHT && theme !== THEME_DARK) {
            logger.warning(`Invalid theme: ${theme}`, logger.CATEGORY.SYSTEM);
            return;
        }

        if (theme === this._theme) {
            return; // No change
        }

        this._theme = theme;
        this._saveTheme(theme);
        this._applyTheme(theme);

        logger.log(`Theme changed to: ${theme}`, logger.CATEGORY.UI);
        eventBus.emit('theme:changed', { theme });
    }

    /**
     * Toggle between light and dark themes
     * @returns {string} The new theme
     */
    toggleTheme() {
        const newTheme = this._theme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
        this.setTheme(newTheme);
        return newTheme;
    }
}

// Create singleton instance
const themeState = new ThemeState();

// Make available globally for testing
if (typeof window !== 'undefined') {
    window.themeState = themeState;
}

export default themeState;
