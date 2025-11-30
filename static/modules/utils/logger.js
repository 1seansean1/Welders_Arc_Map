/**
 * UI Logger - Logs to both console and UI display
 *
 * DEPENDENCIES: None (pure utility, accesses DOM directly)
 * PERFORMANCE: O(1) append, maintains max 500 UI entries, 5000 full buffer
 *
 * Features:
 * - Dual logging (console + UI)
 * - Color-coded log levels (info, success, warning, error, diagnostic)
 * - Category-based logging (MAP, SATELLITE, SENSOR, UI, SYNC, DATA)
 * - Contextual metadata (key-value pairs for debugging)
 * - Auto-scroll to top (newest first)
 * - Clear and download functionality
 * - Timestamp for each entry
 * - Structured log export with categories and context
 * - MESSAGE THROTTLING: Identical messages suppressed for configurable interval
 * - TWO-TIER STORAGE: Full buffer for download, filtered UI display
 * - CONFIGURABLE: Level filter, throttle interval, buffer size
 */

class UILogger {
    constructor() {
        // Category constants for organized logging
        this.CATEGORY = {
            MAP: 'MAP',
            SATELLITE: 'SAT',
            SENSOR: 'SNS',
            PANEL: 'UI',
            SYNC: 'SYNC',
            DATA: 'DATA',
            ANALYSIS: 'ANLY',
            TEST: 'TEST'
        };

        // Log level priority (higher = more important)
        this.LEVEL_PRIORITY = {
            diagnostic: 0,
            info: 1,
            success: 2,
            warning: 3,
            error: 4
        };

        // Full buffer for download (ALL logs)
        this.logBuffer = [];           // Alias for backwards compatibility
        this.maxFullBuffer = 5000;     // Max entries in full buffer

        // UI display settings
        this.maxEntries = 500;         // Limit UI display to prevent DOM bloat
        this.displayElement = null;
        this.countElement = null;
        this.bufferCountElement = null;

        // Throttling settings
        this.throttleCache = new Map(); // messageKey -> { lastTime, count }
        this.throttleMs = 2000;         // Default 2 second throttle for identical messages

        // UI level filter (minimum level to show in UI)
        // 'diagnostic' = show all, 'info' = info+, 'warning' = warning+, 'error' = errors only
        this.uiMinLevel = 'info';

        // Track suppressed message counts for periodic summary
        this.suppressedCount = 0;
        this.lastSuppressedReport = Date.now();
        this.suppressedReportInterval = 10000; // Report suppressed count every 10 seconds
    }

    /**
     * Initialize logger (call after DOM loaded)
     */
    init() {
        this.displayElement = document.getElementById('log-display');
        this.countElement = document.getElementById('log-count');
        this.bufferCountElement = document.getElementById('log-buffer-count');

        // Setup clear button (clears UI only)
        const clearBtn = document.getElementById('log-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clear());
        }

        // Setup download button (downloads filtered UI logs)
        const downloadBtn = document.getElementById('log-download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.download());
        }

        // Setup DL All button (downloads FULL buffer)
        const downloadAllBtn = document.getElementById('log-download-all-btn');
        if (downloadAllBtn) {
            downloadAllBtn.addEventListener('click', () => this.downloadAll());
        }

        // Setup context menu
        this.initContextMenu();

        this.log('UI Logger initialized', 'success');
    }

