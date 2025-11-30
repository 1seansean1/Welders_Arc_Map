# WA_map Feature Registry

> **Document Type**: FEATURES
> **Version**: 5.6
> **Last Updated**: 2025-11-30
> **Maintainer**: AI Governor System

---

## Status Legend

| Code | Status | Description |
|------|--------|-------------|
| DONE | Complete | Fully implemented and tested |
| WIP | In Progress | Currently being developed |
| PLAN | Planned | Approved for development |
| IDEA | Proposed | Under consideration |
| HOLD | On Hold | Deferred or blocked |

## Priority Legend

| Priority | Meaning |
|----------|---------|
| P0 | Critical - Core functionality |
| P1 | High - Essential features |
| P2 | Medium - Important enhancements |
| P3 | Low - Nice to have |

## Complexity Legend

| Complexity | Effort Estimate |
|------------|-----------------|
| XS | < 2 hours |
| S | 2-8 hours |
| M | 1-3 days |
| L | 1-2 weeks |
| XL | 2+ weeks |

---

## Feature Matrix

### Map Visualization (MAP)

| ID | Feature | Priority | Complexity | Status | Dependencies |
|----|---------|----------|------------|--------|--------------|
| MAP-001 | Leaflet.js 2D Map | P0 | M | DONE | None |
| MAP-002 | CartoDB Dark Matter Tiles | P0 | XS | DONE | MAP-001 |
| MAP-003 | Deck.gl WebGL Overlay | P0 | L | DONE | MAP-001 |
| MAP-004 | Leaflet-Deck.gl Sync | P0 | M | DONE | MAP-001, MAP-003 |
| MAP-005 | 4-Pane Resizable Grid | P1 | M | DONE | None |
| MAP-006 | Crosshair Resize Handle | P1 | S | DONE | MAP-005 |
| MAP-007 | Map Maximize/Restore | P2 | S | DONE | MAP-001 |
| MAP-008 | Infinite World Wrapping | P2 | S | DONE | MAP-001 |
| MAP-009 | Touch/Mobile Support | P1 | M | DONE | MAP-001 |
| MAP-010 | Smart Aspect Ratio Zoom | P3 | S | DONE | MAP-005 |
| MAP-011 | Equator Reference Line | P2 | XS | DONE | MAP-003 |
| MAP-012 | Fit Earth Button | P2 | S | DONE | MAP-001, MAP-005 |
| MAP-013 | ~~Fit View Button~~ | P2 | XS | REMOVED | ~~MAP-001~~ |
| MAP-014 | Remove + from Fit Button | P2 | XS | DONE | MAP-012 |
| MAP-015 | Clock Overlay Styling | P2 | XS | DONE | TIME-018 |
| MAP-016 | Fit Button Maximized Mode | P2 | XS | DONE | MAP-012 |
| MAP-017 | Zoom Level Display | P2 | XS | DONE | MAP-001, TIME-018 |

### Satellite Management (SAT)

| ID | Feature | Priority | Complexity | Status | Dependencies |
|----|---------|----------|------------|--------|--------------|
| SAT-001 | Satellite State Module | P0 | M | DONE | None |
| SAT-002 | Satellite CRUD Operations | P0 | M | DONE | SAT-001 |
| SAT-003 | TLE Validation & Parsing | P0 | S | DONE | SAT-002 |
| SAT-004 | Satellite Table UI | P1 | M | DONE | SAT-001 |
| SAT-005 | Ground Track Visualization | P1 | L | DONE | SAT-001, MAP-003 |
| SAT-006 | SGP4 Orbital Propagation | P0 | M | DONE | SAT-005 |
| SAT-007 | ~~Watchlist (Star) Column~~ | P2 | S | REMOVED | ~~SAT-001~~ |
| SAT-024 | +Sat Modal with Color/List | P1 | M | DONE | SAT-001, LIST-001 |
| SAT-008 | Anti-Meridian Handling | P2 | S | DONE | SAT-005 |
| SAT-009 | Satellite Selection Sync | P1 | S | DONE | SAT-001, MAP-003 |
| SAT-010 | Real-time TLE Updates | P2 | L | PLAN | SAT-001, Backend |
| SAT-011 | Satellite Search/Filter | P2 | M | IDEA | SAT-004 |
| SAT-012 | Ground Track Gradient Fade | P2 | M | DONE | SAT-005 |
| SAT-013 | Chevron Satellite Icon | P2 | M | DONE | SAT-005 |
| SAT-014 | Equator Crossing Glow | P2 | M | DONE | SAT-005 |
| SAT-015 | Multi-layer Glow Effect | P2 | S | DONE | SAT-014 |
| SAT-016 | Chevron-Based Glow Enhancement | P2 | M | DONE | SAT-014, SAT-015 |
| SAT-017 | Anti-Meridian Segment Wrapping | P2 | S | DONE | SAT-005, SAT-008 |
| SAT-018 | Latitude Apex Glow Ticks | P2 | M | DONE | SAT-014, SAT-015 |
| SAT-019 | Watch List Color Assignment | P2 | M | DONE | SAT-007, MAP-003 |
| SAT-020 | User Lists Feature | P2 | M | DONE | SAT-001, LIST-001 |
| SAT-021 | Aggressive Tail Gradient Taper | P2 | XS | DONE | SAT-012 |
| SAT-022 | EventDetector Module | P1 | M | DONE | SAT-014 |
| SAT-023 | Apex Tick Pulse Controls | P2 | M | DONE | SAT-018, TIME-001 |

