const { clipboard } = require('electron');
const { createUiohookKeyboardBackend } = require('./uiohookKeyboardBackend');

const KEYBOARD_AUTOMATION_STATES = Object.freeze({
    ENABLED_UIOHOOK_NAPI: 'enabled-uiohook-napi',
    DISABLED_KNOWN_LIMITATION: 'disabled-known-limitation',
});

const AFFECTED_FLOWS = Object.freeze([
    'Device text actions',
    'Device hotkey actions',
    'AI output paste-to-cursor',
    'Selected-text AI helper menu',
]);

function createDisabledBackend(loadError) {
    const disabledStatus = Object.freeze({
        id: 'keyboardAutomation.backend',
        state: KEYBOARD_AUTOMATION_STATES.DISABLED_KNOWN_LIMITATION,
        enabled: false,
        owner: 'runtime-security-migration',
        backend: 'disabled',
        reason: 'OS keyboard automation is disabled because uiohook-napi could not be loaded.',
        loadError: loadError ? String(loadError.message || loadError) : undefined,
        replacementRequiredBefore: 'Re-enable text input, hotkey playback, paste-to-cursor, or selected-text AI helper features.',
        affectedFlows: AFFECTED_FLOWS,
    });
    const disabledReason = disabledStatus.loadError
        ? `${disabledStatus.reason} ${disabledStatus.loadError}`
        : disabledStatus.reason;
    const warnedActions = new Set();

    function warnDisabled(action) {
        if (warnedActions.has(action)) return;
        warnedActions.add(action);
        console.warn(`Keyboard automation disabled for ${action}: ${disabledReason}`);
    }

    return {
        getStatus() {
            return {
                ...disabledStatus,
                affectedFlows: [...disabledStatus.affectedFlows],
            };
        },
        isAvailable() {
            return false;
        },
        setKeyboardDelay() {
            warnDisabled('setKeyboardDelay');
            return false;
        },
        keyTap() {
            warnDisabled('keyTap');
            return false;
        },
        typeString() {
            warnDisabled('typeString');
            return false;
        },
        copySelection() {
            warnDisabled('copySelection');
            return false;
        },
        pasteClipboard() {
            warnDisabled('pasteClipboard');
            return false;
        },
        getClipboardContent() {
            warnDisabled('getClipboardContent');
            return '[]';
        },
    };
}

function createBackend() {
    try {
        const { uIOhook, UiohookKey } = require('uiohook-napi');
        return createUiohookKeyboardBackend({
            uIOhook,
            UiohookKey,
            clipboard,
        });
    } catch (err) {
        console.warn('Keyboard automation failed to load uiohook-napi backend:', err);
        return createDisabledBackend(err);
    }
}

const backend = createBackend();
const backendStatus = backend.getStatus();

export const KEYBOARD_AUTOMATION_FEATURE_FLAG = Object.freeze({
    id: backendStatus.id,
    state: backendStatus.state || KEYBOARD_AUTOMATION_STATES.ENABLED_UIOHOOK_NAPI,
    enabled: backendStatus.enabled,
    owner: backendStatus.owner || 'runtime-security-migration',
    backend: backendStatus.backend,
    reason: backendStatus.reason,
    loadError: backendStatus.loadError,
    replacementRequiredBefore: backendStatus.replacementRequiredBefore,
    affectedFlows: AFFECTED_FLOWS,
});

function isAvailable() {
    return backend.isAvailable();
}

function getStatus() {
    return {
        ...KEYBOARD_AUTOMATION_FEATURE_FLAG,
        affectedFlows: [...KEYBOARD_AUTOMATION_FEATURE_FLAG.affectedFlows],
    };
}

function setKeyboardDelay(...args) {
    return backend.setKeyboardDelay(...args);
}

function keyTap(...args) {
    return backend.keyTap(...args);
}

function typeString(...args) {
    return backend.typeString(...args);
}

function copySelection(...args) {
    return backend.copySelection(...args);
}

function pasteClipboard(...args) {
    return backend.pasteClipboard(...args);
}

function getClipboardContent(...args) {
    return backend.getClipboardContent(...args);
}

export default {
    KEYBOARD_AUTOMATION_FEATURE_FLAG,
    getStatus,
    isAvailable,
    setKeyboardDelay,
    keyTap,
    typeString,
    copySelection,
    pasteClipboard,
    getClipboardContent,
};
