# Electron Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate DecoKeeAI from Electron 23 to a supported Electron line and close the critical security gaps found in the static audit.

**Architecture:** Treat renderer, plugins, local WebSocket clients, OTA packages, LLM output, web content, and device messages as untrusted inputs. Move privileged operations into the main process behind typed preload APIs, validated IPC, signed update/plugin boundaries, and explicit action policies. Keep the migration incremental so every phase has a testable security improvement and a rollback point.

**Tech Stack:** Electron 23 -> latest supported Electron line, Vue 2 / Vue CLI 5, Node.js, Electron preload/contextBridge, IPC, node-hid, robotjs, uiohook-napi, ws, express, electron-store, electron-log.

## Global Constraints

- Keep the app usable during migration; do not combine unrelated security epics in a single PR.
- Prefer failing regression tests or static guard scripts before behavior changes.
- Do not keep temporary insecure exceptions unless they are tracked in an allowlist with owner, reason, expiry, and test coverage.
- Renderer code must not receive `fs`, `shell`, `appManager`, `resourcesManager`, `storeManager`, or `@electron/remote` directly.
- Any network/package install/build step must be run explicitly by the implementer with the right approval in restricted environments.
- Security target state: `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`, `webSecurity:true`, no `@electron/remote`, signed OTA, authenticated local servers, no `eval()` on untrusted data.

---

## File Structure

- `docs/security/security-migration-baseline.md`: shared Phase 0 baseline, smoke checklist, known insecure baseline, and manual verification matrix.
- `scripts/security/check-electron-security-baseline.mjs`: static guard script for high-risk Electron/IPC/AI patterns.
- `package.json`: add `security:baseline` script after the guard script exists.
- `src/main/security/`: new main-process security helpers for IPC sender checks, schemas, update verification, path containment, and policy decisions.
- `src/preload/`: preload APIs exposed via `contextBridge`.
- `src/main/windows/`: replace per-window `webPreferences` with a secure BrowserWindow factory.
- `src/main/ai/`: remove `eval()`, add strict JSON schema parsing and AI action policy.
- `src/main/DeviceControl/Connections/`: authenticate local WebSocket servers and harden protocol parsing.
- `src/main/managers/resources.js`: plugin ZIP/path containment and signed plugin handling.
- `src/views/Components/UpgradeInfoDialog.vue` and `src/background.js`: remove renderer-side OTA apply path and move update apply into verified main-process flow.

## Task 1: Phase 0 Baseline Documentation

**Files:**
- Create: `docs/security/security-migration-baseline.md`
- Create: `docs/superpowers/plans/2026-06-18-electron-security-hardening.md`

**Interfaces:**
- Consumes: static audit findings from this Codex thread.
- Produces: shared baseline checklist used by all later tasks.

- [x] **Step 1: Save this migration plan**

Create `docs/superpowers/plans/2026-06-18-electron-security-hardening.md` with the complete task list.

- [x] **Step 2: Save the Phase 0 baseline checklist**

Create `docs/security/security-migration-baseline.md` with smoke tests, security invariants, and current known insecure state.

- [ ] **Step 3: Review baseline with maintainers**

Run: `sed -n '1,240p' docs/security/security-migration-baseline.md`

Expected: maintainers can identify every critical product flow that must keep working.

- [ ] **Step 4: Commit baseline docs**

```bash
git add docs/security/security-migration-baseline.md docs/superpowers/plans/2026-06-18-electron-security-hardening.md
git commit -m "docs: add electron security hardening plan"
```

Expected: baseline docs are visible to future Codex sessions through git history.

## Task 2: Static Security Baseline Guard