### User Lists (LIST)

| ID | Feature | Priority | Complexity | Status | Dependencies |
|----|---------|----------|------------|--------|--------------|
| LIST-001 | List State Module | P1 | M | DONE | None |
| LIST-002 | List CRUD Operations | P1 | S | DONE | LIST-001 |
| LIST-003 | ~~List Table UI~~ | P1 | M | REMOVED | ~~LIST-001~~ |
| LIST-004 | ~~Add to List Dropdown~~ | P1 | S | REMOVED | ~~LIST-001, SAT-004~~ |
| LIST-005 | List Visibility Toggle | P1 | S | DONE | LIST-001, MAP-003 |
| LIST-006 | List localStorage Persistence | P1 | S | DONE | LIST-001 |
| LIST-007 | +List Modal with Satellite Picker | P1 | M | DONE | LIST-001, SAT-001 |
| LIST-008 | Consolidated List Management | P1 | M | DONE | LIST-007, UI |
| LIST-009 | Selected Only Default Unchecked | P2 | XS | DONE | LIST-007 |
| LIST-010 | Bulk Select Loading Indicator | P2 | S | DONE | LIST-007 |
| LIST-011 | Custom Delete Confirmation Modal | P2 | S | DONE | LIST-001, UI-005 |


### Catalog Management (CAT)

| ID | Feature | Priority | Complexity | Status | Dependencies |
|----|---------|----------|------------|--------|--------------|
| CAT-001 | Catalog State Module | P0 | M | DONE | None |
| CAT-002 | Catalog Table UI | P1 | M | DONE | CAT-001 |
| CAT-003 | Celestrak Auto-Fetch | P1 | S | DONE | CAT-001 |
| CAT-004 | TLE Batch Import Modal | P1 | M | DONE | CAT-001, UI-005 |
| CAT-005 | Catalog Edit Modal | P1 | M | DONE | CAT-001, UI-005, LIST-001 |

### Sensor Management (SEN)

| ID | Feature | Priority | Complexity | Status | Dependencies |
|----|---------|----------|------------|--------|--------------|
| SEN-001 | Sensor State Module | P0 | M | DONE | None |
| SEN-002 | Sensor CRUD Operations | P0 | M | DONE | SEN-001 |
| SEN-003 | Sensor Table UI | P1 | M | DONE | SEN-001 |
| SEN-004 | Sortable Columns | P2 | S | DONE | SEN-003 |
| SEN-005 | FOV Circle Visualization | P1 | M | DONE | SEN-001, MAP-003 |
| SEN-006 | FOV Altitude Configuration | P2 | S | DONE | SEN-005 |
| SEN-007 | Sensor Icon Layer | P1 | S | DONE | SEN-001, MAP-003 |
| SEN-008 | Input Validation | P1 | S | DONE | SEN-002 |
| SEN-009 | Sensor Search/Filter | P3 | M | IDEA | SEN-003 |

### Time Controls (TIME)

