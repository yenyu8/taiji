# Learn Everything 路线参考

参考项目：https://github.com/redmaplewww/learn-everything

查阅文件：
- https://github.com/redmaplewww/learn-everything/blob/main/learning_ext/path_generator/service.py
- https://github.com/redmaplewww/learn-everything/blob/main/learning_ext/path_generator/prompts.py

太极独立实现其「目标/背景/时间 → 结构化路线 → 模型复核」思路，没有复制项目代码。路线包含 summary、stages 和 nodes；节点使用 code、title、description、stage、est_hours、difficulty、prerequisites。

导入识别 kind=learn-everything.roadmap、schema_version=1 的 project+roadmap 包，也支持原始 roadmap。阶段映射成太极章节分组，节点 code 映射为 lesson.id，保留时间、难度和依赖。增加唯一 ID、依赖引用、循环依赖校验。来源中的完成状态不转换成已验证能力。

详细教程按需生成，学习文件保存教程、练习和用户代码。太极导出自己的 version=1 学习格式，不能保证 Learn Everything 能反向导入。只导出允许字段，API Key 不进入学习文件。

## 快速接入参考

参考 learning_ext/pages/quick_setup.py 的服务商预设与折叠高级设置。太极使用原生下拉框，并在粘贴密钥后自动获取实时模型列表；连接测试成功才继续。没有照搬其将密钥写入 .env 的行为。列表读取支持取消和超时，切换平台清空旧密钥。
