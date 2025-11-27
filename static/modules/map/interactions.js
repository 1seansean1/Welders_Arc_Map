/**
 * Map Interactions Module - Pane resizer and map maximize functionality
 *
 * DEPENDENCIES:
 * - logger: Diagnostic logging
 * - resizeDeckCanvas: Deck.gl canvas resize function
 *
 * Features:
 * - 4-pane resizable grid with crosshair handle
 * - Map maximize/restore button
 * - Smooth drag experience
 * - Touch support for mobile
 *
 * DESIGN PHILOSOPHY:
 * - Simple resize constraints (user has freedom)
 * - Map intelligently adapts to new container size
 * - No complex calculations during drag (smooth performance)
 * - Map auto-adjusts view to prevent white space
 *
 * PERFORMANCE:
 * - Lightweight drag handling (just update grid percentages)
 * - Map optimization happens AFTER drag completes
 * - Debounced for smooth 60fps during resize
 *
 * MOBILE:
 * - Touch events supported
 * - Minimum pane size prevents unusable layouts
 */

import logger from '../utils/logger.js';
import { resizeDeckCanvas } from './deckgl.js';
import { enforceLogPanelConstraints } from '../ui/logPanel.js';

// ============================================
// PANE RESIZER
// ============================================

/**
 * Initialize 4-pane resizable grid with crosshair handle
 */
