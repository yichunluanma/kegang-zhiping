"""Generate the first-version technical report. Requires reportlab; does not use API keys."""
from pathlib import Path
from xml.sax.saxutils import escape
import json
import re
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, Flowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parent.parent
pdfmetrics.registerFont(TTFont('Chinese', 'C:/Windows/Fonts/simsun.ttc', subfontIndex=0))
pdfmetrics.registerFont(TTFont('Heading', 'C:/Windows/Fonts/simhei.ttf'))
GREEN = colors.HexColor('#176e59'); INK = colors.HexColor('#183c39'); MUTED = colors.HexColor('#6c7d74'); LINE = colors.HexColor('#dce5d9'); PALE = colors.HexColor('#edf4e8')
styles = {
 'body': ParagraphStyle('body', fontName='Chinese', fontSize=10.2, leading=18, textColor=INK, spaceAfter=10),
 'h1': ParagraphStyle('h1', fontName='Heading', fontSize=23, leading=32, textColor=INK, spaceAfter=15),
 'h2': ParagraphStyle('h2', fontName='Heading', fontSize=13, leading=22, textColor=GREEN, spaceBefore=10, spaceAfter=8),
 'small': ParagraphStyle('small', fontName='Chinese', fontSize=8.5, leading=14, textColor=MUTED, spaceAfter=8),
 'cell': ParagraphStyle('cell', fontName='Chinese', fontSize=9, leading=15, textColor=INK),
 'label': ParagraphStyle('label', fontName='Heading', fontSize=9, leading=16, textColor=GREEN, spaceAfter=9),
 'cover': ParagraphStyle('cover', fontName='Heading', fontSize=38, leading=47, textColor=INK, spaceAfter=12),
}
story = []
def p(text, kind='body'):
    content=escape(text)
    content=re.sub(r'([A-Za-z0-9][A-Za-z0-9_./()=-]*)', r' \1 ', content)
    content=content.replace('\n', '<br/>')
    return Paragraph(content, styles[kind])
def add(text, kind='body'): story.append(p(text, kind))
def section(n, title, subtitle):
    if story: story.append(PageBreak())
    add(f'KEGANG ZHIPING / TECHNICAL REPORT / {n:02d}', 'label'); add(title, 'h1'); add(subtitle, 'small'); story.append(Spacer(1, 8))
