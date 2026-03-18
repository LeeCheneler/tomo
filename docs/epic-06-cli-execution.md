# Epic 6 — CLI Command Execution

Add a guarded command execution tool that lets the model run shell commands with user approval.

**Depends on:** Epic 4 (Tool System)

## Tickets

### E6-01: `run_command` tool handler

Register the `run_command` tool with the registry. Schema takes a `command` string parameter. Handler spawns a child process, captures stdout and stderr, and returns the combined output as tool content.

Acceptance criteria:

- Tool is registered and appears in provider requests
- Commands execute in the current working directory
- Both stdout and stderr are captured and returned
- Process errors (command not found, permission denied) are caught and returned as tool content rather than crashing

---

### E6-02: Approval gate UI

When a `run_command` tool call arrives, pause execution and display the proposed command prominently in the UI. Present approve/reject options. Block until the user responds. On approval, execute the command. On rejection, return a "user declined this command" message to the model as the tool result.

Acceptance criteria:

- Command is displayed clearly before execution
- User can approve or reject
- Approval triggers execution, rejection feeds back to the model
- Model can adjust its approach after a rejection

---

### E6-03: Command timeout and output handling

Add a configurable timeout for command execution (from config, default 30s). Kill the process if it exceeds the timeout and return whatever output was captured along with a timeout notice. Truncate very long outputs to a sensible limit so they don't blow up the model's context window.

Acceptance criteria:

- Commands that exceed the timeout are killed
- Partial output is returned on timeout
- Very long outputs are truncated with a notice
- Timeout is configurable via config

---

### E6-04: Command allowlist/denylist

Read optional `allowlist` and `denylist` arrays from the tool config. Allowlisted commands bypass the approval prompt. Denylisted commands are auto-rejected with a message to the model. Matching is on command prefix (e.g. `ls` matches `ls -la`).

Acceptance criteria:

- Allowlisted commands execute without approval prompt
- Denylisted commands are auto-rejected
- Matching works on command prefix
- Lists are configured in the config file
- Empty lists mean all commands go through the approval flow

---

### E6-05: End-to-end integration test

Verify the full flow works with both tools (web search + CLI execution) active simultaneously. Model should be able to search the web and run commands in the same conversation. Ensure tool calls, approvals, results, and final responses all render correctly.

Acceptance criteria:

- Model can use both `web_search` and `run_command` in a single session
- Multiple tool calls in one turn work correctly
- Conversation history stays consistent across tool calls
- UI clearly shows the flow of tool calls and results
