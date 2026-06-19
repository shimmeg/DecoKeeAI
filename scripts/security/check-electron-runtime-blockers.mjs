import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const failures = [];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function fail(message) {
  failures.push(message);
}

const packageJson = readJson('package.json');
const dependencyBlocks = ['dependencies', 'devDependencies', 'optionalDependencies'];

for (const blockName of dependencyBlocks) {
  const block = packageJson[blockName] || {};
  if (Object.prototype.hasOwnProperty.call(block, 'robotjs')) {
    fail(`package.json ${blockName} still includes robotjs`);
  }
  if (Object.prototype.hasOwnProperty.call(block, 'targetpractice')) {
    fail(`package.json ${blockName} still includes targetpractice`);
  }
}

const packageLock = readJson('package-lock.json');
const packages = packageLock.packages || {};

for (const packagePath of Object.keys(packages)) {
  if (
    packagePath === 'modules/robotjs' ||
    packagePath === 'node_modules/robotjs' ||
    packagePath === 'node_modules/targetpractice' ||
    packagePath.startsWith('node_modules/targetpractice/')
  ) {
    fail(`package-lock.json still resolves ${packagePath}`);
  }
}

for (const [packagePath, metadata] of Object.entries(packages)) {
  const blocks = [metadata.dependencies, metadata.devDependencies, metadata.optionalDependencies];
  if (blocks.some(block => block && Object.prototype.hasOwnProperty.call(block, 'targetpractice'))) {
    fail(`package-lock.json ${packagePath || '.'} still depends on targetpractice`);
  }
}

const sourceFiles = [
  'src/main/ai/AIManager.js',
  'src/main/DeviceControl/DeviceControlManager.js',
  'src/main/managers/menu.js',
];

