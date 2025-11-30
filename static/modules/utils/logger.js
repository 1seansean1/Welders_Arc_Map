/**
 * UI Logger - Logs to both console and UI display
 *
 * DEPENDENCIES: None (pure utility, accesses DOM directly)
 * PERFORMANCE: O(1) append, maintains max 500 entries
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

        this.logBuffer = []; // Store all logs for download
        this.maxEntries = 500; // Limit UI display to prevent DOM bloat
        this.displayElement = null;
        this.countElement = null;
    }

    /**
     * Initialize logger (call after DOM loaded)
     */
    init() {
        this.displayElement = document.getElementById('log-display');
        this.countElement = document.getElementById('log-count');

        // Setup clear button
        const clearBtn = document.getElementById('log-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clear());
        }

        // Setup download button
        const downloadBtn = document.getElementById('log-download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.download());
        }

        // Setup stub button (reserved for future use)
        const stubBtn = document.getElementById('log-stub-btn');
        if (stubBtn) {
            stubBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Reserved for future functionality
            });
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

        // Download action
        if (contextDownload) {
            contextDownload.addEventListener('click', () => {
                this.download();
                contextMenu.classList.remove('visible');
            });
        }
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

        // Format message with category
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

        // Store full structured entry
        this.logBuffer.push({ timestamp, message, level, category, context });

        // Log to console with appropriate method and include context
        const consoleMethod = level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log';
        console[consoleMethod](message, context || '');

        // Add to UI (if initialized)
        if (this.displayElement) {
            this.addToDisplay(timestamp, displayMsg, level);
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

        // Update status bar counter (fast: direct textContent update)
        this.updateCount();
    }

    /**
     * Update log count in status bar
     * PERFORMANCE: O(1) - direct textContent update
     */
    updateCount() {
        if (this.countElement) {
            this.countElement.textContent = this.logBuffer.length;
        }
    }

    /**
     * Clear displayed logs (does not clear buffer for download)
     */
    clear() {
        if (this.displayElement) {
            this.displayElement.innerHTML = '';
            this.log('Display cleared (buffer preserved for download)', 'info');
        }
    }

    /**
     * Download log buffer as .txt file
     * Includes category and context for structured debugging
     */
    download() {
        if (this.logBuffer.length === 0) {
            this.log('No logs to download', 'warning');
            return;
        }

        // Format log entries with category and context
        const logText = this.logBuffer.map(entry => {
            let line = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
            if (entry.category) line += ` [${entry.category}]`;
            line += ` ${entry.message}`;
            if (entry.context) {
                line += ` ${JSON.stringify(entry.context)}`;
            }
            return line;
        }).join('\n');

        // Create download blob
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `system-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.log(`Downloaded ${this.logBuffer.length} log entries`, 'success');
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