export function initializePaneResizer() {
    const mainContainer = document.getElementById('main-container');
    const verticalHandle = document.getElementById('grid-resize-vertical');
    const horizontalHandle = document.getElementById('grid-resize-horizontal');
    const crosshairHandle = document.getElementById('grid-resize-crosshair');

    if (!mainContainer || !verticalHandle || !horizontalHandle || !crosshairHandle) {
        logger.warning('Pane resizer elements not found', logger.CATEGORY.PANEL);
        return;
    }

    let isDragging = false;
    let activeHandle = null; // 'vertical', 'horizontal', or 'crosshair'
    let currentHorizontalPercent = 65; // Match CSS grid-template-columns: 65% 35%
    let currentVerticalPercent = 60;   // Match CSS grid-template-rows: 60% 40%

    // Simple constraints - user-friendly ranges
    const MIN_PERCENT = 25;  // Minimum 25% (enough space for content)
    const MAX_PERCENT = 75;  // Maximum 75% (leave space for other panes)

    /**
     * Update handle positions based on current grid percentages
     */
    function updateHandlePositions() {
        verticalHandle.style.left = `calc(${currentHorizontalPercent}% - 6px)`;
        horizontalHandle.style.top = `calc(${currentVerticalPercent}% - 6px)`;
        crosshairHandle.style.left = `calc(${currentHorizontalPercent}% - 10px)`;
        crosshairHandle.style.top = `calc(${currentVerticalPercent}% - 10px)`;
    }

    // Set initial positions
    updateHandlePositions();

    // Track which handles are being hovered
    let hoverState = {
        vertical: false,
        horizontal: false,
        crosshair: false
    };

    // Show/hide crosshair synchronized with gradient bars
    const updateCrosshairVisibility = () => {
        const shouldShow = hoverState.vertical || hoverState.horizontal || hoverState.crosshair || isDragging;
        if (shouldShow) {
            crosshairHandle.classList.add('visible');
        } else {
            crosshairHandle.classList.remove('visible');
        }
    };

    // Vertical handle events
    verticalHandle.addEventListener('mouseenter', () => {
        hoverState.vertical = true;
        updateCrosshairVisibility();
    });
    verticalHandle.addEventListener('mouseleave', () => {
        hoverState.vertical = false;
        setTimeout(updateCrosshairVisibility, 10); // Small delay to allow crosshair hover to register
    });

    // Horizontal handle events
    horizontalHandle.addEventListener('mouseenter', () => {
        hoverState.horizontal = true;
        updateCrosshairVisibility();
    });
    horizontalHandle.addEventListener('mouseleave', () => {
        hoverState.horizontal = false;
        setTimeout(updateCrosshairVisibility, 10);
    });

    // Crosshair handle events
    crosshairHandle.addEventListener('mouseenter', () => {
        hoverState.crosshair = true;
        updateCrosshairVisibility();
        // Show both gradient lines when hovering over crosshair
        verticalHandle.classList.add('active');
        horizontalHandle.classList.add('active');
    });
    crosshairHandle.addEventListener('mouseleave', () => {
        hoverState.crosshair = false;
        setTimeout(updateCrosshairVisibility, 10);
        // Hide gradient lines when leaving crosshair (unless dragging)
        if (!isDragging) {
            verticalHandle.classList.remove('active');
            horizontalHandle.classList.remove('active');
        }
    });

    /**
     * Update crosshair glow based on cursor proximity
     * Glow intensity increases as cursor gets closer to center
     */
    function updateCrosshairGlow(e) {
        if (!crosshairHandle.classList.contains('visible')) return;

        // Get crosshair center position
        const rect = crosshairHandle.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Calculate distance from cursor to center
        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Map distance to glow intensity (0 to 1)
        // Max distance for full effect is 100px, min is 0px
        const maxDistance = 100;
        const intensity = Math.max(0, Math.min(1, 1 - (distance / maxDistance)));

        // Update CSS variable
        crosshairHandle.style.setProperty('--glow-intensity', intensity);
    }

    // Track mouse movement for proximity glow
    mainContainer.addEventListener('mousemove', updateCrosshairGlow, { passive: true });

    /**
     * Optimize map view after resize to prevent white space
     * Uses Leaflet's intelligent fitBounds to fill container optimally
     */
    function optimizeMapView() {
        const map = window.leafletMap;
        if (!map) return;

        const mapContainer = document.getElementById('map-container');
        const bounds = map.getBounds();
        const center = map.getCenter();
        const zoom = map.getZoom();

        // Get container dimensions
        const rect = mapContainer.getBoundingClientRect();
        const aspectRatio = rect.width / rect.height;

        // Mercator projection: optimal aspect ratio varies by latitude and zoom
        // For global view (zoom < 3), aspect ratio should be ~2:1
        // For regional views, it's more flexible

        if (aspectRatio > 2.2) {
            // Container is too wide - zoom in slightly to fill horizontal space
            // This prevents horizontal white space on sides
            map.setView(center, zoom + 0.3, { animate: true, duration: 0.3 });
        } else if (aspectRatio < 0.8) {
            // Container is too tall - zoom out slightly to fill vertical space
            map.setView(center, Math.max(1, zoom - 0.2), { animate: true, duration: 0.3 });
        } else {
            // Aspect ratio is reasonable - just ensure size is correct
            map.invalidateSize({ animate: true, duration: 0.3 });
        }

        // CRITICAL: Also resize Deck.gl canvas to match new map dimensions
        resizeDeckCanvas();

        logger.diagnostic('Map optimized', logger.CATEGORY.MAP, {
            size: `${rect.width.toFixed(0)}×${rect.height.toFixed(0)}px`,
            ratio: aspectRatio.toFixed(2)
        });
    }

    /**
     * Start dragging vertical handle (horizontal resize)
     */
    function handleVerticalDragStart(e) {
        isDragging = true;
        activeHandle = 'vertical';
        verticalHandle.classList.add('active');
        updateCrosshairVisibility(); // Keep crosshair visible during drag
        e.preventDefault();
    }

    /**
     * Start dragging horizontal handle (vertical resize)
     */
    function handleHorizontalDragStart(e) {
        isDragging = true;
        activeHandle = 'horizontal';
        horizontalHandle.classList.add('active');
        updateCrosshairVisibility(); // Keep crosshair visible during drag
        e.preventDefault();
    }

    /**
     * Start dragging crosshair (both horizontal and vertical resize)
     */
    function handleCrosshairDragStart(e) {
        isDragging = true;
        activeHandle = 'crosshair';
        crosshairHandle.classList.add('active');
        verticalHandle.classList.add('active');
        horizontalHandle.classList.add('active');
        updateCrosshairVisibility(); // Keep crosshair visible during drag
        e.preventDefault();
    }

    /**
     * Handle drag movement for all handles
     */
    function handleDragMove(e) {
        if (!isDragging) return;

        // Get current mouse/touch position
        let currentX, currentY;
        if (e.type === 'touchmove') {
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
        } else {
            currentX = e.clientX;
            currentY = e.clientY;
        }

        // Calculate new position relative to container
        const containerRect = mainContainer.getBoundingClientRect();
        const relativeX = currentX - containerRect.left;
        const relativeY = currentY - containerRect.top;

        if (activeHandle === 'vertical') {
            // Vertical handle controls horizontal split
            let horizontalPercent = (relativeX / containerRect.width) * 100;
            horizontalPercent = Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, horizontalPercent));
            currentHorizontalPercent = horizontalPercent;
            mainContainer.style.gridTemplateColumns = `${horizontalPercent}% ${100 - horizontalPercent}%`;

            // CRITICAL: Keep Leaflet and Deck.gl synced during horizontal resize
            if (window.leafletMap) {
                window.leafletMap.invalidateSize({ animate: false });
            }
            resizeDeckCanvas();
        } else if (activeHandle === 'horizontal') {
            // Horizontal handle controls vertical split
            let verticalPercent = (relativeY / containerRect.height) * 100;
            verticalPercent = Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, verticalPercent));
            currentVerticalPercent = verticalPercent;
            mainContainer.style.gridTemplateRows = `${verticalPercent}% ${100 - verticalPercent}%`;

            // Dynamically shrink log panel if needed during drag
            enforceLogPanelConstraints();

            // CRITICAL: Keep Leaflet and Deck.gl synced during vertical resize
            // Without this, sensors disappear or appear at wrong locations
            if (window.leafletMap) {
                window.leafletMap.invalidateSize({ animate: false });
            }
            resizeDeckCanvas();
        } else if (activeHandle === 'crosshair') {
            // Crosshair controls both splits simultaneously
            let horizontalPercent = (relativeX / containerRect.width) * 100;
            let verticalPercent = (relativeY / containerRect.height) * 100;
            horizontalPercent = Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, horizontalPercent));
            verticalPercent = Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, verticalPercent));
            currentHorizontalPercent = horizontalPercent;
            currentVerticalPercent = verticalPercent;
            mainContainer.style.gridTemplateColumns = `${horizontalPercent}% ${100 - horizontalPercent}%`;
            mainContainer.style.gridTemplateRows = `${verticalPercent}% ${100 - verticalPercent}%`;

            // Dynamically shrink log panel if needed during drag
            enforceLogPanelConstraints();

            // CRITICAL: Keep Leaflet and Deck.gl synced during resize
            // Without this, sensors disappear or appear at wrong locations
            if (window.leafletMap) {
                window.leafletMap.invalidateSize({ animate: false });
            }
            resizeDeckCanvas();
        }

        // Update handle positions
        updateHandlePositions();
    }

    /**
     * Stop dragging
     */
    function handleDragEnd() {
        if (!isDragging) return;

        isDragging = false;
        verticalHandle.classList.remove('active');
        horizontalHandle.classList.remove('active');
        crosshairHandle.classList.remove('active');
        activeHandle = null;

        // Update crosshair visibility based on hover state
        updateCrosshairVisibility();

        // Optimize map view to fit new container size
        if (window.leafletMap) {
            setTimeout(() => {
                optimizeMapView();
            }, 50);
        }

        // Enforce log panel constraints after grid resize
        // This shrinks the log panel if the bottom pane got too small
        enforceLogPanelConstraints();

        logger.diagnostic(
            'Grid resized',
            logger.CATEGORY.PANEL,
            {
                horizontal: `${currentHorizontalPercent.toFixed(1)}%`,
                vertical: `${currentVerticalPercent.toFixed(1)}%`
            }
        );
    }

    // Mouse events for vertical handle
    verticalHandle.addEventListener('mousedown', handleVerticalDragStart);

    // Mouse events for horizontal handle
    horizontalHandle.addEventListener('mousedown', handleHorizontalDragStart);

    // Mouse events for crosshair handle
    crosshairHandle.addEventListener('mousedown', handleCrosshairDragStart);

    // Global move/up events
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    // Touch events (mobile)
    verticalHandle.addEventListener('touchstart', handleVerticalDragStart, { passive: false });
    horizontalHandle.addEventListener('touchstart', handleHorizontalDragStart, { passive: false });
    crosshairHandle.addEventListener('touchstart', handleCrosshairDragStart, { passive: false });
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);

    logger.success('Grid border resizers initialized');
    logger.info('Hover over borders to see crosshair, drag to resize');
}

