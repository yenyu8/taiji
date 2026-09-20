# Programming Scene v0.1

编程场景展示 Code Editor、运行/测试结果、分级提示以及 Evidence。当前 Runner 接口为 `POST /api/run`，输入任务 ID、代码文本和提示级别，输出检查明细、Evidence 和 Progress。

当前实现是 **mock runner**：它不执行代码，只按学习包声明的简单文本条件检查。所有结果写成 `mock_test_result`，并标记 `verified: false`。真实代码执行必须迁移到隔离 Sandbox Service，限制文件、网络、权限和资源；绝不能在 FastAPI 主进程里执行用户代码。

## 当前工作台补充

新工作台通过浏览器 Pyodide 执行标准库 Python，编辑器为本地 Monaco。执行模块位于 apps/web/lib/python-runner.ts：opaque-origin iframe + Worker、局部资源 CSP、10 秒执行超时、主动停止。用户代码不进入 API 主进程。终端显示 stdout/stderr，调试页显示异常，不提供系统 Shell 或断点。

原 /api/run 继续保留 mock 语义。浏览器运行和模型评分暂不写入 Core 已验证 Evidence；未来通过隔离 Docker Runner 和真实测试形成证据闭环。
