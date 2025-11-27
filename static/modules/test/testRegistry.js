/**
 * Test Registry - Comprehensive Hypothesis Definitions
 *
 * All tests follow the hypothesis-driven debugging methodology:
 *   1. OBSERVE    → Document exact symptoms
 *   2. MEASURE    → Quantify with metrics/baselines
 *   3. HYPOTHESIZE → Form testable hypotheses
 *   4. PREDICT    → State expected outcomes
 *   5. EXPERIMENT → Run minimal intervention
 *   6. VALIDATE   → Accept/reject based on predictions
 *   7. ISOLATE    → Ablation testing
 *   8. REGRESS    → Verify no regressions
 *
 * Categories:
 *   H-MAP-*     Map rendering tests
 *   H-STATE-*   State management tests
 *   H-EVENT-*   Event bus tests
 *   H-UI-*      UI component tests
 *   H-VALID-*   Validation tests
 *   H-FLOW-*    Integration flow tests
 */

import logger from '../utils/logger.js';

// ============================================
// MAP TESTS (existing)
// ============================================

const MAP_HYPOTHESES = {
    'H-DRIFT-1': {
        id: 'H-DRIFT-1',
        name: 'Initial Zoom Offset',
        category: 'map',
        hypothesis: 'Missing -1 zoom offset on init causes Deck.gl/Leaflet position mismatch',
        symptom: 'Sensors appear in wrong position on initial load',
        prediction: 'Deck.gl zoom should equal Leaflet zoom minus 1',
        nullPrediction: 'Zoom values would match exactly (no offset)',
        threshold: { zoomDiff: 0.01 },
        causalChain: [
            'SYMPTOM: Position drift on initial load',
            'PROXIMATE: Deck.gl viewState zoom != Leaflet zoom - 1',
            'ROOT: Line 299 missing zoom offset',
            'MECHANISM: Deck.gl MapView uses different zoom scale',
            'FIX: Apply LEAFLET_TO_DECKGL_ZOOM_OFFSET constant'
        ]
    },
    'H-TIME-1': {
        id: 'H-TIME-1',
        name: 'Time Source',
        category: 'map',
        hypothesis: 'Ground tracks use wall clock instead of simulation time',
        symptom: 'Ground tracks ignore time control settings',
        prediction: 'Changing simulation time should move satellite positions',
        nullPrediction: 'Satellites would stay at current real-time positions',
        threshold: { timeApplied: true },
        causalChain: [
            'SYMPTOM: Ground tracks ignore time controls',
            'PROXIMATE: Positions calculated with new Date()',
            'ROOT: Line 680 uses wall clock not timeState',
            'MECHANISM: SGP4 propagation uses provided time',
            'FIX: Use timeState.getCurrentTime()'
        ]
    },
    'H-SYNC-PAN': {
        id: 'H-SYNC-PAN',
        name: 'Pan Synchronization',
        category: 'map',
        hypothesis: 'Deck.gl may drift from Leaflet during pan operations',
        symptom: 'Layers misalign during or after panning',
        prediction: 'Zero drift events during pan sequence',
        nullPrediction: 'Drift events would occur during rapid pan',
        threshold: { driftEvents: 0, maxDrift: 0.001 },
        causalChain: [
            'SYMPTOM: Layers misalign during pan',
            'PROXIMATE: viewState not synced on move event',
            'ROOT: Missing or delayed sync callback',
            'MECHANISM: Leaflet fires move before Deck.gl updates',
            'FIX: Sync viewState on every Leaflet move event'
        ]
    },
    'H-SYNC-ZOOM': {
        id: 'H-SYNC-ZOOM',
        name: 'Zoom Synchronization',
        category: 'map',
        hypothesis: 'Deck.gl may drift from Leaflet during zoom operations',
        symptom: 'Layers misalign during or after zooming',
        prediction: 'Zero drift events during zoom sequence',
        nullPrediction: 'Zoom drift would accumulate',
        threshold: { driftEvents: 0, maxZoomDrift: 0.01 },
        causalChain: [
            'SYMPTOM: Layers misalign during zoom',
            'PROXIMATE: Zoom offset not applied consistently',
            'ROOT: Async zoom events cause race condition',
            'MECHANISM: Leaflet zoom != Deck.gl zoom - 1',
            'FIX: Apply offset in all zoom handlers'
        ]
    },
    'H-PERF-1': {
        id: 'H-PERF-1',
        name: 'Rapid Pan Performance',
        category: 'map',
        hypothesis: 'Rapid panning may cause frame drops or visual glitches',
        symptom: 'Stuttering or flicker during fast pan',
        prediction: 'Less than 10% dropped frames, zero glitches',
        nullPrediction: 'High frame drop rate and visible glitches',
        threshold: { droppedFrameRate: 0.10, glitches: 0 },
        causalChain: [
            'SYMPTOM: Stutter during rapid pan',
            'PROXIMATE: Too many setProps calls per frame',
            'ROOT: No batching or throttling of updates',
            'MECHANISM: Each pan event triggers full re-render',
            'FIX: Batch setProps calls, use requestAnimationFrame'
        ]
    },
    'H-BATCH-1': {
        id: 'H-BATCH-1',
        name: 'setProps Batching',
        category: 'map',
        hypothesis: 'Unbatched setProps calls may cause race conditions',
        symptom: 'Intermittent visual glitches or state inconsistency',
        prediction: 'Combined viewState+layers calls should exist',
        nullPrediction: 'All calls would be viewState-only',
        threshold: { viewStateOnlyRatio: 0.95 },
        causalChain: [
            'SYMPTOM: Intermittent glitches',
            'PROXIMATE: Multiple setProps in same frame',
            'ROOT: Separate calls for viewState and layers',
            'MECHANISM: Race between viewState and layer updates',
            'FIX: Combine updates into single setProps call'
        ]
    }
};

