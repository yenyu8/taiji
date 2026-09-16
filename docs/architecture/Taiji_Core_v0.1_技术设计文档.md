元学 · Taiji Core

太极内核 v0.1 技术设计文档

开源 · AI-native · Mod 化的通用学习底座

开发基线草案 · 2026-09-16

核心定义：Taiji Core 不规定唯一学习方法，而是用统一协议把目标、能力、任务、场景、组件、学习证据和 AI 调度串起来，让不同领域像“给学习装 Mod”一样扩展。

## 0. 这份文档是干什么的

这不是“功能愿望清单”，而是后续开发的技术宪法。任何新功能进入项目之前，都要回答三个问题：

1. 它是否符合本文的核心边界？

2. 它应该属于 Core（核心底座）、Mod（学习模组）还是 Service（外部能力服务）？

3. 它是否破坏了开放性、可替换性、安全性或后向兼容性？

如果答案不清楚，先写 RFC（Request for Comments，设计提案）再动代码。

### 0.1 一句话定义

Taiji Core 是一个开放的学习运行时：它不负责规定世界上唯一正确的学习方式，而是用统一协议把目标、能力、任务、学习场景、组件、学习证据与 AI 调度串起来，让不同领域可以像给游戏装 Mod 一样安装自己的学习方式。

### 0.2 名词先解释

Core（核心）：所有学习领域共同使用的底层能力。

Mod（模组）：可安装、可卸载、可替换的学习扩展。类似游戏 Mod。

Scene（场景）：用户真正练习的环境，例如“编程训练场”“英语对话场”。

Component（组件）：场景里的零件，例如代码编辑器、测试器、语音输入、动态图表。

Runtime（运行时）：负责把组件、数据、AI 和执行环境真正跑起来的那一层。

Evidence（学习证据）：系统判断“你会不会”的依据，例如测试通过率、独立完成度、提示次数、迁移任务结果。

API（应用程序接口）：不同模块互相说话的统一规则。

Schema（数据结构规范）：规定一个 JSON/YAML 文件必须有哪些字段、字段是什么类型。

## 1. 愿景、边界与非目标

### 1.1 愿景

长期目标是形成“学习领域的 Linux”：

Core 提供稳定底座和协议；

官方维护少量高质量基础组件和示范 Mod；

社区可以创建新的学习包、场景、评测器和组件；

普通用户一键安装，高级用户可以自由组合和修改；

AI 不只是聊天框，而是参与规划、调度、反馈和个性化。

### 1.2 v0.1 只验证一件事

一个编程基础较弱的人，能否在 Taiji 中通过“任务 -> 写代码 -> 运行 -> 测试 -> 提示 -> 再练 -> 留下证据”的闭环，逐渐获得独立开发 Agent 应用的能力。

### 1.3 v0.1 明确不做

不做“全学科平台”。

不做社区商店、支付、排行榜。

不做多人协作和学校 SaaS。

不做 Kubernetes、Kafka、复杂微服务。

不承诺 AI 自动生成的路线就是“世界最优路线”。

不允许未经隔离的第三方 Mod 在主进程里任意执行代码。

不先造一套新的大模型框架；能适配现有模型接口就不重复造轮子。

## 2. 核心设计原则（以后开发不能轻易违反）

### P1. 学习证据优先，而不是“看完课程优先”

系统的核心状态不是“第几课学完了”，而是“什么能力被什么证据支持”。

### P2. AI 可以提出建议，但不能天然成为真相来源

AI 可以生成初始路线、解释、提示和候选任务；但是“路线质量”“是否掌握”“是否可以跳级”必须允许由规则、测试、专家包和真实证据共同决定。

### P3. Core 不懂具体学科

Core 只理解 Goal、Skill、Task、Scene、Component、Evidence 等通用概念。Python、英语口语、微积分应该由 Mod 描述。

### P4. 声明式优先，代码扩展其次

能用配置表达的 Mod 就不要要求执行第三方代码。所谓“声明式”，就是 Mod 先通过 JSON/YAML 说明“我要什么”，而不是直接往核心里塞代码。

### P5. 一键模式和专家模式必须共用同一套底层

