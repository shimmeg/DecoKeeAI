let activeWindowLookupDisabled = false;
let activeWindowLookupWarningShown = false;

function getErrorText(err) {
    const stderr = err && typeof err.stderr === 'string' ? err.stderr.trim() : '';
    if (stderr) return stderr;

    const message = err && typeof err.message === 'string' ? err.message.trim() : '';
    if (message) return message.split('\n')[0];

    return String(err);
}

function getActiveWindowFailureSummary(err) {
    const errorText = getErrorText(err);
    if (/accessibility permission/i.test(errorText)) {
        return 'macOS Accessibility permission is required for active-win.';
    }

    return errorText;
}

function isActiveWindowLookupDisabled() {
    return activeWindowLookupDisabled;
}

function handleActiveWindowLookupFailure(context, err) {
    activeWindowLookupDisabled = true;

    if (activeWindowLookupWarningShown) return;
    activeWindowLookupWarningShown = true;

    console.warn(`${context}: active-win lookup disabled for this session. ${getActiveWindowFailureSummary(err)}`);
}

export {
    isActiveWindowLookupDisabled,
    handleActiveWindowLookupFailure,
};
