// Rehype plugin: links to other sites open in a new tab.
// A link is external when its href is absolute (http/https) and points to a
// host other than the site's own. Internal links (/blog/...) are left alone.
export default function rehypeExternalLinks({ siteHost } = {}) {
  const isExternal = (href) => {
    if (typeof href !== 'string' || !/^https?:\/\//i.test(href)) return false
    try {
      return new URL(href).hostname !== siteHost
    } catch {
      return false
    }
  }

  const walk = (node) => {
    if (node.type === 'element' && node.tagName === 'a' && isExternal(node.properties?.href)) {
      node.properties.target = '_blank'
      node.properties.rel = ['noopener', 'noreferrer']
    }
    for (const child of node.children ?? []) walk(child)
  }

  return (tree) => walk(tree)
}
