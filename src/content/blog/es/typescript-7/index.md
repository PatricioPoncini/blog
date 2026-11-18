---
title: 'TypeScript 7.0: 10 veces más rápido gracias a un compilador en Go'
summary: 'El compilador de TypeScript deja de estar escrito en TypeScript: ahora corre nativamente en Go. Las razones detrás de la decisión, los números reales de las pruebas, y el detalle que puede frenar tu migración a la 7.0.'
date: '2026-08-28'
draft: false
tags:
  - Typescript
  - Go
  - Compilers
  - Performance
---

# Contenido
- [El compilador de TypeScript ya no está escrito en TypeScript](#el-compilador-de-typescript-ya-no-está-escrito-en-typescript)
- [Nueva versión: 7.0](#nueva-versión-70)
- [¿Qué le aporta Go a Typescript?](#qué-le-aporta-go-a-typescript)
- [¿Por qué Golang y no otro?](#por-qué-golang-y-no-otro)
- [¿Qué ventajas reales se vieron en las pruebas?](#qué-ventajas-reales-se-vieron-en-las-pruebas)
- [¿Qué cambios importantes trae la 7.0 además de la performance?](#qué-cambios-importantes-trae-la-70-además-de-la-performance)
- [Conclusión](#conclusión)

# El compilador de TypeScript ya no está escrito en TypeScript
Durante años, cada vez que abrías un proyecto grande en tu editor y sentías esos segundos (o minutos) de carga mientras el autocompletado se ponía al día, la razón era la misma: el compilador de TypeScript corre en Node.js, es single-thread, y no escala bien en proyectos con millones de líneas de código.

Microsoft encontró la solución en un lugar inesperado: reescribir ese compilador, literalmente archivo por archivo, en Go.

# Nueva versión: 7.0
Hace unos meses Microsoft anunció la nueva versión, adelantando que su compilador estaría construido en Go. La idea, según comentaron, es mantener la versión anterior y la nueva de manera paralela hasta que esta última adquiera madurez.

Para los que ya tienen experiencia programando, seguramente escucharon hablar de este lenguaje. Go (o Golang) es el lenguaje creado por Google que últimamente aparece cada vez más como reemplazo de herramientas pesadas: sintaxis simple, curva de aprendizaje corta, y un rendimiento que le compite de igual a igual a lenguajes compilados mucho más complejos.

Como dato personal, es mi lenguaje favorito: pocas veces encontré un lenguaje donde escribís tan poco código para resolver tanto.

# ¿Qué le aporta Go a Typescript?
Las mejoras que aporta Go no son en cuanto a performance de ejecución del código, sino al momento de compilar los proyectos: builds más rápidos, menos RAM utilizada, mejor escalado, entre otras cosas. Todo esto representa una mejora del lado del desarrollador; del lado del cliente no hay ningún cambio, ya que el código que se ejecuta sigue siendo Javascript por debajo.

Esto se nota especialmente en proyectos con bases de código grandes, donde antes los editores tardaban bastante en cargar el proyecto completo, y lo mismo pasaba al generar builds o correr procesos de CI. Ese fue, justamente, el problema que empujó a Microsoft a portear el compilador completo a Go.

# ¿Por qué Golang y no otro?
Tenían en claro que querían hacer, pero no sabían que lenguaje utilizar. Por eso fue que probaron con diferentes opciones (Rust, C#, C++), de hecho mucha gente se quejó de que no utilizaran C# siendo Microsoft quien lo desarrolló y además el lenguaje favorito de Anders Hejlsberg. 

A pesar de probar varias alternativas, su explicación del por qué fue Go el elegido fueron las siguientes:
- Buen uso del Garbage Collector para lo que estaban necesitando.
- El diseño de Go mapeaba bien con cómo ya estaba pensado el checker de Typescript internamente.
- Go es un lenguaje simple.
- Buen manejo de la concurrencia.

# ¿Qué ventajas reales se vieron en las pruebas?
Todas esas decisiones de diseño se tradujeron en un número concreto: comparado con la versión 6.0, la nueva versión compila hasta 10 veces más rápido, lo que también repercute en las builds. Y esto no se explica solo por el buen manejo que tiene Go de la concurrencia: en una prueba usando un solo thread, el compilador en Go ya rendía 3 veces mejor que el de Typescript.

Estas evidencias se pueden ver en el vídeo de 2025 donde anuncian este cambio, y muestran algunos ejemplos de las ventajas que ofrece Go contra Typescript. Lo que hicieron fue compilar un proyecto de 1.5 millones de líneas de código y ver cuanto tiempo tardaba.

**Link al anuncio del native port (2025)**: https://devblogs.microsoft.com/typescript/typescript-native-port/

**Link al anuncio oficial de la 7.0 (2026)**: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/

Vale la pena diferenciar estos dos anuncios: el primero, de 2025, es donde Microsoft presentó el compilador nativo en Go como preview y mostró las pruebas de performance que menciono arriba. El segundo, de julio de 2026, es el release oficial de la versión 7.0, que ya trae ese compilador por defecto.

## Tiempos con el compilador construido en Typescript
<img src="/photos/typescript_compiler_time.png" alt="TS Compiler" width="500" />

*Fuente: [anuncio del native port (2025)](https://devblogs.microsoft.com/typescript/typescript-native-port/)*

## Tiempos con el compilador construido en Go
<img src="/photos/golang_compiler_time.png" alt="Go Compiler" width="500" />

*Fuente: [anuncio del native port (2025)](https://devblogs.microsoft.com/typescript/typescript-native-port/)*

# ¿Qué cambios importantes trae la 7.0 además de la performance?
Más allá del compilador en Go, la 7.0 también actualiza algunos valores por defecto que venían de la 6.0: ahora `strict` viene activado por defecto, `module` pasa a ser `esnext`, y se elimina el soporte para ES5, los módulos AMD/UMD, `baseUrl` y la resolución de módulos "classic". Si tenés un proyecto viejo, es probable que necesites tocar la configuración antes de actualizar.

Pero el punto más importante, y que puede frenar tu migración, es este: **la 7.0 sale sin API programática**. Esa API recién llega en la versión 7.1. Esto significa que herramientas que dependen de poder invocar al compilador de Typescript de forma programática, como Vue, Angular, Svelte, Astro o MDX, todavía no pueden usar la 7.0 para su soporte de tipos embebido y van a seguir apoyándose en la 6.0 mientras tanto. Como solución temporal, se puede instalar `@typescript/typescript6` como `npm:@typescript/typescript6` para destrabar herramientas como typescript-eslint.

# Conclusión
Migrar un compilador completo a otro lenguaje no es una decisión menor, y mucho menos cuando ese compilador es la base de un ecosistema tan grande como el de Typescript. Lo interesante de este cambio no es solo la ganancia en velocidad, sino la filosofía detrás: priorizar la experiencia del desarrollador sin tocar en absoluto la experiencia del usuario final, que sigue ejecutando el mismo Javascript de siempre por debajo.

De igual manera, ver que Microsoft se anime a dejar de lado "su propio lenguaje" para elegir la herramienta que mejor resolvía el problema, deja una buena señal: no importa cuánta inversión haya detrás de una tecnología, si otra la resuelve mejor, vale la pena el cambio.

**¡Gracias por leer, nos vemos en la próxima entrega!** 👋
