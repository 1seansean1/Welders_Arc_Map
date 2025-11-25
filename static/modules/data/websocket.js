/**
 * WebSocket Manager Module - Real-time satellite data updates
 *
 * DEPENDENCIES: logger.js, eventBus.js
 * PATTERN: Singleton manager with automatic reconnection
 *
 * Features:
 * - WebSocket connection management
 * - Automatic reconnection with exponential backoff
 * - Message handling with event emissions
 * - Connection state tracking
 * - Mobile-optimized update frequency
 *
 * Events Emitted:
 * - websocket:connected - Connection established
 * - websocket:disconnected - Connection lost
 * - websocket:message - Message received
 * - websocket:error - Error occurred
 *
 * Usage:
 *   import websocketManager from './modules/data/websocket.js';
 *
 *   // Connect to server
 *   websocketManager.connect();
 *
 *   // Listen for updates
 *   eventBus.on('websocket:message', (data) => {
 *     console.log('Received:', data);
 *   });
 *
 *   // Disconnect
 *   websocketManager.disconnect();
 */

import logger from '../utils/logger.js';
import eventBus from '../events/eventBus.js';

/**
 * WebSocket Manager class - Handles real-time connections
 */
class WebSocketManager {
    constructor() {
        this._ws = null;
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 10;
        this._reconnectDelay = 1000; // Start with 1 second
        this._reconnectTimer = null;
        this._isConnecting = false;
        this._manualDisconnect = false;
        this._url = null;
    }

    /**
     * Get connection state
     * @returns {boolean} True if connected
     */
    isConnected() {
        return this._ws && this._ws.readyState === WebSocket.OPEN;
    }

    /**
     * Get connection status
     * @returns {string} 'connected', 'connecting', 'disconnected', or 'error'
     */
    getStatus() {
        if (!this._ws) return 'disconnected';

        switch (this._ws.readyState) {
            case WebSocket.CONNECTING:
                return 'connecting';
            case WebSocket.OPEN:
                return 'connected';
            case WebSocket.CLOSING:
            case WebSocket.CLOSED:
                return 'disconnected';
            default:
                return 'error';
        }
    }

    /**
     * Connect to WebSocket server
     * @param {string} url - WebSocket URL (default: ws://localhost:8000/ws/realtime)
     * @returns {boolean} True if connection initiated
     */
    connect(url = 'ws://localhost:8000/ws/realtime') {
        // Prevent multiple simultaneous connection attempts
        if (this._isConnecting || this.isConnected()) {
            logger.warning('WebSocket already connecting or connected', logger.CATEGORY.DATA);
            return false;
        }

        this._url = url;
        this._manualDisconnect = false;
        this._isConnecting = true;

        // TODO: Implement actual WebSocket connection
        // This is a stub for future implementation
        logger.info('WebSocket connection: Not yet implemented', logger.CATEGORY.DATA, {
            url: this._url,
            status: 'stub'
        });

        // Simulate connection delay
        setTimeout(() => {
            this._isConnecting = false;
            logger.info('WebSocket would connect here', logger.CATEGORY.DATA);
        }, 100);

        return true;

        /* FUTURE IMPLEMENTATION:
        try {
            this._ws = new WebSocket(url);

            this._ws.onopen = () => {
                this._isConnecting = false;
                this._reconnectAttempts = 0;
                this._reconnectDelay = 1000;
                logger.success('WebSocket connected', logger.CATEGORY.DATA, { url });
                eventBus.emit('websocket:connected', { url });
            };

            this._ws.onmessage = (event) => {
                this._handleMessage(event);
            };

            this._ws.onerror = (error) => {
                this._handleError(error);
            };

            this._ws.onclose = (event) => {
                this._handleClose(event);
            };

            return true;
        } catch (error) {
            this._isConnecting = false;
            logger.error('Failed to create WebSocket', logger.CATEGORY.DATA, {
                error: error.message
            });
            return false;
        }
        */
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        this._manualDisconnect = true;

        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }

        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }

        logger.info('WebSocket disconnected', logger.CATEGORY.DATA);
        eventBus.emit('websocket:disconnected', { manual: true });
    }

    /**
     * Send message to server
     * @param {Object} data - Data to send
     * @returns {boolean} True if sent successfully
     */
    send(data) {
        if (!this.isConnected()) {
            logger.warning('Cannot send: WebSocket not connected', logger.CATEGORY.DATA);
            return false;
        }

        try {
            this._ws.send(JSON.stringify(data));
            return true;
        } catch (error) {
            logger.error('Failed to send WebSocket message', logger.CATEGORY.DATA, {
                error: error.message
            });
            return false;
        }
    }

    /**
     * Handle incoming message
     * @private
     * @param {MessageEvent} event - Message event
     */
    _handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            logger.log('WebSocket message received', logger.CATEGORY.DATA);
            eventBus.emit('websocket:message', data);
        } catch (error) {
            logger.error('Failed to parse WebSocket message', logger.CATEGORY.DATA, {
                error: error.message
            });
        }
    }

    /**
     * Handle connection error
     * @private
     * @param {Event} error - Error event
     */
    _handleError(error) {
        logger.error('WebSocket error', logger.CATEGORY.DATA, {
            error: error.message || 'Unknown error'
        });
        eventBus.emit('websocket:error', { error });
    }

    /**
     * Handle connection close
     * @private
     * @param {CloseEvent} event - Close event
     */
    _handleClose(event) {
        this._isConnecting = false;
        this._ws = null;

        logger.info('WebSocket closed', logger.CATEGORY.DATA, {
            code: event.code,
            reason: event.reason,
            clean: event.wasClean
        });

        eventBus.emit('websocket:disconnected', {
            manual: this._manualDisconnect,
            code: event.code,
            reason: event.reason
        });

        // Attempt reconnection if not manually disconnected
        if (!this._manualDisconnect) {
            this._reconnect();
        }
    }

    /**
     * Attempt to reconnect with exponential backoff
     * @private
     */
    _reconnect() {
        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
            logger.error('Max reconnection attempts reached', logger.CATEGORY.DATA, {
                attempts: this._reconnectAttempts
            });
            return;
        }

        this._reconnectAttempts++;
        const delay = Math.min(this._reconnectDelay * Math.pow(2, this._reconnectAttempts - 1), 30000);

        logger.info(`Reconnecting in ${delay / 1000}s (attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts})`,
            logger.CATEGORY.DATA);

        this._reconnectTimer = setTimeout(() => {
            logger.info(`Reconnection attempt ${this._reconnectAttempts}`, logger.CATEGORY.DATA);
            this.connect(this._url);
        }, delay);
    }

    /**
     * Reset reconnection state
     */
    resetReconnection() {
        this._reconnectAttempts = 0;
        this._reconnectDelay = 1000;
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
    }
}

// Export singleton instance
const websocketManager = new WebSocketManager();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
    window.websocketManager = websocketManager;
}

export default websocketManager;
