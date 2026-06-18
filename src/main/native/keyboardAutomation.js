const disabledReason = 'robotjs is not compatible with Electron 42 / Node 24 and is disabled in this runtime spike.';
const warnedActions = new Set();

function warnDisabled(action) {
    if (warnedActions.has(action)) return;
    warnedActions.add(action);
    console.warn(`Keyboard automation disabled for ${action}: ${disabledReason}`);
}

function isAvailable() {
    return false;
}

function setKeyboardDelay() {
    warnDisabled('setKeyboardDelay');
    return false;
}

function keyTap() {
    warnDisabled('keyTap');
    return false;
}

function typeString() {
    warnDisabled('typeString');
    return false;
}

function copySelection() {
    warnDisabled('copySelection');
    return false;
}

function pasteClipboard() {
    warnDisabled('pasteClipboard');
    return false;
}

function getClipboardContent() {
    warnDisabled('getClipboardContent');
    return '[]';
}

export default {
    isAvailable,
    setKeyboardDelay,
    keyTap,
    typeString,
    copySelection,
    pasteClipboard,
    getClipboardContent,
};
