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

### 方式一：从 GitHub Release 远程安装（推荐）

无需拉取本仓库到本地。直接从 GitHub Release 产物安装：

```bash
cd /path/to/deepseek-harness
pnpm dsh plugin --profile web add https://github.com/<owner>/<repo>/releases/download/<tag>/dsh-model-filter.tgz
```

`dsh plugin add` 会自动检测 `dsh.bundle.patch` 声明并将插件加入 profile 的 bundles 列表。

### 方式二：本地构建安装

需要 DSH checkout（默认位于 `../deepseek-harness`）与 pnpm。

```bash
# 1. 安装依赖（devDependencies 使用 link: 协议指向 DSH checkout）
pnpm install

# 2. 构建（lib/ 不提交至仓库，clone 后必须构建）
pnpm run build

# 3. 安装到 DSH profile
cd /path/to/deepseek-harness
pnpm dsh plugin --profile web add /path/to/dsh-model-filter
```

### 重启 DSH Web

```bash
kill $(pgrep -f "apps/cli/src/bin.ts web")
cd /path/to/deepseek-harness && pnpm dsh web
```

## 使用

安装后，搜索框会自动出现在 composer 的模型选择下拉框中。点击模型选择器，选择 "Model" 进入模型列表，即可输入关键词过滤模型。

## 工作原理

插件在 Client 端注册 `conversation.input.model` slot（`priority: -1` 覆盖默认的 `ui-model-selection` 组件），提供一个带搜索框的增强版 `ModelSelect`。搜索通过 `modelDirectories` 服务获取会话的模型目录（按 provider 分组的模型列表），在前端按 provider 名、模型名、模型 ID 过滤并高亮匹配字符。

## 发布新版本

推送 `v*` tag 会自动触发 GitHub Action（`.github/workflows/release.yml`）构建、打包并创建 Release 产物：

```bash
# 1. 更新 package.json 版本号
# 2. 打 tag 并推送
git tag v0.1.0
git push origin v0.1.0
```

Action 会在 CI 中 stub 掉 `link:../deepseek-harness` 的本地依赖（CI 没有 DSH checkout），执行 `pnpm install` + 构建，打包出包含 `lib/` 的 `dsh-model-filter.tgz`，上传到 GitHub Release。

## 开发

常用操作已整合到 `justfile`，通过 `just` 运行（`just --list` 查看全部）：

```bash
just install       # 安装依赖
just build         # 构建
just typecheck     # TypeScript 类型检查
just pack          # 打包 tarball（含构建产物）
just dev           # 完整开发循环：构建 + 重装到 profile + 重启 DSH Web
just reinstall     # 仅重装插件到 profile
just restart       # 仅重启 DSH Web
just release v0.1.0  # 打 tag 并推送，触发 GitHub Action 发布
```

手动命令等价于 `just dev`：

```bash
pnpm run build
cd /path/to/deepseek-harness
pnpm dsh plugin --profile web remove dsh-model-filter
pnpm dsh plugin --profile web add ../dsh-model-filter
pnpm dsh web
```

修改代码后执行 `just dev` 即可完成构建 + 重装 + 重启。也可使用 DSH 的动态 Cordis 插件机制进行快速测试，无需构建和重启。

## License

MIT