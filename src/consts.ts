import type { Links, Socials } from '@types'

// Navigation links (text comes from the i18n dictionary, href has no language prefix)
export const LINKS: Links = [
  { KEY: 'home', HREF: '/' },
  { KEY: 'about', HREF: '/about' },
  { KEY: 'work', HREF: '/work' },
  { KEY: 'blog', HREF: '/blog' },
  { KEY: 'projects', HREF: '/projects' },
]

// Socials
export const SOCIALS: Socials = [
  {
    NAME: 'Email',
    ICON: 'email',
    TEXT: 'patricioponcini10@gmail.com',
    HREF: 'mailto:patricioponcini10@gmail.com',
  },
  {
    NAME: 'Github',
    ICON: 'github',
    TEXT: 'PatricioPoncini',
    HREF: 'https://github.com/PatricioPoncini',
  },
  {
    NAME: 'LinkedIn',
    ICON: 'linkedin',
    TEXT: 'Patricio Poncini',
    HREF: 'https://www.linkedin.com/in/patricio-poncini/',
  },
]
