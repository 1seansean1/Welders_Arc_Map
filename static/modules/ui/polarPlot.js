/**
 * Polar Plot Module - Sky view visualization for satellite tracking
 *
 * DEPENDENCIES: analysisState.js, sensorState.js, satelliteState.js, listState.js, timeState.js, geometry.js, propagation.js, eventBus.js, logger.js
 * PATTERN: Canvas-based rendering with event-driven updates
 *
 * Features:
 * - Circular polar plot (azimuth/elevation sky view)
 * - Sky tracks showing satellite pass arcs (using head/tail minutes)
 * - Real-time satellite position display with glow
 * - Direction chevrons showing satellite travel direction
 * - Click-to-select integration with satellite table
 * - Color coding: grey/red/blue (watchColor), orange (active row)
 * - Sensor-centric view from selected ground station
 *
 * Polar Coordinate System:
 * - Center = zenith (90° elevation)
 * - Edge = horizon (0° elevation)
 * - North (0° azimuth) = top
 * - Angles increase clockwise (East = 90°, South = 180°, West = 270°)
 */

import eventBus from '../events/eventBus.js';
import logger from '../utils/logger.js';
import analysisState from '../state/analysisState.js';
import sensorState from '../state/sensorState.js';
import satelliteState from '../state/satelliteState.js';
import listState from '../state/listState.js';
import timeState from '../state/timeState.js';
import { calculateAzimuthElevation } from '../utils/geometry.js';
import { propagateSatellite } from '../data/propagation.js';

// Canvas and context
let canvas = null;
let ctx = null;

// Plot dimensions (will be set on init)
let centerX = 0;
let centerY = 0;
let radius = 0;
let padding = 40;

// Colors (matching app theme)
const COLORS = {
    background: '#0d1117',
    gridLines: 'rgba(88, 166, 255, 0.3)',
    gridLabels: 'rgba(88, 166, 255, 0.7)',
    cardinalLabels: 'rgba(200, 200, 200, 0.9)',
    azimuthLabels: 'rgba(150, 150, 150, 0.6)',
    horizon: 'rgba(88, 166, 255, 0.5)',
    satellite: {
        grey: [180, 180, 180],
        red: [255, 100, 100],
        blue: [100, 150, 255],
        orange: [255, 180, 60]  // Active row highlight
    },
    selectionRing: 'rgba(0, 255, 255, 0.8)',  // Cyan ring for selected
    trackDefault: 'rgba(150, 150, 150, 0.4)',
    currentPosition: 'rgba(255, 200, 100, 1.0)'
};

// Animation frame ID for cleanup
let animationFrameId = null;

// Debug throttle (log every 2 seconds, not every frame)
let lastDebugLog = 0;

// Track calculation settings
const TRACK_STEP_SECONDS = 30;  // Calculate position every 30 seconds along track

/**
 * Initialize the polar plot
 * @param {string} canvasId - ID of the canvas element
 */
export function initializePolarPlot(canvasId = 'polar-plot-canvas') {
    canvas = document.getElementById(canvasId);
    if (!canvas) {
        logger.warning('Polar plot canvas not found', logger.CATEGORY.UI);
        return false;
    }

    ctx = canvas.getContext('2d');

    // Set up resize observer
    const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
            resizeCanvas();
            render();
        }
    });

    const container = canvas.parentElement;
    if (container) {
        resizeObserver.observe(container);
    }

    // Initial size
    resizeCanvas();

    // Subscribe to events
    setupEventListeners();

    // Set up click handler for satellite selection
    setupClickHandler();

    logger.log('Polar plot initialized', logger.CATEGORY.UI);
    return true;
}

/**
 * Resize canvas to fit container
 */
function resizeCanvas() {
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height) - 20;

    // Set canvas size (with device pixel ratio for sharpness)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    ctx.scale(dpr, dpr);

    // Update plot dimensions
    centerX = size / 2;
    centerY = size / 2;
    radius = (size / 2) - padding;
}

/**
 * Set up event listeners for state changes
 */
