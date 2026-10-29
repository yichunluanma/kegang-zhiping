import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);

// Wait for Windows to process the URL before letting the launcher exit.
// Creating cmd.exe alone does not mean that its `start` command succeeded.
export async function openBrowser(url, {
  env = process.env, exists = existsSync, run = execute, start = spawn,
} = {}) {
  if (!/^http:\/\/127\.0\.0\.1:\d+\/$/.test(url)) throw new Error('Invalid local browser URL.');
  const errors = [];
  try {
    await run(env.ComSpec || 'cmd.exe', ['/d', '/c', `start "" "${url}"`], {
      windowsHide: true, windowsVerbatimArguments: true, timeout: 6000, maxBuffer: 8192,
    });
    return { opened: true, method: 'default', errors };
  } catch (error) { errors.push(`Default browser: ${error.stderr?.trim() || error.message}`); }

  const candidates = [
    ['Edge', env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe'],
    ['Edge', env.ProgramFiles, 'Microsoft/Edge/Application/msedge.exe'],
    ['Chrome', env.ProgramFiles, 'Google/Chrome/Application/chrome.exe'],
    ['Chrome', env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'],
  ];
  for (const [name, base, relative] of candidates) {
    if (!base) continue;
    const executable = join(base, relative);
    if (!exists(executable)) continue;
    try {
      await new Promise((resolve, reject) => {
        const child = start(executable, [url], { detached: true, windowsHide: false, stdio: 'ignore' });
        let timer, settled = false;
        const finish = error => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          child.unref();
          error ? reject(error) : resolve();
        };
        child.once('error', finish);
        child.once('exit', (code, signal) => finish(code === 0 ? undefined : new Error(`${name} exited: ${signal || code}`)));
        child.once('spawn', () => { timer = setTimeout(() => finish(), 500); });
      });
      return { opened: true, method: name, errors };
    } catch (error) { errors.push(`${name}: ${error.message}`); }
  }
  return { opened: false, method: 'manual', errors };
}
