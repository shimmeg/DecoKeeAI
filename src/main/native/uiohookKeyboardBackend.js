const RESTORE_CLIPBOARD_DELAY_MS = 250;

const KEY_ALIASES = Object.freeze({
    alt: 'Alt',
    option: 'Alt',
    right_alt: 'AltRight',
    backspace: 'Backspace',
    capslock: 'CapsLock',
    command: 'Meta',
    cmd: 'Meta',
    meta: 'Meta',
    win: 'Meta',
    windows: 'Meta',
    control: 'Ctrl',
    ctrl: 'Ctrl',
    left_control: 'Ctrl',
    right_control: 'CtrlRight',
    delete: 'Delete',
    delte: 'Delete',
    down: 'ArrowDown',
    end: 'End',
    enter: 'Enter',
    escape: 'Escape',
    esc: 'Escape',
    home: 'Home',
    insert: 'Insert',
    left: 'ArrowLeft',
    pagedown: 'PageDown',
    pageup: 'PageUp',
    printscreen: 'PrintScreen',
    right: 'ArrowRight',
    scrolllock: 'ScrollLock',
    shift: 'Shift',
    left_shift: 'Shift',
    right_shift: 'ShiftRight',
    space: 'Space',
    tab: 'Tab',
    up: 'ArrowUp',
    numpad_lock: 'NumLock',
    numpad_0: 'Numpad0',
    numpad_1: 'Numpad1',
    numpad_2: 'Numpad2',
    numpad_3: 'Numpad3',
    numpad_4: 'Numpad4',
    numpad_5: 'Numpad5',
    numpad_6: 'Numpad6',
    numpad_7: 'Numpad7',
    numpad_8: 'Numpad8',
    numpad_9: 'Numpad9',
    'numpad_+': 'NumpadAdd',
    'numpad_-': 'NumpadSubtract',
    'numpad_*': 'NumpadMultiply',
    'numpad_/': 'NumpadDivide',
    'numpad_.': 'NumpadDecimal',
    ';': 'Semicolon',
    '=': 'Equal',
    ',': 'Comma',
    '-': 'Minus',
    '.': 'Period',
    '/': 'Slash',
    '`': 'Backquote',
    '·': 'Backquote',
    "'": 'Quote',
    '[': 'BracketLeft',
    '\\': 'Backslash',
    ']': 'BracketRight',
});

function normalizeKeyName(keyName) {
    if (keyName === undefined || keyName === null) return '';
    return String(keyName).trim().toLowerCase();
}

function resolveKeyCode(keyName, UiohookKey) {
    const normalizedKeyName = normalizeKeyName(keyName);
    if (!normalizedKeyName || !UiohookKey) return undefined;

    if (/^[a-z]$/.test(normalizedKeyName)) {
        return UiohookKey[normalizedKeyName.toUpperCase()];
    }

    if (/^[0-9]$/.test(normalizedKeyName)) {
        return UiohookKey[normalizedKeyName];
    }

    if (/^f([1-9]|1[0-9]|2[0-4])$/.test(normalizedKeyName)) {
        return UiohookKey[normalizedKeyName.toUpperCase()];
    }

    const keyAlias = KEY_ALIASES[normalizedKeyName];
    if (!keyAlias) return undefined;

    return UiohookKey[keyAlias];
}

function resolveModifierCodes(modifiers, UiohookKey) {
    if (!Array.isArray(modifiers)) return [];

    const modifierCodes = [];
    for (const modifier of modifiers) {
        const modifierCode = resolveKeyCode(modifier, UiohookKey);
        if (modifierCode === undefined) return undefined;
        modifierCodes.push(modifierCode);
    }

    return modifierCodes;
}

function getPlatformPasteModifier(platform) {
    return platform === 'darwin' ? 'command' : 'control';
}

function parseUriList(uriList) {
    return String(uriList)
        .split(/\r?\n/)
        .map(uri => uri.trim())
        .filter(uri => uri && !uri.startsWith('#'))
        .map(uri => {
            if (uri.startsWith('file://')) {
                return decodeURIComponent(uri.replace(/^file:\/\//, ''));
            }
            return uri;
        });
}

function createUiohookKeyboardBackend(options) {
    const {
        uIOhook,
        UiohookKey,
        clipboard,
        platform = process.platform,
        setTimeoutFn = setTimeout,
    } = options;

    function keyTap(keyName, delayGap, modifiers = []) {
        const keyCode = resolveKeyCode(keyName, UiohookKey);
        const modifierCodes = resolveModifierCodes(modifiers, UiohookKey);
        if (keyCode === undefined || modifierCodes === undefined) return false;

        try {
            uIOhook.keyTap(keyCode, modifierCodes);
            return true;
        } catch (err) {
            console.warn(`Keyboard automation keyTap failed for ${keyName}:`, err);
            return false;
        }
    }

    function pasteClipboard(modifier = getPlatformPasteModifier(platform)) {
        return keyTap('v', 0, [modifier]);
    }

    function copySelection(modifier = getPlatformPasteModifier(platform)) {
        return keyTap('c', 0, [modifier]);
    }

    function typeString(text) {
        const textToPaste = String(text || '');
        if (textToPaste.length === 0) return true;

        try {
            const previousText = clipboard.readText();
            clipboard.writeText(textToPaste);
            if (!pasteClipboard()) {
                clipboard.writeText(previousText);
                return false;
            }

            setTimeoutFn(() => {
                try {
                    clipboard.writeText(previousText);
                } catch (err) {
                    console.warn('Keyboard automation failed to restore clipboard text:', err);
                }
            }, RESTORE_CLIPBOARD_DELAY_MS);
            return true;
        } catch (err) {
            console.warn('Keyboard automation typeString failed:', err);
            return false;
        }
    }

    function getClipboardContent() {
        try {
            const availableFormats = typeof clipboard.availableFormats === 'function'
                ? clipboard.availableFormats()
                : [];

            if (availableFormats.includes('text/uri-list') && typeof clipboard.read === 'function') {
                const files = parseUriList(clipboard.read('text/uri-list'));
                if (files.length > 0) {
                    return JSON.stringify(files.map(file => ({
                        type: 'File',
                        content: file,
                    })));
                }
            }

            const text = clipboard.readText();
            if (!text) return '[]';

            return JSON.stringify([{
                type: 'Text',
                content: text,
            }]);
        } catch (err) {
            console.warn('Keyboard automation getClipboardContent failed:', err);
            return '[]';
        }
    }

    function getStatus() {
        return {
            id: 'keyboardAutomation.backend',
            state: 'enabled-uiohook-napi',
            enabled: true,
            owner: 'runtime-security-migration',
            backend: 'uiohook-napi',
            reason: 'OS keyboard automation is backed by uiohook-napi for the Electron 42 runtime.',
            replacementRequiredBefore: undefined,
            affectedFlows: [
                'Device text actions',
                'Device hotkey actions',
                'AI output paste-to-cursor',
                'Selected-text AI helper menu',
            ],
        };
    }

    return {
        copySelection,
        getClipboardContent,
        getStatus,
        isAvailable: () => true,
        keyTap,
        pasteClipboard,
        setKeyboardDelay: () => true,
        typeString,
    };
}

module.exports = {
    createUiohookKeyboardBackend,
    resolveKeyCode,
};