function setupEventListeners() {
    // Polar plot toggle
    eventBus.on('analysis:polarplot:toggled', ({ enabled }) => {
        if (enabled) {
            startAnimation();
        } else {
            stopAnimation();
        }
    });

    // Sensor selection for polar view
    eventBus.on('analysis:sensor:selected', () => {
        render();
    });

    eventBus.on('analysis:sensor:deselected', () => {
        render();
    });

    // Satellite selection changes
    eventBus.on('satellite:selection:changed', () => {
        render();
    });

    eventBus.on('satellite:watchlist:changed', () => {
        render();
    });

    eventBus.on('satellite:watchcolor:changed', () => {
        render();
    });

    // List visibility changes (satellites shown via watch lists)
    eventBus.on('list:changed', () => {
        render();
    });

    eventBus.on('list:visibility:changed', () => {
        render();
    });

    // Time changes
    eventBus.on('time:changed', () => {
        render();
    });

    eventBus.on('time:applied', () => {
        render();
    });

    // Track duration changes
    eventBus.on('time:track:changed', () => {
        render();
    });
}

/**
 * Set up click handler for satellite selection
 */
function setupClickHandler() {
    if (!canvas) return;

    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x = (e.clientX - rect.left) * dpr;
        const y = (e.clientY - rect.top) * dpr;

        // Check if click is on any satellite
        const clickedSatellite = findSatelliteAtPosition(x / dpr, y / dpr);
        if (clickedSatellite) {
            // Set as active row in satellite state
            satelliteState.setActiveRow(clickedSatellite.id);
            logger.log(`Polar plot: selected ${clickedSatellite.name}`, logger.CATEGORY.UI);

            // Emit event for table to highlight
            eventBus.emit('satellite:selection:changed', {
                id: clickedSatellite.id,
                source: 'polarPlot'
            });

            render();
        }
    });

    // Change cursor on hover
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const hoveredSatellite = findSatelliteAtPosition(x, y);
        canvas.style.cursor = hoveredSatellite ? 'pointer' : 'default';
    });
}

// Store satellite positions for click detection
let satellitePositions = [];

/**
 * Find satellite at canvas position
 * @param {number} x - Canvas X coordinate
 * @param {number} y - Canvas Y coordinate
 * @returns {Object|null} Satellite object or null
 */
function findSatelliteAtPosition(x, y) {
    const clickRadius = 15;  // Click tolerance in pixels

    for (const satPos of satellitePositions) {
        const dx = x - satPos.x;
        const dy = y - satPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= clickRadius) {
            return satPos.satellite;
        }
    }

    return null;
}

/**
 * Start animation loop
 */
function startAnimation() {
    if (animationFrameId) return;

    const animate = () => {
        render();
        animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    logger.log('Polar plot animation started', logger.CATEGORY.UI);
}

/**
 * Stop animation loop
 */
function stopAnimation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        logger.log('Polar plot animation stopped', logger.CATEGORY.UI);
    }
}

/**
 * Main render function
 */
export function render() {
    if (!ctx || !canvas) return;
    if (!analysisState.isPolarPlotEnabled()) return;

    // Clear satellite positions for click detection
    satellitePositions = [];

    // Clear canvas
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid with enhanced labels
    drawGrid();

    // Get selected sensor for polar view
    const sensorId = analysisState.getPolarViewSensorId();
    if (sensorId === null) {
        drawNoSensorMessage();
        return;
    }

    // Get sensor data
    const sensor = sensorState.getSensorById(sensorId);
    if (!sensor) {
        drawNoSensorMessage();
        return;
    }

    // Draw sensor name
    drawSensorLabel(sensor);

    // Get satellites to display from visible lists (same as map)
    const visibleSatelliteIds = listState.getVisibleSatelliteIds();
    const satellites = visibleSatelliteIds
        .map(id => satelliteState.getSatelliteById(id))
        .filter(sat => sat !== null);

    if (satellites.length === 0) {
        logger.diagnostic('No satellites visible from lists', logger.CATEGORY.UI);
        return;
    }

    // Get current time and track settings
    const currentTime = timeState.getCurrentTime();
    const tailMinutes = timeState.getTailMinutes();
    const headMinutes = timeState.getHeadMinutes();

    // Get active row ID for highlighting
    const activeRowId = satelliteState.getEditingState().activeRowId;

    // Debug: Log what we're processing (throttled)
    const now = Date.now();
    const shouldLog = now - lastDebugLog > 2000;
    if (shouldLog) {
        lastDebugLog = now;
        logger.diagnostic(`Processing ${satellites.length} satellites, tail=${tailMinutes}m, head=${headMinutes}m`, logger.CATEGORY.UI);
    }

    // Draw each satellite (tracks first, then current positions on top)
    // First pass: draw all tracks
    satellites.forEach(sat => {
        const isActive = sat.id === activeRowId;
        drawSatelliteTrack(sat, sensor, currentTime, tailMinutes, headMinutes, isActive);
    });

    // Second pass: draw current positions and labels
    satellites.forEach(sat => {
        const isActive = sat.id === activeRowId;
        drawSatellitePosition(sat, sensor, currentTime, isActive, shouldLog);
    });
}

