---
title: 'Testing, ¿qué y para qué es?'
summary: 'Lorem ipsum'
date: '2025-11-24'
draft: false
tags:
  - Desarrollo
  - Testing
  - Typescript
---

## ¿Qué es el testing del código?
El testing dentro del código consiste en la práctica de escribir pruebas automatizadas que verifiquen el correcto funcionamiento de tu propia implementación. Aunque al principio puede sonar raro, se vuelve completamente natural (e indispensable en mi opinión) a medida que los proyectos crecen en complejidad.

Implementar testing es una muy buena práctica porque permite asegurarnos de que el código realmente hace lo que debería hacer. Desde un punto de vista técnico los casos de prueba nos permiten evaluar distintos escenarios: tanto los casos exitosos como aquellos en los que el código debería fallar o manejar errores adecuadamente. Por ejemplo:
- Guardado de datos enviados a un endpoint mediante una request
- Guardado en la base de datos de ciertos valores
- Validación de un endpoint ante datos inválidos enviados en la request
- Entre otros

## ¿Qué beneficios trae desarrollar casos de test?
Los beneficios que trae desarrollar casos de test son varios, pero algunos serían los siguientes:
- Validación de nuestro código de manera automática: Si queremos verificar que nuestro código se comporta de cierta manera, podemos generar casos de test donde validemos este camino (y otros que pueda tomar).
- Reducción de errores: Los casos de test nos ayudan a reducir errores, ya que muchas veces desarrollando casos de test encontramos validaciones/correcciones que podemos hacer en nuestro código para que sea mejor.
- 

### Validación del funcionamiento de nuestro código
Si queremos asegurarnos que nuestro código hace _A_, podemos desarrollar casos de test que validen que haga _A_, no _B_ ni _C_. Y que en caso de que yo quiera forzar a que haga _B_ o _C_, resulte en un error/validación específico que sé que puede ocurrir.