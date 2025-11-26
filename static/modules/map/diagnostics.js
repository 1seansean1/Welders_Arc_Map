/**
 * Map Diagnostics Module
 *
 * Scientific debugging framework for map rendering issues.
 * Collects quantitative metrics for hypothesis testing and ablation studies.
 *
 * USAGE:
 *   // Start recording
 *   diagnostics.startRecording();
 *
 *   // Perform test actions...
 *
 *   // Get report
 *   const report = diagnostics.stopRecording();
 *   console.table(report.frames);
 *
 * METRICS COLLECTED:
 * - Frame timings (for detecting dropped frames)
 * - Sync drift (Leaflet vs Deck.gl position mismatch)
 * - setProps call frequency (for detecting race conditions)
 * - Glitch events (manually or automatically recorded)
 * - Resize events (for tracking container changes)
 */

import logger from '../utils/logger.js';

class MapDiagnostics {
    constructor() {
        this.metrics = {
            frameTimings: [],
            syncDrifts: [],
            setPropsEvents: [],
            glitchEvents: [],
            resizeEvents: []
        };
        this.isRecording = false;
        this._startTime = 0;
        this._frameId = null;
        this._lastFrameTime = 0;
        this._flushCounter = 0;
    }

    /**
     * Start recording metrics
     */
    startRecording() {
        this.isRecording = true;
        this.metrics = {
            frameTimings: [],
            syncDrifts: [],
            setPropsEvents: [],
            glitchEvents: [],
            resizeEvents: []
        };
        this._startTime = performance.now();
        this._flushCounter = 0;

        // Start frame timing loop
        this._startFrameLoop();

        logger.info('Diagnostics recording started', logger.CATEGORY.SYNC);
    }

    /**
     * Stop recording and generate report
     * @returns {Object} Diagnostic report
     */
    stopRecording() {
        this.isRecording = false;

        // Stop frame loop
        if (this._frameId) {
            cancelAnimationFrame(this._frameId);
            this._frameId = null;
        }

        const report = this.generateReport();
        logger.info('Diagnostics recording stopped', logger.CATEGORY.SYNC, {
            duration: `${(report.duration / 1000).toFixed(1)}s`,
            frames: report.frames.count
        });

        return report;
    }

    /**
     * Start the frame timing loop
     * @private
     */
    _startFrameLoop() {
        const measureFrame = (timestamp) => {
            if (!this.isRecording) return;

            if (this._lastFrameTime > 0) {
                const frameTime = timestamp - this._lastFrameTime;
                this.recordFrameTime(frameTime);
            }
            this._lastFrameTime = timestamp;

            this._frameId = requestAnimationFrame(measureFrame);
        };

        this._frameId = requestAnimationFrame(measureFrame);
    }

    /**
     * Record a frame timing
     * @param {number} ms - Frame time in milliseconds
     */
    recordFrameTime(ms) {
        if (!this.isRecording) return;
        this.metrics.frameTimings.push({
            time: performance.now() - this._startTime,
            value: ms
        });
    }

    /**
     * Record sync drift between Leaflet and Deck.gl
     * @param {number} lngDrift - Longitude drift in degrees
     * @param {number} latDrift - Latitude drift in degrees
     * @param {number} zoomDrift - Zoom level drift
     */
    recordSyncDrift(lngDrift, latDrift, zoomDrift) {
        if (!this.isRecording) return;
        this.metrics.syncDrifts.push({
            time: performance.now() - this._startTime,
            lng: Math.abs(lngDrift),
            lat: Math.abs(latDrift),
            zoom: Math.abs(zoomDrift)
        });
    }

    /**
     * Record a setProps call for race condition analysis
     * @param {string} source - Source identifier
     * @param {boolean} hasViewState - Whether viewState was included
     * @param {boolean} hasLayers - Whether layers were included
     * @param {boolean} hasSize - Whether width/height were included
     */
    recordSetPropsCall(source, hasViewState, hasLayers, hasSize) {
        if (!this.isRecording) return;
        this._flushCounter++;
        this.metrics.setPropsEvents.push({
            time: performance.now() - this._startTime,
            flushId: this._flushCounter,
            source,
            hasViewState,
            hasLayers,
            hasSize
        });
    }

