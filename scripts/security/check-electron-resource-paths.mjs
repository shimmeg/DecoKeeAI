import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  resolveAppResourcePath,
  resolveNodeModuleResourcePath,
} = require('../../src/main/managers/resourcePaths');

const defaultInstallPath = '/Applications/DecoKeeAI.app/Contents/MacOS/DecoKeeAI';
const resourcesPath = '/Applications/DecoKeeAI.app/Contents/Resources';

const timerPath = resolveAppResourcePath({
  resourcePath: '@/icon/timer.png',
  defaultInstallPath,
  resourcesPath,
  isDev: false,
  fileAccessPath: true,
});

assert.equal(
  timerPath,
  '/Applications/DecoKeeAI.app/Contents/Resources/app/icon/timer.png',
  'packaged app resources must resolve under Contents/Resources/app'
);
assert.equal(
  timerPath.includes('/Contents/MacOS/resources/'),
  false,
  'packaged app resources must not resolve relative to the executable directory'
);

assert.equal(
  resolveAppResourcePath({
    resourcePath: '@/icon/timer.png',
    defaultInstallPath,
    resourcesPath,
    isDev: false,
  }),
  'file:///Applications/DecoKeeAI.app/Contents/Resources/app/icon/timer.png',
  'renderer resource paths should be file URLs by default'
);

assert.equal(
  resolveAppResourcePath({
    resourcePath: '/tmp/custom.png',
    defaultInstallPath,
    resourcesPath,
    isDev: false,
  }),
  '/tmp/custom.png',
  'non-app resources must pass through unchanged'
);

assert.equal(
  resolveNodeModuleResourcePath({
    moduleResourcePath: '@mdi/svg/svg/home.svg',
    defaultInstallPath,
    resourcesPath,
    isDev: false,
  }),
  'file:///Applications/DecoKeeAI.app/Contents/Resources/app/node_modules/@mdi/svg/svg/home.svg',
  'packaged node module resources must resolve under Contents/Resources/app/node_modules'
);

console.log('electron resource path checks passed');
