const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

export default class NativePluginLoader {
    constructor(appManager, pluginInfo) {
        let execEndFix = '';
        let platform = 'windows';
        if (process.platform === 'win32') {
            execEndFix = '.exe';
        } else {
            platform = 'mac';
        }
        this.executableFileName = pluginInfo.manifestInfo.CodePath;
        if (!this.executableFileName.endsWith(execEndFix)) {
            this.executableFileName += execEndFix;
        }
        this.pluginProcess = undefined;
        let pluginExecutePath = path.join(pluginInfo.pluginPath, this.executableFileName);
        if (!fs.existsSync(pluginExecutePath)) {
            console.log(
                'NativePluginLoader: constructor: Plugin: ',
                pluginInfo.pluginName,
                ' Not able to find executable file: ',
                pluginExecutePath
            );
            return;
        }

        this.inInfoParam = {
            application: {
                font: 'sans-serif',
                language: 'zh_CN',
                platform: platform,
                platformVersion: '11.4.0',
                version: '5.0.0.14247',
            },
            plugin: {
                uuid: pluginInfo.pluginId,
                Version: pluginInfo.pluginVersion,
            },
            devicePixelRatio: 2,
            colors: {
                buttonPressedBackgroundColor: '#303030FF',
                buttonPressedBorderColor: '#646464FF',
                buttonPressedTextColor: '#969696FF',
                disabledColor: '#F7821B59',
                highlightColor: '#F7821BFF',
                mouseDownColor: '#CF6304FF',
            },
            devices: [
                {
                    id: '55F16B35884A859CCE4FFA1FC8D3DE5B',
                    name: 'Device Name',
                    size: {
                        columns: 5,
                        rows: 3,
                    },
                    type: 0,
                },
            ],
        };

        setTimeout(() => {
            this._launchPlugin(appManager, pluginExecutePath, pluginInfo);
        }, 1000);
    }

    _launchPlugin(appManager, pluginExecutePath, pluginInfo) {
        const pluginWSServerPort = appManager.storeManager.storeGet('serverPorts.pluginWSServerPort');

        if (!pluginWSServerPort) {
            setTimeout(() => {
                this._launchPlugin(appManager, pluginExecutePath, pluginInfo);
            }, 1000);
            return;
        }

        const pluginArgs = [
            '-port',
            String(pluginWSServerPort),
            '-pluginUUID',
            String(pluginInfo.pluginId),
            '-registerEvent',
            'registerPluginHandler',
            '-info',
            JSON.stringify(this.inInfoParam),
        ];

        console.log(
            'NativePluginLoader: constructor: Plugin: ',
            pluginInfo.pluginName,
            ' Start on executable file: ',
            pluginExecutePath,
            ' args: ',
            pluginArgs
        );

        const pluginProcess = spawn(pluginExecutePath, pluginArgs, {
            cwd: pluginInfo.pluginPath,
            shell: false,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        this.pluginProcess = pluginProcess;

        pluginProcess.stdout.on('data', data => {
            console.log('NativePluginLoader: stdout: ', String(data));
        });
        pluginProcess.stderr.on('data', data => {
            console.error('NativePluginLoader: stderr: ', String(data));
        });
        pluginProcess.on('error', err => {
            console.error('NativePluginLoader: start: spawn error: ', err);
        });
        pluginProcess.on('exit', (code, signal) => {
            console.log('NativePluginLoader: process exited: code: ', code, ' signal: ', signal);
            if (this.pluginProcess === pluginProcess) {
                this.pluginProcess = undefined;
            }
        });
    }

    destroy() {
        if (!this.pluginProcess || !this.pluginProcess.pid) {
            console.log('NativePluginLoader: destroy: no running process.');
            return;
        }

        const pid = String(this.pluginProcess.pid);
        if (process.platform === 'win32') {
            const killer = spawn('taskkill', ['/F', '/PID', pid], {
                shell: false,
                windowsHide: true,
                stdio: 'ignore',
            });
            killer.on('error', err => {
                console.error('NativePluginLoader: destroy: taskkill error: ', err);
            });
        } else {
            this.pluginProcess.kill('SIGTERM');
        }
        this.pluginProcess = undefined;
    }
}
