# Electron Runtime Upgrade Notes

Created: 2026-06-18
Branch: `codex/electron-runtime-spike`
Baseline commit: `593a3a2`

## Scope

This file records the runtime spike: target Electron line, current build/runtime blockers, dependency changes, native-module validation results, and smoke-check status. It does not change Electron security preferences.

The initial version of this note was docs-only. Later updates in this branch include dependency installation, native rebuild diagnostics, the `robotjs` isolation, Electron build smoke results, and packaged app launch/restart smoke. No dev server run has been performed.

## Target Electron Line

Recommended immediate spike target: Electron `42.4.1`.

Source state on 2026-06-18:

- Electron releases page lists `42.4.1` as the current stable release, released on 2026-06-16, with Chromium `148.0.7778.265` and Node.js `24.16.0`.
- Electron release schedule lists Electron `42.0.0` stable on 2026-05-05 and EOL on 2026-10-20.
- Electron release schedule lists Electron `43.0.0` stable on 2026-06-30.

Decision: start compatibility work on Electron 42 now because it is the latest stable line available today. Keep the process repeatable and expect a short retarget pass to Electron 43 before a production hardening release if Electron 43 is stable by then.

Official references:

- https://releases.electronjs.org/
- https://releases.electronjs.org/schedule
- https://www.electronjs.org/docs/latest/breaking-changes
- https://www.electronjs.org/blog/electron-42-0

## Runtime Baseline And Migration State

Baseline repository state:

- `package.json` devDependency pins `electron` to `23.0.0`.
- Electron release schedule marks Electron `23.0.0` stable on 2023-02-07, EOL on 2023-08-15, with Chromium M110 and Node.js `18.12.1`.
- The upstream repository had no package manager lockfile and `.gitignore` ignored `package-lock.json`.
- A baseline `package-lock.json` has now been generated with install scripts disabled and committed as an explicit migration artifact.
- Local inspection environment: Node.js `v26.3.0`, npm `11.16.0`.
- `npm run security:baseline` is intentionally red from the Phase 0 guard and must remain red until hardening tasks remove specific findings.

Current migration branch state:

- `package.json` pins `electron` to `42.4.1`.
- `package.json` uses `@electron/rebuild@^4.0.4` and no longer depends on deprecated `electron-rebuild`.
- `package.json` has direct `electron-builder@^26.15.3` so root scripts do not rely only on a transitive builder binary.
- `package.json` no longer depends on `robotjs`; the stale vendored package remains in `modules/robotjs` but is not in the install/rebuild graph.
- `src/main/native/keyboardAutomation.js` is a temporary disabled adapter for OS keyboard automation paths that previously required `robotjs`.

Build/runtime coupling to Electron 23 found at baseline:

- Root `install` script ran `npm rebuild --runtime=electron --target=23.0.0 --abi=113 --dist-url=https://electronjs.org/headers`.
- Root `rebuildmodule` script ran `node-gyp rebuild --target=23.0.0 --arch=x64 --dist-url=https://electronjs.org/headers --abi=113`.
- `modules/robotjs/package.json` had an `install` script pinned to Electron `23.0.0` and ABI `113`.
- `modules/active-win/package.json` had an `install` script pinned to Electron `23.0.0` and ABI `113`.
- `vue.config.js` sets `buildDependenciesFromSource: true`, `npmRebuild: false`, `asar: false`, and Windows `requestedExecutionLevel: 'requireAdministrator'`.

Hardcoded Electron 23/ABI 113 rebuild removal:

- Root `install` lifecycle script was removed so a future `npm ci` does not run an extra rebuild before `postinstall`.
- Root manual rebuild scripts now use `electron-rebuild` instead of direct `node-gyp` with fixed target/ABI values.
- `modules/robotjs` install script now runs `node-gyp rebuild` without fixed Electron target/ABI.
- `modules/active-win` install script now runs `node-pre-gyp install --fallback-to-build` without fixed Electron target/ABI.
- This does not prove Electron 42 compatibility. It only removes an incorrect old-runtime pin before the dependency bump.

Native and local packages that require explicit compatibility checks:

