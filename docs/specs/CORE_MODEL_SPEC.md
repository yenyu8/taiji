# Core Model v0.1

本文件把技术设计文档中的七个核心对象落实为 Demo 的最小字段。API 模型见 `apps/api/taiji_api/models.py`。

| 对象 | 核心字段 | 关系 |
| --- | --- | --- |
| Goal | id、title、description、success_criteria | 学习包提供一个目标 |
| Skill | id、title、description、prerequisites | 目标下的可验证能力 |
| Task | id、title、description、skill_id、scene_id、starter_code、checks | 任务练习一项能力并使用一个场景 |
| Scene | id、title、component_ids | 组合组件形成学习环境 |
| Component | id、title、kind | 声明场景所需的 UI 能力 |
| Evidence | id、schema_version、type、task_id、skill_id、result、created_at、source | 原始事实，写入后不修改 |
| Progress | skill_id、status、evidence_ids | 从 Evidence 派生，可重算 |

`mock_passed` 只表示文本模拟检查满足条件，不能解释为技能已被真实验证。未来接入隔离沙箱后，真实测试应产生不同的 Evidence 类型，再由 Evaluator 明确决定 SkillState。
