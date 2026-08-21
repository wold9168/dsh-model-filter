# dsh-model-filter — 常用操作 Justfile
# 通过 `just` 运行，`just --list` 查看所有配方。

set shell := ["bash", "-cu"]

# 默认配方：列出所有可用命令
default:
  @just --list

# 安装依赖（pnpm）
install:
  pnpm install

# 构建插件（生成 lib/index.js + lib/client.js）
build:
  node build.mjs

# TypeScript 类型检查（不产出）
typecheck:
  pnpm exec tsc --noEmit

# 打包 tarball（含构建产物，供 GitHub Release 使用）
pack: build
  rm -rf package dsh-model-filter.tgz
  mkdir -p package
  cp package.json cordis.patch.yml dsh.plugin.json README.md LICENSE package/
  cp -r lib package/lib
  tar -czf dsh-model-filter.tgz package
  @echo "→ dsh-model-filter.tgz ready"

# 发布新版本：打 tag 并推送（触发 GitHub Action 自动构建 Release）
release tag:
  git tag {{tag}}
  git push origin {{tag}}
