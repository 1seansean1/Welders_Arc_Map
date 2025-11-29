/**
 * Bootstrap Module - Application initialization orchestration
 *
 * DEPENDENCIES:
 * - All application modules
 *
 * Features:
 * - Ordered initialization sequence
 * - Error handling for init failures
 * - Mobile-responsive setup
 * - Debug helpers
 *
 * INITIALIZATION ORDER:
 * 1. Logger (diagnostic output)
 * 2. UI Components (control panel, time controls)
 * 3. Sensor data and controls
 * 4. Satellite data and controls
 * 5. Map (Leaflet + Deck.gl)
 * 6. Pane resizer and maximize button
 * 7. Mobile adjustments
 */

import logger from '../utils/logger.js';

// State modules
import uiState from '../state/uiState.js';
import sensorState from '../state/sensorState.js';
import satelliteState from '../state/satelliteState.js';
import timeState from '../state/timeState.js';
import profileState from '../state/profileState.js';
import analysisState from '../state/analysisState.js';

// Data modules
import websocketManager from '../data/websocket.js';

// UI modules
import { initializeControlPanel, togglePanel } from '../ui/controlPanel.js';
import { initializeTimeControls, initializeFlatpickr } from '../ui/timeControls.js';
import { initializeSensorTable } from '../ui/sensorTable.js';
import { initializeSatelliteTable } from '../ui/satelliteTable.js';
import { initializeWatchlistTable } from '../ui/watchlistTable.js';
import { initializeCatalogTable } from '../ui/catalogTable.js';
import { initializeLogPanel } from '../ui/logPanel.js';
import { initializeCurrentTimeDisplay } from '../ui/currentTimeDisplay.js';
import { initializeSettingsPanel } from '../ui/settingsPanel.js';
import { initializeMapTimeBar } from '../ui/mapTimeBar.js';
import { showLoginModal } from '../ui/modals.js';
import polarPlot from '../ui/polarPlot.js';

// Sensor & Satellite CRUD
import { initializeSensors, initializeSensorButtons, editSensor } from '../data/sensorCRUD.js';

// Test panel
import { initTestPanel } from '../ui/testPanel.js';
import {
    initializeSatellites,
    initializeSatelliteButtons,
    editSatellite,
    toggleSatelliteSelection,
    toggleSatelliteWatchlist
} from '../data/satelliteCRUD.js';

// Map modules
import { initializeLeaflet } from '../map/leaflet.js';
import { initializeDeckGL, updateDeckOverlay } from '../map/deckgl.js';
import { initializePaneResizer, initializeMapMaximize, initializeFitEarthButton } from '../map/interactions.js';

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize application
 * Called when DOM is loaded
 */
export function init() {
    // Initialize UI logger first
    logger.init();

    logger.info('Initializing Satellite Visualization System');
    logger.info(`Mobile device: ${uiState.isMobile()}`);
    logger.info(`Window size: ${window.innerWidth} x ${window.innerHeight}`);

    // Require login before initializing app
    requireLogin();
}

/**
 * Require user login before app initialization
 * Shows non-dismissible login modal
 */
function requireLogin() {
    showLoginModal(
        async ({ username, password }) => {
            const success = await profileState.login(username, password);
            if (success) {
                logger.success(`Logged in as ${username}`, logger.CATEGORY.PANEL);
                applyProfileSettings();
                initializeApp();
            }
            return success;
        },
        null,
        { dismissible: false }
    );
}

/**
 * Apply profile settings to UI components
 */
function applyProfileSettings() {
    const settings = profileState.getSettings();
    if (settings.theme) {
        import('../state/themeState.js').then(({ default: themeState }) => {
            themeState.setTheme(settings.theme);
        });
    }
    if (settings.glowEnabled !== undefined) timeState.setGlowEnabled(settings.glowEnabled);
    if (settings.glowSize !== undefined) timeState.setGlowSize(settings.glowSize);
    if (settings.glowIntensity !== undefined) timeState.setGlowIntensity(settings.glowIntensity);
    if (settings.glowFadeInMinutes !== undefined) timeState.setGlowFadeInMinutes(settings.glowFadeInMinutes);
    if (settings.glowFadeOutMinutes !== undefined) timeState.setGlowFadeOutMinutes(settings.glowFadeOutMinutes);
    if (settings.apexTickEnabled !== undefined) timeState.setApexTickEnabled(settings.apexTickEnabled);
    if (settings.apexTickPulseSpeed !== undefined) timeState.setApexTickPulseSpeed(settings.apexTickPulseSpeed);
    if (settings.apexTickPulseWidth !== undefined) timeState.setApexTickPulseWidth(settings.apexTickPulseWidth);
    if (settings.apexTickColor !== undefined) timeState.setApexTickColor(settings.apexTickColor);
    if (settings.apexTickOpacity !== undefined) timeState.setApexTickOpacity(settings.apexTickOpacity);
    if (settings.tailMinutes !== undefined) timeState.setTailMinutes(settings.tailMinutes);
    if (settings.headMinutes !== undefined) timeState.setHeadMinutes(settings.headMinutes);
    logger.info('Profile settings applied', logger.CATEGORY.PANEL);
}

