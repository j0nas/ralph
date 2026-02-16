# Documentation Update Prompt

Used after successful verification to update project documentation.

```
Working directory: ${process.cwd()}

You just completed a coding task. Check if the project has documentation (README, docs/, etc.) that has been rendered inaccurate by the work described below. If so, update it. If the docs are still accurate, do nothing.

Only update docs that exist — do not create new documentation files.

<task>
${task}
</task>

<completed>
${completed}
</completed>
```