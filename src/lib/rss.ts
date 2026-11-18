import rss from '@astrojs/rss'
import { getLocalizedCollection, localizePath, useTranslations } from '@i18n/utils'
import type { Lang } from '@i18n/ui'

export async function buildRss(site: string | URL | undefined, lang: Lang) {
  const t = useTranslations(lang)
  const posts = await getLocalizedCollection('blog', lang)
  const projects = await getLocalizedCollection('projects', lang)

  const items = [...posts, ...projects].filter((item) => !item.data.draft)

  items.sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())

  return rss({
    title: t.site.title,
    description: t.site.description,
    site: site ?? '',
    customData: `<language>${lang}</language>`,
    items: items.map((item) => ({
      title: item.data.title,
      description: item.data.summary,
      pubDate: item.data.date,
      link: localizePath(`/${item.collection}/${item.cleanSlug}/`, lang),
    })),
  })
}