| ID | Feature | Priority | Complexity | Status | Dependencies |
|----|---------|----------|------------|--------|--------------|
| TIME-001 | Time State Module | P0 | M | DONE | None |
| TIME-002 | Start/Stop Time Inputs | P0 | S | DONE | TIME-001 |
| TIME-003 | Flatpickr Integration | P1 | S | DONE | TIME-002 |
| TIME-004 | NOW Buttons | P1 | XS | DONE | TIME-002 |
| TIME-005 | Arrow Buttons (±1 Day) | P2 | XS | DONE | TIME-002 |
| TIME-006 | Pending State Tracking | P1 | S | DONE | TIME-001 |
| TIME-007 | Apply/Cancel Buttons | P1 | S | DONE | TIME-006 |
| TIME-008 | Time-based Ground Tracks | P1 | M | DONE | TIME-001, SAT-005 |
| TIME-009 | Current Time Display | P1 | S | DONE | TIME-001 |
| TIME-010 | Ground Track Tail/Head Controls | P2 | M | DONE | TIME-001, SAT-005 |
| TIME-011 | Time Slider with Step Controls | P1 | M | DONE | TIME-001 |
| TIME-012 | Hold-to-Repeat Step Buttons | P2 | S | DONE | TIME-011 |
| TIME-013 | Glow Fade Duration Control | P2 | S | DONE | UI-010 |
| TIME-014 | Separate Fade In/Out Controls | P2 | S | DONE | TIME-013 |
| TIME-015 | Map Time Bar | P1 | M | DONE | TIME-001, MAP-001 |
| TIME-016 | Real-time Play/Stop Mode | P1 | S | DONE | TIME-015 |
| TIME-017 | Sub-minute Time Steps | P2 | S | DONE | TIME-015 |
| TIME-018 | Dual Clock Display (UTC + Sim) | P2 | S | DONE | TIME-001 |
| TIME-019 | Rewind/Fast Forward Animation | P2 | S | DONE | TIME-015 |
| TIME-020 | Time Bar Button Reorder | P2 | XS | DONE | TIME-015 |
| TIME-021 | Full-Width Time Bar | P2 | XS | DONE | TIME-015 |
| TIME-022 | Clock with Date + T+Offset | P2 | S | DONE | TIME-001 |
| TIME-023 | Variable Playback Rate | P1 | S | DONE | TIME-015 |
| TIME-024 | Mouse Wheel Jog Control | P2 | S | DONE | TIME-023 |
| TIME-025 | Seek Points System (Stub) | P3 | XS | DONE | TIME-001 |
| TIME-026 | Time Window Presets | P1 | S | DONE | TIME-001 |
| TIME-027 | Inline Start/Stop DateTime Pickers | P1 | S | DONE | TIME-026 |
| TIME-028 | Time Bar Reorder + Stop Button | P1 | S | DONE | TIME-027 |
| TIME-029 | Compact Time Bar with Flatpickr | P1 | M | DONE | TIME-027, TIME-003 |
| TIME-030 | Map Time Bar Calendar Popups | P1 | S | DONE | TIME-029, TIME-003 |
| TIME-031 | Play/Pause Toggle (Remove Stop) | P2 | XS | DONE | TIME-016 |
| TIME-032 | Play Button Maintains Offset | P1 | S | DONE | TIME-016 |
| TIME-033 | Clock Format DD-MMM-YYYY UTC | P2 | XS | DONE | TIME-018 |
| TIME-034 | Double-Click Close Pickers | P2 | XS | DONE | TIME-029 |

### Control Panel (UI)

