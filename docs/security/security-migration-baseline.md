# DecoKeeAI Security Migration Baseline

Created: 2026-06-18

This file is the shared Phase 0 baseline for the Electron security migration. It is intentionally descriptive: later tasks add automated checks and code changes. Future Codex sessions should update this file when a security invariant moves from "known insecure" to "fixed".

## Current Known Insecure Baseline

The following items are confirmed by static review and should be treated as migration targets:

- Electron runtime is `23.0.0` in `package.json`.
- Most BrowserWindow definitions enable `nodeIntegration:true`, `enableRemoteModule:true`, `webSecurity:false`, and `webviewTag:true`.
- Several app windows use `contextIsolation:false`.
- Renderer initialization exposes privileged objects such as `fs`, `shell`, `clipboard`, `store`, `appManager`, `resourcesManager`, and `globalShortcut` on `window`.
- `@electron/remote` is used in renderer and main window setup.
- AI/model/provider responses are parsed with `eval()` in main and renderer code.
- AI assistant Markdown is rendered with `v-html` without a sanitizer.
- OTA update flow downloads and extracts a ZIP without visible signature or digest verification.
- Plugin ZIP extraction lacks explicit canonical path containment checks.
- Web and native plugins run with broad privileges; native plugin launch uses shell command construction.
- Local HTTP and WebSocket servers call `.listen(port)` without explicit localhost binding and without authentication.
- API keys and chat/plugin state are stored through plain `electron-store`; sensitive values are logged.
- Firecrawl token is hardcoded in source.

## Security Invariants For Target State

The migration is not complete until these invariants hold:

- No production BrowserWindow or webview runs with `nodeIntegration:true`.
- No production BrowserWindow runs with `contextIsolation:false`.
- No production BrowserWindow or webview disables `webSecurity`.
- No renderer imports or uses `@electron/remote`.
- No renderer receives raw `fs`, `shell`, `appManager`, `resourcesManager`, or `storeManager`.
- No code path uses `eval()` on LLM, clipboard, network, plugin, device, or config data.
- OTA artifacts are verified by signature and digest before extraction or apply.
- ZIP extraction rejects entries that escape the intended target directory.
- Local servers bind to `127.0.0.1` by default and require tokens for privileged WebSocket events.
- AI actions that affect OS, clipboard, Home Assistant, files, or URLs pass through an explicit policy gate.
- API keys are stored in OS-backed secret storage and are redacted from logs.

## Manual Smoke Checklist

Run this checklist before and after each major phase. Record platform, commit, Electron version, and failures in the relevant phase notes.

### App Startup

- App launches without dev server.
- Main window opens and renders the default main screen.
- Settings window opens and saves a non-secret setting.
- AI assistant window opens and closes from the global shortcut.
- App quits and restarts cleanly.

### Device And HID

- DECOKEE Quake connects over USB HID.
- Key press events are received.
- A configured hotkey action executes.
- A configured text action types into a safe test editor.
- Device display update works for title and icon changes.
- VIA/QMK view opens only for the expected device flow.

### AI And STT/TTS

- AI chat sends a basic text prompt and receives a response.
- Streaming and non-streaming provider paths are tested where supported.
- STT starts, records, stops, and returns a transcript.
- TTS plays a short response and reports completion.
- Selected-text helper menu can be enabled and disabled.
- AI action flow refuses or asks confirmation for sensitive actions.

### Plugins

- Known-good web plugin installs from ZIP.
- Known-good native plugin behavior is tested only in an explicit trusted/developer mode.
- Plugin property inspector opens.
- Plugin `setSettings`, `getSettings`, `setTitle`, and `setImage` still work for trusted plugin clients.
- Unauthenticated WebSocket client cannot call privileged plugin events.

### OTA

- Update check handles "no update" response.
- Signed update manifest is accepted only when signature and digest are valid.
- Unsigned, bad-signature, bad-digest, and path-traversal update packages are rejected.
- App does not replace `resources/app` until verification has completed.

### Local Servers And Phone Companion

- Local plugin HTTP server is reachable from the app when expected.
- Local servers are not reachable from LAN unless user enables paired phone mode.
- Phone pairing creates a token.
- Invalid Origin or missing token is rejected.
- Rate limiting prevents repeated invalid WebSocket messages from consuming unbounded resources.

### Privacy And Secrets

- API keys do not appear in `config.json`, `PluginConfigs.json`, `ChatHistory.json`, or log files.
- Chat history retention can be disabled or cleared.
- Logs redact Authorization headers, API keys, prompts, transcripts, and selected text by default.
- Settings UI clearly identifies external providers that receive text, audio, URL, selected text, or web content.

## Static Commands For Phase 0

These commands are read-only and safe to run without building the app:

```bash
git status --short
rg -n --glob '!public/plugin/**' "nodeIntegration: true|contextIsolation: false|webSecurity: false|enableRemoteModule: true|@electron/remote|eval\\(" src public package.json vue.config.js
rg -n --glob '!public/plugin/**' "ipcMain\\.(on|handle)|\\.listen\\(|DecompressZip|shelljs\\.rm|child_process|exec\\(" src
```

Expected current result: the commands report known violations. `npm run security:baseline` now provides the same baseline as an automated guard and currently fails on the known insecure state.

`public/plugin/VIA/**` is a vendored/minified bundle and is intentionally excluded from the default source scan to keep the signal readable. Review or replace that bundle as part of the supply-chain work rather than mixing it into app-source findings.

## Phase Ownership Notes

- Electron/build migration should not attempt to fix every security finding in the same PR.
- Renderer hardening should land before plugin hardening, because plugins currently inherit unsafe window/webview assumptions.
- OTA hardening should be treated as a release blocker before shipping any auto-update feature.
- AI action hardening should be treated as a release blocker before enabling command execution or Home Assistant control from model output.