    /**
     * Record a glitch event
     * @param {string} type - Glitch type (flicker, drift, disappear, etc.)
     * @param {Object} details - Additional details
     */
    recordGlitch(type, details = {}) {
        if (!this.isRecording) return;
        this.metrics.glitchEvents.push({
            time: performance.now() - this._startTime,
            type,
            details
        });

        logger.warning(`Glitch detected: ${type}`, logger.CATEGORY.SYNC, details);
    }

    /**
     * Record a resize event
     * @param {number} width - New width
     * @param {number} height - New height
     * @param {string} source - Source of resize
     */
    recordResize(width, height, source) {
        if (!this.isRecording) return;
        this.metrics.resizeEvents.push({
            time: performance.now() - this._startTime,
            width,
            height,
            source
        });
    }

    /**
     * Generate comprehensive diagnostic report
     * @returns {Object} Report with statistics
     */
    generateReport() {
        const duration = performance.now() - this._startTime;
        const frameTimes = this.metrics.frameTimings.map(f => f.value);
        const syncDrifts = this.metrics.syncDrifts;
        const setPropsEvents = this.metrics.setPropsEvents;

        // Frame analysis
        const frameReport = {
            count: frameTimes.length,
            avg: this._mean(frameTimes),
            min: frameTimes.length ? Math.min(...frameTimes) : 0,
            max: frameTimes.length ? Math.max(...frameTimes) : 0,
            p50: this._percentile(frameTimes, 50),
            p95: this._percentile(frameTimes, 95),
            p99: this._percentile(frameTimes, 99),
            droppedFrames: frameTimes.filter(t => t > 16.67).length,
            droppedFrameRate: frameTimes.length ?
                (frameTimes.filter(t => t > 16.67).length / frameTimes.length * 100).toFixed(1) + '%' : '0%',
            targetFPS: frameTimes.length && this._mean(frameTimes) > 0 ?
                (1000 / this._mean(frameTimes)).toFixed(1) : 0
        };

        // Sync analysis
        const syncReport = {
            samples: syncDrifts.length,
            maxLngDrift: syncDrifts.length ? Math.max(...syncDrifts.map(s => s.lng)) : 0,
            maxLatDrift: syncDrifts.length ? Math.max(...syncDrifts.map(s => s.lat)) : 0,
            maxZoomDrift: syncDrifts.length ? Math.max(...syncDrifts.map(s => s.zoom)) : 0,
            avgLngDrift: this._mean(syncDrifts.map(s => s.lng)),
            avgLatDrift: this._mean(syncDrifts.map(s => s.lat)),
            driftEvents: syncDrifts.filter(s => s.lng > 0.0001 || s.lat > 0.0001).length
        };

        // setProps analysis (for race condition detection)
        const setPropsReport = {
            totalCalls: setPropsEvents.length,
            callsPerSecond: duration > 0 ? (setPropsEvents.length / (duration / 1000)).toFixed(1) : 0,
            viewStateOnlyCalls: setPropsEvents.filter(e => e.hasViewState && !e.hasLayers).length,
            layersOnlyCalls: setPropsEvents.filter(e => !e.hasViewState && e.hasLayers).length,
            combinedCalls: setPropsEvents.filter(e => e.hasViewState && e.hasLayers).length,
            sizeOnlyCalls: setPropsEvents.filter(e => e.hasSize && !e.hasViewState && !e.hasLayers).length
        };

        // Glitch analysis
        const glitchReport = {
            count: this.metrics.glitchEvents.length,
            byType: this._groupBy(this.metrics.glitchEvents, 'type'),
            events: this.metrics.glitchEvents
        };

        // Resize analysis
        const resizeReport = {
            count: this.metrics.resizeEvents.length,
            events: this.metrics.resizeEvents
        };

        return {
            duration,
            durationFormatted: `${(duration / 1000).toFixed(1)}s`,
            frames: frameReport,
            sync: syncReport,
            setProps: setPropsReport,
            glitches: glitchReport,
            resizes: resizeReport,

            // Summary for quick assessment
            summary: {
                healthy: frameReport.droppedFrames < frameTimes.length * 0.05 &&
                         syncReport.driftEvents === 0 &&
                         glitchReport.count === 0,
                issues: this._identifyIssues(frameReport, syncReport, setPropsReport, glitchReport)
            }
        };
    }