for (const sourceFile of sourceFiles) {
  const content = fs.readFileSync(path.join(rootDir, sourceFile), 'utf8');
  if (/require\(['"]robotjs['"]\)|from ['"]robotjs['"]/.test(content)) {
    fail(`${sourceFile} still imports robotjs`);
  }
}

const activeWinMain = path.join(rootDir, 'modules/active-win/main');
const activeWinMainMode = fs.statSync(activeWinMain).mode;
if ((activeWinMainMode & 0o111) === 0) {
  fail('modules/active-win/main is not executable; packaged active-win spawn fails with EACCES');
}

const keyboardAutomationAdapterPath = 'src/main/native/keyboardAutomation.js';
const keyboardAutomationAdapter = fs.readFileSync(path.join(rootDir, keyboardAutomationAdapterPath), 'utf8');

if (!keyboardAutomationAdapter.includes('KEYBOARD_AUTOMATION_FEATURE_FLAG')) {
  fail(`${keyboardAutomationAdapterPath} must expose an explicit keyboard automation product flag`);
}

if (!keyboardAutomationAdapter.includes('enabled-uiohook-napi')) {
  fail(`${keyboardAutomationAdapterPath} must expose the uiohook-napi backend state`);
}

if (!keyboardAutomationAdapter.includes('disabled-known-limitation')) {
  fail(`${keyboardAutomationAdapterPath} must keep an explicit disabled fallback state`);
}

if (!/function\s+getStatus\s*\(/.test(keyboardAutomationAdapter)) {
  fail(`${keyboardAutomationAdapterPath} must expose getStatus() for product/UI handling`);
}

if (!keyboardAutomationAdapter.includes("require('uiohook-napi')")) {
  fail(`${keyboardAutomationAdapterPath} must load uiohook-napi as the active keyboard backend`);
}

const uiohookBackendPath = 'src/main/native/uiohookKeyboardBackend.js';
const uiohookBackend = fs.readFileSync(path.join(rootDir, uiohookBackendPath), 'utf8');

if (!uiohookBackend.includes('createUiohookKeyboardBackend')) {
  fail(`${uiohookBackendPath} must expose createUiohookKeyboardBackend()`);
}

const nativePluginLoaderPath = 'src/main/DeviceControl/Connections/NativePluginLoader.js';
const nativePluginLoader = fs.readFileSync(path.join(rootDir, nativePluginLoaderPath), 'utf8');

if (/\bexec\s*\(/.test(nativePluginLoader)) {
  fail(`${nativePluginLoaderPath} must launch native plugins with execFile/spawn args, not shell exec()`);
}

if (!nativePluginLoader.includes('spawn(') && !nativePluginLoader.includes('execFileCb')) {
  fail(`${nativePluginLoaderPath} must use spawn/execFile-style argument arrays for native plugin launch and shutdown`);
}

const generalAIManagerPath = 'src/main/ai/GeneralAIManager.js';
const generalAIManager = fs.readFileSync(path.join(rootDir, generalAIManagerPath), 'utf8');

if (/Get-Item\s+['"`]\$\{?appPath/.test(generalAIManager) || /CreateShortcut\(['"`]\$\{?fullPath/.test(generalAIManager)) {
  fail(`${generalAIManagerPath} must pass Windows paths to PowerShell as arguments, not interpolate them into -Command strings`);
}

if (!generalAIManager.includes('getPowerShellItemProductNameArgs') || !generalAIManager.includes('getPowerShellShortcutTargetArgs')) {
  fail(`${generalAIManagerPath} must build PowerShell commands through argument-safe helper functions`);
}

if (!generalAIManager.includes('filter(Boolean)') || !generalAIManager.includes('finishRecentAppLookup')) {
  fail(`${generalAIManagerPath} must filter empty macOS recent-app paths and finish per-file lookup errors without rejecting the whole smoke task`);
}

const haManagerPath = 'src/plugins/HomeAssistant/HAManager.js';
const haManager = fs.readFileSync(path.join(rootDir, haManagerPath), 'utf8');

if (!haManager.includes('_hasValidConfig') || !haManager.includes('Home Assistant is not configured')) {
  fail(`${haManagerPath} must skip Home Assistant connector startup until a non-empty valid hassUrl and token are configured`);
}

const deviceControlManagerPath = 'src/main/DeviceControl/DeviceControlManager.js';
const deviceControlManager = fs.readFileSync(path.join(rootDir, deviceControlManagerPath), 'utf8');

if (!deviceControlManager.includes('isValidActiveWindowInfo') || !deviceControlManager.includes('isValidOpenWindowInfo')) {
  fail(`${deviceControlManagerPath} must validate active-win results before reading owner.path or window id`);
}

const activeWindowLookupPath = 'src/main/native/activeWindowLookup.js';
const activeWindowLookupFullPath = path.join(rootDir, activeWindowLookupPath);
if (!fs.existsSync(activeWindowLookupFullPath)) {
  fail(`${activeWindowLookupPath} must centralize active-win permission failure handling`);
} else {
  const activeWindowLookup = fs.readFileSync(activeWindowLookupFullPath, 'utf8');
  if (!activeWindowLookup.includes('isActiveWindowLookupDisabled') || !activeWindowLookup.includes('handleActiveWindowLookupFailure')) {
    fail(`${activeWindowLookupPath} must expose active-win disabled state and one-time failure handling`);
  }
  if (!activeWindowLookup.includes('Accessibility permission')) {
    fail(`${activeWindowLookupPath} must classify macOS Accessibility permission failures explicitly`);
  }
}

if (!deviceControlManager.includes('isActiveWindowLookupDisabled') || !deviceControlManager.includes('handleActiveWindowLookupFailure')) {
  fail(`${deviceControlManagerPath} must disable repeated active-win polling after known permission failures`);
}

if (!deviceControlManager.includes('hasConfiguredAppMonitorProfiles')) {
  fail(`${deviceControlManagerPath} must skip active-win polling when no app-monitor profiles are configured`);
}

const menuManagerPath = 'src/main/managers/menu.js';
const menuManager = fs.readFileSync(path.join(rootDir, menuManagerPath), 'utf8');

if (!menuManager.includes('isValidActiveWindowInfo') || !menuManager.includes('!ownerInfo || !ownerInfo.path')) {
  fail(`${menuManagerPath} must validate active-win results before using owner.path in the AI helper menu`);
}

if (!menuManager.includes('isActiveWindowLookupDisabled') || !menuManager.includes('handleActiveWindowLookupFailure')) {
  fail(`${menuManagerPath} must avoid repeated active-win lookups after known permission failures`);
}

const aiAssistantWindowPath = 'src/main/windows/AIAssistantWindow.js';
const aiAssistantWindow = fs.readFileSync(path.join(rootDir, aiAssistantWindowPath), 'utf8');

if (/on\(['"]closed['"],\s*\(\)\s*=>\s*{[\s\S]*?getPosition\(\)[\s\S]*?}\)/.test(aiAssistantWindow)) {
  fail(`${aiAssistantWindowPath} must not read BrowserWindow position from the closed event after the window is destroyed`);
}

if (!aiAssistantWindow.includes('saveAssistantWindowPosition')) {
  fail(`${aiAssistantWindowPath} must save assistant window position before close/destroy`);
}

const upgradeNotesPath = 'docs/security/electron-upgrade-notes.md';
const upgradeNotes = fs.readFileSync(path.join(rootDir, upgradeNotesPath), 'utf8');

if (!upgradeNotes.includes('Keyboard automation uiohook-napi backend')) {
  fail(`${upgradeNotesPath} must document the keyboard automation uiohook-napi backend decision`);
}

if (failures.length > 0) {
  console.error(`Electron runtime blocker guard failed with ${failures.length} finding(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Electron runtime blocker guard passed.');
