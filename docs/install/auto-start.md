# Login auto-start

Throughline's backend (T-D2) is intended to run as a long-lived process. ROADMAP Phase 1
documents the auto-start mechanism per platform; nothing is enabled by default — you opt in.

## Setup first (build the artifact)

`start` runs the **compiled** backend (`node dist/index.js`) and serves the **built** frontend
SPA, so you must build once from a fresh clone before starting or enabling any auto-start unit:

```
./scripts/setup.sh
```

(the single-command setup — runs `pnpm install` then `pnpm -r build` for all packages; SPEC §11).
Equivalently, run those two commands directly (e.g. on Windows): `pnpm install && pnpm -r build`.
The OS units below run the same `start` command, so this build must have happened first — they do
**not** build for you. Re-run the build after pulling changes.

## The backend command

For all platforms:

```
pnpm start
```

(equivalently `pnpm --filter @throughline/backend start`). This runs `node dist/index.js` —
the compiled artifact under production module resolution. (`pnpm dev` is the dev variant via
`tsx watch`, which runs the TypeScript source directly and does not require a build.)

Environment variables the backend reads:

| Var | Default | Purpose |
|---|---|---|
| `THROUGHLINE_DATA_DIR` | `~/.throughline` | SQLite + secrets + inbox archives |
| `THROUGHLINE_METHODOLOGIES_DIR` | `<install-root>/methodologies` | Where bundles are discovered (C-D3) |
| `THROUGHLINE_INSTALL_ROOT` | three directories above this file | Repo root, used to resolve the default `methodologies/` |
| `THROUGHLINE_PORT` | `47823` | Local bind port |

The backend always binds to `127.0.0.1` (T-D31). No external network exposure.

---

## macOS — `launchd`

Create `~/Library/LaunchAgents/dev.throughline.backend.plist` with the contents below. Replace
`/Users/you/throughline` with your repo path.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key><string>dev.throughline.backend</string>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/local/bin/pnpm</string>
      <string>--filter</string>
      <string>@throughline/backend</string>
      <string>start</string>
    </array>
    <key>WorkingDirectory</key><string>/Users/you/throughline</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/Users/you/.throughline/backend.out.log</string>
    <key>StandardErrorPath</key><string>/Users/you/.throughline/backend.err.log</string>
  </dict>
</plist>
```

Enable:

```
launchctl load ~/Library/LaunchAgents/dev.throughline.backend.plist
```

Disable:

```
launchctl unload ~/Library/LaunchAgents/dev.throughline.backend.plist
```

---

## Linux — `systemd` user unit

Create `~/.config/systemd/user/throughline-backend.service`. Replace `/home/you/throughline` with
your repo path.

```ini
[Unit]
Description=Throughline backend
After=network-online.target

[Service]
WorkingDirectory=/home/you/throughline
ExecStart=/usr/bin/pnpm --filter @throughline/backend start
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
```

Enable + start:

```
systemctl --user daemon-reload
systemctl --user enable --now throughline-backend.service
```

Logs:

```
journalctl --user -u throughline-backend.service -f
```

---

## Windows — Task Scheduler

Create a new task in Task Scheduler with the following settings:

- **Trigger:** At log on of your user account.
- **Action:** Start a program — `C:\Program Files\nodejs\pnpm.cmd`
- **Arguments:** `--filter @throughline/backend start`
- **Start in:** the repo path (e.g. `C:\Users\you\throughline`).
- **Conditions:** uncheck "Start the task only if the computer is on AC power".
- **Settings:** "If the task fails, restart every: 1 minute, up to: 3 times."

---

## Disabling

To stop the backend permanently, remove the platform-specific unit/plist/task. Closing your
browser does not stop the backend; that's the point (SPEC §3).