| ID | Feature | Priority | Complexity | Status | Dependencies |
|----|---------|----------|------------|--------|--------------|
| UI-001 | Collapsible Panel | P0 | M | DONE | None |
| UI-002 | 9-Section Navigation | P0 | S | DONE | UI-001 |
| UI-003 | Mobile Overlay Mode | P1 | S | DONE | UI-001 |
| UI-004 | Click-Outside Collapse | P2 | XS | DONE | UI-001 |
| UI-005 | Modal System | P0 | M | DONE | None |
| UI-006 | Confirmation Dialogs | P1 | S | DONE | UI-005 |
| UI-007 | Analysis Section | P2 | L | DONE | UI-002 |
| UI-008 | Real-time Data Section | P2 | L | PLAN | UI-002, Backend |
| UI-009 | Settings Section | P2 | M | DONE | UI-002 |
| UI-010 | Glow Effect Controls | P2 | S | DONE | UI-009, SAT-014 |
| UI-011 | Tests Panel | P2 | S | DONE | UI-002, TEST-001 |
| UI-012 | Watch List Panel | P2 | S | DONE | UI-002 |
| UI-013 | Styled Animation Icons | P2 | XS | DONE | TIME-019 |
| UI-014 | Button Highlight Consistency | P2 | XS | DONE | UI-002 |
| UI-015 | Double-Click Panel Close | P2 | XS | DONE | UI-002 |
| UI-016 | Table Column Alignment | P2 | XS | DONE | SEN-003, SAT-004 |
| UI-017 | Table Height Consistency | P2 | XS | DONE | UI-002 |
| UI-018 | Brighter Time Bar Borders | P2 | XS | DONE | TIME-015 |
| UI-019 | Ctrl+Wheel Jog Hint Text | P2 | XS | DONE | TIME-024 |
| UI-020 | Glow Size/Brightness Sliders | P2 | S | DONE | UI-010, SAT-014 |
| UI-021 | Profile Avatar Circle Fix | P2 | XS | DONE | UI-001 |
| UI-022 | Theme Toggle (Light/Dark Mode) | P2 | S | DONE | UI-009, MAP-002 |
| UI-023 | Light Theme Styling Consistency | P2 | S | DONE | UI-022 |
| UI-024 | Map Info Display (Size/Center) | P2 | XS | DONE | MAP-001, TIME-018 |
| UI-025 | Logs Section in Settings | P2 | XS | DONE | UI-009 |
| UI-026 | Canvas Size in Profile Defaults | P2 | XS | DONE | UI-009, AUTH-003 |
| UI-027 | Watch List Selector in Defaults | P2 | XS | DONE | UI-009, AUTH-003, LIST-001 |
| UI-028 | Settings Panel Slider Width Fix | P2 | XS | DONE | UI-009 |
| UI-029 | Design System & Style Guide | P2 | M | DONE | UI-009 |

### Logging System (LOG)

| ID | Feature | Priority | Complexity | Status | Dependencies |
|----|---------|----------|------------|--------|--------------|
| LOG-001 | UILogger Module | P0 | M | DONE | None |
| LOG-002 | Dual Console+UI Output | P0 | S | DONE | LOG-001 |
| LOG-003 | Color-Coded Log Levels | P1 | XS | DONE | LOG-001 |
| LOG-004 | Log Download (TXT) | P1 | S | DONE | LOG-001 |
| LOG-005 | Clear Button | P2 | XS | DONE | LOG-001 |
| LOG-006 | Resizable Log Panel | P2 | M | DONE | LOG-001 |
| LOG-007 | Right-Click Context Menu | P3 | S | DONE | LOG-001 |
| LOG-008 | Live Log Counter | P2 | XS | DONE | LOG-001 |
| LOG-009 | Log Level Filtering | P1 | M | DONE | LOG-001 |
| LOG-010 | Log Search | P3 | M | IDEA | LOG-001 |
| LOG-011 | Message Throttling | P1 | M | DONE | LOG-001 |
| LOG-012 | Two-Tier Storage (UI+Full Buffer) | P1 | M | DONE | LOG-001 |
| LOG-013 | Download All (Full Buffer) | P1 | S | DONE | LOG-012 |
| LOG-014 | Log Settings Controls | P2 | S | DONE | LOG-009, LOG-011 |

### Testing Infrastructure (TEST)

| ID | Feature | Priority | Complexity | Status | Dependencies |
|----|---------|----------|------------|--------|--------------|
| TEST-001 | Test Registry Module | P1 | M | DONE | None |
| TEST-002 | Test Results Persistence | P1 | M | DONE | TEST-001 |
| TEST-003 | Hypothesis-Driven Tests | P1 | M | DONE | TEST-001 |
| TEST-004 | Map Sync Tests (6) | P1 | M | DONE | TEST-001 |
| TEST-005 | State Module Tests (4) | P1 | S | DONE | TEST-001 |
| TEST-006 | Event Bus Tests (2) | P2 | S | DONE | TEST-001 |
| TEST-007 | UI Tests (3) | P2 | S | DONE | TEST-001 |
| TEST-008 | Validation Tests (2) | P2 | S | DONE | TEST-001 |
| TEST-009 | Test Panel UI | P2 | M | DONE | TEST-001 |
| TEST-010 | JSON/CSV Export | P2 | S | DONE | TEST-002 |
| TEST-011 | Regression Detection | P2 | S | DONE | TEST-002 |
| TEST-012 | Integration Flow Tests | P2 | M | PLAN | TEST-001 |
| TEST-013 | Test Panel Column Sorting | P2 | S | DONE | TEST-009 |
| TEST-014 | Enhanced Test Report Download | P2 | S | DONE | TEST-009, TEST-002 |
| TEST-015 | Column Sorting Hypothesis Test | P2 | XS | DONE | TEST-013, TEST-001 |
| TEST-016 | Failed-Only Test Report | P2 | XS | DONE | TEST-014 |
| TEST-017 | Split Download Buttons | P1 | XS | DONE | TEST-016 |

