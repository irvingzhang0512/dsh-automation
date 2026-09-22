/**
 * tsdown 构建配置：只负责浏览器客户端 bundle（lib/client.js）。
 *
 * 宿主半区（lib/index.js 等）由 tsc 编译（见 tsconfig.json）；本配置产出
 * DSH 官方客户端 bundle 形态：
 *
 *   window.__ModuleLoader__.load({ id, factory }) 闭包
 *
 * 其中 id = npm 包名（client-modules 以包名为 compose key，务必与
 * package.json `name` 及 cordis.patch.yml `name` 保持一致）。
 *
 * 依赖策略：peerDependencies（react / react-dom / cordis / dsh-tools /
 * dsh-skill）保持外部（由 shell 模块表 / 宿主提供）；dependencies（ws 等）
 * 不应进入浏览器闭包（ws 只用于宿主侧 WebSocket 服务端）。
 */
import { builtinModules } from 'node:module'
import type { UserConfig } from 'tsdown'

/** Node 内建模块永远不能进入浏览器 module-loader 闭包。 */
const NODE_BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map(id => `node:${id}`),
])

/** 注册的 bundle id：npm 包名（module-loader compose key）。 */
const BUNDLE_ID = 'dsh-automation'

/**
 * 平台外部依赖（shell 静态模块表提供）：React 及其 JSX runtime。
 * 不声明 @deepseek-ai/*：跨插件协作走 cordis 服务，禁止 value import。
 */
const PLATFORM_EXTERNALS = ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', 'cordis']

/** 拒绝 @deepseek-ai value import 与 Node 内建泄漏。 */
function purityGate(): NonNullable<UserConfig['plugins']> {
  return [
    {
      name: 'dsh-automation:client-purity',
      resolveId(source: string) {
        if (NODE_BUILTINS.has(source)) {
          throw new Error(
            `client bundle purity: Node builtin "${source}" cannot run in the browser module table`,
          )
        }
        if (source.startsWith('@deepseek-ai/')) {
          throw new Error(
            `client bundle purity: "${source}" is not a platform module — ` +
            'cross-plugin value imports are forbidden; collaborate through cordis services',
          )
        }
        return null
      },
    },
  ]
}

export default {
  entry: { client: 'src/client/index.tsx' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  clean: false,
  deps: {
    // 平台外部依赖走模块表（react 及 JSX runtime）。
    neverBundle: PLATFORM_EXTERNALS,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  plugins: purityGate(),
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(BUNDLE_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    // 闭包工厂的 require 只解析模块表条目；关闭代码分割，产物为单一脚本。
    codeSplitting: false,
  },
} satisfies UserConfig