def table(rows, widths):
    t = Table([[p(str(c), 'cell') for c in row] for row in rows], colWidths=widths, repeatRows=1, hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND', (0,0),(-1,0), PALE), ('GRID',(0,0),(-1,-1),.4,LINE), ('VALIGN',(0,0),(-1,-1),'TOP'), ('LEFTPADDING',(0,0),(-1,-1),9), ('RIGHTPADDING',(0,0),(-1,-1),9), ('TOPPADDING',(0,0),(-1,-1),8), ('BOTTOMPADDING',(0,0),(-1,-1),8)])); story.append(t); story.append(Spacer(1,12))
def image(path, maxw=470, maxh=430):
    w,h = ImageReader(str(path)).getSize(); scale = min(maxw/w,maxh/h); story.append(Image(str(path), width=w*scale, height=h*scale, hAlign='LEFT'))
class Architecture(Flowable):
    def __init__(self):
        super().__init__()
        self.width=470; self.height=155
    def draw(self):
        c=self.canv; labels=['教师意图','蓝图确认','题目校验','页面渲染','审核发布']
        for i,label in enumerate(labels):
            x=i*95; c.setFillColor(PALE); c.setStrokeColor(LINE); c.roundRect(x,100,82,35,7,stroke=1,fill=1); c.setFillColor(INK); c.setFont('Heading',10); c.drawCentredString(x+41,113,label)
            if i<4: c.setStrokeColor(GREEN); c.line(x+84,117,x+92,117); c.line(x+89,120,x+92,117); c.line(x+89,114,x+92,117)
        c.setFillColor(PALE); c.roundRect(0,35,470,38,7,stroke=0,fill=1); c.setFillColor(INK); c.setFont('Chinese',10); c.drawCentredString(235,50,'学生作答  →  规则评分  →  教师复核  →  知识点报告与补练')
        c.setFont('Chinese',9); c.setFillColor(MUTED); c.drawString(0,10,'SQLite：可编辑草稿 / 独立发布快照 / 作答与复核记录')
        c.setStrokeColor(LINE); c.line(425,99,425,73)

section(1,'课纲智评','易用性优化版技术文档 · v0.2.0 · 2026-10-13')
add('面向职业教育的自然语言测评生成\n与学情反馈平台', 'h1')
table([['命题范围','作品定位','当前交付'],['4 · 低代码与智能表单','教师在环的测评生成引擎','本地可运行v0.2']], [155,155,160])
add('从大纲到蓝图，从试卷到反馈。教师用自然语言描述考核要求，系统将结构化配置渲染为可编辑、可发布、可作答的测评页面。')
image(ROOT/'09-使用说明/操作截图/01-教师工作台.png',470,350)
story.append(Spacer(1,14))
add('实际界面截图。当前默认模板演示，不调用大模型。未完成真实教师试用、真实供应商效果验证或公网部署。', 'small')

section(2,'问题、场景与产品闭环','01 / 一个章节，一条真实可执行的测评流程')
add('教师需要把教学目标转为题型和分值，还要检查公式、答案、教学边界和后续反馈。单独输出题目后，排版、发布、收集与分析仍需多个步骤。课纲智评将这些工作连接起来。')
add('第一版聚焦高职《人工智能基础》“分类模型评价”。示例涵盖混淆矩阵、精确率和召回率计算、工厂缺陷检测情境及业务影响分析。样例尚未由真实任课教师审定为正式大纲。')
table([['阶段','教师/学生的操作','系统产物'],['输入意图','教师粘贴大纲并描述要求','带来源的考核蓝图'],['确认与审核','教师核对目标、分值及每道题','可编辑的试卷草稿'],['发布与作答','教师确认发布，学生答题','独立快照与答卷'],['复核与反馈','教师确认简答分值','目标得分、CSV和原题补练']], [78,175,217])
add('两种模式，清楚区分', 'h2')
add('模板模式只支持内置章节、均衡配比和“增加计算题”示例，使用固定题库及种子。真实模型模式通过服务端兼容接口解析大纲并生成题目；没有密钥时不声称任意课程都可生成。')
add('教师审核是产品主流程', 'h2')
add('蓝图确认、发布确认和简答复核分别对应三个决策点。结构和公式校验能发现格式问题，不能代替教学内容判断。')

section(3,'工程架构与数据流','02 / 用结构化协议连接模型、界面与持久化')
story.append(Architecture()); story.append(Spacer(1,12))
table([['模块','职责'],['public/app.js / style.css','三步工作台、学生表单、题目编辑、报告和响应式布局'],['lib/ai.mjs','模型协议、Prompt模板、接口请求、模式与失败隔离'],['lib/domain.mjs','蓝图/题目校验、演示题库、客观评分和汇总'],['server.mjs','教师会话、API、发布快照、SQLite及输入限制']], [160,310])
add('数据对象', 'h2')
add('Blueprint = title + total + objectives[id/name/source] + plans[type/count/score/objectiveId/level]。Question = id + type + score + objectiveId + level + stem + formula + answer + explanation，按题型附加options、tolerance或rubric。')
add('数据持久化', 'h2')
add('papers为可编辑草稿，exams为发布内容快照，attempts为作答与复核记录。发布后修改草稿，不改变已发布测评。数据库和运行日志不进入源码提交包。')
add('Node.js v24.21.0 + 内置HTTP/SQLite；前端无需编译。KaTeX 0.16.22与字体随项目提供，避免演示依赖外网CDN。', 'small')

section(4,'方法创新与意图控制','03 / 先让教师确认意图，再生成可执行测评')
add('自然语言首先变成可审核的考核蓝图。模型不直接获得任意页面代码执行权；前端仅按已通过校验的JSON配置渲染既定组件。这使题型、分值和目标对应关系成为可核查约束。')
add('运行Prompt策略', 'h2')
add('系统消息约束职业教育角色、JSON协议和输入资料边界。用户消息将outline、intent或已确认blueprint放入资料JSON，要求来源摘录来自大纲原文。温度设置0.2，接口要求JSON对象。模型输出后还需程序校验。')
table([['校验层','已实现约束'],['蓝图','1–12目标、1–20行计划、最多30题；正整数分值；总分一致；目标覆盖；原文来源'],['题目','题数与计划顺序相符；题型/目标/层次/分值匹配；唯一ID；答案类型有效'],['题型','单选四个不同非空选项；数值答案/误差有效；简答量规分值合计一致'],['公式','KaTeX解析通过、trust关闭、宏展开数量限制']], [90,380])
add('失效时如何处理', 'h2')
add('错误JSON、超时、供应商HTTP错误及结构校验失败均向教师明确报告，不静默回退到模板。缺少AI_MODEL时立即提醒配置。内容越界与事实错误仍需教师发现并修改。')
add('原始运行Prompt可核查：02-开发过程记录/04-运行提示词模板.json。此文件是产品运行模板，不是开发聊天历史。', 'small')

section(5,'评分、复核与反馈','04 / 将辅助建议和最终成绩明确区分')
table([['题型','评分方法','确认机制'],['单选 / 判断','与有效参考答案匹配','客观题即时确认'],['数值计算','解析小数、分数和百分数；比较绝对误差','不执行任意表达式'],['简答','按量规关键词提供建议和匹配依据','score=null、pending；教师复核后计分']], [84,260,126])
add('示例计算规则', 'h2')
add('精确率 P = TP / (TP + FP)；召回率 R = TP / (TP + FN)。示例要求0–1之间的小数，允许绝对误差0.001。输入50%与1/2均可解析为0.5；1/0或2+3不视为有效答案。')
add('简答建议的局限', 'h2')
add('关键词匹配无法理解否定、推理质量或替代表述。界面展示参考答案、评分点和实际匹配词，教师可以调整分值。待复核题不进入最终总分，确认均分只统计已复核答卷。')
add('知识点报告与补练', 'h2')
add('按目标汇总本次题目得分。低于70%的目标提供原题回练与解析；没有低分目标时选择相对最低目标巩固。它不是新题生成或经过校准的能力诊断。目标ID覆盖也不等于每项子技能充分覆盖。')
add('自动化演示学生：客观题65分，简答建议20分、测试确认18分，总分83/100。此数据只验证软件流程。', 'small')

section(6,'权限与安全边界','05 / 本地演示具备权限隔离，生产部署仍需补足')
table([['边界','本版实现'],['教师会话','密码登录，HttpOnly、SameSite=Strict Cookie，12小时有效'],['学生接口','仅题干/题型/分值/公式/选项；不返回答案/解析/量规/大纲'],['请求与输入','Host与变更请求Origin校验；请求体200KB限制；字段长度/题数限制；频率限制'],['存储与展示','参数化SQL、文本转义、CSP、静态路径限制、CSV公式前缀处理'],['模型密钥','仅服务端.env/环境变量读取；日志记哈希，不输出真实密钥']], [95,375])
add('本地范围', 'h2')
add('服务仅绑定127.0.0.1，当前学生链接用于本机演示。默认teacher-demo-2026密码会在本地提示，不能直接用于公网。数据库与.env均被Git忽略。')
add('尚未提供的生产能力', 'h2')
add('没有多教师账号、TLS、权限审计后台、备份恢复策略、防作弊或生产并发承诺。真实上线需独立密码、HTTPS、访问范围与数据保留策略，并进行额外安全及负载验证。')
add('不能把“隐藏教师按钮”当作权限控制；本版在服务端校验受保护API，匿名学生请求教师接口返回401。', 'small')

section(7,'实际测试与修复证据','06 / 12项自动化测试通过，另有浏览器全流程验收')
table([['验证范围','结果与说明'],['领域规则（10项）','默认蓝图、意图修改、分值/来源、模板边界、公式/选项、答案隔离、数值解析、待复核、缺省答案、固定种子：通过'],['模型契约（1项）','本地模拟接口验证消息结构、JSON、错误及无静默回退：通过；未调用真实供应商'],['HTTP闭环（1项）','认证、生成、编辑、发布隔离、提交、越界评分、复核、补练和重启持久化：通过'],['浏览器验收','Edge/Playwright实际九题作答与复核，7张截图；390px无横向溢出；无页面JS异常']], [114,356])
add('真实发生的中文路径Bug', 'h2')
add('首轮HTTP测试报“测试服务未就绪”。原因是用new URL(...).pathname取得中文目录路径，其百分号编码不能直接交给Node子进程。修复为标准库fileURLToPath(...)，重跑全流程通过。')
add('证据位置', 'h2')
add('05-测试与验证/核心与接口测试记录.txt、浏览器验收结果.json，以及02-开发过程记录/03-Bug修复记录.md。Git中保留了实际修改，不伪造当时的用户Prompt。')
add('验证限度', 'h2')
add('测试证明固定演示的工程行为。没有实际供应商调用、真实教师反馈、教学效果实验或效信度校准。不能把自动化测试昵称算作真实用户。')

section(8,'界面与用户体验','07 / 让教师看见生成依据，让学生专注作答')
image(ROOT/'09-使用说明/操作截图/04-考核蓝图.png',470,430)
story.append(Spacer(1,10)); add('图：真实浏览器中的考核蓝图。每个目标显示大纲来源，每行题型计划显示题数、单题分值、目标与认知层次。', 'small')
add('三步工作台与反馈', 'h2')
add('输入、蓝图、审核发布分步推进；请求中显示明确状态；失败后保留输入。逐题编辑提供公式预览，错误公式会被拒绝。学生提交后清楚区分客观题得分与待复核题。')
add('响应式布局', 'h2')
add('桌面使用侧栏、主面板和辅助提示；小屏改为单列与可滚动导航。已验收390px宽度，保留原始截图。浏览器截图是工程验收素材，不是正式演示MP4。')

section(9,'开发过程与可复现性','08 / 保留真实演进，区分确定性样例和模型随机性')
add('初始仓库在完整功能生成前建立，随后按领域核心、界面及资料提交。保留原始Git历史与bundle，不回填日期或补造历史。阶段摘要不能冒充用户发出的三个完整功能Prompt链。')
add('固定演示复现', 'h2')
add('固定大纲、蓝图、种子1、package-lock和本地公式库，可重现同一题目集合。种子变化影响数值题数据。Node.js 24+环境下，用启动脚本或npm.cmd start运行。')
table([['耗时参考','复现动作'],['0–2分钟','启动与教师登录，加载内置课程'],['2–4分钟','蓝图确认、生成、公式与题目编辑'],['4–7分钟','发布确认、学生九题作答'],['7–10分钟','教师复核、知识点统计、补练与导出']], [100,370])
add('时间边界与证据', 'h2')
add('Node安装、受网络影响的首次依赖安装和外部模型响应不保证在10分钟内。真实模型不承诺逐字一致，应记录供应商/版本、输入、输出与教师修改。事件哈希只能辅助核对，不替代原始结果。')
add('第三方声明', 'h2')
add('业务代码为本次从空目录开发；KaTeX及字体保留原许可并单独声明。没有直接包装完整开源测评平台。')

section(10,'局限、后续计划与提交状态','09 / 把未验证的部分明确留在待办中')
table([['当前边界','下一步'],['真实模型未实测','配置密钥，多大纲生成，保留供应商版本、原始输出及教师审核'],['没有真实教师试用','邀请教师，记录准备时间、题目修改率、错误与子技能覆盖'],['简答为关键词建议','研究语义评分，但始终保留教师复核和失效分析'],['模板和文本导入有限','扩展课程、题型数据与PDF/DOCX导入；验证质量后上线'],['本机链接不可公网访问','按最终要求部署，补足HTTPS、访问控制与运行验证'],['完整AI证据与视频未完成','导出原始对话；真实保留至少3链；录制5–8分钟1080p MP4、含至少2分钟AI过程']], [142,328])
add('试用测量口径', 'h2')
add('先进行小样本产品试用，测量准备时间（含模型等待及审核）、实质修改率、错误类型和目标覆盖。轮换任务顺序，不把不等价任务直接比较，不夸大学习成效。')
add('规则核实', 'h2')
add('用户提供的规则中，省赛反馈时间与国赛提交时间存在顺序冲突，国赛奖项比例也不一致。提交前核实最新官方通知。当前材料是v0.2本地交付，不是已满足全部比赛条件的最终包。')
add('素材来源：本次开发源码、用户提供赛事原文、实际本机测试与浏览器截图。所有未完成项如实标注。', 'small')

section(11,'v0.2 易用性迭代与说明书','10 / 2026-10-13 · 用户确认真实模型稍后配置')
table([['问题','本次改进'],['首页信息偏多','首页聚焦输入大纲与考核要求；主操作首屏可见'],['配置区挤占空间','目标依据、高级选项、打印导出按需展开'],['教师需要编辑JSON','简答评分改为要点、关键词与分值表单'],['刷新后进度丢失','输入与蓝图在标签页暂存；试卷通过ID恢复'],['重复编辑保存异常','校验失败时保留对象引用，修复后重新保存'],['缺少完整操作手册','27页PPT、文字版及22张真实操作截图']], [142,328])
add('验证口径', 'h2')
add('原有12项测试通过；另以独立浏览器上下文验证教师与学生全流程、102分错误计划、非法公式、简答分值校验、刷新恢复、权限隔离、CSV/JSON下载及390px布局。示例答卷客观题65分，教师确认简答18分，最终83分。')
add('截图与原始记录位于09-使用说明和05-测试与验证/v0.2-易用性验收.json。所有答卷都是隔离数据库内的自动化演示，没有计为真实师生试用。')
add('交付状态', 'h2')
add('真实模型按用户要求暂不配置。完整AI对话链、本人讲解MP4、评审访问权限和最新赛事规则核对仍需完成。本次远程Git检查发生联网组件崩溃，已停止，v0.2先以本地文件交付。')

def chrome(c, doc):
    c.saveState(); w,h=A4
    c.setFillColor(GREEN); c.rect(40,h-30,35,3,fill=1,stroke=0)
    c.setStrokeColor(LINE); c.line(40,42,w-40,42)
    c.setFillColor(MUTED); c.setFont('Chinese',8); c.drawString(40,28,'课纲智评 / v0.2技术报告 / 2026-10-13')
    c.drawRightString(w-40,28,f'{doc.page:02d}')
    c.restoreState()
output=ROOT/'03-技术文档/课纲智评-v0.2-技术文档.pdf'
doc=SimpleDocTemplate(str(output),pagesize=A4,rightMargin=60,leftMargin=60,topMargin=48,bottomMargin=58,title='课纲智评 v0.2技术文档',author='课纲智评项目',pageCompression=1)
doc.build(story,onFirstPage=chrome,onLaterPages=chrome)
print(str(output))