普通用户加载 Preset（预设方案）；高级用户编辑同一份配置。禁止维护两套实现。

### P6. 本地优先可运行，云端以后增强

v0.1 要保证普通开发者能在自己的电脑启动。不能因为未来可能做大，就让第一版依赖一堆云服务。

### P7. 可替换，而不是绑定供应商

模型、数据库、沙箱、对象存储、向量检索都通过接口连接。任何一家厂商都不能成为不可替换的“地基”。

### P8. 安全边界从第一天存在

尤其是“执行用户代码”和“第三方 Mod”两件事，必须默认不可信。

### P9. 兼容性优先于炫技

公开协议一旦发布，修改必须考虑旧 Mod。版本升级必须有迁移策略。

### P10. 少做魔法，多留可解释记录

路线为什么变化、能力为什么升级、AI 为什么给这个提示，都应该尽量有记录可追踪。

## 3. 总体架构

┌───────────────────────────────────────────────┐
│                  Web / Desktop                │
│        用户界面、路线、训练场、设置            │
├───────────────────────────────────────────────┤
│                 Taiji Core API                │
│  Goal / Skill / Task / Evidence / Progress    │
│  学习计划 / Mod 管理 / 权限 / 事件              │
├───────────────────────────────────────────────┤
│                 Mod Runtime                   │
│  Learning Pack / Scene / Component / Evaluator│
├───────────────────────────────────────────────┤
│               Capability Services             │
│  LLM / Sandbox / RAG / Files / Voice / Search │
├───────────────────────────────────────────────┤
│                    Data                       │
│       SQLite/PostgreSQL + Files/S3-like       │
└───────────────────────────────────────────────┘

解释：

Web / Desktop：用户看见并操作的界面。

Core API：真正的“太极内核”，保存学习状态并决定模块如何协作。

Mod Runtime：负责加载学习 Mod，并检查版本、依赖和权限。

Capability Services：提供具体能力，例如调用大模型、跑 Python、检索资料。

Data：数据库和文件。

重要边界：RAG（检索增强生成，简单理解为“让 AI 从资料库查资料再回答”）只是一个可选能力，不是 Core。

## 4. 推荐技术栈

### 4.1 总体选择

| 层 | 推荐 | 为什么 | v0.1 决策 |

| --- | --- | --- | --- |

| 前端 | Next.js + React + TypeScript | 生态成熟、组件化强、适合复杂交互 | 采用 |

| UI 样式 | Tailwind CSS；组件库可选 | 开发快，但不锁死 UI 库 | 采用 Tailwind |

| 代码编辑器 | Monaco Editor | VS Code 同源编辑器，适合编程训练场 | 采用 |

| 后端 API | FastAPI + Python | AI/数据/教育逻辑生态好，自动生成 API 文档 | 采用 |

| 数据校验 | Pydantic | 用 Python 类型定义并校验 API / Mod 数据 | 采用 |

| ORM | SQLAlchemy 2 + Alembic | ORM 管数据库对象；Alembic 做数据库升级迁移 | 采用 |

| 本地数据库 | SQLite | 单机零配置，适合一键启动 | 采用 |

| 服务端数据库 | PostgreSQL | 稳定、开源、JSONB 适合扩展字段 | 预留 |

| Mod 描述格式 | YAML/JSON + JSON Schema | 人可读、机器可验证、跨语言 | 采用 |

| API 标准 | HTTP + OpenAPI | 开放、工具生态成熟 | 采用 |

| 实时事件 | WebSocket 或 SSE | 运行代码、AI 输出、测试结果需要流式返回 | 按场景采用 |

| Python 浏览器执行 | Pyodide（可选） | WebAssembly 沙箱内运行简单 Python | 实验性 |

| 完整代码运行 | 隔离容器 Sandbox Service | 支持文件、依赖、测试、真实工程 | v0.1 本地采用 |

| 包管理 | Python: uv；前端: pnpm | 快、锁文件清晰 | 采用 |

| 测试 | pytest + Vitest/Playwright | 后端单测、前端单测、端到端测试 | 采用 |

| 日志/观测 | 结构化日志；后续 OpenTelemetry | 先简单，未来可以统一追踪 | 分阶段 |

