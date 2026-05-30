# OneDrive `.git/index.lock` recurring on Windows-mounted repo

**Filed:** 2026-05-29
**Severity:** medium (recoverable, but adds 10-30 min per occurrence)
**Tag:** tracks-architect attention; framework-level OneDrive/WSL filesystem interaction
**Reporter:** orchestrator catch-up session 2026-05-29

## Pattern

1. A WSL-side session (Cowork sandbox or VS Code via WSL) tries to commit.
2. `git commit` fails with "another git process seems to be running in this repository" -- typically pointing at `.git/index.lock`.
3. Inspection shows: 0-byte lock file, frozen mtime (often hours old), no live git process holding it (`ps aux | grep git` returns nothing).
4. The lock is being held by Windows-side OneDrive sync (open file handle the WSL sandbox can't release).
5. WSL `rm` on the lock file silently fails or appears to succeed without actually releasing it. Removing the lock requires a Windows-side `del` command (PowerShell or cmd, not WSL).

## Cost when it fires

Hit twice today (2026-05-29):

- `local_efd8ad9a` -- memo continuation sections 7-15 written to disk but commit blocked; resolved by dispatching a Windows-side session to `del .git\index.lock`. ~15 min from detection to recovery.
- The `local_a1890c9c` unblock session also found both `.git/index.lock` **AND** `.git/HEAD.lock` stale -- which suggests the failure mode is happening more often than is being caught (HEAD.lock should not normally be left stale even if index.lock is).

Likely additional silent occurrences earlier in the day that other sessions auto-recovered from or were never noticed because the operator wasn't there.

## Current workaround

When detected, dispatch a Windows-side session (PowerShell or `cmd.exe`) to:

```
del .git\index.lock
del .git\HEAD.lock
```

WSL `rm` does not reliably release the Windows-held file handles. Workaround is dependable but requires manual operator intervention or a second session dispatch.

## Recommendation for architect to consider

Two options, plus a structural one:

1. **Add a pre-commit defensive check to every brief that touches files via WSL.** Before any commit operation, the brief instructs the session to check `ls -la .git/*.lock` (or equivalent). If stale lock files are present, the brief instructs the session to STOP and surface the issue to the operator rather than retry-looping or attempting to remove them itself (the WSL `rm` is unreliable, and a retry-loop wastes credits without recovering).

2. **Recommend Steven move the repo off OneDrive entirely.** CLAUDE.md already notes the project moved off OneDrive once before to fix the trailing-null-bytes-in-page.js issue; the lock-file recurrence suggests OneDrive's open file handles are still causing problems. A move to a non-OneDrive path (e.g. `C:\dev\safeeval` outside the OneDrive sync root) eliminates the failure mode entirely.

3. **Structural: file an upstream bug against OneDrive + git.** OneDrive should not be holding open file handles on `.git/` internals. This is a Microsoft issue, not a SafeEval workflow problem, but is unlikely to be fixed on any useful timeline.

The right call is probably (2) -- the recurrence shows the move-off-OneDrive recommendation in CLAUDE.md's "known gotchas" section is incomplete; the page.js null-byte fix only addressed one symptom of the OneDrive interaction, not the underlying handle-holding behavior. Option (1) is the cheapest defensive measure if (2) is not feasible right now.

## Related observations

CLAUDE.md's "known gotchas" section mentions the page.js trailing null-bytes issue and notes "this is no longer an expected failure mode now that the project is off OneDrive." Today's two occurrences contradict that note -- the repo is presumably back on OneDrive (or `.git/` internals are being synced by OneDrive even if the working tree isn't). CLAUDE.md should be updated either way.
