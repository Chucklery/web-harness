import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Web Harness',
  description: 'Lightweight TypeScript runtime for low-latency AI coding connections.',
  base: process.env.DOCS_BASE ?? '/web-harness/',
  cleanUrls: true,
  head: [['meta', { name: 'theme-color', content: '#0a0a0a' }]],
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Architecture', link: '/guide/architecture' },
      { text: 'MCP', link: '/guide/mcp' },
      { text: 'Performance', link: '/guide/performance' },
      { text: 'Security', link: '/guide/security' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Architecture', link: '/guide/architecture' },
          { text: 'MCP clients', link: '/guide/mcp' },
          { text: 'Performance', link: '/guide/performance' },
          { text: 'Protocol', link: '/guide/protocol' },
          { text: 'Security', link: '/guide/security' },
          { text: 'Release checklist', link: '/guide/release-checklist' },
        ],
      },
    ],
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/Chucklery/web-harness' }],
    editLink: {
      pattern: 'https://github.com/Chucklery/web-harness/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
    footer: { message: 'Released under the Apache-2.0 License.' },
  },
})
