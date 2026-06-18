/*
 * Safe process helpers for the hardened build.
 *
 * Every helper runs an executable via child_process.execFile WITHOUT a shell:
 * arguments are passed as an array, so dynamic values (application names,
 * paths, PIDs, filenames, bundle identifiers) can never be interpreted as
 * shell syntax. This replaces the previous `exec('cmd ' + var)` /
 * template-string usages that were vulnerable to command injection.
 */
import { execFile } from 'child_process';

// Callback signature mirrors child_process.exec: (error, stdout, stderr).
export function execFileCb(file, args, callback) {
    return execFile(file, args || [], { maxBuffer: 1024 * 1024 * 8 }, (error, stdout, stderr) => {
        if (callback) callback(error, stdout == null ? '' : stdout, stderr == null ? '' : stderr);
    });
}

// Run AppleScript with dynamic inputs passed as `argv` (reference them in the
// script via `item N of argv`) instead of string-interpolating them, which
// prevents both AppleScript and shell injection.
export function runAppleScriptCb(scriptBody, args, callback) {
    const argv = (args || []).map(a => String(a));
    return execFileCb('osascript', ['-e', scriptBody, ...argv], callback);
}

export function isValidPid(pid) {
    const n = Number(pid);
    return Number.isInteger(n) && n > 0;
}

// Kill a process by PID without a shell. Invalid PIDs are rejected (no-op).
export function killPidCb(pid, callback) {
    if (!isValidPid(pid)) {
        if (callback) callback(new Error('Invalid pid: ' + pid));
        return;
    }
    const p = String(Number(pid));
    if (process.platform === 'win32') {
        execFileCb('taskkill', ['/F', '/PID', p], callback);
    } else {
        execFileCb('kill', ['-9', p], callback);
    }
}

// Find the first PID whose process-listing line contains `name`. Mirrors the
// previous `tasklist | findstr name` / `ps aux | grep name` behaviour, but
// lists processes via execFile and filters in JS (no shell, no pipe).
export function findPidByNameCb(name, callback) {
    if (!name) {
        callback(null, undefined);
        return;
    }
    const onList = (error, stdout) => {
        if (error) {
            callback(error);
            return;
        }
        const line = String(stdout).split(/\r?\n/).find(l => l.includes(name));
        callback(null, line ? line.trim().split(/\s+/)[1] : undefined);
    };
    if (process.platform === 'win32') {
        execFileCb('tasklist', [], onList);
    } else {
        execFileCb('ps', ['aux'], onList);
    }
}
