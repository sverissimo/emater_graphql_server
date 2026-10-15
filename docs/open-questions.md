# Open questions

Record non-blocking unknowns under `## <run-name>` using the coordinator's run
name (or a descriptive task name for manual work). Keep the affected work
explicitly pending and continue with the parts supported by evidence. Never
include credentials, env values, or private report contents.

Use this format:

```md
## gateway-cache-plan

- Q: Which behavior should apply? (pending: the affected behavior)
  Answer:
```

The user fills in `Answer:`. A later task applies answered entries in its own
section and any earlier section explicitly named by the task. Remove an entry
only after fully applying its answer, then remove empty sections. Blocking
questions belong in `needs_user` or a direct clarification to the user.
