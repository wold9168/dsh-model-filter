# AGENTS.md — dsh-model-filter

## 项目概述

DSH Model Filter 是一个 DeepSeek Harness (DSH) 客户端插件，为 Web GUI 的模型选择下拉框添加搜索功能。用户在模型面板中可通过模糊搜索（按名称或 ID）过滤模型列表，匹配字符会被高亮显示。

## 架构概览

### DSH 客户端插件加载机制

DSH 使用 **Cordis** 作为插件框架。客户端插件通过以下路径被加载到浏览器中：

```
cordis 配置树 (cordis.yml / cordis.patch.yml)
  → Loader 创建插件条目 (plugin entry)
    → ClientModuleRegistry 扫描条目，发现 dsh.client 声明
      → 注入 window.__DSH_BOOT__ 引导清单
        → HTML 预加载 @deepseek-ai/dsh-client-modules / dsh-client-runtime
          → 浏览器按清单顺序 fetch /plugins/<id>/client.js
            → 每个 client.js 通过 window.__ModuleLoader__.load() 自注册
```

### 关键概念

| 概念 | 位置 | 说明 |
|------|------|------|
| `dsh.client` | `package.json` | 声明客户端插件元数据：`inject`（cordis 服务依赖）、`platform`（必须为 `"web"`）、`external`（可选，额外的模块表依赖） |
| `dsh.bundle.patch` | `package.json` | 指向 `cordis.patch.yml`，使包成为 profile bundle。安装时 `dsh plugin add` 会自动将其加入 `dsh.profile.bundles` 列表 |
| `cordis.patch.yml` | 项目根 | Cordis 配置补丁，插入插件条目到配置树中。包含 `id`、`name`、`config` 和 `inject`（cordis 服务依赖声明） |
| `window.__ModuleLoader__` | 浏览器 | DSH 客户端模块系统入口。每个 client bundle 必须调用 `.load({ id, factory })` 注册自身 |
| 平台模块 | DSH 源码 | 所有客户端插件共享的基线外部模块：`react`、`react/jsx-runtime`、`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-primitives` |

### 双层打包

插件需要同时产出两个产物：

1. **Host 端** (`lib/index.js`)：Node.js 端加载器入口，由 DSH 的 Cordis Loader 在服务端 `require/import`。本项目将其打包为自包含 ESM（bundle 所有依赖），避免运行时依赖解析问题。

2. **Client 端** (`lib/client.js`)：浏览器端入口，由 `ClientModuleRegistry` 以 `/plugins/dsh-model-filter/client.js` 提供服务。必须为 CJS 格式，用 `window.__ModuleLoader__.load()` 包装。外部依赖（react、dsh-client-ui-primitives 等）保持为 `require()` 调用，由模块系统在运行时提供。

## 文件结构

```
dsh-model-filter/
├── AGENTS.md                  # 本文件
├── README.md                  # 用户文档
├── LICENSE                    # MIT
├── package.json               # 包清单（含 dsh.client + dsh.bundle）
├── pnpm-workspace.yaml        # 独立 pnpm 包声明
├── pnpm-lock.yaml             # 依赖锁文件（提交至仓库）
├── dsh.plugin.json            # DSH 插件清单
├── cordis.patch.yml           # Cordis 配置补丁（插件注册入口）
├── tsconfig.json              # TypeScript 配置（独立，不依赖 DSH workspace）
├── build.mjs                  # 构建脚本（esbuild）
├── .gitignore
├── src/
│   ├── index.ts               # Host 端插件入口（apply 函数）
│   ├── invariant.ts           # 类型重导出（供其他包使用）
│   ├── css-modules.d.ts       # CSS Modules 类型声明
│   └── client/
│       ├── index.ts           # Client 端入口
│       ├── ModelSelect.tsx    # 增强的模型选择组件
│       ├── ModelSelect.module.css  # 组件样式
│       ├── slots.ts           # 组件注入接口类型
│       └── locales.ts         # 中英文词典
└── lib/                       # 构建产物（gitignored）
    ├── index.js               # Host 端自包含 ESM（bundle 全部 DSH 包，CSS 剥离）
    └── client.js              # Client 端 CJS（ModuleLoader 包装，CSS 内联）
```

