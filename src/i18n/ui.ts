export const languages = {
  es: 'Español',
  en: 'English',
} as const

export type Lang = keyof typeof languages

export const defaultLang: Lang = 'es'

const es = {
  site: {
    title: 'AxisDev',
    description:
      'Bienvenido a mi blog, un espacio personal donde voy a compartir lo que aprendo mientras construyo cosas en el mundo del desarrollo.',
    author: 'Patricio Poncini',
  },
  pages: {
    home: { title: 'Inicio', description: '' },
    work: { title: 'Mi experiencia', description: 'Lugares donde he trabajado.' },
    blog: {
      title: 'Blog',
      description: 'Publicaciones sobre temas que me interesan o me resultan curiosos.',
    },
    projects: {
      title: 'Mis proyectos',
      description: 'Proyectos personales que he desarrollado o que actualmente estoy construyendo.',
    },
    search: { title: 'Búsqueda', description: 'Aquí puedes buscar tópicos de tu interés' },
    about: { title: 'Sobre mí', description: 'Quién soy y a qué me dedico.' },
  },
  nav: {
    home: 'Inicio',
    about: 'Sobre mí',
    work: 'Experiencia',
    blog: 'Blog',
    projects: 'Proyectos',
  },
  a11y: {
    search: 'Buscar posteos y proyectos en',
    theme: 'Cambiar entre tema claro y oscuro',
    drawer: 'Abrir y cerrar el menú',
    language: 'Ver el sitio en inglés',
    backToTop: 'Volver al inicio de la página',
    on: 'en',
    profilePic: 'Foto de Patricio Poncini',
  },
  langToggle: 'EN',
  home: {
    hello: 'Hola, soy...',
    tagline: 'Creando tecnología con propósito humano.',
    exploreBlog: 'Explorar mi blog',
    experience: 'Experiencia',
    aboutMe: 'Sobre mí',
    intro:
      'Soy Patricio Poncini, <b>Desarrollador Backend</b> y <b>Técnico en Programación</b>. Diseño y desarrollo sistemas distribuidos y servicios de alto rendimiento con <b>Kotlin, Go y TypeScript</b>, buscando siempre el equilibrio entre excelencia técnica y valor real para el negocio.',
    knowMore: 'Conocé más sobre mí',
    recentPosts: 'Posteos recientes',
    allPosts: 'Todos mis posteos',
    recentProjects: 'Proyectos recientes',
    allProjects: 'Todos mis proyectos',
    connect: 'Conectemos',
    contactText: 'Me podes contactar por correo electrónico, o encontrarme en mis redes sociales.',
  },
  about: {
    paragraphs: [
      'Soy Patricio Poncini, <b>Software Engineer</b> especializado en backend, con amplia experiencia llevando productos desde la idea hasta producción: diseño, desarrollo, despliegue y mejora continua. Trabajo con <b>Go, Kotlin y TypeScript</b> en arquitecturas cloud sobre <b>AWS</b>, construyendo sistemas confiables y preparados para escalar.',
      'En <b>itti</b> formo parte del equipo de Lealtad de Upys, la plataforma de puntos y beneficios. Ahí diseñé y desarrollé el motor que procesa transacciones de distintos métodos de pago para asignar puntos y beneficios a los usuarios. También participo en decisiones de arquitectura del producto y desarrollo herramientas de automatización para procesar grandes volúmenes de datos y resolver migraciones complejas.',
      'Me interesa el punto donde la técnica se cruza con el negocio: entender por qué se construye algo antes de decidir cómo. El testing, el buen diseño y una arquitectura limpia son herramientas para que el producto pueda cambiar rápido sin cargar deuda técnica innecesaria.',
    ],
    contact: 'Contacto',
    contactText: 'Me podes contactar por correo electrónico, o encontrarme en mis redes sociales.',
  },
  footer: {
    backToTop: 'Subir',
  },
  article: {
    back: 'Volver',
    prev: 'Anterior',
    next: 'Próximo',
    demo: 'Ver demo',
    repo: 'Ver repositorio',
    readingTime: 'minutos de lectura',
  },
  search: {
    placeholder: '¿Que estás buscando?',
    filterPlaceholder: 'Buscar',
    tags: 'Tags',
    found: 'Se encontraron {count} resultados para',
    showing: 'Mostrando {count} de {total}',
    ascending: 'Ascendente',
    descending: 'Descendente',
    post: 'post',
    project: 'proyecto',
  },
}

