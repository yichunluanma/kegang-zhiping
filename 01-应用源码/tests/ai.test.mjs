import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { makeBlueprint, makePaper, provider } from '../lib/ai.mjs';
import { SAMPLE, demoBlueprint, demoQuestions } from '../lib/domain.mjs';
test('兼容模型接口的契约、校验与失败处理（本地模拟，未调用真实供应商）', async () => {
  const backup = Object.fromEntries(['AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL'].map(k => [k, process.env[k]]));
  let response = { choices: [{ message: { content: JSON.stringify(demoBlueprint(SAMPLE)) } }] }, status = 200, received;
  const mock = http.createServer(async (req, res) => { let text = ''; for await (const c of req) text += c; received = JSON.parse(text); assert.equal(req.url, '/v1/chat/completions'); res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(response)); });
  await new Promise(r => mock.listen(0, '127.0.0.1', r));
  process.env.AI_API_KEY = 'fixture-only-not-a-real-key'; process.env.AI_BASE_URL = `http://127.0.0.1:${mock.address().port}/v1`; process.env.AI_MODEL = 'mock-model';
  try {
    assert.equal(provider(), 'model'); const b = await makeBlueprint(SAMPLE, '生成100分测评'); assert.equal(b.total, 100);
    assert.equal(received.model, 'mock-model'); assert.equal(received.response_format.type, 'json_object'); assert.equal(received.messages.length, 2);
    response.choices[0].message.content = JSON.stringify({ questions: demoQuestions(b, 1) }); assert.equal((await makePaper(b, SAMPLE)).provider, 'model');
    response.choices[0].message.content = '这不是JSON'; await assert.rejects(makeBlueprint(SAMPLE, ''), /JSON/);
    response.choices[0].message.content = JSON.stringify({ ...b, total: 99 }); await assert.rejects(makeBlueprint(SAMPLE, ''), /不一致/);
    status = 503; await assert.rejects(makeBlueprint(SAMPLE, ''), /503/); assert.equal(provider(), 'model');
    process.env.AI_MODEL = ''; await assert.rejects(makeBlueprint(SAMPLE, ''), /AI_MODEL/);
  } finally { for (const [k, value] of Object.entries(backup)) { if (value === undefined) delete process.env[k]; else process.env[k] = value; } await new Promise(r => mock.close(r)); }
});
