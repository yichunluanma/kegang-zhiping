# 使用说明文件

直接用 PowerPoint 或 WPS 打开课纲智评-v0.2-图文使用说明.pptx，共27页。每页备注补充操作细节；同目录另附文字版及22张原始操作截图。

截图来自独立测试数据库；3211是截图验收端口，日常启动默认3210。所有示例昵称、答卷与分数均为演示数据，不是真实教学试用。

build-manual.mjs为可编辑生成源，使用Codex自带@oai/artifact-tool（不是应用运行依赖）。再生成时需准备该包、设置PRESENTATION_SKILL_DIR、CODEX_RUNTIME_DEPENDENCIES、RUNTIME_NODE_MODULES；保留旧PPT并改用新的输出文件名和校验回执路径，避免覆盖。应用本身仅需Node.js与package-lock固定的依赖，不需要此生成环境。
