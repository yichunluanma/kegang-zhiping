import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const unpacked = resolve(process.argv[2]), source = join(unpacked, '01-应用源码');
const port = 35000 + Math.floor(Math.random() * 15000), base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server.mjs'], { cwd: source, env: { ...process.env, PORT: String(port), AI_API_KEY: '', TEACHER_PASSWORD: 'offline-test-secret' }, stdio: ['ignore', 'pipe', 'pipe'] });
let diagnostics = ''; child.stderr.on('data', c => diagnostics += c);
try {
  let ready = false;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready, '离线包未启动：' + diagnostics);
  const { SAMPLE, demoBlueprint } = await import(pathToFileURL(join(source, 'lib/domain.mjs')));
  const logged = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'offline-test-secret' }) }); assert.equal(logged.status, 200);
  const cookie = logged.headers.get('set-cookie').split(';')[0];
  const generated = await fetch(base + '/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ outline: SAMPLE, blueprint: demoBlueprint(SAMPLE), seed: 1 }) });
  assert.equal(generated.status, 201); const paper = await generated.json(); assert.equal(paper.questions.length, 9); assert.equal(paper.blueprint.total, 100);
  for (const path of ['/', '/vendor/katex/katex.min.js', '/vendor/katex/fonts/KaTeX_Main-Regular.woff2']) assert.equal((await fetch(base + path)).status, 200);
  const result = { checkedAt: new Date().toISOString(), passed: true, networkInstall: false, scope: '解压ZIP、独立启动、登录、生成9题100分和公式资源可访问；无npm安装', node: process.version };
  if (process.argv[3]) await writeFile(resolve(process.argv[3]), JSON.stringify(result, null, 2));
  console.log('Offline ZIP smoke test passed: no dependency installation, 9 questions / 100 points.');
} finally { if (child.exitCode === null) { child.kill(); await new Promise(r => child.once('exit', r)); } }
