import { defineConfig, lazyPlugins } from 'vite-plus'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

const config = defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  fmt: {
    singleQuote: true,
    semi: false,
    ignorePatterns: ['convex/_generated/**'],
  },
  lint: {
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }, '@shadcn/lint'],
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
      'shadcn/no-restyle': [
        'warn',
        {
          allow: ['layout'],
          deny: ['[--*', '[background-image*', '[mask*', '[-webkit-mask*'],
        },
      ],
      'shadcn/no-raw-colors': 'error',
      'shadcn/no-unknown-classes': 'error',
    },
    overrides: [
      {
        files: ['**/components/ui/**', '**/components/blocks/**'],
        rules: {
          'shadcn/no-restyle': 'off',
        },
      },
    ],
    options: { typeAware: true, typeCheck: true },
  },
  resolve: { tsconfigPaths: true },
  // Pre-bundle client deps up front. Route components are code-split, so Vite
  // otherwise discovers these lazily and re-optimizes mid-session, leaving the
  // browser with mixed chunks (two React copies -> "reading 'useMemoCache'").
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react/compiler-runtime',
      '@tanstack/react-router',
      '@tanstack/react-router-devtools',
      '@tanstack/react-devtools',
      '@tanstack/react-query',
      '@tanstack/react-router-ssr-query',
      'convex/react',
      '@convex-dev/react-query',
      '@base-ui/react/button',
      '@base-ui/react/dialog',
      '@base-ui/react/scroll-area',
      '@base-ui/react/tabs',
      '@base-ui/react/input',
      '@base-ui/react/merge-props',
      '@base-ui/react/use-render',
      '@hugeicons/react',
      '@hugeicons/core-free-icons',
      'class-variance-authority',
      'cn',
      'cmdk',
      'streamdown',
      '@streamdown/code',
    ],
  },
  plugins: lazyPlugins(() => [
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ]),
})

export default config
