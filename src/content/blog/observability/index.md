---
title: 'Más allá del Up/Down: Por qué el monitoreo no te alcanza para dormir tranquilo'
summary: "En arquitecturas distribuidas, un servicio que responde '200 OK' no siempre está sano. Para lograr una verdadera resiliencia, necesitamos entender la diferencia entre saber que algo falló (Monitoreo) y entender por qué falló (Observabilidad). Es la transición de la reacción ante incidentes a la comprensión profunda del sistema."
date: '2026-03-21'
draft: false
tags:
  - Typescript
  - Observabilidad
  - Backend
---

## El fin de la era "Up/Down"
Hoy en día, la complejidad de los sistemas que desarrollamos hace que el monitoreo tradicional sea insuficiente. Ya no lidiamos solo con fallos binarios (el servidor prendido o apagado). Nos enfrentamos a degradaciones sutiles, problemas de latencia en percentiles altos (P95/P99) y fallos en cascada.

La observabilidad no es una herramienta que se compra ni un módulo que se instala al final de un proyecto, es una propiedad de la arquitectura que nos permite interrogar al sistema sobre estados que nunca previmos.

![Observabilidad](/photos/observability.png)

## Monitoreo vs Observabilidad
Es común confundir estos términos, pero la distinción es clara:
- **Monitoreo (El "Qué"):** Se centra en los síntomas. Es el conjunto de métricas y alertas que nos avisan cuando un umbral predefinido se rompe. Nos dice que el sistema tiene fiebre, pero no nos dice la causa. Es reactivo por naturaleza.
- **Observabilidad (El "Por qué"):** Se centra en el estado interno. A través de la correlación de los tres pilares (logs estructurados, métricas y trazas), nos permite navegar la información disponible para encontrar el origen de un comportamiento anómalo, incluso si es la primera vez que ocurre.

## Impacto en la operación y el negocio
Implementar una estrategia sólida de observabilidad y monitoreo no es un "lujo" técnico, es una inversión que impacta directamente en la eficiencia del equipo y en la rentabilidad del producto. Estos son los problemas concretos que logramos mitigar:
- **Reducción drástica del MTTR (Mean Time To Recovery):** Sin observabilidad, ante un fallo en producción el equipo pierde horas tratando de adivinar el origen del problema. Al tener trazabilidad completa, pasamos de la suposición al diagnóstico basado en datos en cuestión de minutos. Esto nos ahorra cientos de horas de ingeniería al año y minimiza el impacto en el usuario final.
- **Detección de "fallos grises" antes que el cliente**: El monitoreo tradicional nos avisa cuando algo se cae, pero la observabilidad nos muestra cuando algo está funcionando mal (latencia alta, errores intermitentes, etc). Esto nos permite intervenir proactivamente antes de que los usuarios reporten problemas, protegiendo la reputación de la empresa.
- **Validación objetiva de deploys y features:** Elimina la incertidumbre técnica tras un lanzamiento. Al monitorear flujos internos en tiempo real, podemos validar si una nueva funcionalidad se comporta como esperamos bajo carga real. Si algo sale mal, lo detectamos al instante, permitiendo un rollback seguro o un hotfix preciso, evitando regresiones costosas.
- **Eliminación del sesgo en la toma de decisiones:** Un sistema observable permite que las discusiones sobre escalabilidad o cambios arquitectónicos dejen de ser opiniones subjetivas. Contar con métricas históricas y correlación de eventos permite al negocio planificar el crecimiento sobre una base sólida de datos reales.

## La tríada de datos y las señales de oro
Para que la observabilidad sea efectiva, no basta con recolectar datos, hay que saber qué mirar y donde mirar. Nos apoyamos en tres pilares:
- **Métricas:** Son datos agregados que nos dan la salud general. Aquí es donde monitoreamos las señales de oro: ¿Cuánta latencia tiene el P99? ¿Cuál es la tasa de error por segundo? ¿Qué tan saturada está la memoria del pod?
- **Logs estructurados:** Son los registros detallados de eventos. Un log con contexto y enriquecido de buena información nos permite entender el "porqué" de un fallo específico.
- **Traces:** Nos permite seguir una petición a través de toda la infraestructura, identificando cuellos de botella en el camino crítico de la solicitud.

![Observabilidad 2](/photos/pilares.png)

## El comienzo de la implementación
Entendido el valor operativo y de negocio, la pregunta es: ¿cómo arrancamos?

La realidad es que hoy en día tenemos muchas maneras de hacerlo, desde opciones base gratuitas hasta otras de pago donde tenemos todo ya preparado. Pero para darte un ejemplo, preparé un repositorio de ejemplo para que puedas ver como comenzar:

Link al repo: https://github.com/PatricioPoncini/opentelemetry-express-bun

Este repositorio contiene un servicio básico que utilizando [Opentelemetry](https://opentelemetry.io/) permite visualizar en Grafana un dashboard pre-configurado muy básico de salud del sistema, entre otras cosas. Dentro del archivo `README.md` vas a poder encontrar como levantarlo localmente, te invito a que lo hagas para que puedas explorar un poco como funciona la plataforma y que información te permite obtener.

![test](/photos/grafana_dashboard.png)

El objetivo de este mini proyecto (y de este posteo) es poder mostrar porque es realmente importante poder monitorear tu sistema y poder hacer uso de la observabilidad sobre el mismo. No solamente son ventajas que te van a ayudar en el desarrollo del día a día, sino que también ayuda cuando todo se está prendiendo fuego y debemos encontrar una solución lo más pronto posible.

La pregunta que nos tenemos que hacer como ingenieros no es si nuestro sistema está funcionando ahora, sino qué tan rápido podemos entender por qué falló cuando el dashboard se ponga rojo. La observabilidad no es un "nice to have"; es el seguro de vida de nuestra infraestructura.