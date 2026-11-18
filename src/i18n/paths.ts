// Pure path helpers. No `astro:content` imports here, so this file is safe to use in client components.
import { defaultLang, languages, type Lang } from './ui'

export function isLang(value: string | undefined): value is Lang {
  return value !== undefined && value in languages
}

export function getLang(url: URL): Lang {
  const [, first] = url.pathname.split('/')
  return isLang(first) ? first : defaultLang
}

/** Removes the language prefix from a pathname: `/en/blog/x` -> `/blog/x`. */
export function stripLangPrefix(pathname: string): string {
  const [, first, ...rest] = pathname.split('/')
  if (isLang(first) && first !== defaultLang) {
    return '/' + rest.join('/')
  }
  return pathname
}

/** Builds a path for the given language: `localizePath('/blog', 'en')` -> `/en/blog`. */
export function localizePath(path: string, lang: Lang): string {
  const clean = stripLangPrefix(path)
  if (lang === defaultLang) return clean
  return clean === '/' ? `/${lang}` : `/${lang}${clean}`
}

/** The same page in the other language. */
export function getAlternatePath(url: URL): { lang: Lang; path: string } {
  const current = getLang(url)
  const other: Lang = current === 'es' ? 'en' : 'es'
  return { lang: other, path: localizePath(url.pathname, other) }
}

/** Replaces `{key}` placeholders: `format('Showing {count}', { count: 3 })`. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''))
}
