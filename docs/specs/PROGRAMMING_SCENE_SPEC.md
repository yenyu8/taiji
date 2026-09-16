# Programming Scene v0.1

编程场景展示 Code Editor、运行/测试结果、分级提示以及 Evidence。当前 Runner 接口为 `POST /api/run`，输入任务 ID、代码文本和提示级别，输出检查明细、Evidence 和 Progress。

当前实现是 **mock runner**：它不执行代码，只按学习包声明的简单文本条件检查。所有结果写成 `mock_test_result`，并标记 `verified: false`。真实代码执行必须迁移到隔离 Sandbox Service，限制文件、网络、权限和资源；绝不能在 FastAPI 主进程里执行用户代码。
