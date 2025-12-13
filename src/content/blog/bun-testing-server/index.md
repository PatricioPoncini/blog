---
title: 'Introducción al Testing en Backend: Unit vs Integration'
summary: 'Descubrí por qué el testing es indispensable en el desarrollo profesional. Aprendé las diferencias entre Unit e Integration tests y mirá ejemplos prácticos de cómo implementarlos en TypeScript para dormir tranquilo cuando deployas.'
date: '2025-11-24'
draft: false
tags:
  - Desarrollo
  - Testing
  - Typescript
---

## ¿Qué es el testing del código?

El testing de software consiste en la práctica de escribir pruebas automatizadas que verifiquen el correcto funcionamiento de tu propia implementación. Aunque al principio puede sonar raro, se vuelve completamente natural (e indispensable en mi opinión) a medida que los proyectos crecen en complejidad.

Implementar testing es una muy buena práctica porque permite asegurarnos de que el código realmente hace lo que debería hacer. Desde un punto de vista técnico los casos de prueba nos permiten evaluar distintos escenarios: tanto los casos exitosos como aquellos en los que el código debería fallar o manejar errores adecuadamente. Por ejemplo:

- Verificar el guardado de datos enviados a un endpoint.
- Comprobar la persistencia en la base de datos de ciertos valores.
- Validar la respuesta de un endpoint ante datos inválidos.
- Entre otros

## ¿Qué beneficios trae desarrollar casos de test?

Incorporar testing en tu flujo de trabajo trae ventajas inmediatas y a largo plazo:

- **Validación del comportamiento:** Nos permite asegurar que el código reaccione como esperamos ante distintos caminos. No solo validamos el "camino feliz" (cuando todo sale bien), sino también los casos borde o de error, garantizando que la aplicación no explote cuando algo falla.
- **Detección temprana de errores (Bugs):** Muchas veces al escribir el test nos damos cuenta de que nos faltó una validación o que la lógica estaba floja. Es mejor encontrar el bug mientras escribís el test que recibir el reporte de un usuario enojado.
- **Refactorización segura y deploy con confianza:** Esta es la clave. Si tenés una buena suite de tests cubriendo tu lógica, podés hacer cambios, optimizar o refactorizar código con la tranquilidad de que, si rompiste algo, los tests te van a avisar antes de subir a producción.

## Tipos de casos de test

### Unit test

Los **_*unit tests*_** (o tests unitarios) verifican una pieza pequeña y aislada del código sin depender de servicios externos como una base de datos o una API por ejemplo.

Como en estas pruebas solo queremos comprobar la lógica interna, es común usar **_*mocks*_**: objetos falsos que reemplazan servicios reales para controlar su comportamiento durante el test.

Por ejemplo, imaginemos que tenemos un servicio que envuelve el cliente de Redis:

```ts
static lpush(key: string, value: string) {
    return this.client.lPush(key, value);
}
```

Para testear esta función no necesitamos Redis ejecutándose, sino únicamente asegurarnos de que:

1. Se llama al método correcto
2. Se llama con los parámetros correctos
3. Devolvemos lo que esperamos

Para eso podemos reemplazar el cliente real por un mock:

```ts
test('Should call lPush on the client', async () => {
  const fakeClient = {
    lPush: mock(async () => 1),
  }

  ;(RedisService as any).client = fakeClient

  await RedisService.lpush('messages', 'hello')

  expect(fakeClient.lPush).toHaveBeenCalled()
  expect(fakeClient.lPush).toHaveBeenCalledWith('messages', 'hello')
})
```

La ventaja es que las pruebas son rápidas, aisladas y no dependen de servicios externos.
La desventaja es que estamos simulando el comportamiento del servicio, por lo que el mock solo cubre aquello que nosotros imaginamos. Es decir: si el servicio real se comporta distinto en algún escenario que no mockeamos, el unit test no lo va a detectar. Otro riesgo es que si la API del servicio cambia, el caso de test seguiría pasando pero al subir el código a producción nos encontraríamos con un error.

### Integration test

Los **_*integration tests*_** (o tests de integración) son una forma de testear donde varios componentes de una aplicación trabajan juntos para ver si el sistema completo se comporta como debería.