/**
 * Draw the polar grid with enhanced labels
 */
function drawGrid() {
    ctx.strokeStyle = COLORS.gridLines;
    ctx.lineWidth = 1;

    // Elevation circles (0°, 30°, 60°, 90° from edge to center)
    const elevations = [0, 30, 60, 90];
    elevations.forEach(el => {
        const r = elevationToRadius(el);
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();

        // Label elevation on the right side (skip 90° at center)
        if (el < 90 && el > 0) {
            ctx.fillStyle = COLORS.gridLabels;
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`${el}°`, centerX + r + 3, centerY + 4);
        }
    });

    // Azimuth lines (every 30°) with degree labels
    for (let az = 0; az < 360; az += 30) {
        const angle = azimuthToAngle(az);
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();

        // Draw azimuth degree labels (skip cardinal directions)
        if (az % 90 !== 0) {
            const labelRadius = radius + 12;
            const labelX = centerX + labelRadius * Math.cos(angle);
            const labelY = centerY + labelRadius * Math.sin(angle);

            ctx.fillStyle = COLORS.azimuthLabels;
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${az}°`, labelX, labelY);
        }
    }

    // Cardinal direction labels (larger, brighter)
    ctx.fillStyle = COLORS.cardinalLabels;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const labelOffset = radius + 20;
    ctx.fillText('N', centerX, centerY - labelOffset);
    ctx.fillText('S', centerX, centerY + labelOffset);
    ctx.fillText('E', centerX + labelOffset, centerY);
    ctx.fillText('W', centerX - labelOffset, centerY);

    // Horizon circle (thicker)
    ctx.strokeStyle = COLORS.horizon;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
}

/**
 * Draw message when no sensor is selected
 */
function drawNoSensorMessage() {
    ctx.fillStyle = 'rgba(150, 150, 150, 0.7)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Click a sensor on the map', centerX, centerY - 10);
    ctx.fillText('to view satellite passes', centerX, centerY + 10);
}

/**
 * Draw sensor name label
 * @param {Object} sensor - Sensor object
 */
function drawSensorLabel(sensor) {
    ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`Sensor: ${sensor.name}`, centerX, 8);
}

/**
 * Draw satellite sky track (pass arc)
 * @param {Object} satellite - Satellite object
 * @param {Object} sensor - Observer sensor
 * @param {Date} currentTime - Current simulation time
 * @param {number} tailMinutes - Minutes of track behind current position
 * @param {number} headMinutes - Minutes of track ahead of current position
 * @param {boolean} isActive - Whether this satellite is the active row
 */
function drawSatelliteTrack(satellite, sensor, currentTime, tailMinutes, headMinutes, isActive) {
    const color = getSatelliteColor(satellite, isActive);
    const trackPoints = [];

    // Calculate track points from tail to head
    const tailMs = tailMinutes * 60 * 1000;
    const headMs = headMinutes * 60 * 1000;
    const stepMs = TRACK_STEP_SECONDS * 1000;

    const startTime = new Date(currentTime.getTime() - tailMs);
    const endTime = new Date(currentTime.getTime() + headMs);

    for (let t = startTime.getTime(); t <= endTime.getTime(); t += stepMs) {
        const time = new Date(t);
        const satPos = propagateSatellite(satellite.tleLine1, satellite.tleLine2, time);
        if (!satPos) continue;

        const lookAngles = calculateAzimuthElevation(
            sensor.lat, sensor.lon, sensor.alt / 1000 || 0,
            satPos.lat, satPos.lon, satPos.alt
        );

        // Only include points above horizon
        if (lookAngles.elevation >= 0) {
            const canvasPos = polarToCanvas(lookAngles.azimuth, lookAngles.elevation);
            trackPoints.push({
                x: canvasPos.x,
                y: canvasPos.y,
                az: lookAngles.azimuth,
                el: lookAngles.elevation,
                time: t
            });
        }
    }

    // Draw track line
    if (trackPoints.length >= 2) {
        ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${isActive ? 0.8 : 0.4})`;
        ctx.lineWidth = isActive ? 2.5 : 1.5;
        ctx.beginPath();

        ctx.moveTo(trackPoints[0].x, trackPoints[0].y);
        for (let i = 1; i < trackPoints.length; i++) {
            ctx.lineTo(trackPoints[i].x, trackPoints[i].y);
        }
        ctx.stroke();

        // Draw direction chevrons along track
        drawTrackChevrons(trackPoints, color, isActive);
    }
}

