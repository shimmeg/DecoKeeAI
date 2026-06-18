/*
 * Build-time security profile for DecoKeeAI hardened ("read-only-like") builds.
 *
 * These are intentionally COMPILE-TIME constants (not runtime / electron-store
 * settings) so that untrusted input — AI model output, plugin code, or network
 * peers — cannot flip them at runtime. The default profile is "hardened":
 * every privileged capability is OFF.
 *
 * To produce the normal (upstream) build, set the relevant flags back to true.
 */

// Allow the AI assistant and device keys to execute arbitrary shell commands.
// Gates: AIManager EXECUTE_CMD (operate-PC) and the raw-command branch of
// AIManager._openApplication (system-app launch). The dedicated "cmd" key type
// is removed outright in the hardened build regardless of this flag.
export const ALLOW_SYSTEM_COMMANDS = false;

// Start the phone-companion WebSocket control channel (WSManager, port 20230).
// This is a device-control channel; in the hardened build it is not started.
export const ENABLE_PHONE_COMPANION = false;

// Load third-party plugins and their local servers (NativePluginLoader exec,
// PluginWSServer, and the plugin HTTP static server).
export const ENABLE_THIRD_PARTY_PLUGINS = false;