### Backend Infrastructure (BACK)

| ID | Feature | Priority | Complexity | Status | Dependencies |
|----|---------|----------|------------|--------|--------------|
| BACK-001 | FastAPI Server | P0 | M | DONE | None |
| BACK-002 | Static File Serving | P0 | XS | DONE | BACK-001 |
| BACK-003 | WebSocket Module (Stub) | P1 | S | DONE | BACK-001 |
| BACK-004 | PostgreSQL Integration | P2 | L | PLAN | BACK-001 |
| BACK-005 | TimescaleDB for Tracks | P2 | L | PLAN | BACK-004 |
| BACK-006 | Redis Caching | P2 | M | PLAN | BACK-001 |
| BACK-007 | TLE Fetching Service | P2 | M | PLAN | BACK-001 |
| BACK-008 | Authentication | P1 | M | WIP | BACK-001, PROFILE-003 |
| BACK-009 | Rate Limiting | P3 | S | IDEA | BACK-001 |
| BACK-010 | System Logging with Profile Tracking | P1 | M | DONE | BACK-001, PROFILE-003 |

### User Profiles (PROFILE)

| ID | Feature | Priority | Complexity | Status | Dependencies |
|----|---------|----------|------------|--------|--------------|
| PROFILE-001 | Profile State Module | P0 | M | DONE | ARCH-003 |
| PROFILE-002 | SQLite Database Setup | P0 | S | DONE | BACK-001 |
| PROFILE-003 | Profile API Endpoints | P0 | M | DONE | BACK-001, PROFILE-002 |
| PROFILE-004 | Login Modal UI | P1 | S | DONE | UI-001 |
| PROFILE-005 | Settings Persistence | P1 | M | DONE | PROFILE-001, PROFILE-002 |
| PROFILE-006 | Stubbed Roles/Permissions | P2 | XS | DONE | PROFILE-002 |
| PROFILE-007 | Default Profile Auto-Load | P1 | S | DONE | PROFILE-001, PROFILE-003 |

### Architecture (ARCH)

| ID | Feature | Priority | Complexity | Status | Dependencies |
|----|---------|----------|------------|--------|--------------|
| ARCH-001 | ES6 Module System | P0 | XL | DONE | None |
| ARCH-002 | Event Bus Pattern | P0 | M | DONE | ARCH-001 |
| ARCH-003 | State Management | P0 | L | DONE | ARCH-001 |
| ARCH-004 | Deck.gl Batch Manager | P1 | M | DONE | MAP-003 |
| ARCH-005 | Diagnostics Framework | P1 | M | DONE | MAP-003 |


### Analysis Tools (ANALYSIS)

| ID | Feature | Priority | Complexity | Status | Dependencies |
|----|---------|----------|------------|--------|--------------|
| ANALYSIS-001 | Analysis State Module | P1 | S | DONE | ARCH-003 |
| ANALYSIS-002 | Polar Plot Canvas | P1 | M | DONE | ANALYSIS-001, SEN-001 |
| ANALYSIS-003 | Az/El Calculation | P1 | S | DONE | SAT-006 |
| ANALYSIS-004 | Sensor Selection for Polar View | P1 | S | DONE | ANALYSIS-001, SEN-007 |
| ANALYSIS-005 | Polar Plot Hypothesis Tests | P2 | S | DONE | TEST-001, ANALYSIS-002 |
| ANALYSIS-006 | Polar Plot Sky Tracks | P1 | M | DONE | ANALYSIS-002, TIME-010 |
| ANALYSIS-007 | Track Color Coding | P2 | S | DONE | ANALYSIS-006, SAT-019 |
| ANALYSIS-008 | Direction Chevrons | P2 | S | DONE | ANALYSIS-006 |
| ANALYSIS-009 | Click-to-Select Integration | P1 | S | DONE | ANALYSIS-002, SAT-009 |
| ANALYSIS-010 | Selection Highlight Ring | P2 | XS | DONE | ANALYSIS-009 |
| ANALYSIS-011 | Enhanced Grid Labels | P2 | XS | DONE | ANALYSIS-002 |
| ANALYSIS-012 | Cross-Panel Entity Selection Sync | P1 | M | DONE | SAT-009, ARCH-002 |
| ANALYSIS-013 | Orange Theme on Sensor Selection | P1 | S | DONE | ANALYSIS-002, SEN-005 |
| ANALYSIS-014 | Sensor Click Auto-Enables Polar Plot | P2 | XS | DONE | ANALYSIS-001, MAP-003 |
| ANALYSIS-015 | Lambert Transfer Solver | P1 | L | DONE | ANALYSIS-001, SAT-006, CAT-001 |
| ANALYSIS-016 | Lambert Panel UI | P1 | M | DONE | ANALYSIS-015, UI-001 |
| ANALYSIS-017 | Transfer Arc Visualization | P1 | M | DONE | ANALYSIS-015, MAP-003 |