/**
 * Draw direction chevrons along the track
 * @param {Array} trackPoints - Array of track points with x, y coordinates
 * @param {Array} color - RGB color array
 * @param {boolean} isActive - Whether this satellite is active
 */
function drawTrackChevrons(trackPoints, color, isActive) {
    if (trackPoints.length < 3) return;

    // Draw chevrons at regular intervals along the track
    const chevronInterval = Math.max(3, Math.floor(trackPoints.length / 6));  // ~6 chevrons max

    for (let i = chevronInterval; i < trackPoints.length - 1; i += chevronInterval) {
        const prev = trackPoints[i - 1];
        const curr = trackPoints[i];
        const next = trackPoints[i + 1];

        // Calculate direction (bearing along track)
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const angle = Math.atan2(dy, dx);

        // Draw chevron
        const size = isActive ? 6 : 4;
        const chevronAngle = Math.PI / 6;  // 30 degrees

        ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${isActive ? 0.9 : 0.6})`;
        ctx.lineWidth = isActive ? 2 : 1.5;
        ctx.beginPath();

        // Left arm of chevron
        ctx.moveTo(
            curr.x - size * Math.cos(angle - chevronAngle),
            curr.y - size * Math.sin(angle - chevronAngle)
        );
        ctx.lineTo(curr.x, curr.y);

        // Right arm of chevron
        ctx.lineTo(
            curr.x - size * Math.cos(angle + chevronAngle),
            curr.y - size * Math.sin(angle + chevronAngle)
        );

        ctx.stroke();
    }
}

/**
 * Draw satellite current position marker
 * @param {Object} satellite - Satellite object
 * @param {Object} sensor - Observer sensor
 * @param {Date} currentTime - Current simulation time
 * @param {boolean} isActive - Whether this satellite is the active row
 * @param {boolean} shouldLog - Whether to log debug info
 */
function drawSatellitePosition(satellite, sensor, currentTime, isActive, shouldLog = false) {
    // Propagate satellite to current time
    const satPos = propagateSatellite(satellite.tleLine1, satellite.tleLine2, currentTime);
    if (!satPos) {
        if (shouldLog) logger.warning(`${satellite.name}: propagation failed`, logger.CATEGORY.UI);
        return;
    }

    // Calculate look angles from sensor
    const lookAngles = calculateAzimuthElevation(
        sensor.lat, sensor.lon, sensor.alt / 1000 || 0,
        satPos.lat, satPos.lon, satPos.alt
    );

    // Debug log
    if (shouldLog) {
        logger.diagnostic(`${satellite.name}: el=${lookAngles.elevation.toFixed(1)}° az=${lookAngles.azimuth.toFixed(1)}° visible=${lookAngles.visible}`, logger.CATEGORY.UI, {
            lat: satPos.lat.toFixed(1),
            lon: satPos.lon.toFixed(1),
            alt: `${satPos.alt.toFixed(0)}km`
        });
    }

    // Only draw if visible (above horizon)
    if (!lookAngles.visible) return;

    // Get color based on watchlist and active state
    const color = getSatelliteColor(satellite, isActive);

    // Convert to canvas coordinates
    const { x, y } = polarToCanvas(lookAngles.azimuth, lookAngles.elevation);

    // Store position for click detection
    satellitePositions.push({
        x,
        y,
        satellite,
        elevation: lookAngles.elevation,
        azimuth: lookAngles.azimuth
    });

    // Draw selection ring if active
    if (isActive) {
        ctx.strokeStyle = COLORS.selectionRing;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Draw glow
    const glowRadius = isActive ? 15 : 10;
    const gradient = ctx.createRadialGradient(x, y, 2, x, y, glowRadius);
    gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.6)`);
    gradient.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw satellite marker
    const markerSize = isActive ? 6 : 5;
    ctx.beginPath();
    ctx.arc(x, y, markerSize, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1.0)`;
    ctx.fill();

    // Draw satellite name
    ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.9)`;
    ctx.font = isActive ? 'bold 10px monospace' : '9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(satellite.name, x + 10, y);
}

