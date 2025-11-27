# Mandatory Check - AI Governor Compliance Verification

Verify all AI Governor mandatory actions are complete before marking work done.

## Purpose

This command ensures compliance with AI_GOVERNOR.md before any feature is marked complete.
Run this BEFORE committing and pushing changes.

## Checklist

### GATE 1: Code Complete
- [ ] Implementation finished
- [ ] Self-review complete
- [ ] No TODO/FIXME left unaddressed

### GATE 2: Tested (MANDATORY)
- [ ] Hypothesis test created (H-XXX-N format)
- [ ] Test added to testRegistry.js with testFn
- [ ] Test appears in UI (auto-registered - verify in Settings > Tests)
- [ ] Test passes when run individually
- [ ] All existing tests still pass (no regressions)

**Test Verification Steps:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Open Settings panel > Tests section
3. Find new test in list (should be auto-registered)
4. Click Run All - verify all tests PASS
5. If failures exist, run `window.testResults.downloadRemediationPlan()` in console

### GATE 3: Documented
- [ ] FEATURES.md updated (status change if applicable)
- [ ] TESTS.md updated (new test entry added)
- [ ] LESSONS.md updated if debugging insights gained
- [ ] Code comments current where logic is non-obvious

### GATE 4: Ready to Commit
- [ ] All files saved
- [ ] Changes staged (`git status` shows expected files)
- [ ] Commit message follows format: `<type>(<scope>): <summary>`

### GATE 5: Pre-Push Verification
- [ ] Run full test suite one more time
- [ ] All tests PASS

## Automated Checks

Run these commands to verify:

```javascript
// In browser console:

// 1. Check test count matches registry
console.log(`Tests registered: ${Object.keys(window.TEST_REGISTRY).filter(k => window.TEST_REGISTRY[k].testFn).length}`);

// 2. Run all tests
await window.automatedTests?.runAllTests() || 'Run via UI';

// 3. Check for failures
console.log(`Failures: ${window.testResults.getFailureCount()}`);
console.log(`Needs remediation: ${window.testResults.needsRemediation()}`);

// 4. If failures, generate remediation plan
if (window.testResults.needsRemediation()) {
    window.testResults.downloadRemediationPlan();
}
```

## Common Issues

### Test Not Appearing in UI
- Verify `testFn` is defined (not just hypothesis)
- Hard refresh browser
- Check console for import errors

### Test Fails After Working
- Check for test isolation issues (use TEST_HOOKS)
- Verify no other test is setting state that affects yours
- Check if real-time mode interferes (beforeEach should stop it)

### Documentation Out of Sync
- Re-read TESTS.md and update test matrix
- Ensure test ID matches between registry and docs

## Output

After running this check, report:

```
MANDATORY CHECK RESULTS
=======================
Gate 1 (Code): PASS/FAIL
Gate 2 (Tests): PASS/FAIL - N/N tests passing
Gate 3 (Docs): PASS/FAIL
Gate 4 (Commit Ready): PASS/FAIL
Gate 5 (Verified): PASS/FAIL

Overall: READY TO COMMIT / NEEDS ATTENTION

[List any items that need attention]
```

## Reference

See AI_GOVERNOR.md:
- §3 Quality Gates
- §3.1 Test Creation Checklist
- Mandatory Behaviors table items 8-10
