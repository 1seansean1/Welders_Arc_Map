# Lessons Learned - Code Refactoring & Debugging

## Overview
General lessons learned from modularizing a large JavaScript codebase and debugging common integration issues. These principles apply to any modular JavaScript project.

---

## 1. Property Name Mapping at Boundaries

**Problem**: Data objects use different property names in internal storage vs external validation/APIs.

**Example**:
- Internal storage: `{ tleLine1, tleLine2 }`
- Validation function expects: `{ tle1, tle2 }`
- Update function merged object and passed to validation → property name mismatch

**Solution**:
```javascript
// BAD: Direct pass-through causes validation to fail
const updatedObject = { ...existingObject, ...updates };
validate(updatedObject); // Validation expects different property names!

// GOOD: Convert property names at the boundary
const validationData = {
    name: updatedObject.name,
    tle1: updatedObject.tleLine1,  // Convert: tleLine1 → tle1
    tle2: updatedObject.tleLine2   // Convert: tleLine2 → tle2
};
validate(validationData);
```

**Lesson**: When data crosses module boundaries (storage ↔ validation, internal ↔ API), explicitly map property names. Don't assume property names match.

**Prevention**:
- Document expected property names in JSDoc
- Use TypeScript interfaces to catch mismatches at compile time
- Create adapter functions for property name conversion
- Write integration tests that exercise the full data flow

---

## 2. ES6 Module Access to Global Variables

**Problem**: ES6 modules can't access global variables from `<script>` tags the same way non-module scripts can.

**Context**:
```html
<!-- Library loaded via script tag -->
<script src="https://unpkg.com/satellite.js@5.0.0/dist/satellite.min.js"></script>

<!-- Creates window.satellite global -->
```

**What Fails**:
```javascript
// Inside ES6 module (.js with type="module")
export function calculate() {
    const satrec = satellite.twoline2satrec(tle1, tle2); // ReferenceError!
    // 'satellite' is not defined - even though it's global!
}
```

**Solution**:
```javascript
export function calculate() {
    const satellite = window.satellite; // Explicitly access via window
    if (!satellite) {
        console.error('satellite.js library not loaded');
        return null;
    }

    const satrec = satellite.twoline2satrec(tle1, tle2); // Works!
}
```

**Lesson**: ES6 modules have their own scope. Global variables from `<script>` tags must be accessed via `window.globalName`.

**Best Practices**:
- Always check library exists before using: `if (!window.library)`
- Add helpful error messages for missing dependencies
- Consider using import maps or bundlers for better dependency management
- Document external script dependencies in module comments

---

## 3. Function Visibility for HTML Event Handlers

**Problem**: Functions in ES6 modules aren't automatically global, so HTML onclick/onchange handlers can't find them.

**What Fails**:
```javascript
// app.js (ES6 module)
function editSatellite(id) { /* ... */ }

// HTML
<button onclick="editSatellite(123)">Edit</button>
// ReferenceError: editSatellite is not defined
```

**Why It Fails**:
- ES6 modules are scoped (not global by default)
- HTML event handlers look for functions in global scope
- Function exists in module scope, not in `window` scope

**Solutions**:

**Option 1: Explicit Global Export**
```javascript
// app.js
function editSatellite(id) { /* ... */ }

// Make it globally accessible
window.editSatellite = editSatellite;
```

**Option 2: Event Delegation (Better)**
```javascript
// Instead of inline handlers
document.addEventListener('click', (e) => {
    if (e.target.matches('[data-action="edit-satellite"]')) {
        const id = e.target.dataset.id;
        editSatellite(id); // Function stays private
    }
});
```

**Option 3: Framework-based Rendering**
```javascript
// Use template literals with event listeners
const html = satellites.map(sat => `
    <button class="edit-btn" data-id="${sat.id}">Edit</button>
`).join('');

// Attach listeners after rendering
document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editSatellite(btn.dataset.id));
});
```

**Lesson**: Don't rely on inline HTML event handlers in modular code. Use event delegation or programmatic event listeners instead.

---

## 4. Test State Independence

**Problem**: Tests that don't reset state between runs can produce false positives or false negatives.

**Example**:
```javascript
// Test 1: Set state
setState({ value: true });

// Test 2: Immutability check (expects value: false initially)
const state1 = getState();
state1.value = true; // Try to mutate
const state2 = getState();

// FAILS: Both are true because Test 1 left value=true!
assert(state2.value !== state1.value); // Expected: false !== true
                                       // Actual: true !== true
```

