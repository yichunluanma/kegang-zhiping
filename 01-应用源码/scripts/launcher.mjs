import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, openSync, closeSync, writeFileSync, unlinkSync, appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { openBrowser } from './browser-launch.mjs';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Please install Node.js 24 or newer.');
const data = resolve(source, 'data');
let portText = process.env.PORT;
if (!portText && existsSync(resolve(source, '.env'))) {
  for (const line of readFileSync(resolve(source, '.env'), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*PORT\s*=\s*(.*)\s*$/);
    if (match) { portText = match[1].trim().replace(/^(['"])(.*)\1$/, '$2'); break; }
  }
}
const port = Number(portText || 3210);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
let url = `http://127.0.0.1:${port}`;
const stateFile = resolve(data, 'launcher-state.json');
async function healthy() {
  try { const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1200) }); const result = await response.json(); return response.ok && result.ok && ['0.1.0', '0.2.0'].includes(result.version) ? result : null; }
  catch { return null; }
}
mkdirSync(data, { recursive: true });
if (process.argv.includes('--stop')) {
  if (!existsSync(stateFile)) { console.log('No service started by this launcher.'); process.exit(0); }
  const state = JSON.parse(readFileSync(stateFile, 'utf8').replace(/^\uFEFF/, ''));
  if (state.serverPath !== resolve(source, 'server.mjs') || !state.token) throw new Error('Service ownership could not be verified.');
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(state.url)) throw new Error('Invalid local service address.');
  url = state.url;
  const status = await healthy();
  if (status) {
    if (status.pid !== state.pid) throw new Error('Port belongs to another instance; stop cancelled.');
    const response = await fetch(`${url}/api/local-stop`, { method: 'POST', headers: { 'X-Launch-Token': state.token }, signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error('Service identity rejected the stop request.');
    for (let attempt = 0; attempt < 20 && await healthy(); attempt++) await delay(100);
    if (await healthy()) throw new Error('Service did not stop yet.');
  }
  unlinkSync(stateFile);
  console.log('Application stopped. Saved data was kept.');
} else if (await healthy()) {
  // Preserve ownership of an existing managed instance. Do not invent a PID for a manual service.
  console.log(`Application already running: ${url}`);
  console.log(`OPEN_URL=${url}`);
} else {
  const serverPath = resolve(source, 'server.mjs');
  const errorLog = resolve(data, 'server-error.log');
  const output = openSync(resolve(data, 'server.log'), 'w'), errors = openSync(errorLog, 'w');
  let child;
  const token = randomBytes(32).toString('hex');
  try { child = spawn(process.execPath, [serverPath], { cwd: source, env: { ...process.env, LOCAL_LAUNCH_TOKEN: token }, detached: true, windowsHide: true, stdio: ['ignore', output, errors] }); }
  finally { closeSync(output); closeSync(errors); }
  let failure; child.on('error', error => { failure = error; });
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (failure || child.exitCode !== null) break;
    if (await healthy()) { ready = true; break; }
    await delay(300);
  }
  if (!ready) {
    if (child.pid && child.exitCode === null) child.kill();
    throw new Error(`Startup failed. ${failure?.message || ''}\n${readFileSync(errorLog, 'utf8')}\nLog: ${errorLog}`);
  }
  writeFileSync(stateFile, JSON.stringify({ pid: child.pid, serverPath, token, url, startedAt: new Date().toISOString() }, null, 2));
  child.unref();
  console.log(`Application started: ${url}`);
  console.log(`OPEN_URL=${url}`);
}
if (!process.argv.includes('--stop') && !process.argv.includes('-NoBrowser') && !process.argv.includes('--no-browser')) {
  const browser = await openBrowser(url + '/');
  appendFileSync(resolve(data, 'browser-launch.log'), JSON.stringify({ at: new Date().toISOString(), url, ...browser }) + '\n');
  if (browser.opened) console.log(`Browser launch requested (${browser.method}): ${url}`);
  else {
    console.log(`\n服务已经启动，但无法自动打开浏览器。\n请把下面的网址复制到浏览器地址栏：\n${url}\n`);
    console.log(`诊断日志：${resolve(data, 'browser-launch.log')}`);
    process.exitCode = 2;
  }
}
