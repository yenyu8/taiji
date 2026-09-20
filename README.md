# 太极 · AI 学习工作台

Next.js + TypeScript / FastAPI + Python 本地 Demo，流程：接入模型 → 学习信息 → 学习路线 → 学习工作台。

## Windows 启动

需要 Python 3.12+、Node.js 20.9+。在仓库根目录打开 PowerShell：

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r apps/api/requirements.txt
$env:PYTHONPATH="apps/api"
.venv\Scripts\python.exe -m uvicorn taiji_api.main:app --host 127.0.0.1 --port 8000
```

另开一个 PowerShell，在仓库根目录启动前端：

```powershell
cd apps/web
npm ci
npm run dev
```

打开 http://127.0.0.1:3000 。接口文档：http://127.0.0.1:8000/docs 。两个终端保持运行，下次可跳过创建虚拟环境和安装依赖。若 python 打开商店，请使用已安装 Python 的完整路径。

生产预览在 apps/web 执行 `npm run build`，然后 `npm start`，后端仍需运行。代理默认 http://127.0.0.1:8000，自定义 TAIJI_API_URL 需在构建前设置。构建会复制本地 Monaco/Pyodide 资源，运行无需 CDN。

也提供 `docker compose up --build`，但本次未验证 Docker。容器访问宿主机 Ollama 可使用 http://host.docker.internal:11434/v1 。

## 体验流程

1. 下拉选择 API Key 所属平台，粘贴密钥；太极自动读取模型列表并选中一个，可下拉更换。点击「连接并继续」验证成功后进入学习设置。平台地址自动填写，高级设置中可修改地址或手动填写模型。切换平台会清空密钥，修改地址后也需重新粘贴，避免误发。测试会真实请求模型，可能产生费用。
2. 填写目标、基础和每周时间，生成路线。模型生成 JSON 后再次复核，服务端检查结构、阶段、前置依赖和循环。也可加载离线官方示例。
3. 进入学习工作台，点击「生成本节教程」。教程代码块可复制，右侧 Monaco 可编辑代码。
4. 写入带 print(...) 的 Python 并运行，查看真实输出或异常。支持停止，执行超过 10 秒终止。
5. 鼠标选中代码，点击「询问选中代码」或编辑器右键菜单，输入问题发送。模型接收当前教程、代码、选中片段及与当前代码匹配的最近运行结果。
6. 「提交 AI 评估」请求建议性评分，不会自动成为已验证能力证据。
7. 自动保存/导出包含路线、教程、代码和完成标记。支持导入太极学习文件、Learn Everything 路线包及原始 roadmap JSON。

密钥仅在当前页面内存中，刷新需重填，不写入本地保存或导出文件。目标与代码会发送到填写的模型服务。

## 关键文件

| 路径 | 作用 |
| --- | --- |
| docs/architecture/ | 原始设计文档与路线参考说明 |
| apps/api/taiji_api/models.py | Goal、Skill、Task、Scene、Component、Evidence、Progress |
| apps/api/taiji_api/loader.py | 声明式 Mod 加载，不执行 Mod 代码 |
| mods/agent-developer/ | 官方学习包 |
| apps/api/taiji_api/ai.py | 模型适配、路线生成复核、教程、聊天 |
| apps/api/taiji_api/storage.py、apps/api/alembic/ | SQLite 和迁移 |
| apps/web/app/page.tsx | 四阶段工作台 |
| apps/web/app/components/CodeEditor.tsx | Monaco 与选中代码提问 |
| apps/web/lib/learning-plan.ts | 路线导入校验、字段白名单导出 |
| apps/web/lib/python-runner.ts | 浏览器 Python、停止和超时 |

Core 不按 Python 等学科分支，编程功能属于场景组件。第三方 Mod 只有声明数据，没有 Core 主进程权限。旧 POST /api/run 仍为明确标记的 mock runner，保留未来 Docker 接口；新工作台使用浏览器 Python。

## 当前限制与验证范围

- 需要 Chat Completions 兼容接口，并非所有厂商原生 API 都可直接连接；暂无流式输出。
- Python 支持标准库小练习，每次运行独立；无宿主机文件、进程、任意网络或 pip 安装。终端不是系统 Shell，无交互断点，也没有严格内存配额。
- 工作台路线与完成状态保存在浏览器/学习文件，尚未连接完整 Core Evidence/Progress 闭环。AI 复核不等于人工审核或真实测试。
- 本地 Demo 无登录/多租户隔离，不应直接公开部署。
- 自动化覆盖模拟模型服务、路线导入、Python 执行、运行消息及停止/超时；生产构建与本地 HTTP 已检查。没有真实用户 API Key，未验证供应商账号；浏览器控制工具故障，尚未完成页面点击和浏览器隔离策略验收。

## API Key 快速测试

在接入页面把 API Key 粘贴到输入框后，直接点击旁边的「测试 API」。它只请求平台的 `/models` 列表来验证密钥和接口，不要求先选模型，也不会生成路线或教程；成功会显示可用模型并自动选第一个，失败显示平台返回的可处理提示。这个测试只读取模型列表，不调用文本生成；当前本地 Token 估算不统计此请求。列表读取成功不代表模型生成一定可用。

## 模型用量保护

后端提供 `/api/ai/usage` 用量状态。默认每个进程每日估算上限 60,000 Token，单次请求上下文加输出上限 12,000 Token；计数按 UTC 日期滚动，服务重启会重置。每次模型请求发送前检查预算，成功后按返回文本长度估算输出；达到上限直接返回提示，不自动重试。页面每 5 秒刷新今日估算用量。估算不是服务商账单，输入、输出和价格以服务商为准；请同时设置服务商侧消费上限。

连接测试会调用模型并进入本地估算；模型列表读取不调用文本生成，也不进入当前 Token 计数。路线最多有生成/复核/可选修正的既定调用次数；教程单次请求；聊天按单次请求。已发送到服务商的请求无法撤回或退款。

## 检查

```powershell
$env:PYTHONPATH="apps/api"
.venv\Scripts\python.exe -m pytest apps/api/tests -q
cd apps/web
npm test
npm run build
```

下一步：浏览器交互验收、真实供应商兼容验证、Docker Runner 与真实测试证据，再接学习进度闭环。许可证 Apache-2.0，发布前检查依赖许可。

## 路线生成 v0.3

新增逐节学习成果、实践任务、完成标准和预计时间；生成后程序校验并由AI复核。支持一次自动格式修复，复核失败会保留并标注初稿。可填写补充偏好或调整意见，新路线先预览再采用，并备份上一版。详见 docs/MODEL_ROADMAP_MILESTONE.md。