- `node-hid@2.1.2`
- `uiohook-napi@^1.5.4`
- `active-win` from `file:modules/active-win`, vendored package version `8.1.1`, native package using prebuild/native fallback paths
- `sharp@^0.33.4`
- `font-carrier` from `file:modules/font-carrier`, stale pure-JS-looking dependency tree with `xmldom@^0.1.27`
- `robotjs` is no longer an install-time package. The previous vendored `robotjs@0.6.0` addon is `nan`-based and fails against Electron 42 / Node 24 headers, so keyboard automation is disabled until a supported replacement is selected.

Electron build tooling requiring review:

- `vue-cli-plugin-electron-builder@^2.1.1`
- `@electron/rebuild@^4.0.4`
- direct `electron-builder@^26.15.3`
- `overrides.electron-builder` forces the `vue-cli-plugin-electron-builder@2.1.1` packaging flow to use `electron-builder@26.15.3` instead of its original nested `electron-builder@22.14.13`.
- `electron-builder install-app-deps` in `postinstall` and `postuninstall`

Electron dependency bump:

- npm registry lookup confirmed `electron` latest is `42.4.1`.
- `package.json` now pins `electron` to `42.4.1`.
- Legacy `electron-rebuild@^3.2.9` was replaced with `@electron/rebuild@^4.0.4`; the registry marks `electron-rebuild` as deprecated and points to `@electron/rebuild`.
- Direct `electron-builder@^26.15.3` was added so root package scripts use a current builder binary instead of relying only on the old builder dependency pulled by `vue-cli-plugin-electron-builder`.
- Stable `vue-cli-plugin-electron-builder` remains `^2.1.1`; npm still reports `2.1.1` as the latest stable tag. Its `3.0.0-alpha.4` line is alpha and still depends on `electron-builder@^22.2.0`, so it was not adopted in this spike.
- The first scoped override attempt for `vue-cli-plugin-electron-builder -> electron-builder` did not rewrite the lockfile; `npm ls` marked the old nested `electron-builder@22.14.13` as invalid. A top-level `"overrides": { "electron-builder": "^26.15.3" }` deduped the plugin flow to `electron-builder@26.15.3`.

## Lockfile Baseline

Generated command:

```bash
npm install --package-lock-only --ignore-scripts --registry=https://registry.npmjs.org/ --replace-registry-host=never
```

Result:

- `package-lock.json` lockfileVersion is `3`.
- Lockfile contains `2550` package entries after the Electron 42/build-tooling bump and `robotjs` isolation.
- All remote `resolved` URLs use `registry.npmjs.org`; local `registry.npmmirror.com` configuration was deliberately excluded from the committed lockfile.
- `node_modules` was not created.
- Install/lifecycle scripts were disabled for generation.
- npm still reported `91 vulnerabilities` from audit metadata after the bump: `7 low`, `48 moderate`, `32 high`, `4 critical`.
- npm reported `EBADENGINE` for `@achrinza/node-ipc@9.2.10` and `@achrinza/node-ipc@9.2.2` under the local Node.js `v26.3.0` runtime.

Packages marked with `hasInstallScript` in the lockfile:

- root package `.`
- `modules/active-win`
- `node_modules/babel-plugin-espower/node_modules/core-js`
- `node_modules/babel-runtime/node_modules/core-js`
- `node_modules/call-matcher/node_modules/core-js`
- `node_modules/core-js`
- `node_modules/electron-winstaller`
- `node_modules/empower-core/node_modules/core-js`
- `node_modules/espurify/node_modules/core-js`
- `node_modules/node-hid`
- `node_modules/sharp`
- `node_modules/uiohook-napi`
- `node_modules/fsevents`
- `node_modules/watchpack-chokidar2/node_modules/fsevents`
- `node_modules/yorkie`

`node_modules/electron` is no longer marked with `hasInstallScript` after the Electron 42 bump, which matches the Electron 42 npm package behavior change.
`modules/robotjs`, `node_modules/robotjs`, `node_modules/targetpractice`, and `node_modules/targetpractice/node_modules/electron` are no longer present in the lockfile.

Normal `npm ci` and `npm run rebuild` are now validated on macOS arm64 for the remaining Electron 42 native module graph. This does not validate disabled `robotjs` behavior; it confirms the runtime install/rebuild path no longer depends on `robotjs`.

## Native Module Validation Results

Environment:

- Platform: macOS `darwin-arm64`
- Local Node.js: `v26.3.0`
- npm: `11.16.0`
- Electron target: `42.4.1`