Por ejemplo, imaginemos un endpoint que busca un usuario en la base de datos. Si el usuario no existe, devuelve un 404 con un mensaje de error. Un test de integración podría levantar una base de datos real (por ejemplo con Docker), conectarse a ella y validar qué pasa cuando realmente buscamos un usuario que no existe. El objetivo es validar la interacción real entre los componentes y los servicios externos.

En esencia, estos tests verifican que varias piezas del sistema funcionen bien en conjunto. En el ejemplo siguiente lo que queremos validar es que:

- El endpoint reciba la petición
- Valide correctamente el body
- Guarde el mensaje en la base de datos real (Redis en este caso)

Como acá usamos un servicio real, lo primero es levantarlo. Lo más cómodo es hacerlo con un contenedor Docker, así no tocamos nuestra base local y siempre tenemos un entorno limpio para testear. Una vez levantado Redis, conectamos nuestro cliente y borramos el contenido de la key `"messages"`. Esto es **_importante_**: los tests de integración siempre deben empezar desde un estado limpio.
Si no, los resultados pueden fallar o variar dependiendo del orden de ejecución. Para esto usamos `beforeEach` donde definimos las acciones que deben ejecutarse antes de cada prueba, como limpiar la base de datos.

Con todo el entorno preparado, ya podemos correr los tests. El siguiente ejemplo demuestra que al enviar un mensaje vía POST:

- El endpoint responde con status 200
- Efectivamente el mensaje queda guardado en Redis

```ts
describe('Message Routes', () => {
  beforeEach(async () => {
    await RedisService.start()
    await RedisService.op().del('messages')
  })

  afterAll(async () => {
    await RedisService.stop()
  })

  test('POST /messages → stores a new message successfully', async () => {
    const req = new Request('http://localhost/messages', {
      method: 'POST',
      body: JSON.stringify({ text: 'hi' }),
    })

    const res = await messageRoutes.request('/', req)
    expect(res.status).toBe(200)

    const count = await RedisService.lrange('messages', 0, 10)
    expect(count.length).toBe(1)
  })
})
```

A medida que aumenten los casos de test, también se vuelven más variados. Por ejemplo podemos validar que el endpoint rechace peticiones inválidas. Este caso prueba que si enviamos un número en vez de un string, el servidor debe:

- Devolver un 400
- Mostrar un mensaje de error
- No guardar nada en la base de datos real

```ts
test('POST /messages → returns 400 when text is not a string', async () => {
  const req = new Request('http://localhost/messages', {
    method: 'POST',
    body: JSON.stringify({ text: 10 }),
  })

  const res = await messageRoutes.request('/', req)
  const data = (await res.json()) as ErrorResponse

  expect(res.status).toBe(400)
  expect(data.error).toEqual('Invalid body: expected { text: string }')

  const count = await RedisService.lrange('messages', 0, 10)
  expect(count.length).toBe(0)
})
```

En resumen: los tests de integración son ideales para asegurarte de que el sistema realmente funcione cuando sus piezas colaboran “en la vida real”. Son más lentos que los unit tests pero también más cercanos al comportamiento se espera en producción.

## Conclusión

A medida que crecés como desarrollador, te das cuenta de que los tests no son un "extra", sino una necesidad. No se trata solo de escribir código, sino de construir software robusto que soporte miles de ejecuciones sin fallar. Incorporar testing no solo te da paz mental al momento de deployar, sino que eleva significativamente la calidad profesional de tu trabajo.

Para bajar toda esta teoría a tierra, armé un repositorio de ejemplo. Es un servicio backend simple utilizando TypeScript, Bun y Redis que expone endpoints para guardar y leer mensajes. Lo interesante es que ahí vas a encontrar aplicados todos los conceptos que vimos hoy: desde unit tests con mocks hasta pruebas de integración con contenedores reales.

Sentite libre de clonarlo, usarlo de base o romperlo para aprender. Y si se te ocurre alguna mejora o querés sumar más casos, ¡mandá tu PR que será más que bienvenido!

- 👉 Link al repo: https://github.com/PatricioPoncini/bun-testing-lab

## Links útiles

- [Unit testing - Software Testing](https://www.geeksforgeeks.org/software-testing/unit-testing-software-testing/)
- [What is integration testing?](https://www.ibm.com/think/topics/integration-testing)
- [Difference between Unit Testing and Integration Testing](https://www.geeksforgeeks.org/software-engineering/difference-between-unit-testing-and-integration-testing/)
