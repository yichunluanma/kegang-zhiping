import katex from 'katex';

export const TYPES = { choice: '单选题', judge: '判断题', number: '数值计算题', short: '简答题' };
export const LEVELS = { easy: '基础', medium: '应用', hard: '综合' };
export const SAMPLE = `课程：高职《人工智能基础》
章节：分类模型评价
教学目标：
1. 理解混淆矩阵中 TP、FP、FN、TN 的含义，区分准确率、精确率和召回率。
2. 能根据混淆矩阵计算准确率、精确率、召回率和 F1 值。
3. 能在工厂缺陷检测、垃圾邮件识别等职业情境中选择合适的评价指标。
4. 能解释漏检和误报的业务影响，并提出模型评价与改进建议。
教学边界：只考核二分类模型评价，不涉及模型训练、ROC 曲线推导和多分类指标。
评价方式：概念理解、公式计算、职业情境判断、简短分析。`;
export const DEFAULT_INTENT = '生成100分测评，包含单选、判断、公式计算和职业情境简答题，突出教学目标对齐。';

export function insist(ok, message) { if (!ok) throw new Error(message); }
const str = (v, max = 2000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const integer = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
export function validateBlueprint(b, outline) {
  insist(b && str(b.title, 120) && integer(b.total, 1, 300), '考核标题或总分不合法');
  insist(Array.isArray(b.objectives) && b.objectives.length >= 1 && b.objectives.length <= 12, '教学目标应为1–12个');
  const ids = new Set();
  for (const o of b.objectives) {
    insist(str(o.id, 30) && !ids.has(o.id) && str(o.name, 300) && str(o.source, 1000), '目标ID、名称或来源不合法');
    if (outline) insist(outline.replace(/\s/g, '').includes(o.source.replace(/\s/g, '')), '目标来源必须摘自大纲原文');
    ids.add(o.id);
  }
  insist(Array.isArray(b.plans) && b.plans.length >= 1 && b.plans.length <= 20, '题型计划应为1–20行');
  let total = 0, count = 0;
  for (const p of b.plans) {
    insist(TYPES[p.type] && LEVELS[p.level] && ids.has(p.objectiveId), '题型、认知层次或目标映射无效');
    insist(integer(p.count, 1, 20) && integer(p.score, 1, 100), '题数或单题分值无效');
    total += p.count * p.score; count += p.count;
  }
  insist(count <= 30, '第一版每份测评最多30题');
  insist(total === b.total, `题型计划合计${total}分，与总分${b.total}不一致`);
  insist(b.objectives.every(o => b.plans.some(p => p.objectiveId === o.id)), '每个教学目标至少需要一项考核');
  return b;
}

export function demoBlueprint(outline, intent = '') {
  insist(/混淆矩阵/.test(outline) && /召回率/.test(outline) && /职业情境|工厂缺陷/.test(outline), '演示模式仅支持内置“分类模型评价”章节；其他大纲请配置模型后重试');
  insist(!/\d+\s*分/.test(intent) || /100\s*分/.test(intent), '演示模板总分固定100分；自定义总分请在蓝图中编辑或启用模型');
  const sources = [
    '理解混淆矩阵中 TP、FP、FN、TN 的含义，区分准确率、精确率和召回率。',
    '能根据混淆矩阵计算准确率、精确率、召回率和 F1 值。',
    '能在工厂缺陷检测、垃圾邮件识别等职业情境中选择合适的评价指标。',
    '能解释漏检和误报的业务影响，并提出模型评价与改进建议。'
  ];
  insist(sources.every(s => outline.replace(/\s/g, '').includes(s.replace(/\s/g, ''))), '演示模板需使用内置大纲原文；任意大纲解析需要真实模型');
  const moreCalculation = /增加.*(计算|公式)|(计算|公式).*增加/.test(intent);
  const b = {
    title: '人工智能基础 · 分类模型评价', total: 100,
    objectives: ['概念辨析', '指标计算', '职业情境选择', '业务影响分析'].map((name, i) => ({ id: `O${i + 1}`, name, source: sources[i] })),
    plans: [
      { type: 'choice', count: moreCalculation ? 1 : 2, score: 10, objectiveId: 'O1', level: 'easy' },
      { type: 'judge', count: 2, score: 5, objectiveId: 'O1', level: 'easy' },
      { type: 'number', count: moreCalculation ? 3 : 2, score: 15, objectiveId: 'O2', level: 'medium' },
      { type: 'choice', count: 2, score: 10, objectiveId: 'O3', level: 'medium' },
      { type: 'short', count: 1, score: moreCalculation ? 15 : 20, objectiveId: 'O4', level: 'hard' }
    ],
    note: '模板演示：不调用大模型。支持“增加计算题”示例指令；其他意图请手动编辑蓝图或启用模型。'
  };
  return validateBlueprint(b, outline);
}

export function validatePaper(paper) {
  insist(paper && paper.blueprint, '试卷缺少考核蓝图');
  const b = validateBlueprint(paper.blueprint);
  insist(Array.isArray(paper.questions) && paper.questions.length === b.plans.reduce((n, p) => n + p.count, 0), '生成题数与蓝图不符');
  const seen = new Set();
  let i = 0;
  for (const plan of b.plans) for (let n = 0; n < plan.count; n++, i++) {
    const q = paper.questions[i];
    insist(q && str(q.id, 50) && !seen.has(q.id), '题目ID缺失或重复'); seen.add(q.id);
    insist(q.type === plan.type && q.score === plan.score && q.objectiveId === plan.objectiveId && q.level === plan.level, `第${i + 1}题与蓝图不一致`);
    insist(str(q.stem, 4000) && str(q.explanation, 4000), '题干或解析缺失');
    insist(typeof q.formula === 'string' && q.formula.length <= 1000, '公式字段无效');
    if (q.formula) { try { katex.renderToString(q.formula, { throwOnError: true, trust: false, strict: 'error', maxExpand: 1000 }); } catch { throw new Error(`第${i + 1}题LaTeX公式无效`); } }
    if (q.type === 'choice') {
      insist(Array.isArray(q.options) && q.options.length === 4 && q.options.every(x => str(x, 1000)), '单选题必须有4个非空选项');
      insist(new Set(q.options).size === 4 && ['A', 'B', 'C', 'D'].includes(q.answer), '单选题答案或选项无效');
    } else if (q.type === 'judge') insist(['true', 'false'].includes(q.answer), '判断题答案无效');
    else if (q.type === 'number') insist(typeof q.answer === 'number' && Number.isFinite(q.answer) && typeof q.tolerance === 'number' && q.tolerance >= 0 && q.tolerance <= 1, '数值答案或误差无效');
    else {
      insist(str(q.answer, 4000) && Array.isArray(q.rubric) && q.rubric.length >= 1 && q.rubric.length <= 8, '简答题需要参考答案和评分量规');
      insist(q.rubric.every(r => str(r.point, 300) && Number.isFinite(r.score) && r.score > 0 && Array.isArray(r.keywords) && r.keywords.length && r.keywords.every(k => str(k, 30))), '简答量规无效');
      insist(Math.abs(q.rubric.reduce((s, r) => s + r.score, 0) - q.score) < .001, '简答量规分值与题目不符');
    }
  }
  return paper;
}

export function demoQuestions(b, seed = 1) {
  const qs = [], idx = { O1: 0, O2: 0, O3: 0, O4: 0 };
  const definitions = [
    ['TP表示什么？', ['实际为正类且预测为正类', '实际为负类且预测为正类', '实际为正类且预测为负类', '实际为负类且预测为负类'], 'A', 'TP为真正例。'],
    ['哪一个指标回答“被模型判为正类的样本中，有多少确实是正类”？', ['召回率', '准确率', '精确率', '样本数量'], 'C', '精确率的分母是所有预测正类TP+FP。'],
    ['FN表示什么？', ['正确检出的缺陷', '正常品被误报', '缺陷被漏检', '正确识别的正常品'], 'C', 'FN是假负例，即实际正类被预测为负类。']
  ];
  const situations = [
    ['工厂希望尽量减少缺陷产品漏检，应优先关注哪一指标？', ['样本总量', '缺陷类别召回率', '预测耗时', '训练轮数'], 'B', '漏检对应FN；提高召回率有助于减少漏检，仍需同时关注误报成本。'],
    ['垃圾邮件过滤系统希望尽量避免正常邮件被拦截，应关注被拦截邮件的哪一指标？', ['召回率', '特征数量', '精确率', '批大小'], 'C', '提高垃圾邮件类别精确率，意味着被拦截邮件中真实垃圾邮件占比更高。'],
    ['缺陷率只有1%的生产线，模型把所有产品都判为正常时，哪一种评价更合理？', ['准确率99%即可上线', '仅检查推理速度', '补查缺陷召回率与混淆矩阵', '忽略缺陷类别'], 'C', '类别不平衡时，高准确率可能掩盖正类完全漏检。']
  ];
  for (const plan of b.plans) {
    insist(['O1', 'O2', 'O3', 'O4'].includes(plan.objectiveId), '演示题库只支持内置4个教学目标；请启用模型生成其他目标');
    for (let n = 0; n < plan.count; n++) {
      const k = idx[plan.objectiveId]++, q = { id: `Q${qs.length + 1}`, type: plan.type, score: plan.score, objectiveId: plan.objectiveId, level: plan.level, formula: '' };
      if (plan.type === 'choice' && ['O1', 'O3'].includes(plan.objectiveId)) {
        const bank = plan.objectiveId === 'O1' ? definitions : situations;
        const item = bank[k % bank.length]; insist(k < bank.length, '演示单选题库数量不足，请减少题数或启用模型');
        [q.stem, q.options, q.answer, q.explanation] = item;
      } else if (plan.type === 'judge' && plan.objectiveId === 'O1') {
        const items = [
          ['只要准确率高，缺陷检测模型就一定适合上线。', 'false', '必须结合类别分布、缺陷召回率和业务成本判断。'],
          ['在同一混淆矩阵中，召回率分母是TP+FN。', 'true', 'TP+FN代表所有实际正类。']
        ];
        // Concept choice items have already consumed O1 indices; use the local row index.
        insist(n < items.length, '演示判断题最多2题'); [q.stem, q.answer, q.explanation] = items[n];
      } else if (plan.type === 'number' && plan.objectiveId === 'O2') {
        const tp = 36 + (Number(seed) % 7) * 2 + n * 3, fp = 6 + n, fn = 9 + n, tn = 49 + n * 2;
        const metric = n % 3;
        const names = ['精确率', '召回率', '准确率'];
        const denominators = [tp + fp, tp + fn, tp + fp + fn + tn];
        const numerator = metric === 2 ? tp + tn : tp;
        q.stem = `某生产线以“缺陷”为正类，检测结果为TP=${tp}、FP=${fp}、FN=${fn}、TN=${tn}。计算${names[metric]}，填写0–1之间的小数，保留三位小数。`;
        q.formula = ['P=\\frac{TP}{TP+FP}', 'R=\\frac{TP}{TP+FN}', 'Accuracy=\\frac{TP+TN}{TP+FP+FN+TN}'][metric];
        q.answer = numerator / denominators[metric]; q.tolerance = 0.001;
        q.explanation = `${names[metric]}=${numerator}/${denominators[metric]}≈${q.answer.toFixed(3)}。允许绝对误差0.001。`;
      } else if (plan.type === 'short' && plan.objectiveId === 'O4') {
        insist(n === 0, '演示简答题最多1题');
        q.stem = '某缺陷检测模型准确率达98%，但仍有缺陷流入后续工序。请解释为什么不能只看准确率，并提出两项评价或改进建议。';
        q.answer = '类别不平衡可能导致准确率掩盖缺陷漏检。应查看混淆矩阵和缺陷召回率，结合误报与漏检成本调整阈值，并使用独立验证集检验效果。';
        const a = Math.floor(q.score / 3), c = q.score - 2 * a;
        q.rubric = [
          { point: '解释类别不平衡或漏检问题', score: a, keywords: ['不平衡', '漏检', '少数类'] },
          { point: '提出召回率或混淆矩阵评价', score: a, keywords: ['召回', '混淆矩阵', 'FN'] },
          { point: '提出可验证的改进建议', score: c, keywords: ['阈值', '验证集', '测试集', '成本'] }
        ];
        q.explanation = '关键词匹配只用于辅助建议，不能识别否定、推理质量或替代表述，最终由教师复核。';
      } else throw new Error('演示题库不支持该题型与目标组合，请修改蓝图或启用真实模型');
      qs.push(q);
    }
  }
  return qs;
}

export function publicPaper(paper) {
  return { title: paper.blueprint.title, total: paper.blueprint.total, questions: paper.questions.map(q => ({ id: q.id, type: q.type, score: q.score, level: q.level, stem: q.stem, formula: q.formula, ...(q.type === 'choice' ? { options: q.options } : {}) })) };
}
export function parseNumber(value) {
  const s = String(value ?? '').trim();
  if (/^[+-]?\d+(?:\.\d+)?\s*\/\s*[+-]?\d+(?:\.\d+)?$/.test(s)) { const [a, b] = s.split('/').map(Number); return b ? a / b : NaN; }
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)%$/.test(s)) return Number(s.slice(0, -1)) / 100;
  return s && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s) ? Number(s) : NaN;
}
export function grade(paper, answers) {
  return paper.questions.map(q => {
    const response = String(answers[q.id] ?? '').trim().slice(0, 4000);
    if (q.type === 'short') {
      const evidence = q.rubric.map(r => { const matched = r.keywords.filter(k => response.toLowerCase().includes(k.toLowerCase())); return { point: r.point, maximum: r.score, matched, suggested: matched.length ? r.score : 0 }; });
      return { id: q.id, response, score: null, suggested: evidence.reduce((s, r) => s + r.suggested, 0), evidence, status: 'pending', feedback: '关键词匹配辅助评分；等待教师复核。' };
    }
    const correct = q.type === 'number' ? Number.isFinite(parseNumber(response)) && Math.abs(parseNumber(response) - q.answer) <= q.tolerance : response === q.answer;
    return { id: q.id, response, score: correct ? q.score : 0, suggested: correct ? q.score : 0, status: 'final', feedback: correct ? '回答正确' : '请回顾解析与相关知识点' };
  });
}
export function summarize(paper, results) {
  const pending = results.some(r => r.status === 'pending');
  const score = results.reduce((s, r) => s + (r.score ?? 0), 0);
  const objectives = paper.blueprint.objectives.map(o => {
    const questions = paper.questions.filter(q => q.objectiveId === o.id), ids = new Set(questions.map(q => q.id));
    const rows = results.filter(r => ids.has(r.id));
    return { ...o, maximum: questions.reduce((s, q) => s + q.score, 0), score: rows.reduce((s, r) => s + (r.score ?? 0), 0), pending: rows.some(r => r.status === 'pending') };
  });
  return { score, total: paper.blueprint.total, pending, objectives };
}