## 构建系统

### 依赖解析策略

插件不在 DSH monorepo 的 pnpm workspace 中，通过 `pnpm-workspace.yaml` 声明为独立包，`devDependencies` 使用 `link:` 协议指向 DSH checkout 中的包。`pnpm install` 自动创建所有 symlink：

```json
"devDependencies": {
  "@deepseek-ai/cordis": "link:../deepseek-harness/vendor/cordis",
  "@deepseek-ai/dsh-api-remotes": "link:../deepseek-harness/packages/api/remotes",
  ...
}
```

如果 DSH checkout 不在 `../deepseek-harness`，修改 `link:` 路径后重新运行 `pnpm install` 即可。

### 构建命令

```bash
# 编译（esbuild 直接处理 TypeScript，无需先跑 tsc）
pnpm run build

# 产物：
#   lib/index.js   — Host 端自包含 ESM (~4.9 MB，bundle 全部 DSH 包，CSS 剥离)
#   lib/client.js  — Client 端 CJS (~29 KB，CSS 内联)
```

### build.mjs 要点

**Client bundle：**
- `format: 'cjs'` — DSH 客户端模块系统要求 CJS
- `banner/footer` — 包装在 `window.__ModuleLoader__.load({ id, factory })` 中
- `external: ['@deepseek-ai/*', 'react', ...]` — 平台模块保持外部（浏览器运行时提供）
- CSS Modules 通过 `inline-css-modules` 插件处理：内联 CSS 文本 + 注入 `<style>` 标签 + 导出类名映射

**Host bundle：**
- `format: 'esm'` — Node.js 端 ESM
- `external: ['node:*']` — 仅外部化 Node 内置模块，DSH 包全部 bundle（避免运行时加载 .css 报错）
- CSS 通过 `strip-css` 插件剥离（`→ export default {}`）

## 安装与测试

### 从 GitHub Release 远程安装（推荐）

无需拉取仓库到本地：

```bash
cd $DSH_CHECKOUT
pnpm dsh plugin --profile web add https://github.com/<owner>/<repo>/releases/download/<tag>/dsh-model-filter.tgz
```

### 本地构建安装

```bash
# 1. 安装依赖（link: 协议指向 ../deepseek-harness）
pnpm install

# 2. 构建（lib/ gitignored，clone 后必须构建）
pnpm run build

# 3. 安装到 DSH profile
cd $DSH_CHECKOUT
pnpm dsh plugin --profile web add /path/to/dsh-model-filter
```

`dsh plugin add` 会自动检测 `dsh.bundle.patch` 声明并将插件加入 `dsh.profile.bundles` 列表。

### 重启 DSH Web

```bash
# 停止当前进程
kill $(pgrep -f "apps/cli/src/bin.ts web")

# 重新启动
cd $DSH_CHECKOUT
pnpm dsh web
```

### 验证

打开 http://127.0.0.1:3080，刷新页面：
- 点击模型选择器 → 选择 "Model" → 应出现搜索框
- 输入模型名称或 ID 进行模糊搜索
- 匹配字符高亮显示，按 ID 匹配时显示模型 ID

### 调试

```bash
# 查看插件是否在 cordis 配置树中
cd $DSH_CHECKOUT && pnpm dsh dump-config --profile web | grep -A5 "dsh-model-filter"

# 检查 client.js 是否可访问
curl -s http://127.0.0.1:3080/plugins/dsh-model-filter/client.js | head -5

# 浏览器控制台检查模块加载
# 打开 DevTools → 搜索 "dsh-model-filter" 或 "ModuleLoader"
```

## 本次会话修改记录

### 原始代码问题

