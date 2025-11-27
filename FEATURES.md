# WA_map Feature Registry

> **Document Type**: FEATURES
> **Version**: 1.0
> **Last Updated**: 2025-11-26
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

### Satellite Management (SAT)

| ID | Feature | Priority | Complexity | Status | Dependencies |
|----|---------|----------|------------|--------|--------------|
| SAT-001 | Satellite State Module | P0 | M | DONE | None |
| SAT-002 | Satellite CRUD Operations | P0 | M | DONE | SAT-001 |
| SAT-003 | TLE Validation & Parsing | P0 | S | DONE | SAT-002 |
| SAT-004 | Satellite Table UI | P1 | M | DONE | SAT-001 |
| SAT-005 | Ground Track Visualization | P1 | L | DONE | SAT-001, MAP-003 |
| SAT-006 | SGP4 Orbital Propagation | P0 | M | DONE | SAT-005 |
| SAT-007 | Watchlist (Star) Feature | P2 | S | DONE | SAT-001 |
| SAT-008 | Anti-Meridian Handling | P2 | S | DONE | SAT-005 |
| SAT-009 | Satellite Selection Sync | P1 | S | DONE | SAT-001, MAP-003 |
| SAT-010 | Real-time TLE Updates | P2 | L | PLAN | SAT-001, Backend |
| SAT-011 | Satellite Search/Filter | P2 | M | IDEA | SAT-004 |
| SAT-012 | Ground Track Gradient Fade | P2 | M | DONE | SAT-005 |
| SAT-013 | Chevron Satellite Icon | P2 | M | DONE | SAT-005 |
| SAT-014 | Equator Crossing Glow | P2 | M | DONE | SAT-005 |
| SAT-015 | Multi-layer Glow Effect | P2 | S | DONE | SAT-014 |
| SAT-016 | Chevron-Based Glow Enhancement | P2 | M | DONE | SAT-014, SAT-015 |

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

### Control Panel (UI)

| ID | Feature | Priority | Complexity | Status | Dependencies |
|----|---------|----------|------------|--------|--------------|
| UI-001 | Collapsible Panel | P0 | M | DONE | None |
| UI-002 | 9-Section Navigation | P0 | S | DONE | UI-001 |
| UI-003 | Mobile Overlay Mode | P1 | S | DONE | UI-001 |
| UI-004 | Click-Outside Collapse | P2 | XS | DONE | UI-001 |
| UI-005 | Modal System | P0 | M | DONE | None |
| UI-006 | Confirmation Dialogs | P1 | S | DONE | UI-005 |
| UI-007 | Analysis Section | P2 | L | PLAN | UI-002 |
| UI-008 | Real-time Data Section | P2 | L | PLAN | UI-002, Backend |
| UI-009 | Settings Section | P2 | M | DONE | UI-002 |
| UI-010 | Glow Effect Controls | P2 | S | DONE | UI-009, SAT-014 |
| UI-011 | Tests Panel | P2 | S | DONE | UI-002, TEST-001 |
| UI-012 | Watch List Panel | P2 | S | DONE | UI-002 |

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
| LOG-009 | Log Level Filtering | P3 | M | IDEA | LOG-001 |
| LOG-010 | Log Search | P3 | M | IDEA | LOG-001 |

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
| BACK-008 | Authentication | P3 | L | IDEA | BACK-001 |
| BACK-009 | Rate Limiting | P3 | S | IDEA | BACK-001 |

### Architecture (ARCH)

| ID | Feature | Priority | Complexity | Status | Dependencies |
|----|---------|----------|------------|--------|--------------|
| ARCH-001 | ES6 Module System | P0 | XL | DONE | None |
| ARCH-002 | Event Bus Pattern | P0 | M | DONE | ARCH-001 |
| ARCH-003 | State Management | P0 | L | DONE | ARCH-001 |
| ARCH-004 | Deck.gl Batch Manager | P1 | M | DONE | MAP-003 |
| ARCH-005 | Diagnostics Framework | P1 | M | DONE | MAP-003 |

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
| MAP | 10 | 10 | 0 | 0 | 0 |
| SAT | 16 | 14 | 0 | 1 | 1 |
| SEN | 9 | 8 | 0 | 0 | 1 |
| TIME | 20 | 20 | 0 | 0 | 0 |
| UI | 12 | 10 | 0 | 2 | 0 |
| LOG | 10 | 8 | 0 | 0 | 2 |
| TEST | 15 | 13 | 0 | 1 | 0 |
| BACK | 9 | 3 | 0 | 4 | 2 |
| ARCH | 5 | 5 | 0 | 0 | 0 |
| **TOTAL** | **106** | **91** | **0** | **8** | **6** |

**Completion Rate**: 86% (91/106 features complete)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
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
