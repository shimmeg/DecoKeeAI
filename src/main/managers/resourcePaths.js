const path = require('path');

function withFileProtocol(filePath, fileAccessPath) {
    return (fileAccessPath ? '' : 'file://') + filePath;
}

function stripAppResourcePrefix(resourcePath) {
    return resourcePath.replace('@/', '');
}

function resolvePackagedAppRoot(defaultInstallPath, resourcesPath) {
    if (resourcesPath) {
        return path.join(resourcesPath, 'app');
    }

    return path.join(path.dirname(defaultInstallPath), '..', 'Resources', 'app');
}

function resolveDevResourceRoot(defaultInstallPath) {
    return path.join(defaultInstallPath, '/../../../../public/');
}

function resolveDevNodeModuleRoot(defaultInstallPath) {
    return path.join(defaultInstallPath, '/../../../../node_modules/');
}

function resolveAppResourcePath({
    resourcePath,
    defaultInstallPath,
    resourcesPath,
    isDev,
    fileAccessPath = false,
}) {
    if (!resourcePath.startsWith('@/')) {
        return resourcePath;
    }

    const newResPath = stripAppResourcePrefix(resourcePath);
    const resourceRoot = isDev
        ? resolveDevResourceRoot(defaultInstallPath)
        : resolvePackagedAppRoot(defaultInstallPath, resourcesPath);

    return withFileProtocol(path.join(resourceRoot, newResPath), fileAccessPath);
}

function resolveNodeModuleResourcePath({
    moduleResourcePath,
    defaultInstallPath,
    resourcesPath,
    isDev,
}) {
    if (!moduleResourcePath.startsWith('@')) {
        return moduleResourcePath;
    }

    const moduleRoot = isDev
        ? resolveDevNodeModuleRoot(defaultInstallPath)
        : path.join(resolvePackagedAppRoot(defaultInstallPath, resourcesPath), 'node_modules');

    return 'file://' + path.join(moduleRoot, moduleResourcePath);
}

module.exports = {
    resolveAppResourcePath,
    resolveNodeModuleResourcePath,
};