**Solution**:
```javascript
// Always reset before testing assumptions
beforeEach(() => {
    resetState(); // Ensure predictable initial state
});

// Or reset at the start of specific tests
test('immutability', () => {
    resetState(); // Known state: value = false

    const state1 = getState();
    state1.value = true; // Try to mutate
    const state2 = getState();

    assert(state2.value !== state1.value); // ✓ false !== true
});
```

**Lesson**: Tests should be independent. Reset to known state before making assertions, especially when testing state isolation or immutability.

**Best Practices**:
- Use `beforeEach()` / `afterEach()` hooks for cleanup
- Don't depend on test execution order
- Explicitly reset shared state at test start
- Document expected initial state in test descriptions
- Consider using fresh instances for each test

---

## 5. Modularization Pattern: Public vs Private Exports

**Problem**: Everything exported from a module is public API. Over-exporting creates tight coupling.

**Bad Pattern**:
```javascript
// Too many exports
export const helper1 = ...;
export const helper2 = ...;
export const helper3 = ...;
export const mainFunction = ...;
export const internalState = ...; // Should be private!
```

**Good Pattern**:
```javascript
// Private helpers (not exported)
function helper1() { /* ... */ }
function helper2() { /* ... */ }
const internalState = { /* ... */ };

// Only export public API
export function mainFunction() {
    // Uses helpers internally
    helper1();
    helper2();
}
```

**Lesson**:
- Only export what consumers need
- Keep implementation details private
- Smaller public API = easier to refactor internals
- Use JSDoc `@private` to document internal functions

---

## 6. Debugging Checklist for "Function Not Defined" Errors

When you see `ReferenceError: functionName is not defined`:

1. **Check scope**: Is the function in a module? Module functions aren't automatically global.

2. **Check exports**: If it's supposed to be accessible, is it exported?
   ```javascript
   export function myFunction() { /* ... */ }
   ```

3. **Check imports**: Is it imported where it's being used?
   ```javascript
   import { myFunction } from './module.js';
   ```

4. **Check global exposure**: If called from HTML, is it on `window`?
   ```javascript
   window.myFunction = myFunction;
   ```

5. **Check timing**: Is the function defined before it's called?
   - Script load order matters
   - Module initialization order matters

6. **Check console**: Look for import errors that prevent module loading

---

## 7. Property Name Consistency Strategies

To avoid property name mismatches:

**Strategy 1: Single Source of Truth**
```javascript
// schema.js
export const SATELLITE_SCHEMA = {
    storage: { tleLine1: String, tleLine2: String },
    api: { tle1: String, tle2: String }
};

// Use mappers
export function toAPI(satellite) {
    return {
        tle1: satellite.tleLine1,
        tle2: satellite.tleLine2
    };
}

export function fromAPI(data) {
    return {
        tleLine1: data.tle1,
        tleLine2: data.tle2
    };
}
```

**Strategy 2: Naming Convention**
- Internal properties: camelCase, descriptive (`tleLine1`)
- API properties: match external API exactly (`tle1`)
- Always convert at boundaries

**Strategy 3: TypeScript (Best)**
```typescript
interface InternalSatellite {
    tleLine1: string;
    tleLine2: string;
}

interface APISatellite {
    tle1: string;
    tle2: string;
}

// Compiler catches mismatches!
```

---

## 8. Testing Integration Points

**What to Test**:
- ✅ Data flowing between modules (property name conversions)
- ✅ Functions called from HTML (global accessibility)
- ✅ External library integration (graceful degradation if missing)
- ✅ State mutations don't leak across module boundaries
- ✅ Event emissions reach expected listeners

**Example Integration Test**:
```javascript
test('satellite update flow', () => {
    // 1. Add satellite via API
    const result = addSatellite({ tle1: '...', tle2: '...' });

    // 2. Verify stored with correct property names
    const stored = getSatellite(result.id);
    assert(stored.tleLine1); // Internal property exists

    // 3. Update via API
    const updateResult = updateSatellite(result.id, { name: 'New Name' });

    // 4. Verify update succeeded
    assert(updateResult.success);
    assert(updateResult.satellite.name === 'New Name');
});
```

---

## Key Takeaways

1. **Explicit is better than implicit** - Always explicitly map/convert data at boundaries
2. **Modules are isolated by default** - Use `window` for globals, export for modules
3. **HTML handlers need global functions** - Or use event delegation instead
4. **Tests need clean state** - Reset before testing to ensure reproducibility
5. **Small public API** - Export only what's necessary
6. **Document dependencies** - Make library requirements explicit
7. **Integration tests catch boundary bugs** - Unit tests alone aren't enough

---

## Date Added
2025-11-25

## Last Updated
2025-11-25