| 部署 | Docker Compose | 一条命令拉起开发/自托管环境 | 采用 |

### 4.2 为什么不是 Gradio 继续堆

Gradio 很适合快速 AI Demo，但 Taiji 需要：复杂 IDE 布局、组件生命周期、Mod 动态加载、权限、状态管理、长期可维护的 Web UI。v0.1 可以借鉴 Learn Everything 的学习模型，但新底座不应继续把 Gradio 当长期 UI 地基。

### 4.3 为什么前后端分开

前端负责“体验”，后端负责“学习状态和规则”。这样以后可以有 Web、桌面端、移动端，而不必重写学习内核。

## 5. Taiji Core 的核心数据模型

### 5.1 Learner：学习者

保存用户身份、偏好以及长期能力画像。Core 不应该把“能力”绑死在某一门课程里。

### 5.2 Goal：目标

描述“最终想达到什么”。例如：“12 周后独立完成一个可部署的 Agent 应用”。

关键字段建议：

id

title

description

target_date（可选）

constraints（时间、设备、预算等）

success_criteria（成功标准）

### 5.3 Skill：能力

真正可以成长和被验证的能力，例如“独立编写 Python 函数”“调用 HTTP API”“调试异常”。

不要把 Skill 等同于“课程章节”。

### 5.4 Task：任务

用户实际要完成的练习。例如：“不看答案实现一个 weather_tool() 并通过 5 个测试”。

### 5.5 Scene：学习场景

组织一次学习体验的环境。例如编程 Scene 会组合编辑器、终端、测试器、AI Tutor。

### 5.6 Component：组件

可复用 UI 或能力零件。例如 CodeEditor、Terminal、TestPanel、HintPanel。

### 5.7 Evidence：学习证据（最重要）

Evidence 不是分数本身，而是“发生了什么、结果如何”。

例子：

{
  "type": "code_test_result",
  "skill_id": "python.function.basic",
  "task_id": "task.weather_tool.01",
  "result": {
    "passed": 4,
    "total": 5,
    "hints_used": 2,
    "duration_sec": 812
  }
}

之后由 Evaluator（评估器）解释这些证据意味着什么。

### 5.8 Progress / SkillState：学习状态

它是 Evidence 的“汇总结果”，不是原始事实。必须能追溯到 Evidence。

### 5.9 LearningPlan：学习计划

LearningPlan 是动态视图，不是不可改变的圣旨。它引用 Goal、Skill 和 Task，并记录“为什么这样排”。

## 6. Mod 系统：像给学习加 Mod

### 6.1 Mod 类型

第一版定义四类即可：

1. Learning Pack（学习包）：描述某个目标需要哪些 Skill、Task、路线和资源。

2. Scene Mod（场景模组）：定义学习界面和组件组合。

3. Component Mod（组件模组）：提供单个能力或界面组件。

4. Evaluator Mod（评估模组）：把 Evidence 转换成能力判断。

以后再加 Importer、Exporter、Provider，不提前做。

### 6.2 一个 Mod 最少要有 manifest

manifest 就像 Mod 的身份证。

建议格式：

id: org.taiji.agent-developer
name: Agent Developer Starter
version: 0.1.0
kind: learning-pack
core_api: ">=0.1,<0.2"
license: Apache-2.0

permissions:
  - llm.chat
  - sandbox.python
  - files.workspace

dependencies:
  scenes:
    - org.taiji.scene.programming@^0.1
  evaluators:
    - org.taiji.eval.code-task@^0.1

entrypoints:
  plan: plan.yaml
  skills: skills.yaml
  tasks: tasks/

### 6.3 关键原则：第三方 Mod 默认不能在 Core 进程执行任意 Python

优先级：

1. 配置文件即可表达 -> 只加载配置。

2. 需要 UI -> 沙箱化前端组件 / 受控扩展接口。

3. 需要执行代码 -> 独立进程或容器，通过 API 通信。

禁止“pip install 一个 Mod，然后 import 它到 Core 主进程，给它全部权限”成为默认方式。

### 6.4 版本与兼容

使用 Semantic Versioning（语义化版本）：主版本.次版本.修订版本。

