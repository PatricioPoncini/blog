import { createEffect, createSignal } from 'solid-js'
import Fuse from 'fuse.js'
import ArrowCard, { type CardEntry } from '@components/ArrowCard'
import SearchBar from '@components/SearchBar'
import { format } from '@i18n/paths'
import { ui, type Lang } from '@i18n/ui'

type Props = {
  data: CardEntry[]
  lang: Lang
}

export default function Search({ data, lang }: Props) {
  const t = ui[lang]
  const [query, setQuery] = createSignal('')
  const [results, setResults] = createSignal<CardEntry[]>([])

  const fuse = new Fuse(data, {
    keys: ['cleanSlug', 'data.title', 'data.summary', 'data.tags'],
    includeMatches: true,
    minMatchCharLength: 2,
    threshold: 0.4,
  })

  createEffect(() => {
    if (query().length < 2) {
      setResults([])
    } else {
      setResults(fuse.search(query()).map((result) => result.item))
    }
  })

  const onSearchInput = (e: Event) => {
    const target = e.target as HTMLInputElement
    setQuery(target.value)
  }

  return (
    <div class="flex flex-col">
      <SearchBar
        onSearchInput={onSearchInput}
        query={query}
        setQuery={setQuery}
        placeholderText={t.search.placeholder}
      />

      {query().length >= 2 && results().length >= 1 && (
        <div class="mt-12">
          <div class="text-sm uppercase mb-2">
            {format(t.search.found, { count: results().length })} {`'${query()}'`}
          </div>
          <ul class="flex flex-col gap-3">
            {results().map((result) => (
              <li>
                <ArrowCard entry={result} lang={lang} pill={true} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
