# Event Types Documentation

This document describes all events used in the Event Bus system. Events follow a namespaced naming convention: `category:action`.

## Event Naming Convention

- **Format**: `category:action` (e.g., `sensor:added`, `map:loaded`)
- **Categories**: sensor, satellite, map, time, ui, system
- **Actions**: added, removed, updated, selected, loaded, error, etc.

## Event Categories

### Sensor Events

Events related to ground sensor operations.

| Event Name | Data Payload | Description |
|-----------|--------------|-------------|
| `sensor:added` | `{id, name, lat, lon, alt, fovAltitude}` | New sensor added to map |
| `sensor:removed` | `{id}` | Sensor removed from map |
| `sensor:updated` | `{id, ...changes}` | Sensor properties updated |
| `sensor:selected` | `{id}` | Sensor selected by user |
| `sensor:deselected` | `{id}` | Sensor deselected by user |
| `sensor:cleared` | `null` | All sensors removed |

### Satellite Events

Events related to satellite operations.

| Event Name | Data Payload | Description |
|-----------|--------------|-------------|
| `satellite:added` | `{id, name, tle1, tle2}` | New satellite added to map |
| `satellite:removed` | `{id}` | Satellite removed from map |
| `satellite:updated` | `{id, ...changes}` | Satellite properties updated |
| `satellite:selected` | `{id}` | Satellite selected by user |
| `satellite:deselected` | `{id}` | Satellite deselected by user |
| `satellite:cleared` | `null` | All satellites removed |
| `satellite:position:updated` | `{id, lat, lon, alt}` | Satellite position recalculated |

### Map Events

Events related to map interactions and state.

| Event Name | Data Payload | Description |
|-----------|--------------|-------------|
| `map:loaded` | `null` | Map initialization complete |
| `map:moved` | `{center, zoom}` | Map view changed (pan/zoom) |
| `map:clicked` | `{lat, lon, lngLat}` | User clicked on map |
| `map:layer:toggled` | `{layerId, visible}` | Map layer visibility changed |
| `map:ready` | `null` | Map fully loaded and ready for use |

### Time Events

Events related to time simulation and controls.

| Event Name | Data Payload | Description |
|-----------|--------------|-------------|
| `time:changed` | `{date}` | Simulation time changed |
| `time:play` | `{speed}` | Time simulation started |
| `time:pause` | `null` | Time simulation paused |
| `time:step` | `{direction, amount}` | Time stepped forward/backward |
| `time:reset` | `null` | Time reset to current |

### UI Events

Events related to user interface interactions.

| Event Name | Data Payload | Description |
|-----------|--------------|-------------|
| `ui:panel:opened` | `{panelId}` | UI panel opened |
| `ui:panel:closed` | `{panelId}` | UI panel closed |
| `ui:form:submit` | `{formId, data}` | Form submitted |
| `ui:form:cancel` | `{formId}` | Form cancelled |
| `ui:notification` | `{message, type}` | Show user notification |
| `ui:loading:start` | `{task}` | Loading indicator shown |
| `ui:loading:end` | `{task}` | Loading indicator hidden |

### System Events

Events related to application lifecycle and errors.

| Event Name | Data Payload | Description |
|-----------|--------------|-------------|
| `system:init` | `null` | Application initialization started |
| `system:ready` | `null` | Application fully initialized |
| `system:error` | `{error, context}` | Application error occurred |
| `system:warning` | `{message, context}` | Warning message |
| `system:debug` | `{message, data}` | Debug information |

### State Events

Events related to state changes.

| Event Name | Data Payload | Description |
|-----------|--------------|-------------|
| `state:sensor:changed` | `{sensors}` | Sensor state updated |
| `state:satellite:changed` | `{satellites}` | Satellite state updated |
| `state:ui:changed` | `{key, value}` | UI state property changed |
| `state:time:changed` | `{currentTime, playing, speed}` | Time state updated |

## Usage Examples

### Subscribing to Events