// ============================================
// MAP MAXIMIZE
// ============================================

/**
 * Initialize map maximize/restore button
 *
 * FUNCTIONALITY:
 * - Toggles map between normal grid view and maximized fullscreen
 * - Keeps control panel visible in maximized mode
 * - Hides other 3 panes and crosshair when maximized
 * - Updates map size after toggle
 *
 * PERFORMANCE:
 * - CSS-only transitions (GPU-accelerated)
 * - Simple class toggle (no complex calculations)
 *
 * MOBILE:
 * - Touch-friendly button (44px on mobile)
 * - Works with responsive panel behavior
 */
export function initializeMapMaximize() {
    const maximizeBtn = document.getElementById('map-maximize-btn');
    const mainContainer = document.getElementById('main-container');
    const maximizeIcon = document.getElementById('maximize-icon');

    if (!maximizeBtn || !mainContainer) {
        logger.warning('Map maximize button not found', logger.CATEGORY.PANEL);
        return;
    }

    let isMaximized = false;

    maximizeBtn.addEventListener('click', () => {
        isMaximized = !isMaximized;

        if (isMaximized) {
            // Maximize: hide other panes, show map fullscreen
            mainContainer.classList.add('maximized');
            maximizeIcon.textContent = '⊡';  // Restore icon
            maximizeBtn.title = 'Restore map';
            logger.diagnostic('Map maximized', logger.CATEGORY.MAP);
        } else {
            // Restore: show all panes in grid
            mainContainer.classList.remove('maximized');
            maximizeIcon.textContent = '⛶';  // Maximize icon
            maximizeBtn.title = 'Maximize map';
            logger.diagnostic('Map restored', logger.CATEGORY.MAP);
        }

        // Update map size after transition
        if (window.leafletMap) {
            setTimeout(() => {
                window.leafletMap.invalidateSize({ animate: true });

                // CRITICAL: Also resize Deck.gl canvas to match new map dimensions
                resizeDeckCanvas();
            }, 50);
        }
    });

    logger.success('Map maximize button initialized', logger.CATEGORY.PANEL);
}

