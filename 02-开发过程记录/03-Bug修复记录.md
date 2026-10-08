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
