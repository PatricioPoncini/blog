import { getCollection, type CollectionEntry } from 'astro:content'
import { ui, type Lang } from './ui'

export * from './paths'

export type LocalizableCollection = 'blog' | 'projects' | 'work'

export type LocalizedEntry<C extends LocalizableCollection> = CollectionEntry<C> & {
  cleanSlug: string
}

export function useTranslations(lang: Lang) {
  return ui[lang]
}

/** Entries of a collection for one language, with the language prefix removed from the slug. */
export async function getLocalizedCollection<C extends LocalizableCollection>(
  collection: C,
  lang: Lang
): Promise<LocalizedEntry<C>[]> {
  const entries = (await getCollection(collection)) as CollectionEntry<C>[]
  const prefix = `${lang}/`
  return entries
    .filter((entry) => entry.slug.startsWith(prefix))
    .map((entry) => ({ ...entry, cleanSlug: entry.slug.slice(prefix.length) }))
}
