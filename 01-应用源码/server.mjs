import http from 'node:http';
import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { makeBlueprint, makePaper, provider, hash } from './lib/ai.mjs';
import { SAMPLE, DEFAULT_INTENT, insist, validatePaper, grade, summarize, publicPaper } from './lib/domain.mjs';

const root = dirname(fileURLToPath(import.meta.url));
if (existsSync(resolve(root, '.env'))) for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
}
const port = Number(process.env.PORT || 3210);
const dataDir = resolve(process.env.DATA_DIR || resolve(root, 'data'));
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(resolve(dataDir, 'zhiping.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS papers (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS exams (id TEXT PRIMARY KEY, paper_id TEXT NOT NULL, snapshot TEXT NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, exam_id TEXT NOT NULL, payload TEXT NOT NULL, created TEXT NOT NULL);`);
const sessions = new Map(), limits = new Map();
const password = process.env.TEACHER_PASSWORD || 'teacher-demo-2026';
function limited(req, key, maximum, ms = 60000) {
  const id = `${req.socket.remoteAddress}:${key}`, now = Date.now();
  let bucket = limits.get(id);
  if (!bucket || now > bucket.until) { bucket = { count: 0, until: now + ms }; limits.set(id, bucket); }
  if (++bucket.count > maximum) { const e = new Error('请求过于频繁，请稍后再试'); e.status = 429; throw e; }
}
function teacher(req) {
  const token = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('teacher='))?.slice(8);
  return token && sessions.get(token) > Date.now();
}
function secureEquals(a, b) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
function authorized(req) { if (!teacher(req)) { const e = new Error('请先登录教师工作台'); e.status = 401; throw e; } }
function event(action, detail = {}) {
  appendFileSync(resolve(dataDir, 'events.log'), JSON.stringify({ at: new Date().toISOString(), action, ...detail }) + '\n');
}
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
async function body(req) {
  let content = '', size = 0;
  for await (const chunk of req) { size += chunk.length; insist(size < 200000, '请求内容超过200KB限制'); content += chunk; }
  try { return JSON.parse(content); } catch { throw new Error('请求内容必须是JSON'); }
}
function getPaper(id) {
  const row = db.prepare('SELECT * FROM papers WHERE id=?').get(id); insist(row, '测评草稿不存在'); return { id, ...JSON.parse(row.payload) };
}
function getExam(id) {
  const row = db.prepare('SELECT * FROM exams WHERE id=?').get(id); insist(row, '发布的测评不存在'); return { row, paper: JSON.parse(row.snapshot) };
}
function savePaper(paper, id = randomUUID()) {
  validatePaper(paper);
  db.prepare('INSERT INTO papers(id,payload,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated').run(id, JSON.stringify(paper), new Date().toISOString());
  return { ...paper, id };
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try {
    insist([`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host), '不允许的主机名');
    if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin) insist([`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin), '禁止跨站请求');
    const url = new URL(req.url, `http://127.0.0.1:${port}`), path = url.pathname, method = req.method;
    if (path === '/api/health') return json(res, 200, { ok: true, version: '0.1.0', pid: process.pid });
    if (path === '/api/local-stop' && method === 'POST') {
      const launchToken = process.env.LOCAL_LAUNCH_TOKEN, receivedToken = req.headers['x-launch-token'];
      if (!launchToken || typeof receivedToken !== 'string' || !secureEquals(launchToken, receivedToken)) return json(res, 401, { error: '启动器身份无效' });
      json(res, 200, { ok: true });
      setImmediate(() => server.close(() => { db.close(); process.exit(0); }));
      return;
    }
    if (path === '/api/config' && method === 'GET') return json(res, 200, { provider: provider(), loggedIn: Boolean(teacher(req)), sample: SAMPLE, intent: DEFAULT_INTENT, demoPassword: password === 'teacher-demo-2026' ? password : undefined });
    if (path === '/api/login' && method === 'POST') {
      limited(req, 'login', 8); const input = await body(req);
      if (!secureEquals(String(input.password || ''), password)) { const e = new Error('教师密码不正确'); e.status = 401; throw e; }
      const token = randomBytes(32).toString('hex'); sessions.set(token, Date.now() + 12 * 3600000);
      for (const [key, expiry] of sessions) if (expiry < Date.now()) sessions.delete(key);
      res.setHeader('Set-Cookie', `teacher=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`);
      return json(res, 200, { ok: true });
    }
    if (path === '/api/logout' && method === 'POST') {
      const token = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('teacher='))?.slice(8);
      if (token) sessions.delete(token);
      res.setHeader('Set-Cookie', 'teacher=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return json(res, 200, { ok: true });
    }
    const student = path.match(/^\/api\/exam\/([\w-]+)$/);
    if (student && method === 'GET') { const { paper } = getExam(student[1]); return json(res, 200, publicPaper(paper)); }
    const submit = path.match(/^\/api\/exam\/([\w-]+)\/submit$/);
    if (submit && method === 'POST') {
      limited(req, 'submit', 30); const input = await body(req), { paper } = getExam(submit[1]);
      insist(typeof input.name === 'string' && input.name.trim().length >= 1 && input.name.length <= 30, '请填写1–30字的昵称');
      insist(input.answers && typeof input.answers === 'object' && !Array.isArray(input.answers), '答案格式无效');
      insist(paper.questions.every(q => ['string', 'number'].includes(typeof input.answers[q.id]) && String(input.answers[q.id]).trim() && String(input.answers[q.id]).length <= 4000), '请完成所有题目后提交');
      const results = grade(paper, input.answers), id = randomUUID();
      const attempt = { id, name: input.name.trim(), results, summary: summarize(paper, results), createdAt: new Date().toISOString() };
      db.prepare('INSERT INTO attempts(id,exam_id,payload,created) VALUES(?,?,?,?)').run(id, submit[1], JSON.stringify(attempt), attempt.createdAt);
      event('submit', { examId: submit[1], attemptId: id });
      return json(res, 201, { id, score: attempt.summary.score, total: attempt.summary.total, pending: attempt.summary.pending, message: '提交成功。客观题已评分，简答题等待教师复核；复核结果由教师反馈。' });
    }
    if (path.startsWith('/api/')) authorized(req);
    if (path === '/api/blueprint' && method === 'POST') {
      limited(req, 'ai', 20); const input = await body(req);
      insist(typeof input.outline === 'string' && input.outline.length >= 20 && input.outline.length <= 20000 && typeof input.intent === 'string' && input.intent.length <= 2000, '大纲长度应为20–20000字，要求不超过2000字');
      const b = await makeBlueprint(input.outline, input.intent);
      event('blueprint', { provider: provider(), inputHash: hash(JSON.stringify(input)), outputHash: hash(JSON.stringify(b)) });
      return json(res, 200, b);
    }
    if (path === '/api/generate' && method === 'POST') {
      limited(req, 'ai', 20); const input = await body(req);
      insist(typeof input.outline === 'string' && input.outline.length <= 20000, '大纲无效');
      const paper = savePaper(await makePaper(input.blueprint, input.outline, Number(input.seed) || 1));
      event('generate', { provider: provider(), paperId: paper.id, inputHash: hash(JSON.stringify(input)), outputHash: hash(JSON.stringify(paper)) });
      return json(res, 201, paper);
    }
    if (path === '/api/papers' && method === 'GET') {
      const list = db.prepare('SELECT * FROM papers ORDER BY updated DESC LIMIT 100').all().map(r => { const p = JSON.parse(r.payload); return { id: r.id, title: p.blueprint.title, total: p.blueprint.total, count: p.questions.length, provider: p.provider, updated: r.updated }; });
      return json(res, 200, list);
    }
    const paperMatch = path.match(/^\/api\/papers\/([\w-]+)$/);
    if (paperMatch && method === 'GET') return json(res, 200, getPaper(paperMatch[1]));
    if (paperMatch && method === 'PUT') {
      getPaper(paperMatch[1]); const input = await body(req);
      // Keep original source and generation metadata; teacher may edit questions and blueprint.
      const previous = getPaper(paperMatch[1]); const paper = savePaper({ ...previous, blueprint: input.blueprint, questions: input.questions }, paperMatch[1]);
      event('edit', { paperId: paper.id }); return json(res, 200, paper);
    }
    const publish = path.match(/^\/api\/papers\/([\w-]+)\/publish$/);
    if (publish && method === 'POST') {
      const input = await body(req); insist(input.confirmed === true, '请确认已审核题目、答案和评分依据');
      const paper = getPaper(publish[1]), id = randomBytes(12).toString('hex'); validatePaper(paper);
      db.prepare('INSERT INTO exams(id,paper_id,snapshot,created) VALUES(?,?,?,?)').run(id, paper.id, JSON.stringify(paper), new Date().toISOString());
      event('publish', { paperId: paper.id, examId: id }); return json(res, 201, { id, url: `/exam/${id}` });
    }
    if (path === '/api/exams' && method === 'GET') {
      const rows = db.prepare('SELECT e.*, (SELECT count(*) FROM attempts a WHERE a.exam_id=e.id) AS count FROM exams e ORDER BY e.created DESC LIMIT 100').all();
      return json(res, 200, rows.map(r => ({ id: r.id, title: JSON.parse(r.snapshot).blueprint.title, created: r.created, count: r.count })));
    }
    const report = path.match(/^\/api\/exams\/([\w-]+)\/report$/);
    if (report && method === 'GET') {
      const { paper } = getExam(report[1]);
      const attempts = db.prepare('SELECT payload FROM attempts WHERE exam_id=? ORDER BY created DESC').all(report[1]).map(r => JSON.parse(r.payload));
      return json(res, 200, { paper, attempts });
    }
    const review = path.match(/^\/api\/attempts\/([\w-]+)\/review$/);
    if (review && method === 'POST') {
      const row = db.prepare('SELECT * FROM attempts WHERE id=?').get(review[1]); insist(row, '答卷不存在');
      const input = await body(req), attempt = JSON.parse(row.payload), { paper } = getExam(row.exam_id);
      insist(input.scores && typeof input.scores === 'object', '复核分值缺失');
      for (const r of attempt.results) if (paper.questions.find(q => q.id === r.id).type === 'short') {
        const q = paper.questions.find(q => q.id === r.id), score = input.scores[r.id];
        insist(typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= q.score, '复核分值超出范围');
        r.score = score; r.status = 'final'; r.feedback = '教师已复核';
      }
      attempt.summary = summarize(paper, attempt.results); attempt.reviewedAt = new Date().toISOString();
      db.prepare('UPDATE attempts SET payload=? WHERE id=?').run(JSON.stringify(attempt), review[1]);
      event('review', { attemptId: attempt.id }); return json(res, 200, attempt);
    }
    const practice = path.match(/^\/api\/exams\/([\w-]+)\/practice\/([\w-]+)$/);
    if (practice && method === 'POST') {
      const { paper } = getExam(practice[1]); const row = db.prepare('SELECT payload FROM attempts WHERE id=? AND exam_id=?').get(practice[2], practice[1]); insist(row, '答卷不存在');
      const attempt = JSON.parse(row.payload); insist(!attempt.summary.pending, '请先复核简答题，再生成补练建议');
      const weak = attempt.summary.objectives.filter(o => o.score / o.maximum < .7);
      const goals = weak.length ? weak : [attempt.summary.objectives.reduce((a, b) => a.score / a.maximum <= b.score / b.maximum ? a : b)];
      return json(res, 200, { name: attempt.name, note: '基于本次知识点得分的规则补练，不是经校准的能力诊断。请教师审核。', goals: goals.map(o => ({ name: o.name, source: o.source, achieved: `${o.score}/${o.maximum}`, advice: `先复习“${o.name}”的教学目标，再独立完成下列题目并解释理由。`, questions: paper.questions.filter(q => q.objectiveId === o.id).map(q => ({ stem: q.stem, formula: q.formula, explanation: q.explanation, answer: q.answer, options: q.options })) })) });
    }
    if (path.startsWith('/api/')) return json(res, 404, { error: '接口不存在' });
    if (!['GET', 'HEAD'].includes(method)) return json(res, 405, { error: '不支持的请求方式' });
    const publicDir = resolve(root, 'public'), file = path === '/' || path.startsWith('/exam/') ? resolve(publicDir, 'index.html') : resolve(publicDir, '.' + decodeURIComponent(path));
    insist(file.startsWith(publicDir + sep), '不允许访问该路径');
    const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
    const content = await readFile(file); res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(method === 'HEAD' ? '' : content);
  } catch (e) {
    const status = e.code === 'ENOENT' ? 404 : e.status || 400;
    json(res, status, { error: e.code === 'ENOENT' ? '页面不存在' : e.name === 'TimeoutError' ? '模型请求超时，请稍后重试' : e.message || '请求失败' });
  }
});
server.listen(port, '127.0.0.1', () => console.log(`课纲智评 v0.1.0 · ${provider() === 'demo' ? '模板演示' : '真实模型'} · http://127.0.0.1:${port}`));
process.on('SIGTERM', () => server.close(() => { db.close(); process.exit(); }));