1. **`package.json` 缺少 `dsh.client` 声明** — ClientModuleRegistry 通过 `package.json` 的 `dsh.client` 字段发现客户端插件，没有此声明则插件不会被注入到浏览器引导清单中。

2. **`package.json` 缺少 `dsh.bundle` 声明** — 没有 `dsh.bundle.patch` 则 `dsh plugin add` 不会自动将插件加入 profile 的 bundles 列表。

3. **`tsdown.config.ts` 格式不兼容** — 原配置使用 ESM 格式且无 `window.__ModuleLoader__.load()` 包装，产出的 client.js 无法被 DSH 客户端模块系统加载。

4. **`src/index.ts` 错误导入 `apply`** — `import { apply } from '@deepseek-ai/cordis'` 中的 `apply` 不是 cordis 的导出函数。Cordis 插件只需导出名为 `apply` 的函数即可，无需包装。

5. **`tsconfig.json` 依赖 DSH workspace** — `extends @deepseek-ai/cordis/tsconfig.json` 在独立构建时无法解析（cordis 不导出 tsconfig.json）。

6. **`peerDependencies` 使用 `workspace:^` 协议** — 该协议仅在 pnpm workspace 内有效，独立安装时无法解析。

### 修改内容

| 文件 | 修改 |
|------|------|
| `package.json` | 添加 `dsh.client`（inject + platform: "web"）、`dsh.bundle.patch`；将 `workspace:^` 改为宽松版本范围；添加 `cordis.patch.yml` 到 exports |
| `cordis.patch.yml` | **新建**。插入插件条目，含 `id`、`name`、`config` 和 `inject`（required/optional 服务） |
| `tsconfig.json` | 改为独立配置，含 `jsx: "react-jsx"`、`moduleResolution: "bundler"` |
| `tsdown.config.ts` | 重写为双配置：host 端自包含 ESM + client 端 CJS + ModuleLoader 包装 + CSS Modules 内联插件 |
| `src/index.ts` | 移除错误的 `import { apply }`，改为直接 `export function apply(ctx, config)` |

## 常见问题

### Q: 构建时 `[TSCONFIG_ERROR]` 或 `Package subpath is not defined by exports`

`@deepseek-ai/cordis` 不导出 `tsconfig.json`。`tsconfig.json` 已改为独立配置。

### Q: 构建时 `[MISSING_EXPORT] "apply" is not exported`

`apply` 不是 cordis 的导出函数。Cordis 插件只需导出名为 `apply` 的函数即可。已修复 `src/index.ts`。

### Q: `@tsdown/css is not installed`

项目使用自定义 CSS Modules 插件（内联 CSS + 导出类名映射），由 `build.mjs` 中的 esbuild 插件处理，不依赖 `@tsdown/css`。

### Q: 插件安装后不生效

1. 确认已重启 `dsh web`（ClientModuleRegistry 缓存不会在运行时更新）
2. 检查 `cordis.patch.yml` 是否被正确应用：`pnpm dsh dump-config --profile web | grep dsh-model-filter`
3. 检查浏览器控制台是否有模块加载错误
4. 确认 `lib/client.js` 存在且以 `window.__ModuleLoader__.load` 开头

### Q: 如何在不重启的情况下测试插件修改

Client 端修改（React 组件、样式）可使用 HMR：
```bash
# 终端 1：启动 DSH Web
pnpm dsh web

# 终端 2：启动 Vite dev watch（在同一 DSH checkout 中）
pnpm run dev:web
```

但注意：此 HMR 仅适用于已在 DSH workspace 中的包。对于独立插件，需要重新构建并重启。

## 依赖版本约束

- `@deepseek-ai/cordis`: `>=4.0.0-rc <5`
- `@deepseek-ai/dsh-*`: `>=0.1.0-rc <1`
- `react`: `^18.2.0`
- `clsx`: `^2.1.1`（运行时依赖，client bundle 内联）
- `esbuild`: `^0.25.0`（构建工具）