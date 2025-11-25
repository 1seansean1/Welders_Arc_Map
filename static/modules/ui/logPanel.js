/**
 * Log Panel Module - Log panel vertical resize functionality
 *
 * DEPENDENCIES:
 * - logger: Diagnostic logging
 *
 * Features:
 * - Drag pill-shaped handle on top border of log panel
 * - Adjusts vertical split between content area and log panel
 * - Minimum/maximum constraints for usable layouts
 * - Touch events supported for mobile
 *
 * MOBILE BEHAVIOR:
 * - Touch-friendly drag handle
 * - Smooth drag experience on touch devices
 *
 * PERFORMANCE:
 * - O(1) flex percentage updates
 * - No re-renders, direct style updates
 * - Smooth 60fps drag experience
 */

import logger from '../utils/logger.js';

// ============================================
// LOG PANEL RESIZE
// ============================================

/**
 * Initialize log panel vertical resizer
 *
 * FUNCTIONALITY:
 * - Drag pill-shaped handle on top border of log panel
 * - Adjusts vertical split between content area and log panel
 * - Minimum 10% for either section (prevents unusable layouts)
 * - Maximum 90% for content area (ensures log remains accessible)
 * - Touch events supported for mobile
 *
 * PERFORMANCE:
 * - O(1) flex percentage updates
 * - No re-renders, direct style updates
 * - Smooth 60fps drag experience
 */
export function initializeLogPanel() {
    const bottomLeftPane = document.getElementById('pane-bottom-left');
    const contentArea = bottomLeftPane?.querySelector('.pane-content-area');
    const logArea = bottomLeftPane?.querySelector('.pane-log-area');
    const resizeHandle = document.getElementById('log-resize-handle');

    if (!bottomLeftPane || !contentArea || !logArea || !resizeHandle) {
        logger.warning('Log panel resizer elements not found', logger.CATEGORY.PANEL);
        return;
    }

    let isDragging = false;
    let currentLogHeight = 50; // Start at 50px (minimized)

    // Constraints for usable layouts
    const MIN_LOG_HEIGHT_PX = 50;  // Minimum pixels for log panel (1 row visible)
    const MIN_CONTENT_HEIGHT_PX = 50;  // Minimum pixels for content area above log panel
    const MAX_LOG_PERCENT = 90;  // Maximum 90% of pane height

    // Set initial log height to 50px (minimized)
    logArea.style.flex = `0 0 50px`;
    contentArea.style.flex = `1 1 auto`;

    /**
     * Start dragging
     */
    function handleDragStart(e) {
        isDragging = true;
        resizeHandle.classList.add('active');
        e.preventDefault();
    }

    /**
     * Handle drag movement
     * Updates log panel height in pixels (fixed height, independent of crosshair)
     * Enforces minimum log panel height (50px) and maximum (90% of pane)
     */
    function handleDragMove(e) {
        if (!isDragging) return;

        // Get current mouse/touch position
        let currentY;
        if (e.type === 'touchmove') {
            currentY = e.touches[0].clientY;
        } else {
            currentY = e.clientY;
        }

        // Calculate position relative to bottom-left pane
        const paneRect = bottomLeftPane.getBoundingClientRect();
        const relativeY = currentY - paneRect.top;

        // Calculate log height in pixels (distance from bottom)
        let logHeightPx = paneRect.height - relativeY;

        // Calculate maximum log height (90% of pane)
        const maxLogHeightPx = paneRect.height * (MAX_LOG_PERCENT / 100);

        // Calculate maximum log height based on minimum content area requirement
        const maxLogHeightByContent = paneRect.height - MIN_CONTENT_HEIGHT_PX;

        // Clamp to min/max constraints (respect both percentage and content area minimums)
        logHeightPx = Math.max(MIN_LOG_HEIGHT_PX, Math.min(maxLogHeightPx, maxLogHeightByContent, logHeightPx));

        // Update log area with fixed pixel height
        currentLogHeight = logHeightPx;
        logArea.style.flex = `0 0 ${logHeightPx}px`;
        // Content area takes remaining space
        contentArea.style.flex = `1 1 auto`;
    }

    /**
     * Stop dragging
     */
    function handleDragEnd() {
        if (!isDragging) return;

        isDragging = false;
        resizeHandle.classList.remove('active');

        logger.diagnostic(
            'Log panel resized',
            logger.CATEGORY.PANEL,
            { height: `${currentLogHeight.toFixed(0)}px` }
        );
    }

    // Mouse events
    resizeHandle.addEventListener('mousedown', handleDragStart);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    // Touch events (mobile)
    resizeHandle.addEventListener('touchstart', handleDragStart, { passive: false });
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);

    logger.success('Log panel resizer initialized', logger.CATEGORY.PANEL);
}
