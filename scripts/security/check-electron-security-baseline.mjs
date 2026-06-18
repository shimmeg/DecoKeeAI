import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

const scanTargets = [
  'src',
  'public',
  'package.json',
  'vue.config.js',
];

const excludedPathParts = [
  `${path.sep}.git${path.sep}`,
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}public${path.sep}plugin${path.sep}VIA${path.sep}`,
];

const includedExtensions = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.vue',
  '.json',
  '.html',
]);

const checks = [
  {
    id: 'electron-node-integration',
    description: 'Renderer or webview enables nodeIntegration.',
    pattern: /nodeIntegration\s*:\s*true|nodeIntegration\s*=\s*yes/i,
  },
  {
    id: 'electron-context-isolation-disabled',
    description: 'Renderer disables contextIsolation.',
    pattern: /contextIsolation\s*:\s*false/i,
  },
  {
    id: 'electron-web-security-disabled',
    description: 'Renderer or webview disables webSecurity.',
    pattern: /webSecurity\s*:\s*false|webSecurity\s*=\s*no/i,
  },
  {
    id: 'electron-remote-enabled',
    description: 'Electron remote is enabled or imported.',
    pattern: /enableRemoteModule\s*:\s*true|@electron\/remote/i,
  },
  {
    id: 'untrusted-eval',
    description: 'Code uses eval(), which is forbidden for untrusted data.',
    pattern: /\beval\s*\(/,
  },
  {
    id: 'arbitrary-download-ipc',
    description: 'IPC download channel can become arbitrary URL/path sink.',
    pattern: /ipcMain\.on\(\s*['"]download['"]/,
  },
  {
    id: 'zip-extraction',
    description: 'ZIP extraction must go through signature and path-containment review.',
    pattern: /new\s+DecompressZip\b|\.extract\(\s*\{/,
  },
  {
    id: 'recursive-delete',
    description: 'Recursive delete must be constrained to known app-managed roots.',
    pattern: /shelljs\.rm\(\s*['"]-rf['"]/,
  },
  {
    id: 'shell-exec',
    description: 'Shell exec must be replaced with execFile/spawn or audited exceptions.',
    pattern: /\bexec\s*\(/,
  },
];

function shouldScanFile(filePath) {
  const absolutePath = path.resolve(rootDir, filePath);
  const normalized = `${absolutePath}${fs.statSync(absolutePath).isDirectory() ? path.sep : ''}`;
  if (excludedPathParts.some(part => normalized.includes(part))) return false;
  if (fs.statSync(absolutePath).isDirectory()) return true;
  return includedExtensions.has(path.extname(filePath));
}

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(rootDir, fullPath);

    if (!shouldScanFile(relativePath)) continue;

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function scanFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const findings = [];

  lines.forEach((line, index) => {
    for (const check of checks) {
      if (check.pattern.test(line)) {
        findings.push({
          check,
          filePath,
          lineNumber: index + 1,
          line: line.trim(),
        });
      }
    }

    if (
      line.includes('.listen(') &&
      !line.includes('127.0.0.1') &&
      !line.includes('localhost')
    ) {
      findings.push({
        check: {
          id: 'server-listen-without-explicit-localhost',
          description: 'Local server listen() does not specify localhost binding.',
        },
        filePath,
        lineNumber: index + 1,
        line: line.trim(),
      });
    }
  });

  return findings;
}

const findings = scanTargets.flatMap(target => {
  const fullPath = path.join(rootDir, target);
  if (!fs.existsSync(fullPath)) return [];
  if (!shouldScanFile(target)) return [];
  if (fs.statSync(fullPath).isDirectory()) return walk(fullPath).flatMap(scanFile);
  return scanFile(fullPath);
});

if (findings.length === 0) {
  console.log('Security baseline check passed: no high-risk patterns found.');
  process.exit(0);
}

console.error(`Security baseline check failed: ${findings.length} finding(s).`);

const byCheck = new Map();
for (const finding of findings) {
  const list = byCheck.get(finding.check.id) || [];
  list.push(finding);
  byCheck.set(finding.check.id, list);
}

for (const [checkId, checkFindings] of byCheck.entries()) {
  console.error(`\n[${checkId}] ${checkFindings[0].check.description}`);
  for (const finding of checkFindings) {
    const relativePath = path.relative(rootDir, finding.filePath);
    console.error(`  ${relativePath}:${finding.lineNumber} ${finding.line}`);
  }
}

process.exit(1);
