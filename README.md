# dsh-model-filter

Model Filter Plugin for DeepSeek Harness (DSH)

为 DSH Web GUI 的模型选择下拉框添加搜索功能，支持按模型名称或 ID 模糊搜索，匹配字符高亮显示。

## 免责声明

本仓库代码完全由 LLM 生成，作者对 JavaScript/TypeScript 了解有限且精力有限，此为完全的 Vibe Coding 产物。使用者自行承担风险。

## 功能

1. **搜索框**：打开模型面板时在列表顶部显示搜索输入框
2. **模糊匹配**：对模型名称和 ID 进行大小写不敏感的子串匹配
3. **字符高亮**：匹配字符以品牌色高亮显示
4. **ID 显示**：仅匹配到 ID 时，在模型名称后以小字显示 ID，匹配字符同样高亮

## 安装

### 前置条件

- 已有 DSH checkout（默认位于 `../deepseek-harness`）
- pnpm

### 1. 安装依赖

`devDependencies` 使用 `link:` 协议指向 DSH checkout 中的包，`pnpm install` 自动创建所有 symlink：

```bash
pnpm install
```

### 2. 构建

构建产物不提交至仓库，clone 后必须执行：

```bash
pnpm run build
```

产物：
- `lib/index.js` — Host 端 ESM
- `lib/client.js` — Client 端 CJS（ModuleLoader 包装）

### 3. 安装到 DSH profile

```bash
cd /path/to/deepseek-harness
pnpm dsh plugin --profile web add /path/to/dsh-model-filter
```

`dsh plugin add` 会自动检测 `dsh.bundle.patch` 声明并将插件加入 profile 的 bundles 列表。

### 4. 重启 DSH Web

```bash
kill $(pgrep -f "apps/cli/src/bin.ts web")
cd /path/to/deepseek-harness && pnpm dsh web
```

## 使用

安装后，搜索框会自动出现在 composer 的模型选择下拉框中。点击模型选择器，选择 "Model" 进入模型列表，即可输入关键词过滤模型。

## 工作原理

插件通过 Cordis 机制向 DSH 的 `modelSelect` 服务提供一个增强的 `ModelSelect` 组件（服务名 `model-select-enhanced`）。增强组件在原有模型选择面板的基础上增加了搜索输入框和实时过滤功能。

## 开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm run build
```

修改代码后需重新构建并重启 `dsh web`。也可使用 DSH 的动态 Cordis 插件机制进行快速测试，无需构建和重启。

## License

MIT