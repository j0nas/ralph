#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "=== Ralph Test Harness ==="
echo ""

# Clean up from previous runs
echo "Cleaning up previous test artifacts..."
rm -f step1.txt step2.txt step3.txt progress.md
echo ""

# Run ralph with max 5 iterations (should complete in 3)
echo "Running ralph..."
echo ""
node ../dist/index.js -m 5

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

if grep -q "## Status: DONE" progress.md 2>/dev/null; then
    echo "✓ progress.md has DONE status"
else
    echo "✗ progress.md missing DONE status"
    PASS=false
fi

echo ""
if $PASS; then
    echo "=== ALL TESTS PASSED ==="
    exit 0
else
    echo "=== SOME TESTS FAILED ==="
    exit 1
fi
