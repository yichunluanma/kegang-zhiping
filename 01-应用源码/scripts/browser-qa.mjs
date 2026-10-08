// Optional browser QA. Set PLAYWRIGHT_MODULE to a Playwright entry file if not locally installed.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = fileURLToPath(new URL('../../05-测试与验证/', import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.QA_BROWSER_CHANNEL || 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1 });
const page = await context.newPage(), errors = [], evidence = [];
page.on('pageerror', e => errors.push(e.message));
const shot = async (name) => { await page.screenshot({ path: resolve(out, name), fullPage: true }); evidence.push(name); };
const base = 'http://127.0.0.1:3210';
try {
  await page.goto(base); await page.locator('#generate-blueprint').waitFor();
  await shot('01-教师工作台.png');
  await page.locator('#auth').click(); await page.locator('#login-form button[type=submit]').click(); await page.locator('#modal').waitFor({ state: 'hidden' });
  await page.locator('#generate-blueprint').click(); await page.locator('#generate-paper').waitFor(); await shot('02-考核蓝图.png');
  await page.locator('[data-plan="0"] [data-key="score"]').fill('11'); await page.locator('[data-plan="0"] [data-key="score"]').blur();
  await page.locator('#generate-paper').click(); await page.getByText('题型计划合计102分，与总分100不一致', { exact: true }).waitFor();
  await page.locator('[data-plan="0"] [data-key="score"]').fill('10'); await page.locator('[data-plan="0"] [data-key="score"]').blur();
  await page.locator('#generate-paper').click(); await page.locator('#publish').waitFor();
  assert.equal(await page.locator('.katex').count(), 2); assert.equal(await page.locator('.katex-error').count(), 0);
  await page.locator('[data-edit="0"]').click(); await page.locator('#edit-formula').fill('\\notARealCommand'); await page.locator('#edit-form button[type=submit]').click();
  assert.ok((await page.locator('#edit-error').textContent()).length > 0);
  await page.locator('#edit-formula').fill(''); await page.locator('#edit-form button[type=submit]').click(); await page.locator('#modal').waitFor({ state: 'hidden' });
  await shot('03-试卷与公式.png');
  await page.locator('#publish').click(); await page.locator('#confirm-review').check(); await page.locator('#confirm-publish').click(); await page.locator('#go-report').waitFor();
  const exams = await (await context.request.get(base + '/api/exams')).json(), examId = exams[0].id;
  const report = await (await context.request.get(base + `/api/exams/${examId}/report`)).json();
  const studentContext = await browser.newContext({ viewport: { width: 1440, height: 1080 } }), student = await studentContext.newPage();
  student.on('pageerror', e => errors.push(e.message)); await student.goto(base + '/exam/' + examId); await student.locator('#student-form').waitFor();
  assert.equal((await studentContext.request.get(base + '/api/papers')).status(), 401);
  await student.locator('#student-name').fill('演示学生A（自动测试）');
  let firstNumber = true;
  for (const q of report.paper.questions) {
    if (q.type === 'choice' || q.type === 'judge') await student.locator(`input[name="${q.id}"][value="${q.answer}"]`).check();
    else if (q.type === 'number') { await student.locator(`input[name="${q.id}"]`).fill(firstNumber ? '0' : String(q.answer)); firstNumber = false; }
    else await student.locator(`textarea[name="${q.id}"]`).fill('类别不平衡时准确率可能掩盖漏检，应关注召回率与混淆矩阵，结合业务成本调整阈值，用独立验证集验证效果。');
  }
  await student.screenshot({ path: resolve(out, '04-学生作答.png'), fullPage: true }); evidence.push('04-学生作答.png');
  await student.locator('button[type=submit]').click(); await student.getByText('以上未计入待复核简答题，不能作为最终成绩。请等待教师反馈。').waitFor();
  await studentContext.close();
  await page.locator('#go-report').click(); await page.getByRole('button', { name: '查看答卷', exact: true }).first().click(); await page.locator('#save-review').waitFor();
  await page.locator('[data-review-score]').fill('18'); await page.locator('#save-review').click(); await page.locator('#practice:not([disabled])').waitFor(); await shot('05-学情与教师复核.png');
  await page.locator('#practice').click(); await page.getByRole('heading', { name: /针对性补练/ }).waitFor(); await page.screenshot({ path: resolve(out, '06-补练建议.png') }); evidence.push('06-补练建议.png'); await page.locator('#modal .close').click();
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 }); const mp = await mobile.newPage();
  await mp.goto(base); await mp.locator('#generate-blueprint').waitFor(); await mp.screenshot({ path: resolve(out, '07-移动端工作台.png'), fullPage: true }); evidence.push('07-移动端工作台.png');
  assert.equal(await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await mobile.close(); assert.deepEqual(errors, []);
  await writeFile(resolve(out, '浏览器验收结果.json'), JSON.stringify({ time: new Date().toISOString(), browser: 'Microsoft Edge / Playwright', scope: '本机模板模式自动化验收，不是教师真实试用', passed: true, checks: ['教师登录', '蓝图生成', '错误总分被拒绝', '公式渲染', '非法公式编辑被拒绝', '教师发布确认', '匿名学生无法访问教师接口', '九题完整作答', '待复核提示', '教师复核', '知识点报告', '规则补练', '390px移动端无横向溢出', '无页面JavaScript异常'], screenshots: evidence, errors }, null, 2));
  console.log('浏览器端到端验收通过：' + evidence.length + '张截图。');
} finally { await context.close(); await browser.close(); }