/**
 * Get satellite color based on watchlist status and active state
 * @param {Object} satellite - Satellite object
 * @param {boolean} isActive - Whether this satellite is the active row
 * @returns {Array} RGB color array
 */
function getSatelliteColor(satellite, isActive = false) {
    // Active row gets orange highlight
    if (isActive) return COLORS.satellite.orange;

    // Watch colors
    if (satellite.watchColor === 'red') return COLORS.satellite.red;
    if (satellite.watchColor === 'blue') return COLORS.satellite.blue;
    return COLORS.satellite.grey;
}

/**
 * Convert azimuth to canvas angle (radians)
 * Azimuth: 0° = North (up), increases clockwise
 * Canvas: 0 = right, increases counter-clockwise
 * @param {number} azimuth - Azimuth in degrees
 * @returns {number} Angle in radians for canvas
 */
function azimuthToAngle(azimuth) {
    // Rotate so 0° (North) is at top, and direction is clockwise
    return ((azimuth - 90) * Math.PI) / 180;
}

/**
 * Convert elevation to radius on the plot
 * 90° elevation = center (0 radius)
 * 0° elevation = edge (full radius)
 * @param {number} elevation - Elevation in degrees (0-90)
 * @returns {number} Radius in pixels
 */
function elevationToRadius(elevation) {
    // Linear mapping: 90° -> 0, 0° -> radius
    return radius * (1 - elevation / 90);
}

/**
 * Convert polar coordinates (az, el) to canvas coordinates (x, y)
 * @param {number} azimuth - Azimuth in degrees
 * @param {number} elevation - Elevation in degrees
 * @returns {Object} {x, y} canvas coordinates
 */
function polarToCanvas(azimuth, elevation) {
    const r = elevationToRadius(elevation);
    const angle = azimuthToAngle(azimuth);

    return {
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle)
    };
}

/**
 * Show/hide the polar plot
 * @param {boolean} visible - Whether to show the plot
 */
export function setVisible(visible) {
    const container = document.getElementById('polar-plot-container');
    if (container) {
        container.style.display = visible ? 'flex' : 'none';
    }

    if (visible) {
        resizeCanvas();
        render();
        startAnimation();
    } else {
        stopAnimation();
    }
}

/**
 * Force a re-render of the polar plot
 */
export function refresh() {
    resizeCanvas();
    render();
}

// Export for debugging
if (typeof window !== 'undefined') {
    window.polarPlot = {
        initialize: initializePolarPlot,
        render,
        refresh,
        setVisible
    };
}

export default {
    initialize: initializePolarPlot,
    render,
    refresh,
    setVisible
};