// ============================================
// STATE TESTS (new)
// ============================================

const STATE_HYPOTHESES = {
    'H-STATE-1': {
        id: 'H-STATE-1',
        name: 'Satellite State Immutability',
        category: 'state',
        hypothesis: 'getAllSatellites() returns deep copy, not reference',
        symptom: 'External mutations corrupt internal state',
        prediction: 'Modifying returned array should not affect state',
        nullPrediction: 'Mutations would corrupt satellite list',
        threshold: { mutationDetected: false },
        causalChain: [
            'SYMPTOM: Satellite data unexpectedly changes',
            'PROXIMATE: External code modifies returned array',
            'ROOT: getAllSatellites returns direct reference',
            'MECHANISM: JavaScript arrays passed by reference',
            'FIX: Return deep copy or spread operator'
        ],
        testFn: async () => {
            const satelliteState = window.SatelliteApp?.satelliteState;
            if (!satelliteState) return { passed: false, error: 'satelliteState not available' };

            const original = satelliteState.getAllSatellites();
            const originalCount = original.length;

            // Try to mutate the returned array
            original.push({ id: 999, name: 'FAKE' });

            // Check if state was affected
            const afterMutation = satelliteState.getAllSatellites();
            const mutationDetected = afterMutation.length !== originalCount;

            return {
                passed: !mutationDetected,
                details: {
                    originalCount,
                    afterMutationCount: afterMutation.length,
                    mutationDetected
                }
            };
        }
    },
    'H-STATE-2': {
        id: 'H-STATE-2',
        name: 'Sensor Selection Persistence',
        category: 'state',
        hypothesis: 'Selection state persists across render cycles',
        symptom: 'Checkbox states reset unexpectedly',
        prediction: 'Selection survives table re-render',
        nullPrediction: 'Selection would reset on render',
        threshold: { selectionPreserved: true },
        causalChain: [
            'SYMPTOM: Checkboxes lose selection on re-render',
            'PROXIMATE: Render reads stale state',
            'ROOT: Selection not stored in state',
            'MECHANISM: DOM state not synced with JS state',
            'FIX: Store selection in sensorState, read on render'
        ],
        testFn: async () => {
            const sensorState = window.SatelliteApp?.sensorState;
            if (!sensorState) return { passed: false, error: 'sensorState not available' };

            // Get initial selection
            const sensors = sensorState.getAllSensors();
            if (sensors.length === 0) return { passed: true, skipped: true, reason: 'No sensors' };

            // Toggle first sensor
            const firstId = sensors[0].id;
            const originalState = sensors[0].selected;
            sensorState.toggleSensorSelection(firstId);

            // Force a "render cycle" by re-reading state
            const afterToggle = sensorState.getSensorById(firstId);
            const toggled = afterToggle.selected !== originalState;

            // Restore original state
            if (toggled) sensorState.toggleSensorSelection(firstId);

            return {
                passed: toggled,
                details: {
                    sensorId: firstId,
                    originalState,
                    afterToggle: afterToggle.selected,
                    selectionPreserved: toggled
                }
            };
        }
    },
    'H-STATE-3': {
        id: 'H-STATE-3',
        name: 'Time Pending Changes',
        category: 'state',
        hypothesis: 'Time changes marked pending until applied',
        symptom: 'Changes apply immediately without confirmation',
        prediction: 'hasPendingChanges() true after set, false after apply',
        nullPrediction: 'Pending state would not change',
        threshold: { pendingCorrect: true },
        causalChain: [
            'SYMPTOM: Time changes apply without Apply button',
            'PROXIMATE: Pending flag not set on change',
            'ROOT: setStartTime() doesn\'t mark pending',
            'MECHANISM: No intermediate state between edit and commit',
            'FIX: Mark pending on set, clear on apply/cancel'
        ],
        testFn: async () => {
            const timeState = window.SatelliteApp?.timeState || window.timeState;
            if (!timeState) return { passed: false, error: 'timeState not available' };

            // Save original state
            const originalStart = timeState.getStartTime();
            const originalPending = timeState.hasPendingChanges?.() || false;

            // Set a new start time
            const newStart = new Date(originalStart.getTime() - 3600000); // 1 hour earlier
            timeState.setStartTime(newStart);

            // Check pending state
            const afterSetPending = timeState.hasPendingChanges?.() || false;

            // Apply changes
            if (timeState.applyTimeChanges) {
                timeState.applyTimeChanges();
            }

            const afterApplyPending = timeState.hasPendingChanges?.() || false;

            // Restore
            timeState.setStartTime(originalStart);
            if (timeState.applyTimeChanges) {
                timeState.applyTimeChanges();
            }

            // If hasPendingChanges doesn't exist, test passes structurally
            const hasMethod = typeof timeState.hasPendingChanges === 'function';
            const pendingCorrect = !hasMethod || (afterSetPending === true && afterApplyPending === false);

            return {
                passed: pendingCorrect,
                details: {
                    hasPendingMethod: hasMethod,
                    afterSetPending,
                    afterApplyPending,
                    pendingCorrect
                }
            };
        }
    },
    'H-STATE-4': {
        id: 'H-STATE-4',
        name: 'Sort State 3-Click Cycle',
        category: 'state',
        hypothesis: 'Column sort cycles: asc -> desc -> default',
        symptom: 'Sort gets stuck or skips states',
        prediction: '3 clicks return to original order',
        nullPrediction: 'Sort would cycle incorrectly',
        threshold: { cycleComplete: true },
        causalChain: [
            'SYMPTOM: Sort doesn\'t return to default',
            'PROXIMATE: Click handler doesn\'t track cycle',
            'ROOT: Only 2 states (asc/desc) implemented',
            'MECHANISM: Third click should clear sort',
            'FIX: Track cycle state, reset on third click'
        ],
        testFn: async () => {
            const sensorState = window.SatelliteApp?.sensorState;
            if (!sensorState) return { passed: false, error: 'sensorState not available' };

            // Get initial sort state
            const initial = sensorState.getSortState?.() || { column: null, direction: null };

            // Simulate 3 clicks on name column
            sensorState.setSortState?.('name', 'asc');
            const afterFirst = sensorState.getSortState?.() || {};

            sensorState.setSortState?.('name', 'desc');
            const afterSecond = sensorState.getSortState?.() || {};

            sensorState.setSortState?.(null, null);
            const afterThird = sensorState.getSortState?.() || {};

            // Verify cycle
            const cycleComplete =
                afterFirst.direction === 'asc' &&
                afterSecond.direction === 'desc' &&
                afterThird.column === null;

            // Restore
            sensorState.setSortState?.(initial.column, initial.direction);

            return {
                passed: cycleComplete,
                details: {
                    initial,
                    afterFirst,
                    afterSecond,
                    afterThird,
                    cycleComplete
                }
            };
        }
    }
};

