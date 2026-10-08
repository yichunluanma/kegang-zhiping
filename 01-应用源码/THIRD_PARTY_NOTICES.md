# 第三方依赖说明

本项目业务代码为本次从空目录开发的原创实现；未复制完整开源测评平台。

KaTeX 0.16.22 用于公式解析与渲染，许可证为 MIT。前端分发文件位于 public/vendor/katex，锁定依赖记录位于 package-lock.json。KaTeX字体的许可说明见下方一并保留的原始LICENSE文件。

Node.js 为运行环境，SQLite由Node.js内置模块提供。Playwright仅用于开发阶段浏览器验收，不是应用运行依赖。ReportLab和PDF渲染器仅用于技术文档制作，不是应用运行依赖。

参赛原创性说明应区分原创业务逻辑与明确声明的通用库；不得声称公式渲染库由参赛者原创。
