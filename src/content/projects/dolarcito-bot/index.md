---
title: "Presentando Dolarcito-Bot: tu asistente para cotizaciones"
summary: "Una mirada al proyecto Dolarcito-Bot: qué es, por qué lo construí, cómo funciona y qué tecnologías usé."
date: "2025-11-15"
draft: false
tags:
  - Bots
  - Go
  - Automatización
---

## ¿Qué es Dolarcito-Bot?
![Logo](https://camo.githubusercontent.com/d039cc1fe6d09d45ce8c45f3155ece46148d1742e705ea8602e718035874181a/68747470733a2f2f692e696d6775722e636f6d2f565a4d4a7a31692e706e67)
Dolarcito-Bot es un bot de Telegram que permite obtener cotizaciones en tiempo real (y con recordatorios automáticos) del dólar.

Es un proyecto en desarrollo que permite obtener la cotización del dólar, ya sea consultándola en el momento o mediante notificaciones automáticas. La idea nació de querer crear mi propia forma de acceder a cotizaciones en tiempo real o programadas, implementando una solución a mi estilo y con mis propias decisiones técnicas.
## ¿Por qué nació Dolarcito-Bot?

Este bot nació de la idea de poder tener algo automático que me recuerde día a día la cotización del Dólar en Argentina. La idea era poder armar esto como un proyecto, tanto para mí como para cualquier persona que le sirva.

En Argentina el mercado de valores cierra a las 17:00hs, por lo que me parecía una buena idea que al momento del cierre se me notifique sobre cuales fueron las diferentes cotizaciones, y además tener una breve comparación entre la cotización "Oficial" y "Blue", que es la que más me interesaba.

Si bien hay páginas hoy en día que muestran las cotizaciones en tiempo real, no quería dejar de desarrollar mi versión con las cosas que yo creía que serían interesantes para tener, y de paso poder divertirme un rato programando.

Lo construí para mí, pero también para cualquiera que necesite una herramienta simple y confiable para consultar el dólar desde su teléfono/computadora.
## Tecnologías usadas

Para construir Dolarcito-Bot, utilicé:

- **Lenguaje principal**: Go
- **API para cotización**: [DolarApi](https://dolarapi.com/docs/)
- **Base de datos**: PostgreSQL
- **Automatización**: cron job que ejecuta tareas programadas para enviar notificaciones a los usuarios

La decisión de usar Go vino por gusto, en próximos posteos se darán cuenta lo mucho que amo este lenguaje.

## ¿Cómo funciona internamente?

1. El bot consulta una API externa para obtener el valor actual del dólar.
2. Procesa la respuesta para extraer la cotización relevante.
4. Responde al usuario con el valor formateado utilizando Markdown.

Esto funciona tanto cuando el usuario solicita la cotización en el momento, como a través de una tarea programada ejecutada por un cron job. En este último caso, el sistema consulta en PostgreSQL los chats registrados y envía la notificación correspondiente a cada uno.

## ¿Para qué sirve Dolarcito-Bot?

- **Freelancers o trabajadores remotos** que cobran en dólares o en otra moneda: pueden verificar cotizaciones rápido y de manera automática.
- **Usuarios comunes** que solo quieren saber la cotización sin meterse a webs complicadas.

## ¿Y ahora qué sigue?

Mi plan para los próximos meses incluye:

- Agregar comandos más avanzados (por ejemplo, consultar cotización de otras monedas).
- Mejorar la documentación para que otros puedan contribuir más fácil.

Si te interesa colaborar, dar feedback o simplemente probarlo, podés visitar el repo en GitHub:

**[Ver Dolarcito-Bot en GitHub](https://github.com/PatricioPoncini/dolarcito-bot)**