---

## Feature Details

### MAP-001: Leaflet.js 2D Map
**Priority**: P0 (Critical)
**Complexity**: M (1-3 days)
**Status**: DONE
**Version**: 1.0

**Description**: Core 2D map visualization using Leaflet.js 1.9.4 with Web Mercator projection.

**Capabilities**:
- CartoDB Dark Matter tiles (no API token required)
- Zoom levels 1-19
- Infinite horizontal panning with world wrapping
- Touch gesture support
- Keyboard navigation (arrow keys)

**Performance**:
- 60 FPS target
- 2-5ms frame budget
- 15-25 MB memory baseline

---

### SAT-005: Ground Track Visualization
**Priority**: P1 (High)
**Complexity**: L (1-2 weeks)
**Status**: DONE
**Version**: 2.0

**Description**: Orbital path visualization using SGP4 propagation and Deck.gl PathLayer.

**Capabilities**:
- 90-minute orbital paths (typical LEO period)
- 20-second time steps (270 points per track)
- Anti-meridian crossing handled via path splitting
- Grey coloring (prepared for conditional coloring)

**Performance**:
- <1ms per satellite propagation
- ~47ms layer creation for 18 satellites

---

## Summary Statistics

| Category | Total | DONE | WIP | PLAN | IDEA |
|----------|-------|------|-----|------|------|
| MAP | 16 | 16 | 0 | 0 | 0 |
| SAT | 23 | 21 | 0 | 1 | 1 |
| CAT | 5 | 5 | 0 | 0 | 0 |
| SEN | 9 | 8 | 0 | 0 | 1 |
| TIME | 34 | 34 | 0 | 0 | 0 |
| UI | 30 | 29 | 0 | 1 | 0 |
| LOG | 14 | 13 | 0 | 0 | 1 |
| TEST | 16 | 14 | 0 | 1 | 0 |
| BACK | 10 | 4 | 0 | 4 | 2 |
| ARCH | 5 | 5 | 0 | 0 | 0 |
| LIST | 6 | 6 | 0 | 0 | 0 |
| ANALYSIS | 14 | 14 | 0 | 0 | 0 |
| AUTH | 8 | 8 | 0 | 0 | 0 |
| **TOTAL** | **190** | **177** | **0** | **7** | **5** |

*Note: LOG-009 to LOG-014 added: Message throttling, two-tier storage, download all, settings controls*

