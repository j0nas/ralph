# Task: Create numbered files across multiple iterations

## Objective

Test Ralph's multi-iteration capability by creating a series of files, one per iteration. This verifies that progress persists between iterations and that the loop terminates correctly.

## Success Criteria

The task is complete when ALL of these are true:
- [ ] File `step1.txt` exists with content "Step 1 complete"
- [ ] File `step2.txt` exists with content "Step 2 complete"
- [ ] File `step3.txt` exists with content "Step 3 complete"
- [ ] All three files verified to exist

## Instructions

1. **Iteration 1**: Create `step1.txt` with content "Step 1 complete". Update progress.md and set status to IN_PROGRESS.

2. **Iteration 2**: Create `step2.txt` with content "Step 2 complete". Update progress.md and set status to IN_PROGRESS.

3. **Iteration 3**: Create `step3.txt` with content "Step 3 complete". Verify all three files exist. Update progress.md and set status to DONE.

**Important**: Only create ONE file per iteration to test the multi-iteration flow. Do not create all files in a single iteration.

## Notes

- This is a test task for validating Ralph's loop functionality
- Each iteration should create exactly one file
- The task should complete in exactly 3 iterations