0.1.3 -> 0.1.4：修 bug，不破坏协议。

0.1 -> 0.2：可新增能力；0.x 阶段仍允许谨慎调整。

1.x -> 2.x：可能有破坏性变化，必须提供迁移说明。

## 7. 事件系统：让组件彼此解耦

不要让 TestRunner 直接调用 Tutor，再让 Tutor 直接修改 Skill。它们应该通过标准事件协作。

例子：

code.changed
        ↓
code.run.requested
        ↓
code.run.completed
        ↓
test.completed
        ↓
evidence.recorded
        ↓
skill.evaluated
        ↓
plan.updated

推荐 v0.1 做法：进程内 Typed Event Dispatcher（带类型的事件分发器） + 数据库事件记录。

暂时不要上 Kafka/RabbitMQ。以后真正拆成多服务时，可以把同一事件协议映射到消息队列。

每个重要事件至少包含：

event_id

event_type

schema_version

timestamp

learner_id

session_id

source

payload

## 8. 路线质量：禁止“LLM 一句话生成最佳路线”

### 8.1 路线必须有 Provenance（来源记录）

每条官方或社区学习路线应该记录：

维护者是谁；

适用对象；

目标是什么；

参考了哪些课程/文档/岗位要求/专家意见；

哪些部分由 AI 建议；

哪些部分经过人工审核；

版本历史；

有什么真实效果数据（如果有）。

### 8.2 AI 的正确位置

AI 可以：

从成熟模板中根据用户背景删减；

提议补充 Skill；

生成练习变体；

根据 Evidence 调整下一步任务；

解释错误和给分级提示。

AI 不应：

无证据地宣称路线“最快/最好”；

自己出题、自己判分、自己宣布用户掌握且没有独立规则；

静默修改核心能力图谱而不留下记录。

### 8.3 Generator 和 Evaluator 分离

Generator（生成器）负责提出内容；Evaluator（评估器）负责判断结果。二者尽量不要由同一个 Prompt 一把梭。

编程场景优先使用确定性证据：单元测试、静态检查、运行结果。LLM 只评估机器难以确定的部分。

## 9. 普通用户模式 vs 专家模式

### 9.1 普通用户

用户选择：

我要学 Agent 开发

系统自动：

1. 安装官方 Agent Developer Learning Pack；

2. 检查 Python / Docker 等运行能力；

3. 创建 Workspace；

4. 加载 Programming Scene；

5. 进入第一项任务。

用户不需要理解 manifest、Docker、JSON Schema。

### 9.2 专家用户

可以查看和修改：

Skill Graph

LearningPlan

Component 组合

LLM Provider

Evaluator

Sandbox 配置

权限

两种模式读取的是同一套配置，只是 UI 暴露程度不同。

## 10. 编程 Scene v0.1

### 必须组件

Code Editor：Monaco Editor。

File Explorer：当前学习 Workspace 文件。

Run：运行代码。

Test Runner：执行自动测试。

Terminal：受限终端。

AI Tutor：分级提示，不默认直接给完整答案。

Evidence Collector：收集测试、运行、提示、时间等学习证据。

### 分级提示策略

建议统一 0-5 级：

0：不给提示。

1：指出错误类别。

2：指出检查区域。

3：给思路/伪代码。

4：给局部代码。

5：给完整参考答案，并标记此次任务不能作为“独立完成”证据。

## 11. 代码执行与 Sandbox 安全

这是整个项目最不能草率的一块。

### 11.1 两级执行环境

A. Browser Sandbox（浏览器沙箱）

适合简单 Python、小练习，可使用 Pyodide。优点是用户代码在浏览器 WebAssembly 环境里运行，服务端风险低。缺点是系统包、网络、真实 CLI 和复杂依赖受限。

B. Workspace Sandbox（工作区沙箱）

用于真实 Agent 项目。v0.1 本地版可以通过 Docker 启动隔离容器。

### 11.2 云端不能把“普通 Docker 容器”当绝对安全边界

未来多租户云服务执行陌生用户代码时，需要更强隔离方案（例如额外的用户命名空间、seccomp、无特权容器，甚至 gVisor/Firecracker 一类更强沙箱）。这一阶段单独设计，不能直接复用“本地开发 Docker = 云端安全”的假设。