    /**
     * Identify potential issues from metrics
     * @private
     */
    _identifyIssues(frames, sync, setProps, glitches) {
        const issues = [];

        if (frames.droppedFrames > frames.count * 0.05) {
            issues.push(`High frame drop rate: ${frames.droppedFrameRate}`);
        }

        if (sync.driftEvents > 0) {
            issues.push(`Position drift detected: ${sync.driftEvents} events`);
        }

        if (setProps.viewStateOnlyCalls > setProps.combinedCalls) {
            issues.push('ViewState updates often lack layers (potential race condition)');
        }

        if (glitches.count > 0) {
            issues.push(`${glitches.count} glitch event(s) recorded`);
        }

        return issues;
    }

    /**
     * Calculate mean of array
     * @private
     */
    _mean(arr) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    /**
     * Calculate percentile of array
     * @private
     */
    _percentile(arr, p) {
        if (!arr || arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const idx = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, idx)];
    }

    /**
     * Group array by key
     * @private
     */
    _groupBy(arr, key) {
        return arr.reduce((acc, item) => {
            const k = item[key];
            acc[k] = (acc[k] || 0) + 1;
            return acc;
        }, {});
    }

    /**
     * Validate current sync state between Leaflet and Deck.gl
     * Returns null if valid, error message if invalid
     */
    validateSync() {
        const map = window.leafletMap;
        const deckgl = window.deckgl;

        if (!map || !deckgl) {
            return { valid: false, error: 'Map or Deck.gl not initialized' };
        }

        const leafletCenter = map.getCenter();
        const leafletZoom = map.getZoom();
        const deckViewState = deckgl.viewState || deckgl.props?.viewState;

        if (!deckViewState) {
            return { valid: false, error: 'Deck.gl viewState not available' };
        }

        const EPSILON = 0.0001;
        const expectedZoom = leafletZoom - 1; // Deck.gl uses zoom - 1

        const lngDrift = Math.abs(deckViewState.longitude - leafletCenter.lng);
        const latDrift = Math.abs(deckViewState.latitude - leafletCenter.lat);
        const zoomDrift = Math.abs(deckViewState.zoom - expectedZoom);

        // Record if recording
        this.recordSyncDrift(lngDrift, latDrift, zoomDrift);

        const errors = [];
        if (lngDrift > EPSILON) {
            errors.push(`Longitude drift: ${lngDrift.toFixed(6)}`);
        }
        if (latDrift > EPSILON) {
            errors.push(`Latitude drift: ${latDrift.toFixed(6)}`);
        }
        if (zoomDrift > 0.01) {
            errors.push(`Zoom drift: ${zoomDrift.toFixed(4)}`);
        }

        return {
            valid: errors.length === 0,
            errors,
            leaflet: { lng: leafletCenter.lng, lat: leafletCenter.lat, zoom: leafletZoom },
            deckgl: { lng: deckViewState.longitude, lat: deckViewState.latitude, zoom: deckViewState.zoom },
            drift: { lng: lngDrift, lat: latDrift, zoom: zoomDrift }
        };
    }

    /**
     * Get baseline from localStorage
     */
    getBaseline() {
        const stored = localStorage.getItem('mapDiagnosticsBaseline');
        return stored ? JSON.parse(stored) : null;
    }

    /**
     * Save current report as baseline
     */
    saveAsBaseline(report) {
        localStorage.setItem('mapDiagnosticsBaseline', JSON.stringify(report));
        logger.success('Baseline saved to localStorage', logger.CATEGORY.SYNC);
    }

    /**
     * Compare current report to baseline
     */
    compareToBaseline(currentReport) {
        const baseline = this.getBaseline();
        if (!baseline) {
            return { error: 'No baseline saved. Run saveAsBaseline() first.' };
        }

        return {
            frameDropChange: currentReport.frames.droppedFrames - baseline.frames.droppedFrames,
            p95Change: currentReport.frames.p95 - baseline.frames.p95,
            driftEventChange: currentReport.sync.driftEvents - baseline.sync.driftEvents,
            glitchChange: currentReport.glitches.count - baseline.glitches.count,
            improved: currentReport.frames.droppedFrames <= baseline.frames.droppedFrames &&
                      currentReport.sync.driftEvents <= baseline.sync.driftEvents &&
                      currentReport.glitches.count <= baseline.glitches.count
        };
    }
}

// Export singleton
export const diagnostics = new MapDiagnostics();

// Make available globally for console debugging
if (typeof window !== 'undefined') {
    window.diagnostics = diagnostics;
}

export default diagnostics;
