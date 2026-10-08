import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const unpacked = resolve(process.argv[2]), source = join(unpacked, '01-应用源码');
const port = 35000 + Math.floor(Math.random() * 15000), base = `http://127.0.0.1:${port}`;
const launchEnv = { ...process.env, PORT: String(port), AI_API_KEY: '', TEACHER_PASSWORD: 'offline-test-secret' };
let diagnostics = '', stopped = false;
async function command(filename, args = '') {
  const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${join(unpacked, filename)}" ${args}"`], { cwd: join(unpacked, '08-交付包'), env: launchEnv, windowsHide: true, windowsVerbatimArguments: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', c => output += c); child.stderr.on('data', c => output += c);
  const code = await new Promise((resolveExit, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('CMD启动或停止超时')); }, 30000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); resolveExit(code); });
  });
  diagnostics += output;
  assert.equal(code, 0, output);
  return output;
}
try {
  await command('启动课纲智评.cmd', '--no-browser');
  let ready = false;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready, '离线包未启动：' + diagnostics);
  const { SAMPLE, demoBlueprint } = await import(pathToFileURL(join(source, 'lib/domain.mjs')));
  const logged = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'offline-test-secret' }) }); assert.equal(logged.status, 200);
  const cookie = logged.headers.get('set-cookie').split(';')[0];
  const generated = await fetch(base + '/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ outline: SAMPLE, blueprint: demoBlueprint(SAMPLE), seed: 1 }) });
  assert.equal(generated.status, 201); const paper = await generated.json(); assert.equal(paper.questions.length, 9); assert.equal(paper.blueprint.total, 100);
  for (const path of ['/', '/vendor/katex/katex.min.js', '/vendor/katex/fonts/KaTeX_Main-Regular.woff2']) assert.equal((await fetch(base + path)).status, 200);
  const firstPid = (await (await fetch(base + '/api/health')).json()).pid;
  await command('启动课纲智评.cmd', '--no-browser');
  assert.equal((await (await fetch(base + '/api/health')).json()).pid, firstPid, '重复启动不能创建新实例');
  await command('停止课纲智评.cmd'); stopped = true;
  await assert.rejects(fetch(base + '/api/health', { signal: AbortSignal.timeout(1500) }));
  const result = { checkedAt: new Date().toISOString(), passed: true, networkInstall: false, scope: '从含中文和空格的解压目录执行真实CMD入口，启动、重复启动、登录、生成9题100分、公式资源及停止通过；无需npm安装，无PowerShell入口', node: process.version };
  if (process.argv[3]) await writeFile(resolve(process.argv[3]), JSON.stringify(result, null, 2));
  console.log('Offline ZIP smoke test passed: no dependency installation, 9 questions / 100 points.');
} finally { if (!stopped) await command('停止课纲智评.cmd').catch(error => console.error(error.message)); }