Full install result:

```bash
npm ci --registry=https://registry.npmjs.org/ --replace-registry-host=never
```

Result: failed before target native-module validation.

- Failing package: `node_modules/targetpractice/node_modules/electron`
- Command: `node install.js`
- Attempted artifact: `electron-v1.8.8-darwin-arm64.zip`
- Error: `GET https://npmmirror.com/mirrors/electron/1.8.8/electron-v1.8.8-darwin-arm64.zip returned 404`
- Root cause evidence: `modules/robotjs` has devDependency `targetpractice@0.0.7`; `targetpractice` depends on `electron@^1.7.11`; lockfile resolves that nested Electron to `1.8.8`, which has an install script and no usable `darwin-arm64` artifact in this environment.

Scripts-disabled install result:

```bash
npm ci --ignore-scripts --registry=https://registry.npmjs.org/ --replace-registry-host=never
```

Result: succeeded.

- Installed packages: `2575`
- Audit summary: `91 vulnerabilities` (`7 low`, `48 moderate`, `32 high`, `4 critical`)
- Lifecycle scripts were skipped, so this is not a normal install validation.

Electron binary check:

```bash
npm exec electron -- --version
```

Result: succeeded after downloading the Electron binary; output was `v42.4.1`.

Full native rebuild:

```bash
npm run rebuild
```

Result: failed.

- `electron-rebuild` discovered: `modules/active-win`, `node-hid`, `modules/robotjs`, `uiohook-napi`
- Failing module: `modules/robotjs`
- Failure class: C++ compile failure against Electron 42 / Node 24 headers
- Primary error pattern: `nan` calls V8 APIs that now require `ExternalPointerTypeTag`, for example `v8::External::Value(...)` and `v8::External::New(...)`
- Secondary compile errors appear after the `nan` failures while processing macOS Cocoa/Foundation headers.
- Runtime load result after failed rebuild: `require('robotjs')` fails with `Cannot find module './build/Release/robotjs.node'`.

Targeted rebuild results:

| Module | Result | Notes |
| --- | --- | --- |
| `node-hid@2.1.2` | Pass | `electron-rebuild -f -o node-hid` completed; `require('node-hid')` loaded. |
| `uiohook-napi@1.5.5` | Pass | `electron-rebuild -f -o uiohook-napi` completed; `require('uiohook-napi')` loaded. |
| `active-win@8.1.1` | Pass | `electron-rebuild -f -o active-win` completed; `require('active-win')` loaded. |
| `sharp@0.33.5` | Pass | Not selected by `electron-rebuild`; `require('sharp')` loaded and reported `sharp.versions`. |
| `robotjs@0.6.0` | Fail | Fails to compile via `nan`/V8 API incompatibility and does not load. |
| `font-carrier@0.3.1` | Not native | Still a supply-chain concern because it pulls stale XML/font tooling, including old `xmldom` in its local dependency graph. |

Native validation conclusion: Electron 42 runtime migration is blocked by `robotjs`. Full install is also blocked on macOS arm64 by `robotjs` devDependency `targetpractice` pulling nested `electron@1.8.8`.

RobotJS isolation:

- Root `robotjs` dependency was removed from `package.json` and `package-lock.json`.
- `targetpractice` disappeared from the lockfile because it was only pulled by the vendored `modules/robotjs` devDependency.
- Direct `require('robotjs')` imports were removed from `AIManager`, `DeviceControlManager`, and `menu`.
- `src/main/native/keyboardAutomation.js` now returns `false` for keyboard automation operations and logs that the `robotjs`-backed paths are disabled for this Electron 42 spike.
- AI output-to-key-input still writes the text to the Electron clipboard, but automatic paste is disabled.
- Device configured text/hotkey actions now report invalid action feedback when keyboard automation is unavailable.
- The selected-text AI helper menu is disabled while keyboard automation is unavailable.
- `scripts/security/check-electron-runtime-blockers.mjs` was added to guard against reintroducing `robotjs`, `targetpractice`, or direct product-source `robotjs` imports.

Post-isolation full install:

```bash
npm ci
```

Result: succeeded.

