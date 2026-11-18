---
title: 'Cómo se comunican los microservicios: REST, colas y algo más'
summary: 'Cuando dividís un sistema en microservicios, la comunicación entre ellos se vuelve una decisión de diseño. REST para respuestas inmediatas, colas para procesos diferidos, y un vistazo a gRPC. Con ejemplos en Go y criterios para elegir.'
date: '2026-06-17'
draft: false
tags:
  - Backend
  - SystemsDesign
  - Microservices
---

# Contenido
- [Del monolito al microservicio](#del-monolito-al-microservicio)
- [Comunicación sincrónica vs asincrónica](#cómo-se-comunican-los-microservicios-comunicación-sincrónica-vs-asincrónica)
  - [Sincrónica](#sincrónico)
  - [Asincrónica](#asincrónica)
- [API REST](#api-rest)
  - [¿Cuándo usarlo?](#cuando-usarlo)
  - [Ejemplo en código](#ejemplo-en-código)
- [Colas de mensajería](#colas-de-mensajería)
  - [¿Cuándo usarlo?](#cuándo-usarlo-1)
  - [Ejemplo en código](#ejemplo-en-código-1)
- [¿Cuál elegir?](#cuál-elegir)
- [Extra: ¿Sabías que existe gRPC?](#extra-sabías-que-existe-grpc)
- [Conclusión](#conclusión)

# Del monolito al microservicio
Cuando comenzamos a desarrollar, generalmente hacemos todo en un mismo servicio. El clásico proyecto de "ToDo List": crear notas, completarlas, editarlas, eliminarlas. Simple, con ejemplos sacados de páginas web o tutoriales de YouTube, pero que sirvió (y sigue sirviendo) para dar los primeros pasos en el mundo de la programación.

Y está bien que así sea. Un monolito bien hecho es perfectamente válido para muchos sistemas, y no hay nada de malo en empezar por ahí.

Pero cuando el sistema crece, ya sea en usuarios, en funcionalidades o en equipos trabajando sobre él, muchas empresas optan por dividirlo en partes más pequeñas e independientes: los **microservicios**. Cada uno con su propia responsabilidad, su propio ciclo de vida y, muchas veces, su propio equipo detrás. Esto permite escalar, desplegar y mantener cada parte de forma independiente.

Y esa separación trae una pregunta nueva: si antes todo estaba junto y se comunicaba a través de llamadas internas, ahora que está separado... ¿cómo se comunican entre ellos?

# Cómo se comunican los microservicios: Comunicación sincrónica vs asincrónica
Antes de ver cada tecnología, es importante entender la diferencia entre estos dos modelos, porque define cómo los servicios se relacionan entre sí.

## Sincrónico
Imaginá que llamás por teléfono a alguien. Marcás el número, esperás que atienda, hablás, y recibís una respuesta en el momento. Si no atiende, lo sabés enseguida. Si lo hace, también.

Así funciona la comunicación sincrónica entre microservicios: el servicio **A** le envía una solicitud al servicio **B** y queda bloqueado esperando su respuesta antes de continuar. Si **B** tarda, **A** espera. Si **B** falla, **A** lo sabe en el
momento y puede reaccionar.

Para que esto funcione, **A** debe conocer a **B**: saber dónde está y cómo hablarle. Es una comunicación directa entre dos partes.

**Ejemplo**: Antes de publicar un post, el servicio de posts necesita verificar que el autor existe y está activo. Le consulta al servicio de usuarios y queda bloqueado esperando la respuesta. No puede continuar sin saber el resultado.

### Ventajas
- **Flujo predecible**: El modelo de solicitud-respuesta es lineal y fácil de seguir, lo que hace que el comportamiento del sistema sea más fácil de entender.
- **Consistencia inmediata**: Los cambios en los datos se confirman en el momento, sin lugar a estados intermedios o inconsistentes.
- **Errores claros**: Cuando algo falla, el error se propaga directamente al cliente, que puede reaccionar de inmediato.
- **Protocolos conocidos**: Se apoya en estándares ampliamente adoptados como HTTP y REST, lo que reduce la curva de aprendizaje.

### Desventajas
- **Acoplamiento directo**: En ocasiones, si el servicio **B** no está disponible, el servicio **A** tampoco puede funcionar.
- **Mayor carga en la red**: Mantener conexiones abiertas entre servicios incrementa el tráfico de red.
- **Consumo de recursos**: Conservar el estado de cada conexión activa implica un uso de memoria más elevado.
- **Fallos en cascada**: Un servicio caído puede arrastrar a los que dependen de él, propagando el problema por todo el sistema.

## Asincrónica
Ahora imaginá que en lugar de llamar, dejás un mensaje de voz en un grupo. Lo grabás, lo enviás, y seguís con tu día. No sabés exactamente cuándo lo van a escuchar, ni quién, pero confiás en que el mensaje va a llegar y en algún momento alguien lo escuchará.

Así funciona la comunicación asincrónica: el servicio **A** publica un mensaje en un intermediario (una cola o un bus de eventos) y sigue con su trabajo sin esperar respuesta. **A** no necesita saber quién va a procesar ese mensaje ni
cuándo.

Del otro lado, el servicio **B** escucha ese intermediario y procesa el mensaje cuando lo recibe. Y no solo B: varios servicios pueden estar escuchando el mismo canal y reaccionar de forma independiente al mismo evento.

**Ejemplo**: Cuando un usuario publica un post, el servicio de posts emite el evento `post_created` y sigue con su trabajo. El servicio de notificaciones lo recibe y avisa a los seguidores. El servicio de analytics lo recibe y registra la actividad. Ninguno de los dos sabe del otro, y el servicio de posts no sabe nada de ellos.

### Ventajas
- **Desacoplamiento real**: Los servicios no necesitan conocerse entre sí, lo que los hace más independientes y fáciles de modificar por separado.
- **Mejor uso de recursos**: Cada servicio procesa mensajes a su propio ritmo, sin quedar bloqueado esperando a otro.
- **Aislamiento de fallos**: Si un servicio falla, los mensajes permanecen en la cola y se procesan cuando vuelva, sin afectar al resto del sistema.
- **Tolerancia a picos de tráfico**: Los mensajes se acumulan en la cola y se procesan de forma ordenada, evitando que un pico de carga colapse el sistema.

### Desventajas
- **Obtener el resultado es más complejo**: Si el servicio **A** necesita seguir el ciclo de vida del mensaje que envió, implementar ese mecanismo requiere trabajo adicional.
- **Depuración más difícil**: Rastrear un error implica revisar los logs de varios servicios por separado, lo que hace más lenta la investigación.
- **Testing más complejo**: Probar flujos asincrónicos requiere coordinar múltiples servicios al mismo tiempo, lo que añade complejidad al momento de probar los desarrollos.

## API REST
REST se basa en el protocolo HTTP y es la forma más extendida de comunicación entre servicios. Cada servicio expone endpoints a los que otros pueden llamar usando los métodos estándar: `GET` para obtener datos, `POST` para crear, `PUT` o `PATCH` para modificar, y `DELETE` para eliminar. Las respuestas viajan en formato JSON, que es legible y fácil de trabajar desde cualquier lenguaje.

![alt text](/photos/rest.png)

### ¿Cuándo usarlo?
REST es una buena opción cuando la respuesta importa en el momento: validar datos, consultar información antes de continuar, o cuando el flujo depende del resultado de otro servicio. También es la opción natural cuando ya tenés equipos familiarizados con HTTP y no necesitás optimizar al máximo la performance de la comunicación.

**Ejemplo**: Antes de publicar un post, el servicio de posts necesita verificar que el autor existe y está activo. Le consulta al servicio de usuarios y espera la respuesta. No puede continuar sin saber el resultado.

### Ejemplo en código
```go
func getAuthorProfile(userID string) (string, error) {
    // Llamada HTTP GET al servicio de usuarios para verificar el autor
    resp, err := http.Get("http://users-service/users/" + userID)
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()

    // Estructura para deserializar la respuesta JSON
    var result struct {
        Username string `json:"username"`
    }
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return "", err
    }

    return result.Username, nil
}
```

## Colas de mensajería
Las colas de mensajería son un intermediario entre servicios: el servicio **A** deposita un mensaje en la cola y el servicio **B** lo consume cuando está listo. RabbitMQ y Amazon SQS son dos de las implementaciones más comunes. La cola garantiza que el mensaje no se pierda aunque **B** esté caído en el momento del envío.

![alt text](/photos/queue.jpeg)

### ¿Cuándo usarlo?

Cuando el servicio **A** no necesita saber el resultado de inmediato, cuando querés desacoplar productores de consumidores, o cuando necesitás absorber picos de tráfico sin sobrecargar los servicios que procesan los mensajes.

**Ejemplo**: Cuando un usuario publica un post, el servicio de posts emite el evento `post_created` y termina su trabajo. El servicio de notificaciones lo recibe y avisa a los seguidores del autor. Si el servicio de notificaciones estaba momentáneamente caído, el mensaje lo espera en la cola.

### Ejemplo en código
```go
// Publicar un mensaje (desde el servicio de posts)
func publishPostCreated(ch *amqp.Channel, postID string) error {
    // Serializa el evento como JSON
    body, _ := json.Marshal(map[string]string{"post_id": postID})
    // Publica el mensaje en la cola "post_created" y termina su responsabilidad
    return ch.Publish("", "post_created", false, false, amqp.Publishing{
        ContentType: "application/json",
        Body:        body,
    })
}

// Consumir el mensaje (desde el servicio de notificaciones)
func consumeNewPosts(ch *amqp.Channel) {
    // Escucha la cola de forma continua
    msgs, _ := ch.Consume("post_created", "", true, false, false, false, nil)
    for msg := range msgs {
        var event map[string]string
        // Deserializa el mensaje recibido
        json.Unmarshal(msg.Body, &event)
        notifyFollowers(event["post_id"])
    }
}
```

## ¿Cuál elegir?

| | REST | Colas de mensajería |
|---|---|---|
| **Tipo** | Sincrónico | Asincrónico |
| **Formato** | JSON / HTTP | Depende del broker |
| **Acoplamiento** | Alto | Bajo |
| **Performance** | Media | Media |
| **Complejidad** | Baja | Media |
| **Mejor para** | Consultas que necesitan respuesta inmediata | Procesos diferidos, notificaciones, eventos |
| **Ejemplo común** | Verificar datos antes de continuar un flujo | Notificar seguidores tras publicar un post |

## Extra: ¿Sabías que existe gRPC?

Además de REST y las colas, existe una tercera opción que vale la pena mencionar: **gRPC**. Es un protocolo desarrollado por Google que reemplaza JSON por buffers binarios (Protocol Buffers), lo que lo hace considerablemente más rápido. Los contratos entre servicios se definen en archivos `.proto`, con tipado estricto.

No es algo que vayas a ver en la mayoría de los proyectos, y está bien que así sea. Su adopción tiene sentido en sistemas con altísimo volumen de llamadas internas donde la latencia es un cuello de botella real. Fuera de ese contexto, la complejidad que agrega (archivos `.proto`, generación de código, curva de aprendizaje) generalmente no justifica el cambio.


## Conclusión

No existe una única forma correcta de comunicar microservicios. REST es simple y directo, ideal para cuando necesitás una respuesta en el momento. Las colas de mensajería te dan desacoplamiento y resiliencia cuando el resultado puede esperar.

La clave está en entender qué necesita cada flujo: ¿el servicio que llama necesita la respuesta para continuar? ¿Puede seguir sin ella? ¿Cuántas veces por segundo va a ocurrir esa comunicación? Esas preguntas guían la decisión mejor que cualquier regla fija.

En la práctica, la mayoría de los sistemas usan REST y colas en combinación. No es una elección de por vida, es una herramienta para cada problema.

**Gracias por leer, nos vemos en la próxima entrega 👋**