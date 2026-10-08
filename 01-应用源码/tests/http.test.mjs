import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE, demoBlueprint } from '../lib/domain.mjs';

test('HTTP端到端：认证、生成、编辑、发布隔离、提交、复核和持久化', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'zhiping-test-'));
  const port = 34000 + Math.floor(Math.random() * 20000), base = `http://127.0.0.1:${port}`;
  const launch = () => spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], { env: { ...process.env, PORT: String(port), DATA_DIR: dir, AI_API_KEY: '', TEACHER_PASSWORD: 'http-test-secret' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let proc = launch(), cookie = '';
  async function ready() { for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); } throw new Error('测试服务未就绪'); }
  const request = async (path, data, method, auth = true) => {
    const res = await fetch(base + path, { method: method || (data ? 'POST' : 'GET'), headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(auth && cookie ? { Cookie: cookie } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
    return { res, data: await res.json() };
  };
  async function stop() { const current = proc; if (current.exitCode !== null) return; current.kill(); await new Promise(r => current.once('exit', r)); }
  try {
    await ready(); assert.equal((await request('/api/papers', undefined, undefined, false)).res.status, 401);
    const logged = await request('/api/login', { password: 'http-test-secret' }); assert.equal(logged.res.status, 200); cookie = logged.res.headers.get('set-cookie').split(';')[0];
    const b = (await request('/api/blueprint', { outline: SAMPLE, intent: '生成100分测评' })).data;
    const created = await request('/api/generate', { outline: SAMPLE, blueprint: b, seed: 1 }); assert.equal(created.res.status, 201); const p = created.data;
    const bad = structuredClone(p); bad.questions[0].formula = '\\unknowncommand'; assert.equal((await request('/api/papers/' + p.id, bad, 'PUT')).res.status, 400);
    assert.equal((await request('/api/papers/' + p.id + '/publish', { confirmed: false })).res.status, 400);
    const exam = (await request('/api/papers/' + p.id + '/publish', { confirmed: true })).data;
    const student = (await request('/api/exam/' + exam.id, undefined, undefined, false)).data;
    assert.equal(JSON.stringify(student).includes('"answer"'), false);
    const edited = structuredClone(p); edited.questions[0].stem = '教师编辑后题干'; assert.equal((await request('/api/papers/' + p.id, edited, 'PUT')).res.status, 200);
    assert.notEqual((await request('/api/exam/' + exam.id)).data.questions[0].stem, edited.questions[0].stem);
    assert.equal((await request('/api/exam/' + exam.id + '/submit', { name: '演示', answers: {} }, undefined, false)).res.status, 400);
    const answers = Object.fromEntries(p.questions.map(q => [q.id, q.type === 'short' ? '只看准确率可能掩盖类别不平衡，应关注召回率并调整阈值。' : String(q.answer)]));
    const submitted = await request('/api/exam/' + exam.id + '/submit', { name: '自动化测试昵称', answers }, undefined, false);
    assert.equal(submitted.res.status, 201); assert.equal(submitted.data.score, 80); assert.equal(submitted.data.pending, true);
    assert.equal((await request(`/api/exams/${exam.id}/report`, undefined, undefined, false)).res.status, 401);
    assert.equal((await request(`/api/attempts/${submitted.data.id}/review`, { scores: { Q9: 21 } })).res.status, 400);
    const reviewed = (await request(`/api/attempts/${submitted.data.id}/review`, { scores: { Q9: 18 } })).data;
    assert.equal(reviewed.summary.score, 98); assert.equal(reviewed.summary.pending, false);
    assert.equal((await request(`/api/exams/${exam.id}/practice/${submitted.data.id}`, {})).res.status, 200);
    await stop(); proc = launch(); cookie = ''; await ready();
    assert.equal((await request('/api/exam/' + exam.id)).res.status, 200);
    cookie = (await request('/api/login', { password: 'http-test-secret' })).res.headers.get('set-cookie').split(';')[0];
    const report = (await request(`/api/exams/${exam.id}/report`)).data; assert.equal(report.attempts[0].summary.score, 98);
    assert.equal((await request('/api/config')).data.AI_API_KEY, undefined);
  } finally { await stop(); await rm(dir, { recursive: true, force: true }); }
});
