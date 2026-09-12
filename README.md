# dsh-knowledge-transform

DeepSeek Harness 知识转化实验项目的最小插件骨架。

当前是一个最小 DSH 插件，包含：

- `greet`：最小工具，验证插件安装与加载；
- `make_cognitive_note`：把一段原始资料整理成认知类型 Wiki 笔记；
  - 可选 `outputPath`：生成后通过 `ctx.fs` 保存到知识库。
- `make_method_note`：把原始资料或认知笔记蒸馏成一条可复用的方法笔记；
  - 可选 `outputPath`：保存到 `knowledge-base/methods/`。
- `make_fusion_idea`：把多段资料融合成一篇提出新视角、新 idea 的融合笔记。
- `recall_methods`：从方法论召回库中，按场景召回最相关的方法笔记。
  - 支持 LLM 语义排序，失败时回退关键词排序。
- `agent/pre-step` 自动注入：AI 行动前自动召回并注入相关方法笔记。

最小知识库结构：

```text
knowledge-base/
├── raw/      # 原始资料
├── wiki/     # 认知 / 方法 / 融合笔记与索引
└── methods/  # AI 可召回的方法论技能包
```

## 构建

```sh
npm install --legacy-peer-deps
npm run build
```

> 依赖说明：`@deepseek-ai/dsh-tools` 必须使用 `0.1.2-rc.1`（`next` 线），
> 不要使用 `latest`，因为旧 `0.0.1-rc.1` 的 peer dependency 链会指向不存在的
> `@deepseek-ai/dsh-type-meta`。

## 本地识别验证

```sh
npx @deepseek-ai/dsh@0.1.2-rc.1 --profile web --patch ./dev.patch.yml --dump-config
```

完整加载验证：

```sh
npx @deepseek-ai/dsh@0.1.2-rc.1 --profile web --patch ./dev.patch.yml --no-open
```

启动时应当看到：

```text
[dsh-knowledge-transform] tool registered: greet
[dsh-knowledge-transform] plugin loaded
```

正式 bundle 安装验证：

```sh
npx @deepseek-ai/dsh@0.1.2-rc.1 plugin --profile demo add .
npx @deepseek-ai/dsh@0.1.2-rc.1 --profile demo --dump-config
```

本地自检：

```sh
npm run check
```

`npm run check` 会依次执行：编译、方法库索引生成、字段校验和全部本地自检脚本。

生成工具会在保存前校验笔记结构：

- 认知笔记：`type: 认知` + `## 摘要` + `## 关键点`
- 方法笔记：`type: 方法` + 四个必要小节
- 融合笔记：`type: 融合` + 四个必要小节

校验失败时不会保存坏内容。

## 当前状态

- [x] 最小 bundle 结构
- [x] 插件入口可编译
- [x] `dsh --dump-config` 能识别插件
- [x] DSH Web 能加载插件并注册 `greet` 工具
- [x] 通过 `dsh plugin add` 正式安装 bundle
- [x] `make_cognitive_note`：raw → 认知笔记，支持落盘
- [x] `make_method_note`：raw/认知 → 方法笔记，支持落盘
- [x] `make_fusion_idea`：多源 → 融合笔记，校验来源
- [x] `recall_methods`：关键词 + LLM 语义排序召回
- [x] `agent/pre-step` 自动注入方法笔记
- [x] 笔记结构校验 + 失败用例兜底
- [x] 本地 mock 闭环（raw → 认知/方法 → 融合）
- [ ] 真实 DeepSeek API 调用验证
- [ ] 真实 DSH Web 端到端闭环验证