/**
 * Initialize application components after login
 */
function initializeApp() {
    // Initialize control panel (expand/collapse, section switching)
    initializeControlPanel();

    // Initialize time controls with default values
    initializeTimeControls();

    // Initialize Flatpickr datetime pickers
    initializeFlatpickr();

    // Initialize sensor data and controls
    initializeSensors();
    initializeSensorButtons();
    initializeSensorTable({
        onEdit: editSensor,
        onMapUpdate: updateDeckOverlay
    });

    // Initialize satellite data and controls
    initializeSatellites();
    initializeSatelliteButtons();
    initializeSatelliteTable({
        onEdit: editSatellite,
        onMapUpdate: updateDeckOverlay
    });

    // Initialize catalog table (satellite catalogs with TLE data)
    initializeCatalogTable({
        onMapUpdate: updateDeckOverlay
    });

    // Initialize watchlist table (shows starred satellites with color assignment)
    initializeWatchlistTable({
        onMapUpdate: updateDeckOverlay
    });

    // Initialize Leaflet base map
    const map = initializeLeaflet();

    // Initialize Deck.gl overlay (if map loaded successfully)
    if (map) {
        requestAnimationFrame(() => {
            initializeDeckGL(map);
            requestAnimationFrame(() => {
                updateDeckOverlay();
                logger.success('Map and visualization layers loaded', logger.CATEGORY.MAP);
            });
        });
    } else {
        logger.warning('Map initialization failed', logger.CATEGORY.MAP);
    }

    // Initialize 4-pane resizable grid
    initializePaneResizer();

    // Initialize log panel resizer
    initializeLogPanel();

    // Initialize map maximize button
    initializeMapMaximize();

    // Initialize fit earth button (resize grid + fit)
    initializeFitEarthButton();

    // Initialize test panel (in Settings section)
    initTestPanel();

    // Initialize polar plot
    initializePolarPlot();

    // Initialize profile login/logout buttons
    initializeProfileControls();

    // On mobile, start with panel collapsed
    if (uiState.isMobile()) {
        togglePanel(false);
    }

    logger.success('Initialization complete', logger.CATEGORY.PANEL);
}

// ============================================
// POLAR PLOT INITIALIZATION
// ============================================

/**
 * Initialize polar plot panel and checkbox handler
 */
function initializePolarPlot() {
    // Initialize the canvas
    polarPlot.initialize('polar-plot-canvas');

    // Get DOM elements
    const checkbox = document.getElementById('analysis-polar-plot');
    const plotContainer = document.getElementById('polar-plot-container');
    const placeholder = document.getElementById('polar-plot-placeholder');

    if (!checkbox) {
        logger.warning('Polar plot checkbox not found', logger.CATEGORY.UI);
        return;
    }

    // Handle checkbox changes
    checkbox.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        analysisState.setPolarPlotEnabled(enabled);

        // Toggle visibility
        if (plotContainer) {
            plotContainer.style.display = enabled ? 'flex' : 'none';
        }
        if (placeholder) {
            placeholder.style.display = enabled ? 'none' : 'flex';
        }

        // Trigger polar plot rendering
        if (enabled) {
            polarPlot.setVisible(true);
        } else {
            polarPlot.setVisible(false);
            // Clear sensor selection when disabling
            analysisState.clearPolarViewSensor();
            updateDeckOverlay();
        }

        logger.log(`Polar plot ${enabled ? 'enabled' : 'disabled'}`, logger.CATEGORY.UI);
    });

    // Listen for sensor deselection to update map
    import('../events/eventBus.js').then(({ default: eventBus }) => {
        eventBus.on('analysis:sensor:deselected', () => {
            updateDeckOverlay();
        });
        eventBus.on('analysis:sensor:selected', () => {
            updateDeckOverlay();
        });
    });

    logger.diagnostic('Polar plot initialized', logger.CATEGORY.UI);
}

// ============================================
// GLOBAL EXPORTS
// ============================================

/**
 * Set up global window exports for HTML onclick handlers and debugging
 */
