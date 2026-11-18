import type { APIContext } from 'astro'
import { buildRss } from '@lib/rss'

export function GET(context: APIContext) {
  return buildRss(context.site, 'es')
}