### 11.3 默认权限

用户代码默认：

无宿主机文件访问；

无 Docker Socket；

无 root；

网络默认关闭或按域名白名单；

CPU/内存/执行时间有限额；

API Key 不直接写进用户文件；

每次任务可以销毁并重建环境。

## 12. LLM 层怎么设计

不要在业务代码里到处写 openai.chat...。

定义统一 LLMProvider 接口，例如：

chat(messages, options)
stream(messages, options)
structured_output(schema, messages)

支持：

OpenAI-compatible 接口；

其他厂商 Adapter（适配器）；

本地模型 Adapter。

Core 只依赖接口，不依赖具体厂商。

同时记录：

使用的 provider/model；

prompt/template 版本；

token / latency（延迟）等运行信息；

关键 AI 决策的输入和输出摘要（注意隐私）。

## 13. 数据与存储

### 13.1 v0.1

SQLite：结构化数据。

本地文件系统：Workspace、资源、导出文件。

### 13.2 服务端

PostgreSQL：主数据库。

S3-compatible Object Storage：对象存储，意思是用统一 S3 接口存文件，可选择 MinIO 或云厂商。

### 13.3 JSONB 的用途

PostgreSQL 的 JSONB 适合保存扩展字段，但核心查询字段不要全部塞进 JSONB。例如 Skill ID、Task ID、Evidence type、时间戳必须有明确字段和索引。

## 14. 项目仓库建议

taiji/
├── apps/
│   ├── web/                 # Next.js 用户界面
│   └── api/                 # FastAPI Core API
├── packages/
│   ├── core-schemas/        # Mod、Event、核心对象 JSON Schema
│   ├── mod-sdk-ts/          # TypeScript Mod SDK
│   └── ui-components/       # 官方 UI 基础组件
├── python/
│   ├── taiji-core/          # 核心领域逻辑
│   └── mod-sdk/             # Python SDK
├── services/
│   └── sandbox/             # 代码执行服务
├── mods/
│   └── agent-developer/     # 第一个官方学习 Mod
├── docs/
│   ├── architecture/
│   ├── specs/
│   ├── adr/                 # Architecture Decision Record，架构决策记录
│   └── rfc/                 # 新设计提案
├── examples/
└── docker-compose.yml

注意：目录是边界，不是为了“显得专业”。v0.1 没代码的目录不要全部空建。

## 15. 开源策略

### 15.1 原则

公开协议、Schema、核心代码和官方基础 Mod。

用户学习数据可导出。

不用自定义“假开源许可证”。

商业化未来可以来自托管、算力、高级服务、企业管理、高质量官方内容，而不是必须靠锁死用户数据。

### 15.2 许可证建议（暂定）

Apache-2.0 作为 v0.1 首选：允许商业使用和二次开发，同时包含明确的专利授权条款，适合建立生态。

这是暂定决策。正式公开前再次评估 Apache-2.0、AGPL-3.0 等方案；但不要自创限制商业用途的许可证然后仍然声称“开源”。

### 15.3 贡献治理

至少准备：

LICENSE

CONTRIBUTING.md

CODE_OF_CONDUCT.md

SECURITY.md

CHANGELOG.md

Mod Spec 文档

Issue / RFC 模板

## 16. 开发基本方针

### Rule 1. Core 中禁止出现 `if subject == "python"`

一旦核心代码开始识别具体学科名，通常说明边界坏了。

### Rule 2. 新能力先问“能不能做成 Mod”

只有多个领域都必须依赖的能力，才考虑进入 Core。

### Rule 3. Evidence 不可被结果覆盖

原始学习证据要保留。SkillState 可以重新计算。

### Rule 4. 公共结构必须有 Schema 和版本号

Mod、Event、Evidence payload 等对外结构必须可验证。

### Rule 5. AI 输出一律不默认可信

所有结构化 AI 输出都要校验；关键动作要有失败降级。

### Rule 6. 数据库修改必须有 migration

Migration（迁移）就是让旧数据库安全升级到新结构。禁止“删库重来”作为正常升级方案。

