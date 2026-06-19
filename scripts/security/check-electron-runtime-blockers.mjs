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
