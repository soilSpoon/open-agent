# Tasks: OpenSpec-Native Ralph Engine (Antfarm Update)

## Relevant Files

- `openspec/config.yaml` - Project context and rules (NEW).
- `lib/ralph/engine.ts` - Main engine loop refactoring.
- `lib/ralph/types.ts` - Schema updates for Verifier feedback.
- `lib/ralph/prompt.ts` - Prompt generation (feedback injection).
- `lib/openspec/service.ts` - OpenSpec CLI wrapper (remove `escalateChange`).

### Notes

- `openspec instructions apply --json` is the primary command Ralph should use for task execution.
- `openspec status --json` is used for loop control (isComplete, artifact readiness).
- `openspec block` does NOT exist — do not use it.
- Run `bun run check` and `bun run build` after each change.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. Update after completing each sub-task, not just parent tasks.

## Tasks

- [ ] 0.0 Create feature branch
  - [x] 0.1 Create and checkout `feature/ralph-antfarm-update`

- [ ] 1.0 Create openspec/config.yaml
  - [ ] 1.1 Create `openspec/config.yaml` with project context (tech stack, conventions) and per-artifact rules
  - [ ] 1.2 Verify `openspec instructions apply --json --change <existing-change>` includes context in output

- [ ] 2.0 Remove non-existent `openspec block` dependency
  - [ ] 2.1 Remove `escalateChange()` method from `RalphEngine` (calls `openspec block` which doesn't exist)
  - [ ] 2.2 Replace escalation logic with session status `failed` + callback notification
  - [ ] 2.3 Verify build passes (`bun run check && bun run build`)

- [ ] 3.0 Refactor Ralph to use OpenSpec CLI as SSoT
  - [ ] 3.1 Verify `getOpenSpecStatus()` output matches `openspec instructions apply --json` schema
  - [ ] 3.2 Remove any Ralph-internal DAG/state calculation that duplicates OpenSpec logic
  - [ ] 3.3 Ensure `openspec status --json` is used for artifact readiness checks
  - [ ] 3.4 Ensure `openspec instructions apply --json` is used for task list and progress

- [ ] 4.0 Add Verifier Agent step
  - [x] 4.1 Create Verifier prompt template in `lib/ralph/prompt.ts`
  - [x] 4.2 Add `runVerifier()` method to `RalphEngine` that runs a separate sandbox session
  - [x] 4.3 Add `verifierFeedback` field to `IterationLog` schema in `types.ts`
  - [x] 4.4 Integrate Verifier step after Dual-Gate in `executeTaskWithErrorHandling()`

- [ ] 5.0 Implement Feedback Loop
  - [x] 5.1 Save Verifier feedback to `.ralph/verification-feedback.md` on failure
  - [x] 5.2 Read feedback file and inject `## PREVIOUS VERIFICATION FEEDBACK` into Developer prompt on retry
  - [x] 5.3 Clear feedback file on task success
  - [x] 5.4 Respect max retry count (default 2) before escalation

- [ ] 6.0 Tracing & Visibility (Next Phase)
  - [ ] 6.1 Add `traces` field to `IterationLog` schema
  - [ ] 6.2 Instrument sandbox-agent for tool call tracing
