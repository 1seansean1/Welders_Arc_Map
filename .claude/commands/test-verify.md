# Test Verification Command

Verify all tests are properly registered and documented.

## Purpose

This command checks that:
1. All tests in testRegistry.js have testFn implementations
2. All tests appear in the UI panel (auto-registration working)
3. All tests are documented in TESTS.md
4. No orphaned tests exist (in panel but not registry)

## Steps to Execute

### Step 1: Extract Registry Tests
Read `static/modules/test/testRegistry.js` and list all hypothesis IDs that have `testFn` defined.

### Step 2: Count Auto-Registered Tests
The UI panel auto-generates from TEST_REGISTRY. Count should match Step 1.

### Step 3: Check TESTS.md Coverage
Read `TESTS.md` and verify each test ID appears in the appropriate category table.

### Step 4: Report Gaps

Format output as:

```
TEST VERIFICATION REPORT
========================

Registry Tests (with testFn): N
Auto-Registered (UI Panel): N (should match)

TESTS.md Coverage:
  - Documented: N
  - Missing: [list any missing test IDs]

Status: PASS / FAIL

Recommended Actions:
  - [List any actions needed]
```

## Common Issues

### Test Missing from UI
- Verify `testFn` is defined in testRegistry.js
- Hard refresh browser (Ctrl+Shift+R)
- Check console for registration errors

### Test Not Documented
Add to appropriate section in TESTS.md:
```markdown
| H-XXX-N | Test Name | PENDING | Brief description |
```

### Test Has No testFn
Add implementation to testRegistry.js following the template in AI_GOVERNOR.md §3.1

## Integration

Run this command:
- After implementing any new feature
- Before running `/mandatory-check`
- Before marking a feature as complete
