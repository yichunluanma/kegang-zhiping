import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE, demoBlueprint, demoQuestions, validateBlueprint, validatePaper, publicPaper, parseNumber, grade, summarize } from '../lib/domain.mjs';
const fixture = () => { const blueprint = demoBlueprint(SAMPLE); return { blueprint, questions: demoQuestions(blueprint, 1) }; };
test('默认蓝图覆盖四目标、9题、100分，公式均可解析', () => {
  const p = fixture(); assert.equal(p.questions.length, 9); assert.equal(p.questions.reduce((s, q) => s + q.score, 0), 100); validatePaper(p);
});
test('增加计算题后仍为100分且题数发生变化', () => {
  const blueprint = demoBlueprint(SAMPLE, '减少概念题，增加计算题，总分保持100分');
  const p = { blueprint, questions: demoQuestions(blueprint, 2) }; validatePaper(p);
  assert.equal(p.questions.filter(q => q.type === 'number').length, 3);
});
test('错误总分及伪造大纲来源被拒绝', () => {
  const b = demoBlueprint(SAMPLE); b.total = 99; assert.throws(() => validateBlueprint(b), /不一致/);
  b.total = 100; b.objectives[0].source = '大纲中没有的内容'; assert.throws(() => validateBlueprint(b, SAMPLE), /原文/);
});
test('不支持的大纲不能伪装成AI生成', () => assert.throws(() => demoBlueprint('英语课教学大纲'), /演示模式/));
test('非法LaTeX及重复选项阻止保存和发布', () => {
  const p = fixture(); p.questions[0].formula = '\\notARealCommand'; assert.throws(() => validatePaper(p), /LaTeX/);
  p.questions[0].formula = ''; p.questions[0].options.fill('同一选项'); assert.throws(() => validatePaper(p), /选项/);
});
test('学生卷不含答案、解析、量规或教学原文', () => {
  const text = JSON.stringify(publicPaper(fixture())); for (const key of ['answer', 'explanation', 'rubric', 'source', 'outline']) assert.equal(text.includes(`"${key}"`), false);
});
test('数值评分接受小数、分数、百分数，不执行表达式', () => {
  assert.equal(parseNumber('1/2'), .5); assert.equal(parseNumber('50%'), .5);
  assert.ok(Number.isNaN(parseNumber('1/0'))); assert.ok(Number.isNaN(parseNumber('2+3'))); assert.ok(Number.isNaN(parseNumber('')));
});
test('客观题满分时简答仍待复核，不能提前给最终分数', () => {
  const p = fixture(), answers = Object.fromEntries(p.questions.map(q => [q.id, q.type === 'short' ? '不平衡 召回率 阈值' : q.answer]));
  const results = grade(p, answers), report = summarize(p, results);
  assert.equal(report.score, 80); assert.equal(report.pending, true); assert.equal(results.at(-1).suggested, 20); assert.equal(results.at(-1).score, null);
});
test('缺省答案不会意外通过数值评分', () => { const p = fixture(), r = grade(p, {}); assert.equal(r.reduce((s, q) => s + (q.score || 0), 0), 0); });
test('固定蓝图与种子生成结果完全一致', () => { const b = demoBlueprint(SAMPLE); assert.deepEqual(demoQuestions(b, 7), demoQuestions(b, 7)); assert.notDeepEqual(demoQuestions(b, 7), demoQuestions(b, 8)); });
