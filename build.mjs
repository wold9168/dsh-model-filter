/**
 * Single-file client + ESM host build for dsh-model-filter.
 *
 * The web server serves exactly one file per plugin
 * (/plugins/dsh-model-filter/client.js), so the client half is one CJS
 * bundle wrapped in the ModuleLoader factory handshake; @deepseek-ai/dsh-*
 * and react stay external. The host half is plain ESM for Node,
 * externalizing @deepseek-ai/* plus react.
 */
import { build } from 'esbuild'
import { readFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

mkdirSync('lib', { recursive: true })

const PLUGIN_ID = 'dsh-model-filter'
const dshExternal = ['@deepseek-ai/*', 'react', 'react/jsx-runtime', 'react-dom', 'scheduler']

/**
 * Plugin that strips CSS imports for the Node host bundle.
 */
const stripCssPlugin = {
  name: 'strip-css',
  setup(build) {
    build.onResolve({ filter: /\.css$/ }, () => ({ path: '\0empty-css', namespace: 'strip-css' }))
    build.onLoad({ filter: /\0empty-css/, namespace: 'strip-css' }, () => ({ contents: 'export default {};', loader: 'js' }))
  },
}

/**
 * Plugin that inlines CSS Modules for the browser client bundle.
 * Reads .module.css files, injects <style> tags, and exports class-name maps.
 */
const inlineCssModulesPlugin = {
  name: 'inline-css-modules',
  setup(build) {
    build.onResolve({ filter: /\.module\.css$/ }, args => ({
      path: resolve(args.resolveDir, args.path),
      namespace: 'css-module',
    }))
    build.onLoad({ filter: /.*/, namespace: 'css-module' }, args => {
      const css = readFileSync(args.path, 'utf8')
      const classNames = new Set()
      const classRe = /\.([a-zA-Z_][\w-]*)/g
      let m
      while ((m = classRe.exec(css)) !== null) classNames.add(m[1])
      const classMap = Object.fromEntries([...classNames].map(name => [name, name]))
      const escapedCss = JSON.stringify(css)
      const tagId = `${PLUGIN_ID}/${args.path}`

      return {
        contents: [
          `const css = ${escapedCss};`,
          `const tagId = ${JSON.stringify(tagId)};`,
          `if (typeof document !== 'undefined' && !document.querySelector('style[data-plugin-css="' + tagId + '"]')) {`,
          `  const tag = document.createElement('style');`,
          `  tag.dataset.plugin = ${JSON.stringify(PLUGIN_ID)};`,
          `  tag.dataset.pluginCss = tagId;`,
          `  tag.textContent = css;`,
          `  document.head.appendChild(tag);`,
          `}`,
          `export default ${JSON.stringify(classMap)};`,
        ].join('\n'),
        loader: 'js',
      }
    })
  },
}

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node22'],
  sourcemap: true,
  external: dshExternal,
  plugins: [stripCssPlugin],
  logLevel: 'info',
})

await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: true,
  jsx: 'automatic',
  external: dshExternal,
  plugins: [inlineCssModulesPlugin],
  banner: {
    js: "window.__ModuleLoader__.load({ id: 'dsh-model-filter', factory: (require) => { var module = { exports: {} }; var exports = module.exports;",
  },
  footer: {
    js: 'return module.exports; } });',
  },
  logLevel: 'info',
})