import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwind from '@astrojs/tailwind'
import solidJs from '@astrojs/solid-js'
import rehypeExternalLinks from './src/lib/rehype-external-links.mjs'

const site = 'https://patricioponcini.com.ar'

// https://astro.build/config
export default defineConfig({
  site,
  markdown: {
    rehypePlugins: [[rehypeExternalLinks, { siteHost: new URL(site).hostname }]],
  },
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: 'es',
        locales: {
          es: 'es-AR',
          en: 'en-US',
        },
      },
    }),
    solidJs(),
    tailwind({ applyBaseStyles: false }),
  ],
})
