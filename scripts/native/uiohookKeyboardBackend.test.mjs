import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  createUiohookKeyboardBackend,
  resolveKeyCode,
} = require('../../src/main/native/uiohookKeyboardBackend.js');

const UiohookKey = {
  A: 30,
  C: 46,
  Enter: 28,
  L: 38,
  Meta: 3675,
  Ctrl: 29,
  Shift: 42,
  V: 47,
};

function createFakeClipboard(initialText = '') {
  const writes = [];
  let text = initialText;
  const dataByFormat = new Map();

  return {
    writes,
    dataByFormat,
    availableFormats() {
      return Array.from(dataByFormat.keys()).concat(text ? ['text/plain'] : []);
    },
    read(format) {
      return dataByFormat.get(format) || '';
    },
    readText() {
      return text;
    },
    writeText(value) {
      writes.push(value);
      text = value;
    },
  };
}

function createFakeUiohook() {
  const taps = [];

  return {
    taps,
    keyTap(key, modifiers = []) {
      taps.push({ key, modifiers });
    },
  };
}

test('maps app key names to uiohook key codes', () => {
  assert.equal(resolveKeyCode('enter', UiohookKey), UiohookKey.Enter);
  assert.equal(resolveKeyCode('a', UiohookKey), UiohookKey.A);
  assert.equal(resolveKeyCode('command', UiohookKey), UiohookKey.Meta);
  assert.equal(resolveKeyCode('control', UiohookKey), UiohookKey.Ctrl);
  assert.equal(resolveKeyCode('unknown-key', UiohookKey), undefined);
});

test('sends key taps with mapped modifiers', () => {
  const uIOhook = createFakeUiohook();
  const backend = createUiohookKeyboardBackend({
    uIOhook,
    UiohookKey,
    clipboard: createFakeClipboard(),
    platform: 'darwin',
  });

  assert.equal(backend.keyTap('l', 5, ['command', 'shift']), true);
  assert.deepEqual(uIOhook.taps, [
    { key: UiohookKey.L, modifiers: [UiohookKey.Meta, UiohookKey.Shift] },
  ]);
});

test('rejects unmapped key taps without emitting input', () => {
  const uIOhook = createFakeUiohook();
  const backend = createUiohookKeyboardBackend({
    uIOhook,
    UiohookKey,
    clipboard: createFakeClipboard(),
    platform: 'darwin',
  });

  assert.equal(backend.keyTap('unknown-key'), false);
  assert.deepEqual(uIOhook.taps, []);
});

test('copySelection and pasteClipboard use platform shortcuts', () => {
  const uIOhook = createFakeUiohook();
  const backend = createUiohookKeyboardBackend({
    uIOhook,
    UiohookKey,
    clipboard: createFakeClipboard(),
    platform: 'darwin',
  });

  assert.equal(backend.copySelection('command'), true);
  assert.equal(backend.pasteClipboard(), true);
  assert.deepEqual(uIOhook.taps, [
    { key: UiohookKey.C, modifiers: [UiohookKey.Meta] },
    { key: UiohookKey.V, modifiers: [UiohookKey.Meta] },
  ]);
});

test('typeString writes text, pastes it, then restores the previous clipboard text', () => {
  const uIOhook = createFakeUiohook();
  const clipboard = createFakeClipboard('previous');
  const timers = [];
  const backend = createUiohookKeyboardBackend({
    uIOhook,
    UiohookKey,
    clipboard,
    platform: 'darwin',
    setTimeoutFn: (callback, delayMs) => {
      timers.push({ callback, delayMs });
    },
  });

  assert.equal(backend.typeString('Hello'), true);
  assert.deepEqual(clipboard.writes, ['Hello']);
  assert.deepEqual(uIOhook.taps, [
    { key: UiohookKey.V, modifiers: [UiohookKey.Meta] },
  ]);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delayMs, 250);

  timers[0].callback();

  assert.deepEqual(clipboard.writes, ['Hello', 'previous']);
});

test('getClipboardContent returns robotjs-compatible text payload JSON', () => {
  const backend = createUiohookKeyboardBackend({
    uIOhook: createFakeUiohook(),
    UiohookKey,
    clipboard: createFakeClipboard('selected text'),
    platform: 'darwin',
  });

  assert.equal(
    backend.getClipboardContent(),
    JSON.stringify([{ type: 'Text', content: 'selected text' }])
  );
});

test('getClipboardContent returns robotjs-compatible file payload JSON for uri lists', () => {
  const clipboard = createFakeClipboard('');
  clipboard.dataByFormat.set(
    'text/uri-list',
    'file:///Users/anton/Documents/a.txt\nfile:///Users/anton/Documents/b.txt\n'
  );
  const backend = createUiohookKeyboardBackend({
    uIOhook: createFakeUiohook(),
    UiohookKey,
    clipboard,
    platform: 'darwin',
  });

  assert.equal(
    backend.getClipboardContent(),
    JSON.stringify([
      { type: 'File', content: '/Users/anton/Documents/a.txt' },
      { type: 'File', content: '/Users/anton/Documents/b.txt' },
    ])
  );
});