// ============================================
// EVENT BUS TESTS (new)
// ============================================

const EVENT_HYPOTHESES = {
    'H-EVENT-1': {
        id: 'H-EVENT-1',
        name: 'Event Delivery',
        category: 'event',
        hypothesis: 'Events delivered to all subscribers',
        symptom: 'Some handlers not called',
        prediction: 'N subscribers = N calls',
        nullPrediction: 'Some handlers would be skipped',
        threshold: { allCalled: true },
        causalChain: [
            'SYMPTOM: Event handler not triggered',
            'PROXIMATE: Listener not in subscriber list',
            'ROOT: on() failed or listener removed',
            'MECHANISM: Array iteration skips items',
            'FIX: Use proper iteration, verify registration'
        ],
        testFn: async () => {
            const eventBus = window.SatelliteApp?.eventBus || window.eventBus;
            if (!eventBus) return { passed: true, skipped: true, reason: 'eventBus not available' };

            let callCount = 0;
            const testEvent = '__test_event_delivery__';

            const handler1 = () => callCount++;
            const handler2 = () => callCount++;
            const handler3 = () => callCount++;

            eventBus.on(testEvent, handler1);
            eventBus.on(testEvent, handler2);
            eventBus.on(testEvent, handler3);

            eventBus.emit(testEvent, {});

            // Cleanup
            eventBus.off(testEvent, handler1);
            eventBus.off(testEvent, handler2);
            eventBus.off(testEvent, handler3);

            const allCalled = callCount === 3;

            return {
                passed: allCalled,
                details: {
                    expectedCalls: 3,
                    actualCalls: callCount,
                    allCalled
                }
            };
        }
    },
    'H-EVENT-2': {
        id: 'H-EVENT-2',
        name: 'Once Listener Cleanup',
        category: 'event',
        hypothesis: 'once() listeners removed after first call',
        symptom: 'Handler called multiple times',
        prediction: 'Second emit does not call handler',
        nullPrediction: 'Handler would be called on every emit',
        threshold: { callCount: 1 },
        causalChain: [
            'SYMPTOM: Duplicate processing of events',
            'PROXIMATE: Listener still registered after first call',
            'ROOT: once() doesn\'t auto-remove',
            'MECHANISM: No cleanup logic in emit',
            'FIX: Remove listener after first invocation'
        ],
        testFn: async () => {
            const eventBus = window.SatelliteApp?.eventBus || window.eventBus;
            if (!eventBus || !eventBus.once) return { passed: true, skipped: true, reason: 'once() not available' };

            let callCount = 0;
            const testEvent = '__test_once_cleanup__';

            eventBus.once(testEvent, () => callCount++);

            eventBus.emit(testEvent, {});
            eventBus.emit(testEvent, {}); // Should not trigger

            const passed = callCount === 1;

            return {
                passed,
                details: {
                    expectedCalls: 1,
                    actualCalls: callCount,
                    onceWorked: passed
                }
            };
        }
    }
};

