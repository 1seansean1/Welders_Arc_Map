# Satellite Visualization System

High-performance satellite tracking and orbital mechanics visualization system.

## ✅ Implemented Features

### 1. Collapsible Control Panel
- **Position**: Left sidebar
- **States**:
  - Collapsed: Icon-only (60px wide)
  - Expanded: Icon + label (280px wide)
- **Interaction**:
  - Click anywhere on collapsed panel to expand
  - Click collapse button (✕) or outside panel to collapse
  - Buttons highlight on hover
- **Mobile**:
  - Panel overlays map (doesn't shift content)
  - Touch-friendly (44px minimum touch targets)
  - Auto-collapses on mobile devices

### 2. Navigation Buttons
- ⏰ **Time** - Time range controls (active by default)
- 🛰️ **Satellites** - Satellite selection (coming soon)
- 📡 **Sensors** - Sensor configuration (coming soon)
- 📊 **Analysis** - Analysis tools (coming soon)
- 📈 **Real Time Data** - Live updates (coming soon)
- 📋 **Logs** - System logs (coming soon)
- ⚙️ **Settings** - Application settings (coming soon)

### 3. Time Controls
- **NOW Button**: Resets all times to current UTC
- **Start Time**:
  - Default: NOW - 24 hours (lookback)
  - Left/Right arrows: ±1 day per click
  - Datetime picker for manual selection
- **Stop Time**:
  - Default: NOW
  - Left/Right arrows: ±1 day per click
  - Datetime picker for manual selection

## 🏗️ Architecture

```
WA_map/
├── backend/
│   └── main.py              # FastAPI server
├── static/
│   └── app.js               # Frontend JavaScript
├── templates/
│   └── index.html           # Main application UI
├── venv/                    # Python virtual environment
├── requirements.txt         # Python dependencies
└── README.md               # This file
```

## 🚀 Running the Application

### Start the Server

```bash
cd C:\Users\seanp\Workspace\WA_map\backend
..\venv\Scripts\python main.py
```

### Access the Application

- **Web UI**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/api/health

## 🎨 Design Philosophy & Technical Requirements

### 1. Performance (Extreme Priority)
**Goal**: Zero lag, maximum responsiveness, 60 FPS rendering at all times

**Implementation Strategies**:
- Pre-calculation of computationally expensive operations
- Dynamic loading based on viewport and zoom level
- Pointer storage for efficient data access
- Spline interpolation for smooth animations
- Aggressive caching strategies
- Dynamic resolution/level-of-detail (LOD) system:
  - High detail when zoomed in or static
  - Reduced detail when zooming/scrolling
  - Adaptive mesh/geometry based on viewport

**Current Targets**:
- **Target**: 55-60 FPS
- **Frame budget**: <16.67ms per frame
- **Panel animation**: CSS transform (GPU-accelerated)
- **Responsive**: Debounced resize handlers

### 2. Cross-Platform Architecture
**Requirements**:
- Web application (primary)
- Mobile-friendly (minimal rework for deployment)
- Offline/online performance parity
- Progressive Web App (PWA) capabilities

**Mobile Compatibility**:
All code includes mobile compatibility notes:
- Responsive breakpoints: 768px (tablet), 480px (mobile)
- Touch events supported
- Overlay panel on mobile
- 44x44px minimum touch targets
- Hardware-accelerated animations

### 3. Code Documentation Standards
**Mobile Optimization Notes**:
- Systematic documentation at every level:
  - Class-level: Architecture decisions, mobile considerations
  - Method-level: Performance implications, refactoring guidance
  - Function-level: Optimization opportunities
- Clear markers for mobile-specific refactoring needs
- Performance budgets documented inline

### 4. System Capacity & Computational Load
**User Capacity**: Maximum 50 concurrent users

**Heavy Computation Requirements**:
- Satellite TLE propagation (SGP4/SDP4)
- State vector calculations
- Covariance matrix operations
- Earth shadow geometry:
  - Penumbra calculations
  - Umbra calculations
- Coordinate frame transformations:
  - ECI ↔ ECEF
  - Topocentric conversions
  - Orbital frame transformations

### 5. UI/UX Design Philosophy
**Core Principle**: Minimalistic³ (minimalistic × minimalistic × minimalistic)

**Visual Guidelines**:
- **Colors**: Very limited palette (2-3 primary colors maximum)
  - Current: `#0a0a0a` background, `#f5f5f5` text, `#9dd4ff` accent
- **Typography**:
  - Single font family (system fonts for speed)
  - Minimal size variations (2-3 sizes total)
  - Minimal color variations
- **Elements**:
  - Thin lines (1px borders preferred)
  - Minimal padding/spacing
  - Small, unobtrusive icons
  - Compact buttons
  - NOT bold or large - subtle and refined
- **Layout**:
  - Clean, uncluttered interface
  - Maximum content-to-chrome ratio
  - Every pixel must justify its existence

## 📊 Performance Monitoring

### Frontend
- Panel animations use CSS transforms (60fps)
- Debounced resize handlers (250ms)
- Passive touch event listeners

### Backend
- FastAPI async/await for non-blocking I/O
- CORS enabled for cross-origin requests
- WebSocket support for real-time updates

## 🔧 Technology Stack

### Backend
- **Framework**: FastAPI 0.122.0
- **Server**: Uvicorn with auto-reload
- **SGP4**: Skyfield 1.53 (orbital mechanics)
- **Caching**: Redis (planned)
- **Database**: PostgreSQL + TimescaleDB (planned)

### Frontend
- **Visualization**: Deck.gl 9.0.0 (planned integration)
- **Base Map**: Mapbox GL JS 3.0.1 (requires API key)
- **Styling**: Vanilla CSS (no framework, max performance)
- **JavaScript**: ES6+, no build step required

## ✅ Tested Compatibility

### Python 3.14.0
All dependencies installed successfully:
- ✅ FastAPI
- ✅ Uvicorn
- ✅ Skyfield (SGP4 propagation)
- ✅ NumPy
- ✅ Redis client
- ✅ WebSockets

### Browsers
- Chrome/Edge (recommended)
- Firefox
- Safari (iOS/macOS)
- Mobile browsers (tested responsive design)

## 🎯 Next Steps

### Immediate Priorities
1. **Deck.gl Integration**: Add satellite layer rendering
2. **Mapbox Token**: Configure Mapbox API key for base map
3. **SGP4 Propagation**: Implement actual orbital calculations
4. **WebSocket**: Real-time position updates

### Future Enhancements
1. Load TLE data from CelesTrak/Space-Track
2. Implement satellite search/filtering
3. Add ground station visibility calculations
4. Umbra/penumbra shadow overlay
5. Performance monitoring panel (Ctrl+Shift+P)

## 📝 Code Organization

### Mobile Compatibility Notes
Every file includes mobile compatibility comments:
- **HTML**: Viewport meta tags, responsive CSS
- **CSS**: Media queries, touch-friendly sizing
- **JavaScript**: Touch events, adaptive updates

### Performance Comments
Key functions include:
- **Big O complexity** analysis
- **Target execution time** specifications
- **Mobile-specific** optimizations

## 🐛 Known Issues

1. **Mapbox Token Required**: Need valid token for base map
   - Get free token at: https://account.mapbox.com/
   - Add to `app.js`: `MAPBOX_ACCESS_TOKEN`

2. **Mock Data**: Currently using placeholder satellite data
   - Will be replaced with real TLE propagation

3. **Deck.gl Layer**: Not yet configured
   - Will add ScatterplotLayer for satellites

## 📖 API Endpoints

### `GET /api/health`
Health check endpoint

### `GET /api/time/now`
Get current UTC time

### `GET /api/satellites`
Get list of satellites
- Query params: `limit`, `offset`

### `GET /api/satellites/positions`
Get satellite positions at specific time
- Query params: `time` (ISO format), `norad_ids` (comma-separated)

### `WebSocket /ws/realtime`
Real-time position updates (1 Hz)

## 💡 Usage Tips

### Panel Shortcuts
- **Expand**: Click anywhere on collapsed panel
- **Collapse**: Click ✕ button or click outside panel
- **Switch sections**: Click navigation buttons

### Time Controls
- **Quick reset**: Click NOW button
- **Increment**: Use ◀ ▶ arrows (±1 day)
- **Precise**: Click datetime input for calendar picker

### Keyboard Support (Planned)
- `Ctrl+Shift+P`: Toggle performance panel
- `Escape`: Collapse control panel
- `Space`: Play/pause time animation

## 🔒 Security Notes

### Production Checklist
- [ ] Restrict CORS origins (currently allows all)
- [ ] Add API rate limiting
- [ ] Implement authentication for sensitive endpoints
- [ ] Use HTTPS in production
- [ ] Sanitize user inputs
- [ ] Add CSP headers

## 📄 License

[To be determined]

---

**Built with**: Python 3.14, FastAPI, Deck.gl, Vanilla JS
**Performance Target**: 60 FPS, <100ms API responses
**Mobile**: Fully responsive, touch-optimized