// ============================================
// FIT EARTH BUTTON
// ============================================

/**
 * Initialize Fit Earth button - zooms to show exactly one complete Earth
 *
 * FUNCTIONALITY:
 * - Sets optimal zoom level to show a single complete Earth
 * - Adjusts based on map container aspect ratio
 * - Centers on current view center
 *
 * OPTIMAL EARTH VIEW:
 * - For Web Mercator projection at zoom 1-2
 * - Wider containers need slightly higher zoom
 * - Taller containers need slightly lower zoom
 */
export function initializeFitEarthButton() {
    const fitEarthBtn = document.getElementById('map-fit-earth-btn');
    const mainContainer = document.getElementById('main-container');

    if (!fitEarthBtn || !mainContainer) {
        logger.warning('Fit Earth button not found', logger.CATEGORY.PANEL);
        return;
    }

    fitEarthBtn.addEventListener('click', () => {
        const map = window.leafletMap;
        if (!map) return;

        // Target aspect ratio for one complete Earth in Web Mercator
        // World is roughly 2:1 (360° longitude / ~170° latitude visible)
        const TARGET_ASPECT_RATIO = 2.0;

        // Get current main container dimensions
        const containerRect = mainContainer.getBoundingClientRect();
        const totalWidth = containerRect.width;
        const totalHeight = containerRect.height;

        // Calculate what horizontal % would give the map the target aspect ratio
        // We need: mapWidth / mapHeight = TARGET_ASPECT_RATIO
        // mapWidth = horizontalPercent * totalWidth
        // mapHeight = verticalPercent * totalHeight
        // So: (horizontalPercent * totalWidth) / (verticalPercent * totalHeight) = TARGET_ASPECT_RATIO

        // Start with current vertical split (or use 60% as default)
        const currentVerticalPercent = 60;
        const mapHeight = (currentVerticalPercent / 100) * totalHeight;

        // Calculate required map width for target aspect ratio
        const requiredMapWidth = mapHeight * TARGET_ASPECT_RATIO;

        // Calculate what horizontal % this represents
        let horizontalPercent = (requiredMapWidth / totalWidth) * 100;

        // Clamp to reasonable bounds (25% - 85%)
        horizontalPercent = Math.max(25, Math.min(85, horizontalPercent));

        // Apply the new grid layout
        mainContainer.style.gridTemplateColumns = `${horizontalPercent}% ${100 - horizontalPercent}%`;
        mainContainer.style.gridTemplateRows = `${currentVerticalPercent}% ${100 - currentVerticalPercent}%`;

        // Wait for layout to update, then fit the map
        setTimeout(() => {
            // Invalidate map size first
            map.invalidateSize({ animate: false });

            // Resize Deck.gl canvas
            resizeDeckCanvas();

            // Fit to world bounds (shows exactly one Earth)
            // Web Mercator limits: lat ~±85.05°, lon ±180°
            const worldBounds = L.latLngBounds(
                L.latLng(-60, -180),  // SW corner (cut off Antarctica)
                L.latLng(75, 180)     // NE corner (cut off Arctic)
            );

            map.fitBounds(worldBounds, {
                animate: true,
                duration: 0.5,
                padding: [10, 10]
            });

            // Get final dimensions for logging
            const mapContainer = document.getElementById('map-container');
            const finalRect = mapContainer.getBoundingClientRect();
            const finalAspect = finalRect.width / finalRect.height;

            logger.diagnostic('Fit to Earth view', logger.CATEGORY.MAP, {
                gridWidth: `${horizontalPercent.toFixed(1)}%`,
                mapSize: `${finalRect.width.toFixed(0)}x${finalRect.height.toFixed(0)}`,
                aspectRatio: finalAspect.toFixed(2)
            });
        }, 50);
    });

    logger.success('Fit Earth button initialized', logger.CATEGORY.PANEL);
}