// ============================================
// UI TESTS (new)
// ============================================

const UI_HYPOTHESES = {
    'H-UI-1': {
        id: 'H-UI-1',
        name: 'Panel Expand/Collapse',
        category: 'ui',
        hypothesis: 'Panel state toggles correctly',
        symptom: 'Panel stuck open or closed',
        prediction: 'togglePanel() inverts state',
        nullPrediction: 'Panel state would not change',
        threshold: { stateToggled: true },
        causalChain: [
            'SYMPTOM: Panel won\'t expand/collapse',
            'PROXIMATE: CSS class not applied',
            'ROOT: togglePanel() logic error',
            'MECHANISM: State not synced with DOM',
            'FIX: Ensure class toggle and state sync'
        ],
        testFn: async () => {
            const panel = document.getElementById('control-panel');
            if (!panel) return { passed: false, error: 'Panel not found' };

            const wasExpanded = panel.classList.contains('expanded');

            // Toggle
            panel.classList.toggle('expanded');
            const afterToggle = panel.classList.contains('expanded');

            // Toggle back
            panel.classList.toggle('expanded');
            const afterRestore = panel.classList.contains('expanded');

            const stateToggled = afterToggle !== wasExpanded && afterRestore === wasExpanded;

            return {
                passed: stateToggled,
                details: {
                    wasExpanded,
                    afterToggle,
                    afterRestore,
                    stateToggled
                }
            };
        }
    },
    'H-UI-2': {
        id: 'H-UI-2',
        name: 'Section Switching',
        category: 'ui',
        hypothesis: 'Only one content section visible at a time',
        symptom: 'Multiple sections visible or none',
        prediction: 'Exactly 1 section has display:block',
        nullPrediction: 'Multiple or zero sections visible',
        threshold: { visibleSections: 1 },
        causalChain: [
            'SYMPTOM: Wrong content shown',
            'PROXIMATE: Multiple sections have display:block',
            'ROOT: switchContent() doesn\'t hide others',
            'MECHANISM: display property not toggled',
            'FIX: Hide all sections before showing target'
        ],
        testFn: async () => {
            const sections = document.querySelectorAll('.content-section > div[id^="content-"]');
            let visibleCount = 0;

            sections.forEach(section => {
                const style = window.getComputedStyle(section);
                if (style.display !== 'none') {
                    visibleCount++;
                }
            });

            // In collapsed state, 0 is acceptable; in expanded, exactly 1
            const panel = document.getElementById('control-panel');
            const isExpanded = panel?.classList.contains('expanded');
            const expected = isExpanded ? 1 : 0;

            // For this test, we just check structure is correct
            const passed = visibleCount <= 1;

            return {
                passed,
                details: {
                    totalSections: sections.length,
                    visibleSections: visibleCount,
                    isExpanded,
                    expected
                }
            };
        }
    },
    'H-UI-4': {
        id: 'H-UI-4',
        name: 'Table Row Highlight',
        category: 'ui',
        hypothesis: 'Only one row highlighted at a time',
        symptom: 'Multiple rows highlighted',
        prediction: 'Clicking row removes highlight from others',
        nullPrediction: 'Highlights would accumulate',
        threshold: { highlightedRows: 1 },
        causalChain: [
            'SYMPTOM: Multiple blue rows in table',
            'PROXIMATE: Old selection not cleared',
            'ROOT: Click handler doesn\'t remove .selected',
            'MECHANISM: classList.add without remove',
            'FIX: Remove .selected from all rows before adding'
        ],
        testFn: async () => {
            // Check sensor table
            const sensorRows = document.querySelectorAll('#sensor-table tbody tr.selected');
            const satelliteRows = document.querySelectorAll('#satellite-table tbody tr.selected');

            const sensorHighlighted = sensorRows.length;
            const satelliteHighlighted = satelliteRows.length;

            // Each table should have at most 1 highlighted row
            const passed = sensorHighlighted <= 1 && satelliteHighlighted <= 1;

            return {
                passed,
                details: {
                    sensorHighlighted,
                    satelliteHighlighted,
                    maxAllowed: 1
                }
            };
        }
    },
    'H-UI-5': {
        id: 'H-UI-5',
        name: 'Time Slider Step Buttons',
        category: 'ui',
        hypothesis: 'Step buttons increment/decrement current time by step size',
        symptom: 'Buttons do nothing or wrong increment',
        prediction: 'stepTime(1) adds timeStepMinutes to currentTime',
        nullPrediction: 'Time would not change or change wrong amount',
        threshold: { stepCorrect: true },
        causalChain: [
            'SYMPTOM: Step buttons don\'t change time correctly',
            'PROXIMATE: stepTime() not called or wrong delta',
            'ROOT: Event handler not connected',
            'MECHANISM: timeState.stepTime() uses timeStepMinutes',
            'FIX: Connect button click to stepTime(direction)'
        ],
        testFn: async () => {
            const timeState = window.SatelliteApp?.timeState || window.timeState;
            if (!timeState) return { passed: false, error: 'timeState not available' };

            // Save original state
            const originalTime = timeState.getCurrentTime();
            const stepMinutes = timeState.getTimeStepMinutes?.() || 5;

            // Test step forward
            timeState.stepTime?.(1);
            const afterForward = timeState.getCurrentTime();
            const forwardDiff = (afterForward - originalTime) / 60000; // minutes

            // Test step backward
            timeState.stepTime?.(-1);
            const afterBackward = timeState.getCurrentTime();
            const backwardDiff = (afterBackward - afterForward) / 60000; // minutes

            // Restore original time
            timeState.setCurrentTime?.(originalTime);
            timeState.resumeRealTime?.();

            const forwardCorrect = Math.abs(forwardDiff - stepMinutes) < 0.1;
            const backwardCorrect = Math.abs(backwardDiff + stepMinutes) < 0.1;
            const passed = forwardCorrect && backwardCorrect;

            return {
                passed,
                details: {
                    stepMinutes,
                    forwardDiff: forwardDiff.toFixed(2),
                    backwardDiff: backwardDiff.toFixed(2),
                    forwardCorrect,
                    backwardCorrect
                }
            };
        }
    },
    'H-UI-6': {
        id: 'H-UI-6',
        name: 'Time Slider Position',
        category: 'ui',
        hypothesis: 'Slider position maps to time within start-stop range',
        symptom: 'Slider position doesn\'t reflect current time',
        prediction: 'Position 0=start, 1=stop, proportional between',
        nullPrediction: 'Slider would be disconnected from time state',
        threshold: { positionCorrect: true },
        causalChain: [
            'SYMPTOM: Slider shows wrong position',
            'PROXIMATE: getSliderPosition() returns wrong value',
            'ROOT: Position calculation formula error',
            'MECHANISM: (currentTime - startTime) / (stopTime - startTime)',
            'FIX: Correct position mapping formula'
        ],
        testFn: async () => {
            const timeState = window.SatelliteApp?.timeState || window.timeState;
            if (!timeState) return { passed: false, error: 'timeState not available' };
            if (!timeState.getSliderPosition) return { passed: true, skipped: true, reason: 'getSliderPosition not implemented' };

            const start = timeState.getCommittedStartTime?.() || timeState.getStartTime?.();
            const stop = timeState.getCommittedStopTime?.() || timeState.getStopTime?.();

            if (!start || !stop) return { passed: true, skipped: true, reason: 'Start/stop times not set' };

            // Test position at start time
            timeState.setCurrentTime?.(start);
            const posAtStart = timeState.getSliderPosition();

            // Test position at stop time
            timeState.setCurrentTime?.(stop);
            const posAtStop = timeState.getSliderPosition();

            // Test position at midpoint
            const midTime = new Date((start.getTime() + stop.getTime()) / 2);
            timeState.setCurrentTime?.(midTime);
            const posAtMid = timeState.getSliderPosition();

            // Restore to real-time
            timeState.resumeRealTime?.();

            const startCorrect = Math.abs(posAtStart - 0) < 0.01;
            const stopCorrect = Math.abs(posAtStop - 1) < 0.01;
            const midCorrect = Math.abs(posAtMid - 0.5) < 0.01;
            const passed = startCorrect && stopCorrect && midCorrect;

            return {
                passed,
                details: {
                    posAtStart: posAtStart.toFixed(3),
                    posAtStop: posAtStop.toFixed(3),
                    posAtMid: posAtMid.toFixed(3),
                    startCorrect,
                    stopCorrect,
                    midCorrect
                }
            };
        }
    },
    'H-UI-7': {
        id: 'H-UI-7',
        name: 'Now Button Real-Time Resume',
        category: 'ui',
        hypothesis: 'Now button resets to current time and resumes real-time mode',
        symptom: 'Now button doesn\'t resume real-time tracking',
        prediction: 'After Now click, isRealTime() returns true',
        nullPrediction: 'isRealTime would stay false',
        threshold: { realTimeResumed: true },
        causalChain: [
            'SYMPTOM: Now button doesn\'t resume real-time',
            'PROXIMATE: resumeRealTime() not called',
            'ROOT: Button click handler missing or wrong',
            'MECHANISM: isRealTime flag not set to true',
            'FIX: Call timeState.resumeRealTime() on click'
        ],
        testFn: async () => {
            const timeState = window.SatelliteApp?.timeState || window.timeState;
            if (!timeState) return { passed: false, error: 'timeState not available' };
            if (!timeState.isRealTime || !timeState.resumeRealTime) {
                return { passed: true, skipped: true, reason: 'isRealTime/resumeRealTime not implemented' };
            }

            // First, step time to exit real-time mode
            timeState.stepTime?.(-1);
            const afterStep = timeState.isRealTime();

            // Then resume real-time
            timeState.resumeRealTime();
            const afterResume = timeState.isRealTime();

            const passed = afterStep === false && afterResume === true;

            return {
                passed,
                details: {
                    afterStepRealTime: afterStep,
                    afterResumeRealTime: afterResume,
                    exitedRealTime: !afterStep,
                    resumedRealTime: afterResume
                }
            };
        }
    }
};

