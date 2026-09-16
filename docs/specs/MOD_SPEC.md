# Mod Spec v0.1

本 Demo 只加载官方 `learning-pack`。`manifest.yaml` 使用 `packages/core-schemas/mod-manifest.schema.json` 校验，计划在 `plan.yaml` 中声明 Goal、Skill、Task、Scene 和 Component。

加载器只读取 YAML，不 `import` 或执行学习包中的代码。当前允许的组件 ID 为 `code-editor`、`run-panel`、`test-panel`、`hint-panel`。Mod 的 `permissions` 必须为空；运行能力由受控服务提供。第三方 Mod 的安装入口尚未开放。

专家模式保存的是计划配置覆盖层，不会修改官方包文件，也不会给予 Mod 进程权限。配置必须通过后端模型和引用检查。协议仍处于 0.1 阶段，后续需要定义版本迁移和第三方包签名/分发流程。
