# Electron Runtime Upgrade Notes

Created: 2026-06-18
Branch: `codex/electron-runtime-spike`
Baseline commit: `593a3a2`

## Scope

This is a notes-only runtime spike. It records the target Electron line, current build/runtime blockers, and the migration order. It does not change dependencies, build configuration, native modules, or security preferences.

No `npm install`, native rebuild, application build, or dev server was run for this note.

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

## Current Runtime Baseline

Current repository state:

- `package.json` devDependency pins `electron` to `23.0.0`.
- Electron release schedule marks Electron `23.0.0` stable on 2023-02-07, EOL on 2023-08-15, with Chromium M110 and Node.js `18.12.1`.
- The upstream repository had no package manager lockfile and `.gitignore` ignored `package-lock.json`.
- A baseline `package-lock.json` has now been generated with install scripts disabled and committed as an explicit migration artifact.
- Local inspection environment: Node.js `v26.3.0`, npm `11.16.0`.
- `npm run security:baseline` is intentionally red from the Phase 0 guard and must remain red until hardening tasks remove specific findings.

Build/runtime coupling to Electron 23:

- Root `install` script runs `npm rebuild --runtime=electron --target=23.0.0 --abi=113 --dist-url=https://electronjs.org/headers`.
- Root `rebuildmodule` script runs `node-gyp rebuild --target=23.0.0 --arch=x64 --dist-url=https://electronjs.org/headers --abi=113`.
- `modules/robotjs/package.json` has an `install` script pinned to Electron `23.0.0` and ABI `113`.
- `modules/active-win/package.json` has an `install` script pinned to Electron `23.0.0` and ABI `113`.
- `vue.config.js` sets `buildDependenciesFromSource: true`, `npmRebuild: false`, `asar: false`, and Windows `requestedExecutionLevel: 'requireAdministrator'`.

Native and local packages that require explicit compatibility checks:

- `node-hid@2.1.2`
- `robotjs` from `file:modules/robotjs`, vendored package version `0.6.0`, `nan`-based native addon
- `uiohook-napi@^1.5.4`
- `active-win` from `file:modules/active-win`, vendored package version `8.1.1`, native package using prebuild/native fallback paths
- `sharp@^0.33.4`
- `font-carrier` from `file:modules/font-carrier`, stale pure-JS-looking dependency tree with `xmldom@^0.1.27`

Electron build tooling requiring review:

- `vue-cli-plugin-electron-builder@^2.1.1`
- `electron-rebuild@^3.2.9`
- `electron-builder install-app-deps` in `postinstall` and `postuninstall`

## Lockfile Baseline

Generated command:

```bash
npm install --package-lock-only --ignore-scripts --registry=https://registry.npmjs.org/ --replace-registry-host=never
```

Result:

- `package-lock.json` lockfileVersion is `3`.
- Lockfile contains `2464` package entries.
- All remote `resolved` URLs use `registry.npmjs.org`; local `registry.npmmirror.com` configuration was deliberately excluded from the committed lockfile.
- `node_modules` was not created.
- Install/lifecycle scripts were disabled for generation.
- npm still reported `92 vulnerabilities` from audit metadata: `7 low`, `47 moderate`, `34 high`, `4 critical`.
- npm reported `EBADENGINE` for `@achrinza/node-ipc@9.2.10` and `@achrinza/node-ipc@9.2.2` under the local Node.js `v26.3.0` runtime.

Packages marked with `hasInstallScript` in the lockfile:

- root package `.`
- `modules/active-win`
- `modules/robotjs`
- `node_modules/electron`
- `node_modules/targetpractice/node_modules/electron`
- `node_modules/node-hid`
- `node_modules/sharp`
- `node_modules/uiohook-napi`
- `node_modules/lzma-native`
- `node_modules/fsevents`
- `node_modules/watchpack-chokidar2/node_modules/fsevents`
- `node_modules/yorkie`
- six legacy `core-js` install-script locations under Babel/test tooling

Do not run a normal `npm install` or `npm ci` yet. The next migration step must remove or neutralize hardcoded Electron 23/ABI 113 rebuild scripts before install scripts are allowed to run.

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

Read-only local commands:

- `git checkout -b codex/electron-runtime-spike`
- `git status --short --branch`
- `sed -n '1,220p' package.json`
- `sed -n '1,220p' vue.config.js`
- `sed -n '1,220p' modules/robotjs/package.json`
- `sed -n '1,220p' modules/active-win/package.json`
- `sed -n '1,220p' modules/font-carrier/package.json`
- `rg --files -g 'package-lock.json' -g 'yarn.lock' -g 'pnpm-lock.yaml' -g 'npm-shrinkwrap.json'`
- `npm install --package-lock-only --ignore-scripts --registry=https://registry.npmjs.org/ --replace-registry-host=never`

Official web references were checked for Electron release status and breaking changes. Dependency metadata was fetched from npm only for lockfile generation. No full package install, lifecycle-script execution, native rebuild, application build, application run, or network request from the application was performed.

## Next Actions

1. Remove or neutralize hardcoded Electron 23/ABI 113 rebuild scripts.
2. Create the first actual dependency bump commit for Electron 42 and build tooling.
3. Rebuild native modules and record exact failures by platform.
4. Only after the runtime opens cleanly, continue to Task 4: secure BrowserWindow factory.