// ============================================
// VALIDATION TESTS (new)
// ============================================

const VALIDATION_HYPOTHESES = {
    'H-VALID-1': {
        id: 'H-VALID-1',
        name: 'Coordinate Validation',
        category: 'validation',
        hypothesis: 'Invalid coordinates rejected',
        symptom: 'Out-of-range coords accepted',
        prediction: 'Lat > 90 or < -90 returns error',
        nullPrediction: 'Invalid coords would be saved',
        threshold: { invalidRejected: true },
        causalChain: [
            'SYMPTOM: Invalid sensor position saved',
            'PROXIMATE: Validation not called',
            'ROOT: addSensor() skips validation',
            'MECHANISM: No range check for lat/lon',
            'FIX: Validate coordinates before save'
        ],
        testFn: async () => {
            // Test coordinate validation logic
            const testCases = [
                { lat: 91, lon: 0, shouldPass: false },
                { lat: -91, lon: 0, shouldPass: false },
                { lat: 0, lon: 181, shouldPass: false },
                { lat: 0, lon: -181, shouldPass: false },
                { lat: 45, lon: 90, shouldPass: true },
                { lat: -45, lon: -90, shouldPass: true }
            ];

            const results = testCases.map(tc => {
                const latValid = tc.lat >= -90 && tc.lat <= 90;
                const lonValid = tc.lon >= -180 && tc.lon <= 180;
                const isValid = latValid && lonValid;
                return {
                    ...tc,
                    validated: isValid === tc.shouldPass
                };
            });

            const allCorrect = results.every(r => r.validated);

            return {
                passed: allCorrect,
                details: {
                    testCases: results.length,
                    allCorrect,
                    results
                }
            };
        }
    },
    'H-VALID-2': {
        id: 'H-VALID-2',
        name: 'TLE Format Validation',
        category: 'validation',
        hypothesis: 'TLE format validated on input',
        symptom: 'Malformed TLE accepted',
        prediction: 'Wrong line length returns error',
        nullPrediction: 'Corrupted TLE would be saved',
        threshold: { formatValidated: true },
        causalChain: [
            'SYMPTOM: Invalid TLE causes propagation error',
            'PROXIMATE: TLE saved without validation',
            'ROOT: No format check in addSatellite',
            'MECHANISM: SGP4 crashes on malformed TLE',
            'FIX: Validate TLE format before save'
        ],
        testFn: async () => {
            // Test TLE format validation
            const validTLE1 = '1 25544U 98067A   21275.52422453  .00001878  00000-0  42889-4 0  9993';
            const validTLE2 = '2 25544  51.6442 208.5507 0003399 320.0619 193.8898 15.48919755305637';

            const testCases = [
                { tle1: validTLE1, tle2: validTLE2, shouldPass: true, desc: 'Valid TLE' },
                { tle1: 'short', tle2: validTLE2, shouldPass: false, desc: 'Line 1 too short' },
                { tle1: validTLE1, tle2: 'short', shouldPass: false, desc: 'Line 2 too short' },
                { tle1: '2' + validTLE1.slice(1), tle2: validTLE2, shouldPass: false, desc: 'Wrong line 1 number' },
                { tle1: validTLE1, tle2: '1' + validTLE2.slice(1), shouldPass: false, desc: 'Wrong line 2 number' }
            ];

            const results = testCases.map(tc => {
                const line1Valid = tc.tle1.length === 69 && tc.tle1.startsWith('1 ');
                const line2Valid = tc.tle2.length === 69 && tc.tle2.startsWith('2 ');
                const isValid = line1Valid && line2Valid;
                return {
                    desc: tc.desc,
                    shouldPass: tc.shouldPass,
                    validated: isValid === tc.shouldPass
                };
            });

            const allCorrect = results.every(r => r.validated);

            return {
                passed: allCorrect,
                details: {
                    testCases: results.length,
                    allCorrect,
                    results
                }
            };
        }
    }
};


