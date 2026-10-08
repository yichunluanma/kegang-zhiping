# 实际Bug修复记录

## 问题

第一次运行HTTP端到端测试时，核心10项测试通过，但接口测试失败：

```text
HTTP端到端：认证、生成、编辑、发布隔离、提交、复核和持久化
Error: 测试服务未就绪
at ready (.../tests/http.test.mjs:14:180)
```

## 定位与修复

测试子进程通过new URL('../server.mjs', import.meta.url).pathname取得脚本路径。目录“01-应用源码”在URL中被百分号编码，不能直接作为Windows文件路径交给Node运行。

改为Node标准库fileURLToPath：

```javascript
import { fileURLToPath } from 'node:url';
const serverPath = fileURLToPath(new URL('../server.mjs', import.meta.url));
```

实际源码见01-应用源码/tests/http.test.mjs。该修复没有采用硬编码转义或改变中文目录。

## 验证

修复后HTTP测试完整走通认证、生成、非法公式拒绝、发布快照隔离、学生提交、越界评分拒绝、教师复核、补练和服务重启持久化。最终包含模型契约测试的12项测试全部通过；原始通过日志在05-测试与验证。

另在界面验收中验证：修改蓝图使总分变成102分时生成被拒绝；输入未知LaTeX命令时保存被拒绝。这是有意触发的验证，不是新的生产Bug。

## 2026-10-08：Windows启动入口故障与火绒兼容

用户反馈双击启动无反应，浏览器显示ERR_CONNECTION_REFUSED。实际执行原CMD后复现：`'01' is not recognized` 和 `'ll.exe' is not recognized`。文件字节检查确认使用LF换行；修正为CRLF后原入口能启动服务。

随后后台启动调整中的start.ps1出现无法读取、文件被移除的情况；用户明确反馈火绒识别该文件为病毒并清理。未取得火绒的具体告警名或扫描报告，因此不对检测性质作确定判断，也未修改防护设置。

最终移除start.ps1、open-preview.ps1和stop.ps1，CMD直接调用Node.js标准进程接口。后台服务就绪后打开浏览器，错误时CMD保留提示；日志写入data/server.log与server-error.log。增加停止CMD：使用启动时随机生成的本地令牌请求服务关闭，不通过脚本搜索或强制结束系统进程。令牌状态文件不进入交付包或Git。

验证包含真实CMD启动、重复启动、停止、重新启动，首页HTTP 200和浏览器教师登录；接口测试增加无效停止令牌拒绝与有效令牌安全停止。离线包验收改为执行包内真实CMD入口，不再仅直接运行server.mjs。
