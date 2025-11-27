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

// Data modules
import websocketManager from '../data/websocket.js';

// UI modules
import { initializeControlPanel, togglePanel } from '../ui/controlPanel.js';
import { initializeTimeControls, initializeFlatpickr } from '../ui/timeControls.js';
import { initializeSensorTable } from '../ui/sensorTable.js';
import { initializeSatelliteTable } from '../ui/satelliteTable.js';
import { initializeLogPanel } from '../ui/logPanel.js';
import { initializeCurrentTimeDisplay } from '../ui/currentTimeDisplay.js';
import { initializeSettingsPanel } from '../ui/settingsPanel.js';
import { initializeMapTimeBar } from '../ui/mapTimeBar.js';

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
    logger.info(`Window size: ${window.innerWidth} × ${window.innerHeight}`);

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

    // Initialize Leaflet base map
    const map = initializeLeaflet();

    // Initialize Deck.gl overlay (if map loaded successfully)
    if (map) {
        // Leaflet map is ready immediately (no 'load' event needed)
        // Wait a frame to ensure DOM is fully updated
        requestAnimationFrame(() => {
            initializeDeckGL(map);

            // CRITICAL: Call updateDeckOverlay() to render sensor layers
            // Without this, sensors with selected=true won't appear until user toggles checkbox
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

    // Initialize fit earth button
    initializeFitEarthButton();

    // Initialize test panel (in Settings section)
    initTestPanel();

    // On mobile, start with panel collapsed
    if (uiState.isMobile()) {
        togglePanel(false);
    }

    logger.success('Initialization complete', logger.CATEGORY.PANEL);
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