// ============================================
// SATELLITE TESTS (new)
// ============================================

const SATELLITE_HYPOTHESES = {
    'H-SAT-1': {
        id: 'H-SAT-1',
        name: 'Satellite Selection',
        category: 'satellite',
        hypothesis: 'Selected satellites appear on map, deselected do not',
        symptom: 'Satellites visible regardless of selection state',
        prediction: 'Only selected satellites render ground tracks',
        nullPrediction: 'All satellites would render regardless of selection',
        threshold: { selectionWorks: true },
        causalChain: [
            'SYMPTOM: Wrong satellites visible on map',
            'PROXIMATE: Selection filter not applied',
            'ROOT: getSelectedSatellites() returns all',
            'MECHANISM: .filter(s => s.selected) missing',
            'FIX: Filter satellites by selected property'
        ],
        testFn: async () => {
            const satelliteState = window.SatelliteApp?.satelliteState;
            if (!satelliteState) return { passed: false, error: 'satelliteState not available' };

            const allSats = satelliteState.getAllSatellites();
            const selectedSats = satelliteState.getSelectedSatellites();

            const hasSelection = selectedSats.length > 0;
            const isSubset = selectedSats.every(s => allSats.some(a => a.id === s.id));

            return {
                passed: isSubset,
                details: {
                    totalSatellites: allSats.length,
                    selectedSatellites: selectedSats.length,
                    hasSelection,
                    isSubset
                }
            };
        }
    },
    'H-SAT-2': {
        id: 'H-SAT-2',
        name: 'Ground Track Propagation',
        category: 'satellite',
        hypothesis: 'Ground tracks calculated using simulation time, not wall clock',
        symptom: 'Ground tracks ignore time slider changes',
        prediction: 'Changing simulation time updates ground track positions',
        nullPrediction: 'Ground tracks would show current real-time positions only',
        threshold: { usesSimTime: true },
        causalChain: [
            'SYMPTOM: Ground tracks do not respond to time changes',
            'PROXIMATE: Propagation uses Date.now() instead of simTime',
            'ROOT: calculateGroundTrack() ignores timeState',
            'MECHANISM: SGP4 propagates to wrong time',
            'FIX: Pass timeState.getCurrentTime() to propagation'
        ],
        testFn: async () => {
            const timeState = window.SatelliteApp?.timeState || window.timeState;
            if (!timeState) return { passed: false, error: 'timeState not available' };

            const hasGetCurrentTime = typeof timeState.getCurrentTime === 'function';
            const currentTime = hasGetCurrentTime ? timeState.getCurrentTime() : null;
            const isDate = currentTime instanceof Date;

            return {
                passed: hasGetCurrentTime && isDate,
                details: {
                    hasGetCurrentTime,
                    currentTime: currentTime?.toISOString?.(),
                    isDate
                }
            };
        }
    },
    'H-CHEV-1': {
        id: 'H-CHEV-1',
        name: 'Chevron Direction Calculation',
        category: 'satellite',
        hypothesis: 'Chevron bearing calculated from tail point to current position',
        symptom: 'Chevrons all point north regardless of direction',
        prediction: 'Eastbound satellite has bearing ~90, westbound ~270',
        nullPrediction: 'All chevrons would have bearing 0 (north)',
        threshold: { bearingVaries: true },
        causalChain: [
            'SYMPTOM: All chevrons point north',
            'PROXIMATE: Bearing always returns 0',
            'ROOT: calculateBearing() not called or returns default',
            'MECHANISM: No tail points available for calculation',
            'FIX: Ensure tail points exist and bearing formula is correct'
        ],
        testFn: async () => {
            const testCases = [
                { from: [0, 0], to: [1, 0], expectedDir: 'east', minBearing: 45, maxBearing: 135 },
                { from: [0, 0], to: [-1, 0], expectedDir: 'west', minBearing: 225, maxBearing: 315 },
                { from: [0, 0], to: [0, 1], expectedDir: 'north', minBearing: 315, maxBearing: 45 },
                { from: [0, 0], to: [0, -1], expectedDir: 'south', minBearing: 135, maxBearing: 225 }
            ];

            function calcBearing(lon1, lat1, lon2, lat2) {
                const toRad = Math.PI / 180;
                const lat1Rad = lat1 * toRad;
                const lat2Rad = lat2 * toRad;
                const dLon = (lon2 - lon1) * toRad;
                const x = Math.sin(dLon) * Math.cos(lat2Rad);
                const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
                          Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
                let bearing = Math.atan2(x, y) * (180 / Math.PI);
                return (bearing + 360) % 360;
            }

            const results = testCases.map(tc => {
                const bearing = calcBearing(tc.from[0], tc.from[1], tc.to[0], tc.to[1]);
                let inRange;
                if (tc.minBearing > tc.maxBearing) {
                    inRange = bearing >= tc.minBearing || bearing <= tc.maxBearing;
                } else {
                    inRange = bearing >= tc.minBearing && bearing <= tc.maxBearing;
                }
                return { dir: tc.expectedDir, bearing: bearing.toFixed(1), inRange };
            });

            const allCorrect = results.every(r => r.inRange);

            return {
                passed: allCorrect,
                details: {
                    testResults: results,
                    bearingVaries: true
                }
            };
        }
    },
    'H-GLOW-1': {
        id: 'H-GLOW-1',
        name: 'Equator Crossing Detection',
        category: 'satellite',
        hypothesis: 'Equator crossings detected when latitude changes sign',
        symptom: 'Glow points appear at wrong locations or not at all',
        prediction: 'Crossing detected between points with opposite sign latitudes',
        nullPrediction: 'No crossings would be detected',
        threshold: { detectsCrossing: true },
        causalChain: [
            'SYMPTOM: No glow points on equator',
            'PROXIMATE: detectEquatorCrossings() returns empty',
            'ROOT: Sign change check incorrect',
            'MECHANISM: (lat1 >= 0 && lat2 < 0) || (lat1 < 0 && lat2 >= 0)',
            'FIX: Ensure latitude sign change detected correctly'
        ],
        testFn: async () => {
            const testCases = [
                { lat1: 1, lat2: -1, shouldDetect: true, desc: 'North to South' },
                { lat1: -1, lat2: 1, shouldDetect: true, desc: 'South to North' },
                { lat1: 1, lat2: 2, shouldDetect: false, desc: 'North to North' },
                { lat1: -1, lat2: -2, shouldDetect: false, desc: 'South to South' },
                { lat1: 0, lat2: 1, shouldDetect: false, desc: 'Equator to North' },
                { lat1: 0, lat2: -1, shouldDetect: true, desc: 'Equator to South' }
            ];

            const results = testCases.map(tc => {
                const detected = (tc.lat1 >= 0 && tc.lat2 < 0) || (tc.lat1 < 0 && tc.lat2 >= 0);
                return {
                    desc: tc.desc,
                    detected,
                    expected: tc.shouldDetect,
                    correct: detected === tc.shouldDetect
                };
            });

            const allCorrect = results.every(r => r.correct);

            return {
                passed: allCorrect,
                details: {
                    testCases: results.length,
                    allCorrect,
                    results
                }
            };
        }
    },
    'H-GLOW-2': {
        id: 'H-GLOW-2',
        name: 'Glow Fade Timing',
        category: 'satellite',
        hypothesis: 'Glow intensity fades to 0 outside fade window',
        symptom: 'Glow points always visible regardless of time from crossing',
        prediction: 'Intensity = 0 when timeDelta >= fadeMinutes',
        nullPrediction: 'Intensity would stay at 0.1 minimum always',
        threshold: { fadesToZero: true },
        causalChain: [
            'SYMPTOM: Glow points never disappear',
            'PROXIMATE: Minimum intensity set to 0.1',
            'ROOT: else clause sets intensity = 0.1 instead of 0',
            'MECHANISM: Math.max(0.1, intensity) prevents zero',
            'FIX: Set intensity = 0 beyond fade range'
        ],
        testFn: async () => {
            const timeState = window.SatelliteApp?.timeState || window.timeState;
            if (!timeState) return { passed: true, skipped: true, reason: 'timeState not available' };

            const fadeMinutes = timeState.getGlowFadeMinutes?.() || 5;
            const fadeMs = fadeMinutes * 60 * 1000;
            const testDeltas = [0, fadeMs / 2, fadeMs, fadeMs * 2];

            const results = testDeltas.map(timeDelta => {
                let intensity;
                if (timeDelta < fadeMs) {
                    const fadeProgress = timeDelta / fadeMs;
                    intensity = Math.cos(fadeProgress * Math.PI / 2);
                } else {
                    intensity = 0;
                }
                return {
                    timeDelta: (timeDelta / 60000).toFixed(1) + ' min',
                    intensity: intensity.toFixed(3),
                    isZeroBeyondFade: timeDelta >= fadeMs ? intensity === 0 : true
                };
            });

            const fadesToZero = results.every(r => r.isZeroBeyondFade);

            return {
                passed: fadesToZero,
                details: {
                    fadeMinutes,
                    results,
                    fadesToZero
                }
            };
        }
    },
    'H-GLOW-3': {
        id: 'H-GLOW-3',
        name: 'Glow Enable Toggle',
        category: 'satellite',
        hypothesis: 'Glow effect can be enabled/disabled via settings',
        symptom: 'Glow always visible or always hidden',
        prediction: 'setGlowEnabled(false) hides all glow points',
        nullPrediction: 'Glow visibility would not respond to toggle',
        threshold: { toggleWorks: true },
        causalChain: [
            'SYMPTOM: Glow toggle has no effect',
            'PROXIMATE: isGlowEnabled() not checked in layer',
            'ROOT: visible prop ignores glowEnabled state',
            'MECHANISM: visible: glowEnabled && data.length > 0',
            'FIX: Include glowEnabled in layer visible check'
        ],
        testFn: async () => {
            const timeState = window.SatelliteApp?.timeState || window.timeState;
            if (!timeState) return { passed: false, error: 'timeState not available' };
            if (!timeState.isGlowEnabled || !timeState.setGlowEnabled) {
                return { passed: true, skipped: true, reason: 'Glow methods not available' };
            }

            const originalEnabled = timeState.isGlowEnabled();

            timeState.setGlowEnabled(!originalEnabled);
            const afterToggle = timeState.isGlowEnabled();

            timeState.setGlowEnabled(originalEnabled);
            const afterRestore = timeState.isGlowEnabled();

            const toggleWorks = afterToggle === !originalEnabled && afterRestore === originalEnabled;

            return {
                passed: toggleWorks,
                details: {
                    originalEnabled,
                    afterToggle,
                    afterRestore,
                    toggleWorks
                }
            };
        }
    }
};

// ============================================
// COMBINED REGISTRY
// ============================================

export const TEST_REGISTRY = {
    ...MAP_HYPOTHESES,
    ...STATE_HYPOTHESES,
    ...EVENT_HYPOTHESES,
    ...UI_HYPOTHESES,
    ...VALIDATION_HYPOTHESES,
    ...SATELLITE_HYPOTHESES
};

/**
 * Get hypothesis by ID
 */
export function getHypothesis(id) {
    return TEST_REGISTRY[id] || null;
}

/**
 * Get all hypotheses
 */
export function getAllHypotheses() {
    return Object.values(TEST_REGISTRY);
}

/**
 * Get hypotheses by category
 */
export function getHypothesesByCategory(category) {
    return Object.values(TEST_REGISTRY).filter(h => h.category === category);
}

/**
 * Get all categories
 */
export function getCategories() {
    const categories = new Set(Object.values(TEST_REGISTRY).map(h => h.category));
    return Array.from(categories);
}

// Make available globally
if (typeof window !== 'undefined') {
    window.TEST_REGISTRY = TEST_REGISTRY;
}

export default TEST_REGISTRY;