- Installed packages: `2529`
- `electron-builder install-app-deps` ran from `postinstall`.
- `@electron/rebuild` prepared `modules/active-win`, `node-hid`, and `uiohook-napi`.
- npm still reports local config warnings for `disturl`, `ELECTRON_MIRROR`, `ELECTRON_CUSTOM_DIR`, and `node_gyp`.
- npm still reports `EBADENGINE` warnings for `@achrinza/node-ipc` under local Node.js `v26.3.0`.

Post-isolation rebuild:

```bash
npm run rebuild
```

Result: succeeded.

- `electron-rebuild` discovered and rebuilt `modules/active-win`, `node-hid`, and `uiohook-napi`.
- `robotjs` was not discovered because it is no longer in the dependency graph.

Post-isolation native load smoke:

```bash
node -e "const mods=['node-hid','uiohook-napi','active-win','sharp']; for (const mod of mods) { const value=require(mod); console.log(mod + ': ok', typeof value); }"
```

Result: succeeded for all four modules.

Post-isolation runtime blocker guard:

```bash
npm run security:runtime-blockers
```

Result: succeeded.

Native validation conclusion after isolation: the Electron 42 macOS arm64 install/rebuild blocker is resolved for the remaining dependency graph. The remaining product blocker is functional: OS keyboard automation features that depended on `robotjs` are intentionally disabled until a supported replacement is implemented and tested.

## Smoke Checklist Status

Task 3.4 was partially attempted after the `robotjs` isolation.

- App Startup: partially passed. Before the builder override, `npm run buildapp:mac` compiled renderer/main bundles and reached packaging, but the old nested Electron Builder path failed on missing `/usr/bin/python` after signing/unsigned packaging. After adding the top-level `electron-builder` override, `npm run buildapp:mac` used `electron-builder@26.15.3`, signed `dist_electron/mac-arm64/DecoKeeAI.app`, skipped notarization, and completed zip/DMG packaging successfully. `open -a dist_electron/mac-arm64/DecoKeeAI.app` starts the packaged app; `pgrep` shows the main process plus helper/renderer processes; Accessibility reports one `DecoKeeAI` window; LaunchServices reports `DecoKeeAI` as a visible process. User visual check confirmed the main window is visible and Settings opens. User observed that menu icons are not visible globally, some menu labels remain in Chinese, and Settings could not be closed from the UI. Logs show a quit/restart cycle occurred and the packaged app reopened with a new PID. Logs also show startup update checking, `UpgradeInfoDialog show`, Home Assistant `Invalid URL: ws/api/websocket` without configured HA URL, and `GeneralAIManager` `mdls` errors for an empty recent-app path.
- Device And HID: native module load smoke passed for `node-hid`; physical DECOKEE Quake connection and key press flow were not run because hardware is required. Configured text/hotkey actions are known-disabled while `keyboardAutomation` has no supported backend.
- AI And STT/TTS: not run. Requires app startup plus provider configuration/API keys. AI output-to-key-input automatic paste is known-disabled while `keyboardAutomation` has no supported backend.
- Plugins: not run dynamically. Electron main/renderer bundle compilation passed, and `active-win`/`uiohook-napi` native load smoke passed.
- OTA: not run. Signed-update flow does not exist yet; covered by later OTA hardening task.
- Local Servers And Phone Companion: not run. Requires app startup and pairing flow.
- Privacy And Secrets: not run dynamically. Static baseline still shows known insecure storage/logging issues.

Static guard status:

- `node scripts/security/check-electron-security-baseline.mjs` still fails with `135 finding(s)`, as expected for this phase.

Smoke validation conclusion: the install/rebuild blocker and macOS packaging blocker are cleared for this host. Basic packaged app startup/restart smoke passes, with follow-up UI issues for globally missing menu icons, Chinese menu labels, and Settings close behavior. Task 3.4 is still not fully complete because hardware, AI/API, plugin, OTA, and local server smoke checks have not been run, and keyboard automation remains disabled until a supported `robotjs` replacement is chosen.

## Breaking Changes Relevant To This App

Electron 42:

- The `electron` npm package no longer downloads the Electron binary during `postinstall`; download happens on first run, and the documented alternative is `install-electron`. This affects local bootstrap, CI, packaging, and any assumption that `postinstall` fully prepares Electron.
- `ELECTRON_SKIP_BINARY_DOWNLOAD` is removed. Any local or CI workflow relying on it must be changed before the Electron bump.
- macOS notifications now use `UNNotification` and require the app to be code-signed before notifications appear on macOS. Check whether product flows rely on desktop notifications.
- Offscreen rendering default device scale factor changes to `1.0`. Check any offscreen capture, image conversion, preview, or rendering code for size/scaling regressions.
- The `quotas` object is removed from `Session.clearStorageData`. Search before bumping and adjust if used.

