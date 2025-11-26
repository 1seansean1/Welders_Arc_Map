/**
 * Satellite Visualization System - Entry Point
 *
 * This is the main entry point for the application.
 * All functionality has been modularized into separate files.
 *
 * ARCHITECTURE:
 * ├── modules/
 * │   ├── utils/          # Utilities (logger, time, geometry, validation)
 * │   ├── events/         # Event bus for decoupled communication
 * │   ├── state/          # State management (ui, sensors, satellites, time)
 * │   ├── data/           # Data operations (propagation, websocket, CRUD)
 * │   ├── ui/             # UI components (panels, modals, tables)
 * │   ├── map/            # Map visualization (Leaflet, Deck.gl, interactions)
 * │   └── init/           # Initialization and bootstrap
 *
 * PERFORMANCE TARGETS:
 * - 60 FPS rendering
 * - <16ms frame time
 * - Smooth panel animations (CSS transform, GPU-accelerated)
 *
 * MOBILE COMPATIBILITY:
 * - Touch event support for panel interactions
 * - Responsive breakpoints (768px tablet, 480px mobile)
 * - Panel overlays map on mobile instead of shifting
 * - Reduced update frequency on mobile to save battery
 * - Touch-friendly button sizes (44x44px minimum)
 */

// ============================================
// BOOTSTRAP
// ============================================

import { init, setupGlobalExports } from './modules/init/bootstrap.js';

// ============================================
// ERROR HANDLING
// ============================================

/**
 * Global error handler for uncaught errors
 */
window.addEventListener('error', (event) => {
    console.error('[SatelliteApp] Uncaught error:', event.error);
});

/**
 * Global handler for unhandled promise rejections
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('[SatelliteApp] Unhandled promise rejection:', event.reason);
});

// ============================================
// INITIALIZATION
// ============================================

/**
 * Start the application
 */
function startApp() {
    try {
        // Set up global exports for HTML onclick handlers
        setupGlobalExports();

        // Initialize application
        init();
    } catch (error) {
        console.error('[SatelliteApp] Initialization failed:', error);
    }
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
