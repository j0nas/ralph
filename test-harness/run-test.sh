#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "=== Ralph Test Harness ==="
echo ""

# Clean up from previous runs
echo "Cleaning up previous test artifacts..."
rm -f step1.txt step2.txt step3.txt
echo ""

# Create a test session
SESSION_ID="test-$(date +%s)"
SESSION_DIR="${TMPDIR:-/tmp}/ralph"
SESSION_FILE="$SESSION_DIR/session-$SESSION_ID.md"

mkdir -p "$SESSION_DIR"

# Create the session file with task and initial progress
cat > "$SESSION_FILE" << 'EOF'
# Session: test-session
Created: 2025-01-27T00:00:00.000Z
Working Directory: TEST_DIR

## Task

### Objective

Test Ralph's multi-iteration capability by creating a series of files, one per iteration. This verifies that progress persists between iterations and that the loop terminates correctly.

### Success Criteria

The task is complete when ALL of these are true:
- [ ] File `step1.txt` exists with content "Step 1 complete"
- [ ] File `step2.txt` exists with content "Step 2 complete"
- [ ] File `step3.txt` exists with content "Step 3 complete"
- [ ] All three files verified to exist

### Instructions

1. **Iteration 1**: Create `step1.txt` with content "Step 1 complete". Update the session file and set status to IN_PROGRESS.

2. **Iteration 2**: Create `step2.txt` with content "Step 2 complete". Update the session file and set status to IN_PROGRESS.

3. **Iteration 3**: Create `step3.txt` with content "Step 3 complete". Verify all three files exist. Update the session file and set status to DONE.

**Important**: Only create ONE file per iteration to test the multi-iteration flow. Do not create all files in a single iteration.

### Notes

- This is a test task for validating Ralph's loop functionality
- Each iteration should create exactly one file
- The task should complete in exactly 3 iterations

## Status: IN_PROGRESS

## Completed

(none yet)

## Current Focus

Create step1.txt with content "Step 1 complete"

## Remaining

- [ ] Create step1.txt with "Step 1 complete"
- [ ] Create step2.txt with "Step 2 complete"
- [ ] Create step3.txt with "Step 3 complete"
- [ ] Verify all files exist and set status to DONE

## Notes

Starting test run.
EOF

# Replace TEST_DIR with actual directory
sed -i '' "s|TEST_DIR|$(pwd)|g" "$SESSION_FILE"

echo "Created test session: $SESSION_ID"
echo "Session file: $SESSION_FILE"
echo ""

# Run ralph with max 5 iterations (should complete in 3)
echo "Running ralph..."
echo ""
node ../dist/index.js "$SESSION_ID" -m 5

echo ""
echo "=== Verification ==="

# Check results
PASS=true

if [[ -f step1.txt ]] && grep -q "Step 1 complete" step1.txt; then
    echo "✓ step1.txt exists with correct content"
else
    echo "✗ step1.txt missing or incorrect"
    PASS=false
fi

if [[ -f step2.txt ]] && grep -q "Step 2 complete" step2.txt; then
    echo "✓ step2.txt exists with correct content"
else
    echo "✗ step2.txt missing or incorrect"
    PASS=false
fi

if [[ -f step3.txt ]] && grep -q "Step 3 complete" step3.txt; then
    echo "✓ step3.txt exists with correct content"
else
    echo "✗ step3.txt missing or incorrect"
    PASS=false
fi

if grep -q "## Status: DONE" "$SESSION_FILE" 2>/dev/null; then
    echo "✓ Session file has DONE status"
else
    echo "✗ Session file missing DONE status"
    PASS=false
fi

# Clean up session file
rm -f "$SESSION_FILE"

echo ""
if $PASS; then
    echo "=== ALL TESTS PASSED ==="
    exit 0
else
    echo "=== SOME TESTS FAILED ==="
    exit 1
fi