### Rule 7. 核心逻辑必须可测试，不依赖 UI

规划、能力更新、Evidence 处理必须能在无浏览器情况下跑测试。

### Rule 8. 先做单体模块化，不提前做微服务

“模块化单体”指一个后端进程，但内部边界清楚。等真实扩展压力出现再拆服务。

### Rule 9. 可观测

关键任务至少有日志、错误码、request/session/event ID，不能出错后只能靠猜。

### Rule 10. 每一个“智能”功能必须有非智能退路

模型接口挂了时，系统至少还能打开学习包、查看任务、运行已有测试。

## 17. 避雷清单

### 雷 1：一开始做“万能学习平台”

结果：每个领域都浅，底座没验证。

规避：只拿 Agent 编程场景验证 Core。

### 雷 2：AI 生成 = 高质量

结果：路线看似完整，实际缺前置、错难度、无法验证。

规避：路线来源、审核、版本、证据、独立 Evaluator。

### 雷 3：为了插件化，把所有东西都抽象成插件

结果：代码难看懂、调试困难。

规避：先定义少量稳定扩展点。真正有第二个实现时再抽象。

### 雷 4：第三方插件直接 import 进主进程

结果：一个坏 Mod 可以读数据、删文件、拖死服务。

规避：声明式优先；需要代码时隔离执行。

### 雷 5：Docker = 完全安全

结果：未来云端执行不可信代码留下严重风险。

规避：本地 Docker 和云端多租户沙箱是两套威胁模型。

### 雷 6：把 RAG 当学习系统核心

结果：最后变成“会查资料的聊天机器人”。

规避：RAG 只是 Capability Service。

### 雷 7：所有状态都存成一个大 JSON

结果：后期无法查询、统计、迁移。

规避：核心对象结构化；灵活扩展字段才用 JSON。

### 雷 8：过早微服务/Kubernetes/Kafka

结果：一个人维护基础设施而不是做产品。

规避：模块化单体 + Docker Compose。

### 雷 9：为了“AI-native”让 AI 控制一切

结果：不可预测、不可测试、贵。

规避：AI 负责不确定部分，确定性规则负责确定部分。

### 雷 10：核心协议天天改

结果：社区 Mod 全坏。

规避：Schema Version + SemVer + Deprecated（废弃期）+ migration。

### 雷 11：把学习时间当学习效果

规避：时间只是行为数据，不能直接等于能力。

### 雷 12：AI Tutor 太热心

结果：用户每次卡住都得到完整答案，形成“复制能力”。

规避：分级提示，完整答案会降低 Evidence 权重。

## 18. v0.1 最小可交付范围

### 必须有

1. 创建 Goal。

2. 安装官方 agent-developer Learning Pack。

3. 展示 Skill / Task 路线。

4. Programming Scene。

5. Monaco 编辑器。

6. Python Workspace Sandbox。

7. Run + Test。

8. AI Tutor 分级提示。

9. 记录 Evidence。

10. 根据 Evidence 更新至少 1 种 SkillState。

11. Mod manifest 校验和版本检查。

12. 本地 Docker Compose 一键启动。

### 可以没有

社区市场。

英语 / 数学 Mod。

手机端。

多租户。

付费。

复杂 RAG。

向量数据库。

Redis。

消息队列。

Kubernetes。

## 19. v0.1 验收标准

以下闭环完整跑通，才叫“底座成立”：

安装 Agent 学习包
        ↓
系统创建学习目标与 Skill
        ↓
打开一个编程 Task
        ↓
用户写代码
        ↓
Sandbox 运行
        ↓
自动测试
        ↓
失败 -> AI 分级提示 -> 再修改
        ↓
产生 Evidence
        ↓
Evaluator 更新 SkillState
        ↓
系统决定下一项 Task

同时必须满足：

换掉 LLM Provider 不改业务核心。

Agent Learning Pack 可以卸载/替换，不改 Core 源码。

一个坏的 manifest 不能把 Core 启动搞崩，必须给清晰错误。

用户代码不能直接访问宿主机敏感文件。

关键 Evidence 可以追溯“什么时候、哪个任务、什么结果”。

## 20. 第一阶段开发顺序