**Completion Rate**: 93% (177/190 features complete)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 5.6 | 2025-11-30 | BACK-010 DONE: System Logging with Profile Tracking - backend logging system using structlog, logs all API requests with profile ID/username, 48-hour retention with auto-cleanup, GET/DELETE /api/logs endpoints, frontend headers updated to send X-Profile-ID and X-Username; H-LOG-13/14/15 tests added |
| 5.5 | 2025-11-29 | LOG-009 to LOG-014 DONE: Enhanced Logging System - message throttling (2s default, configurable), two-tier storage (UI filtered, full buffer for download), log level filtering UI in Settings, DL All button for full buffer download, Clear All button; H-LOG-9/10/11/12 tests added |
| 5.4 | 2025-11-29 | UI-029 DONE: Design System & Style Guide - centralized design tokens CSS file (/static/styles/design-tokens.css), comprehensive style guide markdown (docs/STYLE_GUIDE.md), living HTML component library (/static/style-guide.html), added missing CSS variables (--accent-primary, --accent-orange, --accent-cyan), fixed hardcoded colors; H-UI-18 test added |
| 5.2 | 2025-11-29 | UI-026/027/028 DONE: Canvas Size in Profile Defaults, Watch List Selector in Defaults, Settings Panel Slider Width Fix (reduced to 80px max-width for better alignment); H-PROFILE-4/5/6 tests added |
| 5.1 | 2025-11-29 | UI-024/025 DONE: Map Info Display (zoom/size/center coordinates in top-left overlay), Logs moved to Settings panel; H-UI-14/15/16/17 tests updated |
| 5.0 | 2025-11-29 | AUTH-001 to AUTH-008 DONE: User Login & Profile Defaults - Required login on app load, profile defaults modal in Settings, expanded settings schema (theme, glow, apex tick, map view), settings persistence per user, stubs for Authentik OAuth/session timeout/multi-user; H-PROFILE-1/2/3 tests added |
| 4.9 | 2025-11-29 | UI-023 DONE: Light Theme Styling Consistency - SATELLITE/SENSOR control panel icons now visible in light theme; equator glow markers use theme-aware colors (darker blue on light maps); apex latitude markers adjust for theme contrast; clock fonts normalized (consistent weight in light theme); apex opacity slider styled like other sliders; system log border highlight matches other borders; H-UI-17 test added |
| 4.8 | 2025-11-29 | UI-022 Light Theme Polish: Polar plot theme-aware colors; FOV polygon theme-aware colors (darker blue for light theme); clock glow/text override; map time bar background override; log panel buttons override; panel border highlight override (darker gradient); reduced theme toggle switch size (36x18px); H-UI-16 test updated for checkbox |
| 4.7 | 2025-11-29 | UI-022 Enhanced: Theme toggle now uses styled pill switch with accent blue color; map tiles switch between CartoDB Dark Matter and Positron; tile layer switching on theme change |
| 4.6 | 2025-11-29 | UI-022 DONE: Theme Toggle (Light/Dark Mode) - button in SETTINGS panel to switch between light and dark themes; preference persists in localStorage; H-UI-16 test added |
| 5.3 | 2025-11-29 | ANALYSIS-015/016/017 DONE: Lambert Transfer Solver - Izzo algorithm for orbital transfer analysis, Lambert panel UI (satellite dropdowns, TOF slider, revolution buttons, compute button), transfer arc visualization, delta-V results display; H-LAM-1 to H-LAM-7 tests added; Fixed catalogState/satelliteState ID lookup for catalog satellites |
| 4.5 | 2025-11-29 | TEST-017 DONE: Split Download Buttons - replaced single Download button with "Current Run" (minimal pass info, full fail details, no history) and "Full History" (all details + history) |
| 4.4 | 2025-11-29 | TEST-016 DONE: Failed-Only Test Report - Download button now exports only failed tests (summary still shows full stats) |
| 4.3 | 2025-11-29 | ANALYSIS-014 DONE: Sensor click auto-enables polar plot - clicking sensor on map auto-enables polar plot and selects that sensor; H-POLAR-11 test added; Fixed testRegistry.js syntax errors |
| 4.2 | 2025-11-28 | MAP-017, UI-020/021 DONE: Zoom level display below clocks, glow size/brightness sliders in Settings, profile avatar circle fix (smaller, always circular), clock format updated to DD-MMM-YYYY UTC; H-STATE-9/10/11 tests added |
| 4.1 | 2025-11-28 | ANALYSIS-012/013 DONE: Cross-Panel Entity Selection Sync - clicking satellite/sensor in any panel highlights it in all panels (map chevron, polar plot); Orange Theme on Sensor Selection - polar plot gridlines/border turn orange when sensor selected for polar view, FOV polygon turns orange on map; H-POLAR-8/9/10 tests added |
| 4.0 | 2025-11-28 | LIST-009/010/011 DONE: Watch list UX improvements - Selected Only default unchecked, bulk select loading indicator, custom delete confirmation modal; H-UI-14/15 tests added |
| 3.9 | 2025-11-28 | CAT-005 DONE: Catalog Edit Modal - double-click catalog row opens two-panel modal (satellite list + detail editor), edit satellite name/TLE/color, manage watch list memberships, rename catalog; H-CAT-5/6/7/8 tests added |
| 3.8 | 2025-11-28 | CAT-001 to CAT-004 DONE: Catalog Management - renamed Satellites panel to Catalogs, catalog state module, catalog table UI with checkbox/name/count columns, Celestrak auto-fetch on startup, +Cat modal with TLE batch import, H-CAT-1/2/3/4 tests added |
| 3.7 | 2025-11-28 | ANALYSIS-006 to ANALYSIS-011 DONE: Enhanced polar plot with sky tracks (head/tail minutes), track color coding (grey/red/blue/orange), direction chevrons, click-to-select integration, selection highlight ring, enhanced grid labels; H-POLAR-5/6/7 tests added |
| 3.6 | 2025-11-27 | ANALYSIS-001 to ANALYSIS-005, UI-007 DONE: Polar Plot feature - Analysis panel checkbox, canvas polar plot (az/el sky view), sensor selection for polar view, H-POLAR-1/2/3/4 tests |
| 3.5 | 2025-11-27 | LIST-003/004 REMOVED, SAT-007 REMOVED, LIST-007/008 & SAT-024 DONE: Consolidated satellite/list UI with +Sat and +List modal buttons |
| 3.4 | 2025-11-27 | TIME-032/033/034, UI-020/021 DONE: Play button preserves time offset, DDMMMYYYY UTC clock format, double-click close pickers, remove time window dropdown and Ctrl+wheel hint |
| 3.3 | 2025-11-27 | SAT-023 DONE: Apex Tick Pulse Controls - independent controls for apex latitude tick marks with horizontal pulse animation |
| 3.2 | 2025-11-27 | SAT-022 DONE: EventDetector module for decoupled event detection |
| 3.1 | 2025-11-27 | MAP-013 REMOVED (fit-view-btn), MAP-016 DONE (fit button maximized mode fix) |
| 3.0 | 2025-11-27 | MAP polish: Fit button fix (maximized), clock overlay styling, aggressive tail gradient, Play/Pause toggle, brighter borders, jog hint, calendar popups, UTC/SIM sync |
| 2.9 | 2025-11-27 | LIST-001 to LIST-006 DONE: User Lists feature with CRUD, visibility, localStorage |
| 2.8 | 2025-11-27 | TIME-029 DONE: Compact time bar redesign with Flatpickr, responsive groups |
| 2.7 | 2025-11-27 | TIME-027/TIME-028 DONE: Inline start/stop datetime pickers, time bar reorder, stop button |
| 2.6 | 2025-11-27 | Added TIME-023 to TIME-026: Playback rate, jog wheel, seek stubs, presets |
| 2.5 | 2025-11-26 | Added SAT-019: Watch List Color Assignment (table + chevron/track coloring) |
| 2.4 | 2025-11-26 | Added MAP-013: Fit View Button, H-MAP-7 test, fixed grid state sync |
| 2.3 | 2025-11-26 | Added UI-017: Table height consistency, H-UI-9 test |
| 2.2 | 2025-11-26 | Added MAP-012: Fit Earth Button, TIME-022: Enhanced clock display, UI-014/015/016: Button/panel/table fixes |
| 2.1 | 2025-11-26 | Added SAT-018: Latitude apex glow ticks |
| 2.0 | 2025-11-26 | Added SAT-017: Anti-meridian wrapping, MAP-011: Equator line, TIME-021: Full-width bar, UI-013: Styled icons |
| 1.9 | 2025-11-26 | Added TIME-019: Rewind/Fast Forward animation buttons |
| 1.8 | 2025-11-26 | Added TIME-018: Dual Clock Display (UTC + Sim), moved to top-left of map |
| 1.7 | 2025-11-26 | Added TIME-015/016/017: Map Time Bar with play/stop and sub-minute steps |
| 1.6 | 2025-11-26 | Added SAT-015: Multi-layer glow effect, TIME-014: Separate fade in/out controls |
| 1.5 | 2025-11-26 | Added TEST-015: Column sorting hypothesis test (H-UI-8) |
| 1.4 | 2025-11-26 | Added TEST-013/014: Test Panel column sorting, enhanced download report |
| 1.3 | 2025-11-26 | Added TIME-012/013, UI-011/012: hold-to-repeat, glow fade, Tests/Watch List panels |
| 1.2 | 2025-11-26 | Added TIME-011: Time Slider with Step Controls |
| 1.1 | 2025-11-26 | Added TLE rendering features: SAT-012/013/014, TIME-009/010, UI-009/010 |
| 1.0 | 2025-11-26 | Initial consolidated feature registry |
