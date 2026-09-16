# Taiji Core v0.1 Demo

一个开源、模块化的学习底座 Demo。当前只加载官方 Agent Developer 学习包，展示“目标 → 能力 → 编程任务 → 模拟测试 → 学习证据 → 学习状态”的最小闭环。

## 启动

推荐使用 Docker Compose：

```bash
docker compose up --build
```

打开 <http://localhost:3000>。FastAPI 文档在 <http://localhost:8000/docs>。

本机开发：

```bash
# 终端 1：在仓库根目录
python -m venv .venv
.venv\Scripts\activate
pip install -r apps/api/requirements.txt
$env:PYTHONPATH="apps/api"
python -m uvicorn taiji_api.main:app --reload --port 8000

# 终端 2：在 apps/web 目录
npm install
npm run dev
```

macOS/Linux 将虚拟环境激活命令改为 `source .venv/bin/activate`，并用 `export PYTHONPATH=apps/api`。前端 API 地址可通过 `NEXT_PUBLIC_API_URL` 设置。

## 体验流程

1. 点击“一键加载官方学习包”。
2. 在编程场景中编辑 `weather_tool(city)`，点击“运行 / 测试”。
3. 查看明确标记为 **mock** 的检查结果、Evidence 和 Progress。
4. 切换专家模式，查看或编辑同一份声明式学习包计划。保存后普通模式也会读取新配置。

## 架构与关键文件

| 路径 | 作用 |
| --- | --- |
| `docs/architecture/Taiji_Core_v0.1_技术设计文档.docx` 和同名 `.md` | 原始技术设计文档及 Git 可读版，作为设计依据 |
| `docs/specs/` | 当前 Demo 的模型、Mod、事件和编程场景规范 |
| `apps/api/taiji_api/models.py` | Goal、Skill、Task、Scene、Component、Evidence、Progress 模型 |
| `apps/api/taiji_api/loader.py` | 只读 YAML 并验证声明，不加载 Mod 代码 |
| `apps/api/taiji_api/main.py` | FastAPI 接口和 mock runner |
| `apps/api/taiji_api/storage.py`、`apps/api/alembic/` | SQLAlchemy 数据层与 Alembic 迁移 |
| `mods/agent-developer/` | 官方 Agent Developer Starter 学习包 |
| `packages/core-schemas/mod-manifest.schema.json` | 学习包 manifest 结构校验 |
| `apps/web/app/page.tsx` | Next.js 演示页面 |

Core 不识别 Python 等具体学科；官方学习包定义内容，编程场景提供编辑器和 mock 检查。第三方 Mod 当前没有安装入口、主进程权限或代码执行能力。

## 当前限制

- **代码不会被执行。** Mock runner 只做简单文本检查，`mock_passed` 不代表能力已被真实验证。
- AI Tutor 当前提供静态分级提示，占位于未来的 LLM Provider 接口。
- 只有一个官方学习包、一个任务；没有完整学习路线、实时流、RAG 或云端多租户。
- SQLite 用于本地 Demo；首次访问数据时自动运行 Alembic 迁移。
- 开源许可证暂采用 Apache-2.0；正式公开发布前仍应按设计文档复核。

## 下一步

按设计文档的顺序，先完善 Core/Mod/Event 规范与迁移策略，再实现隔离的 Python Workspace Sandbox、真实测试、Evidence evaluator，以及可替换的 LLM Provider。真实沙箱接入前，不应把用户代码送入 API 主进程执行。

## 检查

```bash
$env:PYTHONPATH="apps/api"
python -m pytest apps/api/tests -q
cd apps/web
npm run build
```