### Phase 0：Spec-first（规范先行）

先实现 Schema，不做漂亮 UI。

1. Goal / Skill / Task / Evidence 数据结构。

2. Mod Manifest Schema。

3. Event Schema。

4. 官方 Agent Mod 的最小 YAML。

### Phase 1：Core

1. FastAPI 项目。

2. SQLite + migration。

3. Mod loader（加载器）。

4. Event dispatcher。

5. Evidence store。

6. Skill evaluator。

### Phase 2：Programming Scene

1. Next.js 页面。

2. Monaco。

3. Workspace。

4. Sandbox API。

5. Test Runner。

### Phase 3：AI Tutor

1. LLM Provider 接口。

2. Hint Level。

3. 错误上下文注入。

4. Prompt 版本化。

### Phase 4：第一个真实学习包

用你自己学习 Agent 的过程持续修改 agent-developer Mod，而不是不断往 Core 塞特殊逻辑。

## 21. Architecture Decision（当前锁定程度）

| 决策 | 状态 | 说明 |

| --- | --- | --- |

| 开源 | LOCKED | 项目基本方针 |

| Mod 化 | LOCKED | 领域能力不得写死 Core |

| Evidence-first | LOCKED | 学习判断的基础 |

| Next.js + TypeScript | PROVISIONAL | 开发前仍可更换，但需明确理由 |

| FastAPI + Python | PROVISIONAL | 与 AI 场景高度匹配 |

| SQLite 本地 / PostgreSQL 服务端 | PROVISIONAL | 保持存储层接口 |

| Apache-2.0 | PROVISIONAL | 正式发布前法务/商业策略再确认 |

| Docker 本地 Sandbox | PROVISIONAL | 只代表本地 v0.1，不代表云安全架构 |

| Kafka/K8s | REJECTED FOR v0.1 | 无实际需求前不引入 |

LOCKED 不是永远不能改，而是修改必须写 ADR，说明为什么原原则不成立。

## 22. 对 Learn Everything 的继承与区别

### 继承

“用户目标 -> AI 路线”的入口体验；

知识/能力之间的前置关系；

学习任务、复习、测验、进度等可拆模块；

学习模块与底层 RAG 尽量解耦的思想。

### 不直接继承

不以 Kotaemon/RAG 为核心地基；

不把所有学习领域统一成“知识点 + 卡片 + 测验”；

不把 mastery 单一分数当原始事实；

不让编程“实操”只是辅助模块，而是让 Scene 成为学习主体；

不把路线当静态课程目录。

## 23. 参考技术依据

以下只用于解释技术选择，不构成永久绑定：

Next.js 官方文档：React 全栈 Web 框架，App Router 支持现代 React 功能。https://nextjs.org/docs

FastAPI 官方文档：Python API 框架，基于类型提示，兼容 OpenAPI 与 JSON Schema。https://fastapi.tiangolo.com/

Monaco Editor：VS Code 所使用的 Web 代码编辑器。https://microsoft.github.io/monaco-editor/

JSON Schema：用于声明和验证 JSON 结构。https://json-schema.org/docs

Pyodide：基于 WebAssembly 在浏览器运行 Python。https://pyodide.org/en/stable/

PostgreSQL JSON/JSONB：https://www.postgresql.org/docs/current/datatype-json.html

OpenTelemetry：开放、厂商中立的 traces / metrics / logs 可观测标准。https://opentelemetry.io/docs/

WebAssembly 安全模型概览：https://developer.mozilla.org/en-US/docs/WebAssembly/Guides/Concepts

## 24. 下一份文档

完成本总纲后，按顺序写：

1. CORE_MODEL_SPEC.md：Goal / Skill / Task / Evidence 的字段与关系。

2. MOD_SPEC.md：Mod manifest、权限、依赖、版本、生命周期。

3. EVENT_SPEC.md：事件命名与 payload。

4. PROGRAMMING_SCENE_SPEC.md：编程场景交互和 Sandbox 接口。

5. AGENT_DEVELOPER_PACK.md：第一个官方学习包内容规范。

从这一刻开始，功能实现应优先服从这些规范，而不是“想到一个功能就直接加进代码”。