export function setupGlobalExports() {
    // Export functions globally for HTML onclick handlers
    window.editSatellite = editSatellite;
    window.toggleSatelliteSelection = toggleSatelliteSelection;
    window.toggleSatelliteWatchlist = toggleSatelliteWatchlist;

    // Export for use in other modules (if needed)
    window.SatelliteApp = {
        // State modules (read-only access)
        uiState,
        sensorState,
        satelliteState,
        timeState,
        profileState,
        // Functions
        togglePanel,
        fetchSatellites,
        websocketManager,
        editSatellite,
        toggleSatelliteSelection,
        toggleSatelliteWatchlist,
        // Debug helpers
        updateDeckOverlay,
        testSensors: () => {
            logger.info('Debug Info', logger.CATEGORY.SENSOR, {
                deckglReady: !!window.deckgl,
                totalSensors: sensorState.getSensorCount(),
                selectedSensors: sensorState.getSelectedCount()
            });
            logger.diagnostic('Sensor sample', logger.CATEGORY.SENSOR, {
                sample: JSON.stringify(sensorState.getAllSensors().slice(0, 3))
            });
            if (window.deckgl) {
                logger.success('Deck.gl is ready', logger.CATEGORY.SATELLITE);
                updateDeckOverlay();
            } else {
                logger.warning('Deck.gl not initialized yet', logger.CATEGORY.SATELLITE);
            }
        }
    };
}

// ============================================
// PROFILE CONTROLS
// ============================================

/**
 * Initialize profile login/logout controls in Settings panel and avatar button
 */
function initializeProfileControls() {
    // Settings panel elements
    const loginBtn = document.getElementById('profile-login-btn');
    const logoutBtn = document.getElementById('profile-logout-btn');
    const displayName = document.getElementById('profile-display-name');

    // Avatar button elements (bottom of control panel)
    const avatarBtn = document.getElementById('profile-avatar-btn');
    const avatarLetter = document.getElementById('profile-avatar-letter');
    const avatarName = document.getElementById('profile-avatar-name');
    const avatarRole = document.getElementById('profile-avatar-role');

    // Get first letter of name for avatar
    function getAvatarLetter(name) {
        if (!name) return '?';
        return name.charAt(0).toUpperCase();
    }

    // Update UI based on profile state
    function updateProfileUI() {
        const isLoggedIn = profileState.isLoggedIn();
        const name = profileState.getDisplayName() || profileState.getUsername();
        const role = profileState.getRole();

        // Update Settings panel
        if (displayName) {
            displayName.textContent = isLoggedIn ? name : 'Not logged in';
        }
        if (loginBtn) {
            loginBtn.style.display = isLoggedIn ? 'none' : 'inline-block';
        }
        if (logoutBtn) {
            logoutBtn.style.display = isLoggedIn ? 'inline-block' : 'none';
        }

        // Update Avatar button
        if (avatarLetter) {
            avatarLetter.textContent = isLoggedIn ? getAvatarLetter(name) : '?';
        }
        if (avatarName) {
            avatarName.textContent = isLoggedIn ? name : 'Not logged in';
        }
        if (avatarRole) {
            avatarRole.textContent = isLoggedIn ? role : 'guest';
        }
    }

    // Show login modal handler (for manual re-login)
    function handleShowLogin() {
        showLoginModal(
            async ({ username, password }) => {
                const success = await profileState.login(username, password);
                if (success) {
                    updateProfileUI();
                    applyProfileSettings();
                    logger.success(`Logged in as ${username}`, logger.CATEGORY.PANEL);
                }
                return success;
            },
            () => {
                logger.diagnostic('Login skipped', logger.CATEGORY.PANEL);
            }
        );
    }

    // Avatar button click - show login modal
    if (avatarBtn) {
        avatarBtn.addEventListener('click', handleShowLogin);
    }

    // Login button click (Settings panel)
    if (loginBtn) {
        loginBtn.addEventListener('click', handleShowLogin);
    }

    // Logout button click - requires re-login
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await profileState.logout();
            updateProfileUI();
            // Show login modal after logout (non-dismissible)
            showLoginModal(
                async ({ username, password }) => {
                    const success = await profileState.login(username, password);
                    if (success) {
                        updateProfileUI();
                        applyProfileSettings();
                        logger.success(`Logged in as ${username}`, logger.CATEGORY.PANEL);
                    }
                    return success;
                },
                null,
                { dismissible: false }
            );
        });
    }

    // Initial UI update
    updateProfileUI();

    // Listen for profile changes
    import('../events/eventBus.js').then(({ default: eventBus }) => {
        eventBus.on('profile:changed', updateProfileUI);
    });

    logger.diagnostic('Profile controls initialized', logger.CATEGORY.PANEL);
}

// ============================================
// API COMMUNICATION (Placeholder)
// ============================================

/**
 * Fetch satellite data from backend
 *
 * PERFORMANCE: Cached, paginated
 * MOBILE: Reduced payload size
 */
export async function fetchSatellites() {
    try {
        const response = await fetch('/api/satellites?limit=100');
        const data = await response.json();
        logger.success('Satellites loaded', logger.CATEGORY.DATA, { total: data.total });
        return data.satellites;
    } catch (error) {
        logger.error('Failed to fetch satellites', logger.CATEGORY.DATA, { error: error.message });
        return [];
    }
}