export type UI = typeof es

const en: UI = {
  site: {
    title: 'AxisDev',
    description:
      'Welcome to my blog, a personal space where I share what I learn while building things in the software world.',
    author: 'Patricio Poncini',
  },
  pages: {
    home: { title: 'Home', description: '' },
    work: { title: 'My experience', description: 'Places where I have worked.' },
    blog: {
      title: 'Blog',
      description: 'Posts about topics I find interesting or curious.',
    },
    projects: {
      title: 'My projects',
      description: 'Personal projects I have built or am currently building.',
    },
    search: { title: 'Search', description: 'Search for topics you are interested in' },
    about: { title: 'About me', description: 'Who I am and what I do.' },
  },
  nav: {
    home: 'Home',
    about: 'About',
    work: 'Experience',
    blog: 'Blog',
    projects: 'Projects',
  },
  a11y: {
    search: 'Search blog posts and projects on',
    theme: 'Toggle light and dark theme',
    drawer: 'Toggle drawer open and closed',
    language: 'View the site in Spanish',
    backToTop: 'Back to top of page',
    on: 'on',
    profilePic: 'Photo of Patricio Poncini',
  },
  langToggle: 'ES',
  home: {
    hello: "Hi, I'm...",
    tagline: 'Building technology with a human purpose.',
    exploreBlog: 'Explore my blog',
    experience: 'Experience',
    aboutMe: 'About me',
    intro:
      "I'm Patricio Poncini, a <b>Backend Engineer</b> with a degree in <b>Computer Programming</b>. I design and build distributed systems and high-performance services with <b>Kotlin, Go and TypeScript</b>, always looking for the balance between technical excellence and real business value.",
    knowMore: 'Learn more about me',
    recentPosts: 'Recent posts',
    allPosts: 'All posts',
    recentProjects: 'Recent projects',
    allProjects: 'All projects',
    connect: "Let's connect",
    contactText: 'You can reach me by email or find me on social media.',
  },
  about: {
    paragraphs: [
      "I'm Patricio Poncini, a <b>Software Engineer</b> focused on backend, with experience taking products from idea to production: design, development, deployment and continuous improvement. I work with <b>Go, Kotlin and TypeScript</b> on cloud architectures in <b>AWS</b>, building reliable systems that are ready to scale.",
      'At <b>itti</b>, I am part of the Loyalty team for Upys, the points and rewards platform. There I designed and built the engine that processes transactions from different payment methods to assign points and rewards to users. I also take part in product architecture decisions and build automation tools to process large volumes of data and handle complex migrations.',
      'I care about where technology meets business: I like to understand why we build something before deciding how. Testing, good design and clean architecture are tools that help a product change fast without carrying unnecessary technical debt.',
    ],
    contact: 'Contact',
    contactText: 'You can reach me by email or find me on social media.',
  },
  footer: {
    backToTop: 'Back to top',
  },
  article: {
    back: 'Back',
    prev: 'Previous',
    next: 'Next',
    demo: 'See demo',
    repo: 'See repository',
    readingTime: 'min read',
  },
  search: {
    placeholder: 'What are you looking for?',
    filterPlaceholder: 'Search',
    tags: 'Tags',
    found: 'Found {count} results for',
    showing: 'Showing {count} of {total}',
    ascending: 'Ascending',
    descending: 'Descending',
    post: 'post',
    project: 'project',
  },
}

export const ui: Record<Lang, UI> = { es, en }
