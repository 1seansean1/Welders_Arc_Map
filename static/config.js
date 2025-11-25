/**
 * Configuration Constants for Satellite Visualization System
 *
 * USAGE: import { CONFIG } from './config.js';
 *
 * All configuration values centralized here for easy maintenance
 */

export const CONFIG = {
  // API Configuration
  api: {
    baseUrl: 'http://localhost:8000',
    wsUrl: 'ws://localhost:8000/ws/realtime',
    endpoints: {
      health: '/api/health',
      timeNow: '/api/time/now',
      satellites: '/api/satellites',
      satellitePositions: '/api/satellites/positions'
    }
  },

  // Map Configuration
  map: {
    // Mapbox token (currently empty - to be configured)
    mapboxToken: '',

    // Default view
    defaultCenter: [0, 0], // [lon, lat]
    defaultZoom: 2,

    // Tile server (using dark tiles)
    tileUrl: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
    tileAttribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>',

    // Bounds
    maxBounds: [[-180, -90], [180, 90]],
    minZoom: 1,
    maxZoom: 18
  },

  // Performance Targets
  performance: {
    targetFPS: 60,
    maxFrameTime: 16.67, // milliseconds (1000/60)
    maxLogEntries: 500,
    updateInterval: 1000, // milliseconds for WebSocket updates
    propagationTimeout: 5000, // max time for satellite propagation

    // Deck.gl performance settings
    deckgl: {
      useDevicePixels: 1, // Set to 2 for retina displays (slower)
      pickingRadius: 5
    }
  },

  // UI Configuration
  ui: {
    // Responsive breakpoints
    mobileBreakpoint: 768,  // pixels
    tabletBreakpoint: 480,  // pixels

    // Panel dimensions
    panelCollapsedWidth: 42,    // pixels
    panelExpandedWidth: 224,    // pixels
    mobilePanelWidth: 240,      // pixels
    panelTransition: '0.27s cubic-bezier(0.4, 0.0, 0.2, 1)',

    // Animation settings
    animationDuration: 270,     // milliseconds
    debounceDelay: 250,         // milliseconds for resize events

    // Touch targets (iOS guidelines)
    minTouchTarget: 44          // pixels
  },

  // Colors (matching CSS variables)
  colors: {
    bgPrimary: '#0a0a0a',
    bgSecondary: '#1a1a1a',
    bgTertiary: '#2a2a2a',
    borderColor: '#333333',
    textPrimary: '#f5f5f5',
    textSecondary: '#a3a3a3',
    textMuted: '#666666',
    accentBlueGrey: '#9dd4ff',
    accentGreen: '#00ff66',
    accentYellow: '#ffeb3b',
    accentRed: '#ff4444'
  },

  // Satellite Configuration
  satellites: {
    defaultUpdateRate: 1000,    // milliseconds between updates
    maxSatellites: 1000,        // maximum number to display
    groundTrackDuration: 90,    // minutes for ground track
    groundTrackSteps: 60,       // seconds between ground track points

    // Display settings
    pointSize: 8,               // pixels
    selectedPointSize: 12,      // pixels
    groundTrackWidth: 2,        // pixels

    // Colors
    colors: {
      default: [157, 212, 255],      // RGB for accentBlueGrey
      selected: [0, 255, 102],       // RGB for accentGreen
      watchlist: [255, 235, 59],     // RGB for accentYellow
      groundTrack: [157, 212, 255, 100] // RGBA with alpha
    }
  },

  // Sensor Configuration
  sensors: {
    defaultFOVAltitude: 500,    // kilometers
    fovCirclePoints: 64,        // points in FOV circle

    // Display settings
    donutInnerRadius: 8,        // pixels
    donutOuterRadius: 12,       // pixels
    selectedDonutScale: 1.3,    // scale factor when selected
    fovLineWidth: 1,            // pixels

    // Colors
    colors: {
      donut: [157, 212, 255],        // RGB
      donutSelected: [0, 255, 102],  // RGB
      fovCircle: [157, 212, 255, 80] // RGBA with alpha
    }
  },

  // Validation Rules
  validation: {
    sensor: {
      nameMaxLength: 20,
      latMin: -90,
      latMax: 90,
      lonMin: -180,
      lonMax: 180,
      altMin: -500,     // meters (Dead Sea)
      altMax: 9000,     // meters (Mt. Everest)
      fovAltMin: 100,   // kilometers
      fovAltMax: 50000  // kilometers (beyond LEO)
    },
    satellite: {
      nameMaxLength: 30,
      tleLineLength: 69
    }
  },

  // Logging Configuration
  logging: {
    maxBufferSize: 500,
    categories: {
      MAP: 'MAP',
      SATELLITE: 'SAT',
      SENSOR: 'SNS',
      PANEL: 'UI',
      SYNC: 'SYNC',
      DATA: 'DATA'
    },
    levels: {
      INFO: 'info',
      SUCCESS: 'success',
      WARNING: 'warning',
      ERROR: 'error',
      DIAGNOSTIC: 'diagnostic'
    }
  },

  // WebSocket Configuration
  websocket: {
    reconnectAttempts: 5,
    reconnectDelay: 1000,       // milliseconds
    reconnectBackoff: 1.5,      // exponential backoff multiplier
    pingInterval: 30000,        // milliseconds
    messageTimeout: 5000        // milliseconds
  },

  // Development/Production Flags
  debug: {
    logStateChanges: false,
    logEventEmissions: false,
    logPerformance: false,
    showFPS: false,
    verboseErrors: true
  },

  // Version Info
  version: {
    app: '2.0.0-modular',
    plan: 'phase-0',
    lastUpdate: '2025-11-25'
  }
};

// Freeze config to prevent accidental modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.api);
Object.freeze(CONFIG.map);
Object.freeze(CONFIG.performance);
Object.freeze(CONFIG.ui);
Object.freeze(CONFIG.colors);
Object.freeze(CONFIG.satellites);
Object.freeze(CONFIG.sensors);
Object.freeze(CONFIG.validation);
Object.freeze(CONFIG.logging);
Object.freeze(CONFIG.websocket);
Object.freeze(CONFIG.debug);
Object.freeze(CONFIG.version);

export default CONFIG;