```javascript
import eventBus from './modules/events/eventBus.js';

// Subscribe to sensor additions
eventBus.on('sensor:added', (data) => {
    console.log('New sensor:', data.name);
    // Update UI, map, etc.
});

// One-time subscription
eventBus.once('map:loaded', () => {
    console.log('Map is ready!');
    initializeSensors();
});

// Multiple event handlers
eventBus.on('satellite:position:updated', updateMarker);
eventBus.on('satellite:position:updated', checkVisibility);
eventBus.on('satellite:position:updated', logPosition);
```

### Emitting Events

```javascript
import eventBus from './modules/events/eventBus.js';

// Emit with data payload
eventBus.emit('sensor:added', {
    id: 1,
    name: 'Sensor Alpha',
    lat: 47.6062,
    lon: -122.3321,
    alt: 100,
    fovAltitude: 500
});

// Emit without data
eventBus.emit('map:ready');

// Emit error
eventBus.emit('system:error', {
    error: new Error('Failed to load satellite'),
    context: 'satellite-loader'
});
```

### Unsubscribing from Events

```javascript
import eventBus from './modules/events/eventBus.js';

// Keep reference to handler
const handleSensorAdded = (data) => {
    console.log('Sensor added:', data);
};

// Subscribe
eventBus.on('sensor:added', handleSensorAdded);

// Later, unsubscribe
eventBus.off('sensor:added', handleSensorAdded);

// Clear all listeners for an event
eventBus.clear('sensor:added');

// Clear all listeners for all events
eventBus.clear();
```

## Event Flow Examples

### Adding a Sensor

```
User clicks "Add Sensor" button
    ↓
UI emits: ui:form:submit
    ↓
Sensor state validates input
    ↓
Sensor state emits: sensor:added
    ↓
Map module listens and adds marker
UI module listens and updates list
Logger listens and logs action
```

### Time Simulation

```
User clicks "Play" button
    ↓
Time controls emit: time:play
    ↓
Time state starts interval
    ↓
Every frame:
    Time state emits: time:changed
        ↓
    Satellite state listens and recalculates positions
        ↓
    For each satellite:
        Satellite state emits: satellite:position:updated
            ↓
        Map module listens and updates marker
        UI module listens and updates info panel
```

### Error Handling

```
Satellite calculation fails
    ↓
Satellite state emits: system:error
    ↓
Error handler listens and:
    - Logs to console
    - Shows user notification
    - Reports to logger
    - Optionally reports to server
```

## Best Practices

1. **Event Naming**
   - Use lowercase with colons (e.g., `sensor:added`)
   - Keep names descriptive but concise
   - Follow the `category:action` pattern

2. **Data Payloads**
   - Include all relevant data
   - Use consistent property names
   - Don't pass entire objects if only ID is needed

3. **Error Handling**
   - Always handle errors in listeners
   - Use try/catch blocks
   - Event bus will catch and log errors automatically

4. **Performance**
   - Unsubscribe when no longer needed
   - Use `once()` for one-time events
   - Avoid emitting events in tight loops

5. **Debugging**
   - Enable debug mode: `eventBus.setDebug(true)`
   - Check listener counts: `eventBus.listenerCount('event:name')`
   - View stats: `eventBus.getStats()`

## Module Responsibilities

Each module should emit and listen to specific events:

- **Sensor State**: Emits sensor:*, listens to ui:form:submit (sensor forms)
- **Satellite State**: Emits satellite:*, listens to time:changed
- **Time State**: Emits time:*, listens to ui controls
- **Map Module**: Listens to sensor:*, satellite:*, time:changed
- **UI Module**: Emits ui:*, listens to sensor:*, satellite:*, system:*
- **Logger**: Listens to all events (passive observer)

## Future Events

Events that may be added in later phases:

- `connection:*` - Backend API connection events
- `redis:*` - Redis cache events
- `export:*` - Data export events
- `import:*` - Data import events
- `settings:*` - Application settings events
- `theme:*` - UI theme events
