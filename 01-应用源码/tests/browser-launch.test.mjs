import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { openBrowser } from '../scripts/browser-launch.mjs';

test('浏览器启动器：等待默认打开命令完成，不能只创建进程就返回成功', async () => {
  let complete;
  const running = openBrowser('http://127.0.0.1:3210/', {
    run: () => new Promise(resolve => { complete = resolve; }),
    exists: () => { throw new Error('不应尝试备用浏览器'); },
  });
  let returned = false;
  running.then(() => { returned = true; });
  await Promise.resolve();
  assert.equal(returned, false);
  complete({});
  assert.equal((await running).method, 'default');
});

test('浏览器启动器：默认命令失败时尝试存在的备用浏览器', async () => {
  const launches = [];
  const result = await openBrowser('http://127.0.0.1:3210/', {
    env: { ProgramFiles: 'C:/Program Files' }, exists: () => true,
    run: async () => { throw new Error('Windows URL association failed'); },
    start: (file, args) => {
      launches.push({ file, args });
      const child = new EventEmitter(); child.unref = () => {};
      queueMicrotask(() => { child.emit('spawn'); child.emit('exit', 0); });
      return child;
    },
  });
  assert.equal(result.opened, true);
  assert.equal(result.method, 'Edge');
  assert.deepEqual(launches[0].args, ['http://127.0.0.1:3210/']);
  assert.match(result.errors[0], /association failed/);
});

test('浏览器启动器：默认与备用均失败时返回手动打开状态', async () => {
  const result = await openBrowser('http://127.0.0.1:3210/', {
    env: { ProgramFiles: 'C:/Program Files' }, exists: () => true,
    run: async () => { throw new Error('default failed'); },
    start: () => {
      const child = new EventEmitter(); child.unref = () => {};
      queueMicrotask(() => child.emit('error', new Error('browser unavailable')));
      return child;
    },
  });
  assert.equal(result.opened, false);
  assert.equal(result.method, 'manual');
  assert.ok(result.errors.some(x => x.includes('browser unavailable')));
});

test('浏览器启动器：备用进程被信号终止不能视为成功', async () => {
  const result = await openBrowser('http://127.0.0.1:3210/', {
    env: { ProgramFiles: 'C:/Program Files' }, exists: () => true,
    run: async () => { throw new Error('default failed'); },
    start: () => {
      const child = new EventEmitter(); child.unref = () => {};
      queueMicrotask(() => { child.emit('spawn'); child.emit('exit', null, 'SIGTERM'); });
      return child;
    },
  });
  assert.equal(result.opened, false);
  assert.ok(result.errors.some(x => x.includes('SIGTERM')));
});
