---
title: 'Idempotencia: ¿Qué pasa si la misma request llega dos veces?'
summary: 'En redes distribuidas, la pregunta no es si un mismo request va a llegar duplicado, sino cuándo. La idempotencia es lo que hace que eso no importe. En este post vemos el problema, los patrones para resolverlo y un ejemplo concreto en Go.'
date: '2026-06-14'
draft: false
tags:
  - Go
  - Backend
  - Idempotency
---

# ¿Qué es la idempotencia?

La definición de idempotencia dice que es **la propiedad para realizar una acción determinada varias veces y aun así conseguir el mismo resultado que se obtendría si se realizase una sola vez**. Hay un ejemplo de la vida cotidiana que explica esto de manera perfecta:

Cuando estás esperando el ascensor y apretás el botón, ¿qué pasa si lo apretás de nuevo? Nada. El ascensor ya fue llamado. La segunda vez que apretás el botón, el sistema lo ignora po rque el efecto ya fue producido. No importa cuántas veces lo toques el resultado siempre es el mismo.

Eso es la idempotencia. Una operación es idempotente cuando ejecutarla una vez tiene el mismo efecto que ejecutarla múltiples veces.

En matemática se escribe así: `f(f(x)) = f(x)`. Pero en la práctica significa algo mucho más concreto: si un cliente manda el mismo request dos veces, el sistema debería producir el mismo resultado sin efectos secundarios adicionales.

# ¿Por qué los reintentos son inevitables?
Imaginá que estás comprando entradas para un recital. Apretás "Confirmar compra", la pantalla se queda girando y después de 10 segundos te aparece un error genérico. ¿Se procesó el pago o no? No tenés idea. Lo único que podés hacer es intentarlo de nuevo y esperar que esta vez funcione.

Eso mismo pasa en el mundo real todo el tiempo: la conexión se cae antes de que llegue la respuesta, el servidor tarda demasiado y el cliente hace timeout, la app se cierra en el momento equivocado, o simplemente el usuario se desespera y aprieta el botón dos veces.

En todos esos casos el cliente no sabe si el servidor llegó a procesar el request o no. Su única opción razonable es reintentar. Y si tu sistema no está preparado para eso, el resultado son pedidos duplicados, cobros dobles, o usuarios registrados dos veces.

Los reintentos no son un bug del cliente. Son una respuesta lógica ante la incertidumbre de las redes distribuidas. Tu servidor tiene que estar diseñado para recibirlos.

# Operaciones que ya son idempotentes
Antes que nada vale la pena entender qué operaciones HTTP son naturalmente idempotentes:

- **GET**: Siempre idempotente. Pedís datos, los obtenés. Pedirlos de nuevo no cambia nada (asumiendo que no hubo cambios en la información que estas solicitando mientras ejecutas las peticiones).
- **HEAD:** Como el cliente no recibe ningún body como response, solo los headers, es idempotente.
- **PUT:** Idempotente por diseño. `PUT /users/1` con el mismo body siempre deja al usuario en el mismo estado.
- **DELETE:** Borrar algo que ya fue borrado debería simplemente no hacer nada (o devolver 404).

La mayoría de las operaciones críticas de un sistema (crear un pago, registrar un usuario, emitir una factura, etc) son **POST** y ninguna de ellas es idempotente de forma natural. Hay que hacerlas idempotentes explícitamente. Pero, ¿como se logra eso?

# ¿En qué tipo de sistemas se puede aplicar?

## APIs REST
Como mencionamos antes, POST no es idempotente por naturaleza, pero podemos hacerlo serlo con un pequeño contrato entre cliente y servidor. La idea es pedirle al cliente que incluya un header (convencionalmente llamado `Idempotency-Key`) con un valor único por operación, típicamente un UUID que genera del lado del cliente antes de mandar el request.

