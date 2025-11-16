import type { Site, Page, Links, Socials } from '@types'

// Global
export const SITE: Site = {
  TITLE: 'Blog',
  DESCRIPTION: 'Bienvenido a mi blog',
  AUTHOR: 'Patricio Poncini',
}

// Work Page
export const WORK: Page = {
  TITLE: 'Mi experiencia',
  DESCRIPTION: 'Lugares donde he trabajado',
}

// Blog Page
export const BLOG: Page = {
  TITLE: 'Blog',
  DESCRIPTION: 'Publicaciones sobre temas que me interesan o me resultan curiosos.',
}

// Projects Page
export const PROJECTS: Page = {
  TITLE: 'Proyectos',
  DESCRIPTION: 'Proyectos personales que he desarrollado o que actualmente estoy construyendo.',
}

// Search Page
export const SEARCH: Page = {
  TITLE: 'Búsqueda',
  DESCRIPTION: 'Aquí puedes buscar tópicos de tu interés',
}

// Links
export const LINKS: Links = [
  {
    TEXT: 'Inicio',
    HREF: '/',
  },
  {
    TEXT: 'Experiencia',
    HREF: '/work',
  },
  {
    TEXT: 'Blog',
    HREF: '/blog',
  },
  {
    TEXT: 'Projectos',
    HREF: '/projects',
  },
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