    /**
     * Initialize right-click context menu for log display
     * Provides quick access to Clear and Download actions
     */
    initContextMenu() {
        const contextMenu = document.getElementById('log-context-menu');
        const contextClear = document.getElementById('log-context-clear');
        const contextDownload = document.getElementById('log-context-download');
        const contextDownloadAll = document.getElementById('log-context-download-all');

        if (!contextMenu || !this.displayElement) return;

        // Show context menu on right-click
        this.displayElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();

            // Show menu temporarily to measure dimensions
            contextMenu.classList.add('visible');
            const menuRect = contextMenu.getBoundingClientRect();

            // Get viewport dimensions
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Calculate position with boundary checks
            let left = e.clientX;
            let top = e.clientY;

            // Check right boundary - flip to left if would overflow
            if (left + menuRect.width > viewportWidth) {
                left = Math.max(0, viewportWidth - menuRect.width);
            }

            // Check bottom boundary - flip to top if would overflow
            if (top + menuRect.height > viewportHeight) {
                top = Math.max(0, viewportHeight - menuRect.height);
            }

            // Position menu with boundary-safe coordinates
            contextMenu.style.left = `${left}px`;
            contextMenu.style.top = `${top}px`;
        });

        // Hide context menu on click outside
        document.addEventListener('click', (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.classList.remove('visible');
            }
        });

        // Clear action
        if (contextClear) {
            contextClear.addEventListener('click', () => {
                this.clear();
                contextMenu.classList.remove('visible');
            });
        }

        // Download action (filtered)
        if (contextDownload) {
            contextDownload.addEventListener('click', () => {
                this.download();
                contextMenu.classList.remove('visible');
            });
        }

        // Download All action (full buffer)
        if (contextDownloadAll) {
            contextDownloadAll.addEventListener('click', () => {
                this.downloadAll();
                contextMenu.classList.remove('visible');
            });
        }
    }

    /**
     * Generate throttle key for a message
     * Uses message + category to group identical logs
     */
    getThrottleKey(message, category) {
        return `${category || 'NONE'}::${message}`;
    }

    /**
     * Check if message should be throttled
     * Returns true if message should be suppressed
     */
    shouldThrottle(message, category, level) {
        // Never throttle errors or warnings
        if (level === 'error' || level === 'warning') {
            return false;
        }

        const key = this.getThrottleKey(message, category);
        const now = Date.now();
        const cached = this.throttleCache.get(key);

        if (cached && (now - cached.lastTime) < this.throttleMs) {
            // Update suppressed count
            cached.count++;
            this.suppressedCount++;
            return true;
        }

        // Update cache
        this.throttleCache.set(key, { lastTime: now, count: 1 });
        return false;
    }

    /**
     * Check if level should show in UI based on filter
     */
    shouldShowInUI(level) {
        const levelPriority = this.LEVEL_PRIORITY[level] ?? 1;
        const filterPriority = this.LEVEL_PRIORITY[this.uiMinLevel] ?? 1;
        return levelPriority >= filterPriority;
    }

    /**
     * Log message to console and UI
     * @param {string} message - Log message
     * @param {string} level - Log level: 'info', 'success', 'warning', 'error', 'diagnostic'
     * @param {string} category - Optional category (MAP, SAT, SNS, UI, SYNC, DATA)
     * @param {object} context - Optional context object with key-value pairs
     */
    log(message, level = 'info', category = null, context = null) {
        const timestamp = new Date().toISOString();

        // Format message with category for display
        let displayMsg = message;
        if (category) {
            displayMsg = `[${category}] ${message}`;
        }

        // Append context as key=value
        if (context) {
            const contextStr = Object.entries(context)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ');
            displayMsg += ` (${contextStr})`;
        }

        // ALWAYS store in full buffer (for download)
        this.logBuffer.push({ timestamp, message, level, category, context });

        // Trim full buffer if over limit
        while (this.logBuffer.length > this.maxFullBuffer) {
            this.logBuffer.shift();
        }

        // Check throttling for UI and console
        const throttled = this.shouldThrottle(message, category, level);

        // Log to console (unless throttled)
        if (!throttled) {
            const consoleMethod = level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log';
            console[consoleMethod](displayMsg, context || '');
        }

        // Add to UI (if initialized, not throttled, and passes level filter)
        if (this.displayElement && !throttled && this.shouldShowInUI(level)) {
            this.addToDisplay(timestamp, displayMsg, level);
        }

        // Update buffer count
        this.updateCount();

        // Periodically report suppressed messages
        this.reportSuppressed();
    }

    /**
     * Report suppressed message count periodically
     */
    reportSuppressed() {
        const now = Date.now();
        if (this.suppressedCount > 0 && (now - this.lastSuppressedReport) > this.suppressedReportInterval) {
            const count = this.suppressedCount;
            this.suppressedCount = 0;
            this.lastSuppressedReport = now;
            // Log without triggering throttle check (direct to UI)
            if (this.displayElement) {
                const timestamp = new Date().toISOString();
                this.addToDisplay(timestamp, `[LOG] ${count} repetitive messages suppressed`, 'info');
            }
        }
    }

    /**
     * Add entry to UI display (newest at top)
     */
    addToDisplay(timestamp, message, level) {
        // Create log entry element
        const entry = document.createElement('div');
        entry.className = `log-entry ${level}`;

        // Format timestamp (HH:MM:SS.mmm)
        const time = new Date(timestamp);
        const timeStr = time.toTimeString().split(' ')[0] + '.' + time.getMilliseconds().toString().padStart(3, '0');

        entry.textContent = `[${timeStr}] ${message}`;

        // Insert at top (newest first)
        if (this.displayElement.firstChild) {
            this.displayElement.insertBefore(entry, this.displayElement.firstChild);
        } else {
            this.displayElement.appendChild(entry);
        }

        // Limit displayed entries
        while (this.displayElement.children.length > this.maxEntries) {
            this.displayElement.removeChild(this.displayElement.lastChild);
        }

        // Auto-scroll to top to show newest entry
        this.displayElement.scrollTop = 0;
    }

    /**
     * Update log count in status bar
     * PERFORMANCE: O(1) - direct textContent update
     */
    updateCount() {
        if (this.countElement) {
            // Show UI display count
            const uiCount = this.displayElement ? this.displayElement.children.length : 0;
            this.countElement.textContent = uiCount;
        }
        if (this.bufferCountElement) {
            // Show full buffer count
            this.bufferCountElement.textContent = this.logBuffer.length;
        }
    }

    /**
     * Clear displayed logs (does not clear full buffer)
     */
    clear() {
        if (this.displayElement) {
            this.displayElement.innerHTML = '';
            this.log('Display cleared (full buffer preserved)', 'info');
        }
    }

    /**
     * Clear ALL logs including full buffer
     */
    clearAll() {
        this.logBuffer = [];
        this.throttleCache.clear();
        this.suppressedCount = 0;
        if (this.displayElement) {
            this.displayElement.innerHTML = '';
        }
        this.updateCount();
        this.log('All logs cleared', 'info');
    }

    /**
     * Download visible UI logs as .txt file
     */
    download() {
        // Get logs that would show in UI (filtered by level)
        const filteredLogs = this.logBuffer.filter(entry => this.shouldShowInUI(entry.level));

        if (filteredLogs.length === 0) {
            this.log('No logs to download', 'warning');
            return;
        }

        const logText = this.formatLogsForDownload(filteredLogs);
        this.triggerDownload(logText, 'system-log');
        this.log(`Downloaded ${filteredLogs.length} filtered log entries`, 'success');
    }

    /**
     * Download FULL log buffer as .txt file (all levels, including throttled)
     */
    downloadAll() {
        if (this.logBuffer.length === 0) {
            this.log('No logs to download', 'warning');
            return;
        }

        const logText = this.formatLogsForDownload(this.logBuffer);
        this.triggerDownload(logText, 'system-log-FULL');
        this.log(`Downloaded ${this.logBuffer.length} total log entries (full buffer)`, 'success');
    }

    /**
     * Format log entries for download
     */
    formatLogsForDownload(logs) {
        return logs.map(entry => {
            let line = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
            if (entry.category) line += ` [${entry.category}]`;
            line += ` ${entry.message}`;
            if (entry.context) {
                line += ` ${JSON.stringify(entry.context)}`;
            }
            return line;
        }).join('\n');
    }

    /**
     * Trigger file download
     */
    triggerDownload(content, filenamePrefix) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${filenamePrefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ===== SETTINGS API =====

    /**
     * Set throttle interval in milliseconds
     * @param {number} ms - Throttle interval (0 = no throttling)
     */
    setThrottleMs(ms) {
        this.throttleMs = Math.max(0, Math.min(10000, ms));
        this.log(`Throttle interval set to ${this.throttleMs}ms`, 'info', this.CATEGORY.PANEL);
    }

    /**
     * Get current throttle interval
     */
    getThrottleMs() {
        return this.throttleMs;
    }

    /**
     * Set minimum log level for UI display
     * @param {string} level - 'diagnostic', 'info', 'warning', 'error'
     */
    setUIMinLevel(level) {
        if (this.LEVEL_PRIORITY.hasOwnProperty(level)) {
            this.uiMinLevel = level;
            this.log(`UI log level set to ${level}+`, 'info', this.CATEGORY.PANEL);
        }
    }

    /**
     * Get current UI minimum level
     */
    getUIMinLevel() {
        return this.uiMinLevel;
    }

    /**
     * Get buffer statistics
     */
    getStats() {
        return {
            uiCount: this.displayElement ? this.displayElement.children.length : 0,
            bufferCount: this.logBuffer.length,
            maxBuffer: this.maxFullBuffer,
            throttleMs: this.throttleMs,
            uiMinLevel: this.uiMinLevel,
            suppressedCount: this.suppressedCount
        };
    }

    // Convenience methods for different log levels
    info(message, category, context) {
        this.log(message, 'info', category, context);
    }

    success(message, category, context) {
        this.log(message, 'success', category, context);
    }

    warning(message, category, context) {
        this.log(message, 'warning', category, context);
    }

    error(message, category, context) {
        this.log(message, 'error', category, context);
    }

    diagnostic(message, category, context) {
        this.log(message, 'diagnostic', category, context);
    }
}

// Export singleton instance
const logger = new UILogger();
export { logger };
export default logger;