Del lado del servidor, la lógica es simple: cuando llega el request, buscamos esa key en la base de datos. Si ya existe, devolvemos exactamente la misma respuesta que devolvimos la primera vez. Si no existe, procesamos la operación normalmente, guardamos el resultado y registramos la key para futuras verificaciones.

El cliente puede reintentar las veces que quiera. El proceso de la información siempre ocurre una sola vez.

![alt text](/photos/idempotency_key_api_rest.png)

### Código de ejemplo
Veamos cómo se vería esto en un handler de Go. El flujo es simple: si la key ya existe devolvemos el resultado guardado, si no existe procesamos y guardamos. Dos caminos, una sola línea de lógica de negocio.

```go
func HandlePayment(w http.ResponseWriter, r *http.Request) {
    // Se obtiene el valor dentro del header
    key := r.Header.Get("Idempotency-Key")
    if key == "" {
        http.Error(w, "Idempotency-Key requerida", http.StatusBadRequest)
        return
    }

    // ¿Ya se procesó este request?
    if cached, err := redisClient.Get(ctx, key).Result(); err == nil {
        // En caso que si ya se haya procesado, se devuelve la petición cacheada
        w.Header().Set("Content-Type", "application/json")
        w.Write([]byte(cached))
        return
    }

    // Se procesa y se guarda el resultado
    response := processPayment(r)
    data, _ := json.Marshal(response)
    redisClient.Set(ctx, key, string(data), 24*time.Hour)

    // Se genera y devuelve la response
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusCreated)
    w.Write(data)
}
```

## Colas de mensajería
El mismo principio aplica cuando consumís eventos de una cola como SQS o RabbitMQ. En la entrega __at-least-once__, un mensaje puede llegar más de una vez si el broker no recibió confirmación a tiempo. Para manejarlo, al recibir un evento tomamos su ID de transacción y lo buscamos en la base de datos.

Si ya existe, le damos ACK a la cola pero ignoramos el evento (ya fue procesado). Si no existe, procesamos el evento, guardamos el ID y recién entonces damos el ACK. El resultado hacia la cola es siempre el mismo (un ACK), pero internamente nos aseguramos de que el efecto ocurra una sola vez.

![alt text](/photos/idempotency_key_queue.png)

# Detalles que importan en producción
La implementación básica es sencilla, pero hay algunos edge cases que vale considerar antes de llevar esto a un sistema real.

- **¿Qué pasa si llega la misma key con un body diferente?** La convención es devolver un `409 Conflict`. Si el cliente manda la misma key con parámetros distintos, algo está mal de su lado y no se debería procesar el request.
- **¿Cuánto tiempo guardás se guarda la key?** Depende del dominio y no hay una respuesta universal. Pueden ser minutos, horas o días. La pregunta que tenés que hacerte es: ¿a partir de cuándo un reintento deja de ser un reintento y pasa a ser una operación nueva?
- **¿Qué pasa si dos requests con la misma key llegan exactamente al mismo tiempo?** La solución está en la arquitectura del código aplicando Optimistic Locking: en lugar de verificar si la key existe y después guardarla (dos operaciones separadas donde se pueden generar race conditions), se puede intentar escribir directamente con un insert atómico. Si se tiene éxito, este request procesa la operación. Si falla porque la key ya existe, significa que otro request llegó primero y se devuelve el resultado que ese primer request ya guardó. Sin bloqueos, sin esperas.

# Conclusión
La idempotencia no es un detalle de implementación, es una decisión de diseño. Y como la mayoría de las buenas decisiones de diseño, es invisible cuando está bien hecha: el usuario aprieta "Confirmar" dos veces y simplemente funciona.

La próxima vez que diseñes un endpoint POST, la pregunta que vale la pena hacerse antes de escribir la primera línea es: ¿qué pasa si este request llega dos veces? Si la respuesta no es "el mismo resultado", hay trabajo por hacer.

Gracias por leer, nos vemos en la próxima entrega 👋