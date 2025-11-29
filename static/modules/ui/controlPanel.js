/**
 * Control Panel Module - Panel expand/collapse and section switching
 *
 * DEPENDENCIES:
 * - uiState: Panel expansion state
 * - logger: Diagnostic logging
 *
 * Features:
 * - Panel expand/collapse with smooth animations
 * - Section switching (time, sensors, satellites, logs)
 * - Click outside to collapse (desktop only)
 * - Touch event support for mobile
 * - Active button highlighting
 * - Integration with Flatpickr calendars (prevents collapse when calendar closes)
 *
 * MOBILE BEHAVIOR:
 * - Touch event support
 * - Explicit collapse button required (no click outside)
 * - Touch feedback on navigation buttons
 */

import uiState from '../state/uiState.js';
import logger from '../utils/logger.js';

// ============================================
// STATE
// ============================================

/**
 * Flag to prevent panel collapse when Flatpickr calendar closes
 * Set to true when a calendar closes, consumed by click handler
 */
let calendarJustClosed = false;

/**
 * Timestamp of last nav button click to debounce double-clicks
 * Prevents double-click from toggling panel twice (collapse then expand)
 */
let lastNavClickTime = 0;
const NAV_CLICK_DEBOUNCE_MS = 300;

// DOM element references (initialized in init())
let panel = null;
let collapseBtn = null;
let navButtons = null;

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Toggle panel expand/collapse
 * Uses uiState module to manage state and emit events
 *
 * @param {boolean|null} forceState - Force specific state (true=expand, false=collapse, null=toggle)
 *
 * MOBILE: Uses CSS transform for 60fps animation
 */
function togglePanel(forceState = null) {
    const newState = forceState !== null ? forceState : !uiState.isPanelExpanded();
    uiState.setPanelExpanded(newState);

    if (uiState.isPanelExpanded()) {
        panel.classList.add('expanded');
    } else {
        panel.classList.remove('expanded');

        // Clear nav button highlighting when panel collapses
        navButtons.forEach(btn => btn.classList.remove('active'));
    }

    // Update collapse button title (icons toggle via CSS)
    collapseBtn.title = uiState.isPanelExpanded() ? 'Collapse panel' : 'Expand panel';
}

/**
 * Switch content section
 * Hides all sections except the selected one
 *
 * @param {string} section - Section name ('time', 'sensors', 'satellites', 'logs')
 */
function switchContent(section) {
    const allSections = document.querySelectorAll('[id^="content-"]');
    allSections.forEach(s => s.style.display = 'none');

    const targetSection = document.getElementById(`content-${section}`);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
}

/**
 * Click outside panel to collapse (desktop only)
 * MOBILE: User must click collapse button explicitly
 *
 * NOTE: Also handles clicks on Deck.gl canvas element
 * NOTE: Ignores the click that closes a Flatpickr calendar (panel stays open)
 *
 * @param {Event} e - Click or touch event
 */
function handleClickOutside(e) {
    // Don't collapse panel if clicking on Flatpickr calendar
    if (e.target.closest('.flatpickr-calendar')) {
        return;
    }

    // Don't collapse panel if a calendar just closed (this click closed it)
    if (calendarJustClosed) {
        calendarJustClosed = false;
        return;
    }

    // Check if click is outside the panel
    if (!panel.contains(e.target) && uiState.isPanelExpanded() && !uiState.isMobile()) {
        togglePanel(false);
    }
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Panel click handler - expand when clicking on collapsed panel
 * MOBILE: Works with touch events
 */
function handlePanelClick(e) {
    // Only expand if panel is collapsed and not clicking a button
    if (!uiState.isPanelExpanded() && !e.target.closest('button')) {
        togglePanel(true);
    }
}

/**
 * Collapse button click handler
 */
function handleCollapseClick(e) {
    e.stopPropagation(); // Prevent panel click event
    togglePanel();
}

/**
 * Navigation button click handler
 * Switches active section and updates content area
 *
 * MOBILE: When panel is collapsed, clicking button expands panel
 * MOBILE: When panel is expanded, clicking button switches sections
 *
 * @param {Event} e - Click event
 * @param {string} section - Section name from data-section attribute
 */
function handleNavButtonClick(e, section) {
    e.stopPropagation(); // Prevent any parent handlers

    // Debounce to prevent double-click from toggling twice
    const now = Date.now();
    if (now - lastNavClickTime < NAV_CLICK_DEBOUNCE_MS) {
        return;
    }
    lastNavClickTime = now;

    const wasExpanded = uiState.isPanelExpanded();

    // If panel is collapsed, expand it
    if (!wasExpanded) {
        togglePanel(true);
    }

    // If clicking the already-active section while panel was expanded, collapse the panel
    if (section === uiState.getActiveSection() && wasExpanded) {
        togglePanel(false);
        return;
    }

    // Update active button
    navButtons.forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');

    // Switch content
    switchContent(section);

    uiState.setActiveSection(section);
}

/**
 * Touch start handler for navigation buttons (mobile hover effect)
 */
function handleNavTouchStart(btn) {
    btn.style.background = 'var(--bg-tertiary)';
}

/**
 * Touch end handler for navigation buttons (remove hover effect)
 */
function handleNavTouchEnd(btn) {
    setTimeout(() => {
        if (!btn.classList.contains('active')) {
            btn.style.background = 'transparent';
        }
    }, 150);
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize control panel
 * Sets up event listeners and initial state
 *
 * Should be called once during application initialization
 */
export function initializeControlPanel() {
    // Get DOM element references
    panel = document.getElementById('control-panel');
    collapseBtn = document.getElementById('collapse-btn');
    navButtons = document.querySelectorAll('.nav-btn');

    if (!panel || !collapseBtn || !navButtons.length) {
        logger.error('Control panel DOM elements not found', logger.CATEGORY.SYSTEM);
        return;
    }

    // Panel click listener - expand when clicking on collapsed panel
    panel.addEventListener('click', handlePanelClick);

    // Collapse button click listener
    collapseBtn.addEventListener('click', handleCollapseClick);

    // Click outside listener DISABLED - user must use collapse button
    // document.addEventListener('click', handleClickOutside);

    // Navigation button click handlers
    navButtons.forEach(btn => {
        const section = btn.dataset.section;

        btn.addEventListener('click', (e) => handleNavButtonClick(e, section));

        // MOBILE: Add hover effect on touch
        btn.addEventListener('touchstart', () => handleNavTouchStart(btn), { passive: true });
        btn.addEventListener('touchend', () => handleNavTouchEnd(btn), { passive: true });
    });

    logger.success('Control panel initialized', logger.CATEGORY.SYSTEM);
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Set calendar just closed flag
 * Called by time controls module when Flatpickr calendar closes
 * Prevents panel from collapsing when calendar closes
 */
export function setCalendarJustClosed() {
    calendarJustClosed = true;
}

/**
 * Export for direct access if needed
 */
export { togglePanel, switchContent };
