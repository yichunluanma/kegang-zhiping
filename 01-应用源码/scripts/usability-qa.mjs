import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../',import.meta.url));
const out = resolve(root,'09-使用说明/操作截图'); await mkdir(out,{recursive:true});
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3211';
const browser = await chromium.launch({channel:'msedge',headless:true});
const ctx = await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1.5, reducedMotion:'reduce'});
const page = await ctx.newPage(), errors=[], shots=[];
page.on('pageerror',e=>errors.push(e.message));
async function shot(name, target=page) { if (await page.locator('#toast.show').count()) await page.locator('#toast.show').waitFor({state:'hidden'}); await target.screenshot({path:resolve(out,name+'.png')}); shots.push(name+'.png'); }
try {
 await page.goto(base); await page.locator('#generate-blueprint').waitFor();
 const buttonBox=await page.locator('#generate-blueprint').boundingBox(); assert.ok(buttonBox.y+buttonBox.height<=1000,'首页主操作应在首屏可见');
 await shot('01-教师工作台');
 const intent = await page.locator('#intent').inputValue();
 await page.locator('#intent').fill(intent+' 请突出职业情境。');
 await page.reload(); await page.locator('#intent').waitFor(); assert.ok((await page.locator('#intent').inputValue()).endsWith('请突出职业情境。'));
 await page.locator('#intent-default').click();
 await page.locator('#outline-file').setInputFiles(resolve(root,'07-课程样例/01-分类模型评价大纲.txt'));
 await page.getByText(/已导入：/).waitFor(); await shot('02-大纲导入',page.locator('.input-card'));
 await page.locator('#generate-blueprint').click(); await page.locator('#login-form').waitFor(); await shot('03-教师登录',page.locator('#modal'));
 await page.locator('#login-form button[type=submit]').click(); await page.locator('#generate-paper').waitFor();
 await shot('04-考核蓝图',page.locator('.content'));
 await page.locator('.goal-details summary').click(); await shot('05-目标与原文',page.locator('.goal-details')); await page.locator('.goal-details summary').click();
 await page.locator('#blueprint-title').fill('分类模型评价 · 使用说明示例');
 await page.reload(); await page.locator('#generate-paper').waitFor(); assert.equal(await page.locator('#blueprint-title').inputValue(),'分类模型评价 · 使用说明示例');
 const score=page.locator('[data-plan="0"] [data-key="score"]'); await score.fill('11'); await score.blur();
 await page.locator('#generate-paper').click(); await page.getByText('题型计划合计102分，与总分100不一致',{exact:true}).waitFor(); await shot('06-分值校验');
 await score.fill('10'); await score.blur(); await page.locator('#generate-paper').click(); await page.locator('#publish').waitFor();
 assert.equal(await page.locator('.katex-error').count(),0); assert.ok(await page.locator('.katex').count()>=2);
 await shot('07-试卷审核');
 await page.locator('[data-edit="0"]').click(); await page.locator('#edit-formula').fill('\\notARealCommand'); await page.locator('#edit-form button[type=submit]').click(); assert.ok((await page.locator('#edit-error').textContent()).length>0);
 const amended=(await page.locator('#edit-stem').inputValue())+'（演示校订）';
 await page.locator('#edit-formula').fill(''); await page.locator('#edit-stem').fill(amended); await page.locator('#edit-form button[type=submit]').click(); await page.locator('#modal').waitFor({state:'hidden'});
 assert.equal(await page.locator('#question-1 .stem').textContent(),amended,'校验失败后再次编辑必须保存新内容');
 await page.locator('.question-nav a').nth(4).click(); await shot('08-公式与答案',page.locator('#question-5'));
 await page.locator('[data-edit="8"]').click(); await page.locator('.rubric-editor').scrollIntoViewIfNeeded(); await shot('09-简答评分标准',page.locator('.rubric-editor'));
 const rubricScore=page.locator('[data-rubric-score]').first(), original=await rubricScore.inputValue();
 await rubricScore.fill(String(Number(original)+1)); await page.locator('#edit-form button[type=submit]').click(); await page.getByText('简答量规分值与题目不符',{exact:true}).waitFor();
 await rubricScore.fill(original); await page.locator('[data-rubric-point]').first().fill('识别类别不平衡，结合业务解释');
 await page.locator('#edit-form button[type=submit]').click(); await page.locator('#modal').waitFor({state:'hidden'});
 await page.locator('#publish').click(); await shot('10-发布确认',page.locator('#modal')); await page.locator('#confirm-review').check(); await page.locator('#confirm-publish').click(); await page.locator('#go-report').waitFor(); await shot('11-学生链接',page.locator('#modal'));
 const exams=await (await ctx.request.get(base+'/api/exams')).json(), examId=exams[0].id;
 const report=await (await ctx.request.get(base+`/api/exams/${examId}/report`)).json(); assert.equal(report.paper.questions[8].rubric[0].point,'识别类别不平衡，结合业务解释');
 const studentCtx=await browser.newContext({viewport:{width:1280,height:960},deviceScaleFactor:1.5,reducedMotion:'reduce'}), student=await studentCtx.newPage();
 student.on('pageerror',e=>errors.push(e.message)); await student.goto(base+'/exam/'+examId); await student.locator('#student-form').waitFor();
 assert.equal((await studentCtx.request.get(base+'/api/papers')).status(),401);
 const publicExam=await (await studentCtx.request.get(base+'/api/exam/'+examId)).json(); assert.equal(JSON.stringify(publicExam).includes('"answer"'),false);
 await student.locator('#student-name').fill('说明书演示学生'); await shot('12-学生作答',student);
 let firstNumber=true;
 for(const q of report.paper.questions){
  if(q.type==='choice'||q.type==='judge')await student.locator(`input[name="${q.id}"][value="${q.answer}"]`).check();
  else if(q.type==='number'){await student.locator(`input[name="${q.id}"]`).fill(firstNumber?'0':String(q.answer));firstNumber=false;}
  else await student.locator(`textarea[name="${q.id}"]`).fill('类别不平衡会掩盖漏检，应结合混淆矩阵和业务成本关注召回率、精确率，调整阈值并用独立验证集验证。');
 }
 await student.reload(); await student.locator('#student-form').waitFor(); assert.equal(await student.locator('#answered-count').textContent(),'9 / 9');
 await shot('13-完成作答',student); await student.locator('button[type=submit]').click(); await student.getByRole('heading',{name:'答卷已提交'}).waitFor(); await shot('14-提交结果',student);
 await page.locator('#go-report').click(); await page.locator('#exam-select').waitFor(); await shot('15-待复核报告');
 await page.getByRole('button',{name:'查看答卷',exact:true}).first().click(); await page.locator('[data-review-score]').fill('18');
 await page.locator('[data-review-score]').scrollIntoViewIfNeeded(); await shot('16-教师复核',page.locator('#attempt-detail .question').last());
 await page.locator('#save-review').click(); await page.locator('#practice:not([disabled])').waitFor(); await page.evaluate(()=>window.scrollTo(0,0)); await shot('17-确认后学情');
 const finalReport=await (await ctx.request.get(base+`/api/exams/${examId}/report`)).json(); assert.equal(finalReport.attempts[0].summary.score,83); assert.equal(finalReport.attempts[0].summary.pending,false);
 await page.locator('#practice').click(); await page.getByRole('heading',{name:/针对性补练/}).waitFor(); await shot('18-补练建议',page.locator('#modal')); await page.locator('#modal .close').click();
 const csvDownload=page.waitForEvent('download'); await page.locator('#export-report').click(); const csv=await csvDownload; assert.ok((await readFile(await csv.path(),'utf8')).includes('83'));
 await page.locator('[data-nav="history"]').click(); await page.locator('[data-open-paper]').first().waitFor(); await shot('19-我的测评');
 await page.locator('[data-open-paper]').first().click(); await page.locator('#publish').waitFor(); await page.reload(); await page.locator('#publish').waitFor();
 await page.locator('.export-tools summary').click(); await shot('20-打印导出',page.locator('.paper-side'));
 const jsonDownload=page.waitForEvent('download');await page.locator('#export-paper').click();const json=await jsonDownload; assert.equal(JSON.parse(await readFile(await json.path(),'utf8')).questions.length,9);
 await page.emulateMedia({media:'print'}); await page.evaluate(()=>{window.print=()=>{};document.querySelector('#print-paper').click();}); await page.pdf({path:resolve(root,'tmp/学生试卷-v02.pdf'),format:'A4'}); await page.emulateMedia({media:'screen'});
 await page.locator('nav [data-nav="guide"]').click(); await page.getByRole('heading',{name:'使用帮助',exact:true}).waitFor(); await shot('21-使用帮助');
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1.5,reducedMotion:'reduce'}), mp=await mobile.newPage(); await mp.goto(base);await mp.locator('#generate-blueprint').waitFor(); await shot('22-手机布局',mp);
 assert.ok(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobile.close();await studentCtx.close();assert.deepEqual(errors,[]);
 const result={date:new Date().toISOString(),version:'0.2.0',passed:true,scope:'隔离数据库内的模板模式自动化演示，不是真实教师或学生试用',checks:['首屏主操作可见','输入刷新恢复','蓝图刷新恢复','登录后接续生成','大纲文件导入','总分约束','非法公式拒绝后继续编辑正确保存','表单化简答量规及分值校验','发布确认与独立快照','学生答案隔离','作答刷新恢复','教师复核83分','CSV与JSON下载','学生卷打印PDF','试卷刷新恢复','390px无横向溢出','无页面脚本异常'],screenshots:shots};
 await writeFile(resolve(root,'05-测试与验证/v0.2-易用性验收.json'),JSON.stringify(result,null,2));
 console.log(`UI v0.2 passed: ${shots.length} screenshots; reviewed score 83/100.`);
}finally{await browser.close();}