**Files:**
- Create: `scripts/security/check-electron-security-baseline.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: repository source files.
- Produces: `npm run security:baseline`, a read-only static check command.

- [x] **Step 1: Write a failing static guard for known insecure patterns**

Create a Node.js script that scans for:
- `nodeIntegration: true`
- `contextIsolation: false`
- `webSecurity: false`
- `enableRemoteModule: true`
- `require('@electron/remote')`
- `eval(`
- `ipcMain.on('download'`
- `server.listen(` without explicit host in local server files

The script must exclude `public/plugin/VIA/**` by default because it is a vendored/minified bundle. Supply-chain review of that bundle belongs to Task 14.

Run: `node scripts/security/check-electron-security-baseline.mjs`

Expected: FAIL and list current violations.

- [x] **Step 2: Add npm script**

Add to `package.json`:

```json
"security:baseline": "node scripts/security/check-electron-security-baseline.mjs"
```

Run: `npm run security:baseline`

Expected: FAIL and list current violations.

- [x] **Step 3: Keep the guard failing until the relevant hardening task closes each violation**

This guard is intentionally red at first. Later tasks must reduce violations and update the allowed baseline only with explicit justification.

## Task 3: Electron Runtime And Build Migration Spike

**Files:**
- Modify: `package.json`
- Modify: lockfile if present after dependency install.
- Modify: `vue.config.js`
- Create: `docs/security/electron-upgrade-notes.md`

**Interfaces:**
- Consumes: Task 1 smoke checklist.
- Produces: validated target Electron version and native-module compatibility notes.

- [ ] **Step 1: Confirm target Electron line**

Use official Electron release notes and breaking changes. Record target version, Chromium, Node.js, and minimum OS versions in `docs/security/electron-upgrade-notes.md`.

- [ ] **Step 2: Update Electron dependency in an isolated branch**

Update `electron` and related Electron builder dependencies. Do not change security preferences in this task.

- [ ] **Step 3: Rebuild native modules**

Validate `node-hid`, `robotjs`, `uiohook-napi`, `active-win`, `sharp`, and local `file:modules/*` packages.

- [ ] **Step 4: Run smoke checklist**

Use `docs/security/security-migration-baseline.md`. Record failures in `docs/security/electron-upgrade-notes.md`.

## Task 4: Secure BrowserWindow Factory

**Files:**
- Create: `src/main/security/createSecureBrowserWindow.js`
- Modify: `src/main/windows/mainWindow.js`
- Modify: `src/main/windows/SettingWindow.js`
- Modify: `src/main/windows/AIAssistantWindow.js`
- Modify: `src/main/windows/CustomConfigWindow.js`
- Modify: `src/main/windows/IconSelectWindow.js`
- Modify: `src/main/windows/PluginWebWindow.js`
- Modify: `src/main/events/app.js`

**Interfaces:**
- Consumes: current window creation options.
- Produces: one secure window factory and an explicit temporary exception list.

- [ ] **Step 1: Add factory tests or guard cases**

Expected defaults: `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`, `webSecurity:true`, `enableRemoteModule:false`, `webviewTag:false`.

- [ ] **Step 2: Implement secure factory**

The factory must merge safe defaults with narrow per-window options and reject unsafe options unless listed in a tracked exception object.

- [ ] **Step 3: Convert non-plugin windows first**

Main, settings, assistant, custom config, and icon select windows should use the factory before plugin windows.

- [ ] **Step 4: Add navigation and window-open allowlists**

Centralize `will-navigate`, `setWindowOpenHandler`, and external URL validation.

## Task 5: Preload API And `@electron/remote` Removal

**Files:**
- Create: `src/preload/mainPreload.js`
- Create: `src/preload/assistantPreload.js`
- Create: `src/preload/settingsPreload.js`
- Modify: `src/App.vue`
- Modify: renderer components that use `window.fs`, `window.shell`, `window.store`, `window.resourcesManager`, or `window.appManager`.
- Modify: `public/index.html`

**Interfaces:**
- Consumes: secure BrowserWindow factory from Task 4.
- Produces: typed `window.decokee` API exposed via `contextBridge`.

- [ ] **Step 1: Define preload API surface**

Expose only namespaced APIs:
- `window.decokee.system`
- `window.decokee.store`
- `window.decokee.device`
- `window.decokee.ai`
- `window.decokee.plugins`
- `window.decokee.updates`

- [ ] **Step 2: Remove renderer `require()` usage**

Remove direct `require('electron')` from `public/index.html` and renderer files.

- [ ] **Step 3: Remove `@electron/remote`**

Delete renderer remote usage and remove the dependency after all consumers are migrated.

## Task 6: IPC Validation And Sender Authorization

**Files:**
- Create: `src/main/security/ipcRegistry.js`
- Create: `src/main/security/ipcSchemas.js`
- Modify: IPC handlers in `src/main/windows/mainWindow.js`, `src/main/DeviceControl/DeviceControlManager.js`, `src/main/ai/AIManager.js`, `src/main/ai/Connector/OpenAIAdapter.js`, `src/main/DeviceControl/Connections/PluginWSServer.js`.

**Interfaces:**
- Consumes: preload APIs from Task 5.
- Produces: schema-validated, sender-authorized IPC.

- [ ] **Step 1: Add schema validation helper**

Every privileged channel must validate payloads before touching a sink.

- [ ] **Step 2: Add sender checks**

Each channel must declare allowed window types and URL origins.

- [ ] **Step 3: Remove or replace broad channels**

Close `download`, raw profile mutation, raw AI response, and monitor-image channels unless they have a narrow schema and trusted sender.

## Task 7: Remove `eval()` And Validate AI Data

**Files:**
- Modify: `src/main/ai/AIManager.js`
- Modify: `src/views/AIAssistant/OpenAIEngine.vue`
- Modify: `src/main/managers/menu.js`
- Create: `src/main/ai/parseAIJson.js`
- Create: `src/main/ai/aiResponseSchemas.js`

**Interfaces:**
- Consumes: model/provider text.
- Produces: strict parsed objects or typed rejection errors.

- [ ] **Step 1: Add parser tests for invalid JavaScript-shaped payloads**

Inputs that are not valid JSON must be rejected, not executed.

- [ ] **Step 2: Replace `eval()` with `JSON.parse` and schema validation**

All current `eval('(' + data + ')')` sites must be removed.

- [ ] **Step 3: Update model repair flow**

If a model returns invalid JSON, ask for repair and parse again with the same strict parser. Never execute repaired text.

## Task 8: AI Action Policy

**Files:**
- Create: `src/main/ai/actionPolicy.js`
- Modify: `src/main/ai/AIManager.js`
- Modify: UI components that confirm AI actions.

**Interfaces:**
- Consumes: parsed AI action objects from Task 7.
- Produces: allow/deny/confirm decisions before OS, clipboard, URL, document, or Home Assistant actions.

- [ ] **Step 1: Default-deny command execution**

`EXECUTE_CMD` must be disabled unless an explicit developer-mode setting is enabled.

- [ ] **Step 2: Require confirmation for sensitive actions**

Open URL, close app, write to cursor, Home Assistant calls, document generation, and plugin/config mutation require clear user confirmation.

- [ ] **Step 3: Add audit events**

Record action type, source, user confirmation result, and sanitized target.

## Task 9: OTA Verification And Safe Apply

**Files:**
- Create: `src/main/security/updateVerifier.js`
- Create: `src/main/security/safeZipExtract.js`
- Modify: `src/plugins/VersionHelper.js`
- Modify: `src/views/Components/UpgradeInfoDialog.vue`
- Modify: `src/background.js`
- Modify: update IPC from Task 6.

**Interfaces:**
- Consumes: signed update manifest and downloaded artifact.
- Produces: verified staged update directory or rejection.

- [ ] **Step 1: Define signed manifest format**

Fields: version, platform, artifactUrl, sha256, signature, minimumVersion.

- [ ] **Step 2: Verify signature and digest before extraction**

Use an embedded public key and reject unsigned or mismatched artifacts.

- [ ] **Step 3: Add zip-slip protection**

Canonicalize each entry and ensure it stays inside the staging directory.

- [ ] **Step 4: Move update apply into main process**

Renderer may request update, but cannot choose arbitrary URL or save path.

## Task 10: Plugin Sandbox, Signing, And Capabilities

**Files:**
- Modify: `src/main/managers/resources.js`
- Modify: `src/main/windows/PluginWebWindow.js`
- Modify: `src/views/AIAssistant/PluginOptionView.vue`
- Modify: `src/main/DeviceControl/Connections/NativePluginLoader.js`
- Modify: `src/main/DeviceControl/Connections/PluginWSServer.js`
- Create: `src/main/security/pluginManifestSchema.js`
- Create: `src/main/security/pluginCapabilities.js`

**Interfaces:**
- Consumes: plugin ZIP packages and plugin WebSocket events.
- Produces: sandboxed plugin runtime with explicit capabilities.

- [ ] **Step 1: Validate plugin manifest schema**

Reject missing, malformed, absolute, or traversal paths.

- [ ] **Step 2: Add plugin ZIP containment**

Reject ZIP entries that escape the target plugin directory.

- [ ] **Step 3: Disable Node in web plugins**

Web plugins and property inspectors must run without Node integration.

- [ ] **Step 4: Gate native plugins**

Native plugin execution requires signed plugin trust or explicit developer-mode approval.

- [ ] **Step 5: Authenticate plugin WebSocket clients**

Per-plugin session tokens must be required for `setSettings`, `openUrl`, `setImage`, and related events.

## Task 11: Local Server Authentication

**Files:**
- Modify: `src/main/managers/httpExpress.js`
- Modify: `src/main/DeviceControl/Connections/WSManager.js`
- Modify: `src/main/DeviceControl/Connections/PluginWSServer.js`
- Create: `src/main/security/localServerAuth.js`

**Interfaces:**
- Consumes: local HTTP/WS requests.
- Produces: localhost-only default servers and paired LAN phone companion mode.

- [ ] **Step 1: Bind to `127.0.0.1` by default**

All local servers must pass host explicitly to `.listen(port, '127.0.0.1')`.

- [ ] **Step 2: Add Origin and token checks**

Browser-origin requests and LAN clients must fail without a valid session token.

- [ ] **Step 3: Add phone pairing flow**

LAN bind may only be enabled after user pairing.

## Task 12: Shell, File, And Path Hardening

**Files:**
- Modify: `src/main/DeviceControl/DeviceControlManager.js`
- Modify: `src/main/DeviceControl/Connections/NativePluginLoader.js`
- Modify: `src/main/ai/AIManager.js`
- Modify: `src/main/ai/GeneralAIManager.js`
- Modify: `src/main/managers/resources.js`
- Create: `src/main/security/safeProcess.js`
- Create: `src/main/security/safePath.js`

**Interfaces:**
- Consumes: configured paths, plugin paths, AI action targets, and app paths.
- Produces: shell-free process execution and canonical path validation.

- [ ] **Step 1: Replace shell `exec()` with `execFile()` or `spawn()`**

No user/config/model string may pass through a shell.

- [ ] **Step 2: Restrict destructive file operations**

Delete/move/copy operations must be constrained to known app-managed roots.

- [ ] **Step 3: Add image size limits**

Reject excessive base64/SVG input before `sharp`.

## Task 13: Secrets, Privacy, And Logging

**Files:**
- Modify: `src/main/managers/store.js`
- Modify: `src/plugins/logOutput.js`
- Modify: `src/views/Setting/AIConfigSettings.vue`
- Modify: `src/views/AIAssistant/OpenAIEngine.vue`
- Modify: `src/main/ai/Connector/FirecrawlEngineAdapter.js`
- Modify: `src/utils/Utils.js`
- Create: `src/main/security/secretStore.js`
- Create: `src/main/security/redactingLogger.js`

**Interfaces:**
- Consumes: API keys, chat history, selected text, transcripts, web search data.
- Produces: keychain-backed secret storage and redacted logs.

- [ ] **Step 1: Move API keys to OS keychain**

Use Electron `safeStorage` or platform keychain integration.

- [ ] **Step 2: Redact logs**

Never log API keys, Authorization headers, prompts, transcripts, or full provider responses by default.

- [ ] **Step 3: Make external data flows explicit**

Settings UI must show which providers receive text, audio, selected text, URL, or web content.

## Task 14: Packaging And Supply Chain

**Files:**
- Modify: `package.json`
- Modify: `vue.config.js`
- Add release/SBOM docs under `docs/security/`.

**Interfaces:**
- Consumes: hardened app from earlier tasks.
- Produces: signed, auditable release artifacts.

- [ ] **Step 1: Remove `@electron/remote` dependency**

The dependency must be absent after Task 5.

- [ ] **Step 2: Reassess `asar:false` and Windows admin install**

Prefer integrity-protected packaged resources and avoid `requireAdministrator` unless required.

- [ ] **Step 3: Add SCA/SBOM workflow**

Use dependency audit output as a release gate.

## Task 15: Final Security Verification

**Files:**
- Modify: `docs/security/security-migration-baseline.md`
- Create: `docs/security/security-release-checklist.md`

**Interfaces:**
- Consumes: all completed tasks.
- Produces: final go/no-go checklist for security release.

- [ ] **Step 1: Run static baseline guard**

Run: `npm run security:baseline`

Expected: PASS or only documented, time-boxed exceptions.

- [ ] **Step 2: Run smoke checklist**

Run every manual flow in `docs/security/security-migration-baseline.md` on supported platforms.

- [ ] **Step 3: Run package and dependency checks**

Run lint, test, build, SCA, and packaging checks in CI.

- [ ] **Step 4: Produce responsible-disclosure response notes**

Map each original audit finding to fixed, mitigated, accepted-risk, or deferred.
