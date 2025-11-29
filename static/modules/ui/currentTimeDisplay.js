/**
 * Current Time Display Module - Shows UTC and simulation time on map overlay
 *
 * DEPENDENCIES:
 * - timeState: Current simulation time
 * - eventBus: Time change events
 * - logger: Diagnostic logging
 *
 * Features:
 * - Displays both UTC (wall clock) and Sim (simulation) time
 * - Positioned at top-left of map, adjacent to control panel
 * - Sim time turns orange when not matching UTC (simulation mode)
 * - Updates on time:changed events and 1-second interval for UTC
 */

import timeState from '../state/timeState.js';
import eventBus from '../events/eventBus.js';
import logger from '../utils/logger.js';
import { getLeafletMap } from '../map/leaflet.js';

// DOM Elements
const utcTimeElement = document.getElementById('utc-time-value');
const simTimeElement = document.getElementById('sim-time-value');
const zoomLevelElement = document.getElementById('zoom-level-value');
const sizeElement = document.getElementById('size-value');
const centerElement = document.getElementById('center-value');

// UTC update interval
let utcUpdateInterval = null;
let mapEventsBound = false;

/**
 * Format time for compact display
 * Format: DDMMMYYYY HH:MM:SS UTC (e.g., "27NOV2025 14:30:00 UTC")
 * @param {Date} date - Date to format
 * @returns {string} Formatted time string
 */
function formatTimeCompact(date, includeDate = false) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return includeDate ? '---------- --:--:-- UTC' : '--:--:--';
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');

    if (includeDate) {
        return `${day}-${month}-${year} ${hours}:${minutes}:${seconds} UTC`;
    }
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Format time offset as T+/-XXX
 * @param {number} offsetMinutes - Offset in minutes (positive = future, negative = past)
 * @returns {string} Formatted offset string
 */
function formatTimeOffset(offsetMinutes) {
    if (Math.abs(offsetMinutes) < 1) {
        return '';
    }
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absMinutes = Math.abs(Math.round(offsetMinutes));

    if (absMinutes < 60) {
        return `(T${sign}${absMinutes}m)`;
    } else if (absMinutes < 1440) {
        const hours = Math.floor(absMinutes / 60);
        const mins = absMinutes % 60;
        return mins > 0 ? `(T${sign}${hours}h${mins}m)` : `(T${sign}${hours}h)`;
    } else {
        const days = Math.floor(absMinutes / 1440);
        const hours = Math.floor((absMinutes % 1440) / 60);
        return hours > 0 ? `(T${sign}${days}d${hours}h)` : `(T${sign}${days}d)`;
    }
}

/**
 * Check if simulation time is in sync with UTC (within 2 seconds)
 * @returns {boolean} True if in sync
 */
function isSimInSync() {
    const simTime = timeState.getCurrentTime();
    const utcTime = new Date();
    const diffMs = Math.abs(simTime.getTime() - utcTime.getTime());
    return diffMs < 2000;  // 2 second tolerance
}

/**
 * Update both UTC and SIM displays simultaneously
 * Uses a single timestamp to ensure perfect sync
 */
/**
 * Update zoom level display
 */
function updateZoomDisplay() {
    const map = getLeafletMap();
    if (zoomLevelElement && map) {
        const zoom = map.getZoom();
        zoomLevelElement.textContent = zoom.toFixed(1);
    }
}

/**
 * Update canvas size display
 */
function updateSizeDisplay() {
    if (sizeElement) {
        const mapContainer = document.getElementById('map-container');
        if (mapContainer) {
            const rect = mapContainer.getBoundingClientRect();
            sizeElement.textContent = `${Math.round(rect.width)}x${Math.round(rect.height)}`;
        }
    }
}

/**
 * Update center lat/lon display
 */
function updateCenterDisplay() {
    const map = getLeafletMap();
    if (centerElement && map) {
        const center = map.getCenter();
        const lat = center.lat.toFixed(2);
        const lon = center.lng.toFixed(2);
        centerElement.textContent = `${lat}, ${lon}`;
    }
}

/**
 * Update all map-related displays (zoom, size, center)
 */
function updateMapDisplays() {
    updateZoomDisplay();
    updateSizeDisplay();
    updateCenterDisplay();
}

function updateTimeDisplay() {
    const utcTime = new Date();  // Capture once for sync
    const simTime = timeState.getCurrentTime();

    // Update UTC display
    if (utcTimeElement) {
        utcTimeElement.textContent = formatTimeCompact(utcTime, true);
    }

    // Update SIM display
    if (simTimeElement) {
        const timeText = formatTimeCompact(simTime, true);
        const offsetMinutes = (simTime.getTime() - utcTime.getTime()) / 60000;
        const offsetText = formatTimeOffset(offsetMinutes);

        simTimeElement.textContent = offsetText ? `${timeText} ${offsetText}` : timeText;

        // Add/remove sim-mode class based on sync status
        const diffMs = Math.abs(simTime.getTime() - utcTime.getTime());
        const isInSync = diffMs < 2000;

        if (isInSync) {
            simTimeElement.classList.remove('sim-mode');
        } else {
            simTimeElement.classList.add('sim-mode');
        }
    }
}


/**
 * Bind map events when map becomes available
 */
function bindMapEvents() {
    if (mapEventsBound) return;

    const map = getLeafletMap();
    if (!map) return;

    map.on('zoomend', updateMapDisplays);
    map.on('zoom', updateMapDisplays);
    map.on('moveend', updateCenterDisplay);
    map.on('move', updateCenterDisplay);

    // Listen for resize events on the map container
    const mapContainer = document.getElementById('map-container');
    if (mapContainer) {
        const resizeObserver = new ResizeObserver(() => {
            updateSizeDisplay();
        });
        resizeObserver.observe(mapContainer);
    }

    mapEventsBound = true;
    updateMapDisplays();
    logger.diagnostic('Map display events bound', logger.CATEGORY.UI);
}

/**
 * Initialize the current time display
 */
export function initializeCurrentTimeDisplay() {
    if (!utcTimeElement && !simTimeElement) {
        logger.warning('Time display elements not found', logger.CATEGORY.UI);
        return;
    }

    // Initial update
    updateTimeDisplay();

    // Start unified update interval (every second) - updates both UTC and SIM together
    if (utcUpdateInterval) {
        clearInterval(utcUpdateInterval);
    }
    utcUpdateInterval = setInterval(updateTimeDisplay, 1000);

    // Subscribe to time changes for immediate SIM updates
    eventBus.on('time:changed', () => {
        updateTimeDisplay();
    });

    // Also update when time is applied
    eventBus.on('time:applied', () => {
        updateTimeDisplay();
    });

    // Try to bind map events immediately
    bindMapEvents();

    // If map not ready, listen for map:ready event and also retry periodically
    if (!mapEventsBound) {
        eventBus.on('map:ready', bindMapEvents);

        // Retry binding every 500ms until successful (max 10 attempts)
        let attempts = 0;
        const retryInterval = setInterval(() => {
            attempts++;
            if (mapEventsBound || attempts >= 10) {
                clearInterval(retryInterval);
                return;
            }
            bindMapEvents();
        }, 500);
    }

    logger.success('Time display initialized (UTC + Sim synced)', logger.CATEGORY.UI);
}

// Auto-initialize when module loads
initializeCurrentTimeDisplay();

export default {
    updateTimeDisplay,
    initializeCurrentTimeDisplay,
    updateMapDisplays
};