Electron 40:

- Renderer `clipboard` API access is deprecated. This app currently exposes powerful renderer-side capabilities through insecure Electron settings; clipboard access should move behind preload/contextBridge APIs during the hardening tasks.

Electron 39:

- macOS apps using audio capture through `desktopCapturer` require `NSAudioCaptureUsageDescription` on macOS 14.2 and later. Screen/window capture paths must be checked for audio capture usage.

Electron 38:

- Minimum supported macOS is 12. Product support policy must accept dropping macOS 11 and older before production release.
- Wayland-related behavior changed. Linux smoke testing must include the supported desktop environments if Linux distribution remains in scope.

Electron 33:

- Native modules now require C++20. This is a major blocker for `robotjs`, `active-win`, `node-hid`, `uiohook-napi`, and any transitive native addon.
- Minimum supported macOS is 11 for Electron 33 and later. Electron 38 raises this further to macOS 12.
- Custom protocol handling changed. Re-check `vue.config.js` `customFileProtocol: "./"` and any app protocol assumptions.

Electron 32:

- `File.path` was removed in favor of `webUtils.getPathForFile`. Search renderer upload/import flows before bumping.
- Some navigation-related APIs moved or were deprecated. Re-check navigation guards while implementing the secure BrowserWindow factory.

## Migration Risks

Highest-risk blockers:

- Native module rebuild failure on Electron 42/Node 24, especially `robotjs` and `active-win` because local vendored packages have hardcoded Electron 23 install scripts.
- No lockfile, which makes runtime migration and security hardening hard to reproduce.
- Old Electron build plugin/toolchain may not understand Electron 42 install behavior.
- Security baseline remains intentionally failing; runtime migration must not be mistaken for completed hardening.
- `asar: false` and installer admin elevation are not Electron-version blockers, but they widen the security review surface and should be revisited after the runtime bump is stable.

## Proposed Dependency Strategy

1. Create a lockfile-only baseline before changing versions:

   ```bash
   npm install --package-lock-only --ignore-scripts
   ```

   This needs network approval in restricted environments. `--ignore-scripts` is important because current scripts rebuild native modules against Electron 23.

2. Replace hardcoded Electron 23 rebuild scripts with version-derived or documented platform-specific rebuild commands. Do this before enabling install scripts for Electron 42.

3. Bump Electron and build tooling in a dedicated commit:

   - `electron`
   - `electron-builder` or the builder package transitively used by `vue-cli-plugin-electron-builder`
   - `electron-rebuild` or replacement rebuild workflow
   - any package required by Electron 42 lazy download behavior

4. Rebuild and validate native modules per platform:

   - macOS arm64
   - macOS x64 if supported
   - Windows x64
   - Windows ia32 only if still supported
   - Linux targets listed in `package.json`

5. Run the Phase 0 smoke checklist from `docs/security/security-migration-baseline.md` and record failures here before starting BrowserWindow/preload hardening.

## Commands Run For This Note

Local commands:

- `git checkout -b codex/electron-runtime-spike`
- `git status --short --branch`
- `sed -n '1,220p' package.json`
- `sed -n '1,220p' vue.config.js`
- `sed -n '1,220p' modules/robotjs/package.json`
- `sed -n '1,220p' modules/active-win/package.json`
- `sed -n '1,220p' modules/font-carrier/package.json`
- `rg --files -g 'package-lock.json' -g 'yarn.lock' -g 'pnpm-lock.yaml' -g 'npm-shrinkwrap.json'`
- `npm install --package-lock-only --ignore-scripts --registry=https://registry.npmjs.org/ --replace-registry-host=never`
- `npm ci --registry=https://registry.npmjs.org/ --replace-registry-host=never`
- `npm ci --ignore-scripts --registry=https://registry.npmjs.org/ --replace-registry-host=never`
- `npm exec electron -- --version`
- `npm run rebuild`
- `./node_modules/.bin/electron-rebuild -f -o node-hid`
- `./node_modules/.bin/electron-rebuild -f -o uiohook-napi`
- `./node_modules/.bin/electron-rebuild -f -o active-win`
- `rg -n "robotjs|moveMouse|keyTap|typeString|screen.capture|getPixelColor" src modules package.json`
- `node scripts/security/check-electron-runtime-blockers.mjs`
- `npm install --package-lock-only --ignore-scripts`
- `npm ci`
- `npm run rebuild`
- `npm run security:runtime-blockers`
- `node -e "const mods=['node-hid','uiohook-napi','active-win','sharp']; for (const mod of mods) { const value=require(mod); console.log(mod + ': ok', typeof value); }"`
- `npm exec electron -- --version`
- `npm run build`
- `npm run buildapp:mac`
- `env CSC_IDENTITY_AUTO_DISCOVERY=false npm run buildapp:mac`
- `find dist_electron -maxdepth 2 -type f -o -type d`
- `ls -la /usr/bin/python /usr/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3`
- `npm run buildapp:mac`
- `npm view vue-cli-plugin-electron-builder version versions --json`
- `npm view vue-cli-plugin-electron-builder@2.1.1 dependencies --json`
- `npm view vue-cli-plugin-electron-builder@3.0.0-alpha.4 dependencies --json`
- `npm view electron-builder version --json`
- `node -e "const lock=require('./package-lock.json'); const pkg=lock.packages['node_modules/vue-cli-plugin-electron-builder/node_modules/electron-builder']; if (!pkg) throw new Error('nested electron-builder missing'); console.log('nested electron-builder:', pkg.version); if (pkg.version !== '26.15.3') process.exit(1);"`
- `npm install --package-lock-only --ignore-scripts`
- `npm ls electron-builder vue-cli-plugin-electron-builder --depth=3`
- `npm ci`
- `npm run rebuild`
- `npm run security:runtime-blockers`
- `npm run buildapp:mac`
- `open -a /Users/anton/.codex/worktrees/3043/DecoKeeAI/dist_electron/mac-arm64/DecoKeeAI.app`
- `pgrep -fl DecoKeeAI`
- `find "$HOME/Library/Logs/decokee-ai" -maxdepth 3 -type f`
- `find "$HOME/Library/Application Support/decokee-ai" -maxdepth 2 -type f`
- `tail -n 160 "$HOME/Library/Logs/decokee-ai/main.log"`
- `tail -n 160 "$HOME/Library/Application Support/decokee-ai/logs/2026-6-18.log"`
- `osascript -e 'tell application "DecoKeeAI" to activate' ...`
- `lsappinfo visibleProcessList`
- `lsappinfo info -only name,pid,visible,frontASN DecoKeeAI`
- `node scripts/security/check-electron-security-baseline.mjs`

Official web references were checked for Electron release status and breaking changes. Dependency metadata was fetched from npm for lockfile generation and install/rebuild diagnostics. `npm run build` is not an Electron build smoke in this project and fails on existing browser-webpack Node core fallback errors. Before the builder override, `npm run buildapp:mac` compiled renderer/main bundles and failed in the old builder packaging path because `/usr/bin/python` is absent on this host. After the top-level `electron-builder` override, `npm run buildapp:mac` completed successfully with `electron-builder@26.15.3` and produced `dist_electron/mac-arm64/DecoKeeAI.app`, `dist_electron/DecoKeeAI-0.0.61-arm64-mac.zip`, and `dist_electron/DecoKeeAI-0.0.61-arm64.dmg`. Packaged app launch/restart smoke was performed on macOS with user visual confirmation. Hardware, AI/API, plugin, OTA, and phone companion flows were not performed.

## Next Actions

1. Choose the permanent keyboard automation strategy before shipping: replace `robotjs` with a supported backend, or keep the disabled adapter behind an explicit product flag with UI/feature handling.
2. Investigate globally missing menu icons, Chinese menu labels, and the Settings close behavior observed during packaged app smoke.
3. Decide whether to keep the top-level `electron-builder` override long-term or replace `vue-cli-plugin-electron-builder` with a maintained packaging path.
4. Run hardware/API dependent smoke: DECOKEE Quake HID, configured hotkey/text actions, AI/STT/TTS, plugin flows, local server/phone companion flows.
5. Only after the runtime opens cleanly and the temporary keyboard automation decision is accepted, continue to Task 4: secure BrowserWindow factory.
