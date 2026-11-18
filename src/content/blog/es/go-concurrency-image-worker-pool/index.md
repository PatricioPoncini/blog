---
title: 'El núcleo de la concurrencia en Go: Goroutines, Channels y Worker Pools'
summary: 'No se trata solo de lanzar funciones al fondo. Aprendé a sincronizar procesos de forma segura y a implementar patrones de Worker Pool para resolver cuellos de botella reales aprovechando al máximo el hardware.'
date: '2026-03-08'
draft: false
tags:
  - Go
  - Concurrencia
  - Backend
  - Performance
---

## Más allá de la ejecución secuencial

En la ingeniería de backend, la eficiencia se define por el aprovechamiento integral del hardware. Mientras que el software convencional suele ejecutarse de forma secuencial —utilizando un solo núcleo del procesador y dejando el resto ociosos—, las arquitecturas modernas exigen un diseño capaz de distribuir la carga de trabajo.

Optimizar un sistema no se trata simplemente de "ganar velocidad", sino de maximizar el throughput (volumen de trabajo procesado) y reducir la latencia total mediante el paralelismo real. En este artículo, exploraremos cómo Go revoluciona este enfoque.

## ¿Qué es la concurrencia en software?

A menudo se confunde con el paralelismo, pero la concurrencia es la capacidad del lenguaje para gestionar múltiples tareas al mismo tiempo, mientras que el paralelismo es ejecutarlas físicamente en simultáneo. Go facilita ambos mediante un modelo de ejecución extremadamente ligero.

## Concurrencia en Go: El modelo CSP

Para implementar este modelo, Go se basa en dos pilares fundamentales que permiten la comunicación segura entre procesos sin la complejidad de los hilos (threads) tradicionales:

- **Goroutines**: La unidad mínima de ejecución asíncrona.
- **Channels**: El conducto seguro para el intercambio de datos entre ellas.

## ¿Qué son las Goroutines y los Channels?

Una Goroutine es una función que se ejecuta de manera independiente y concurrente cuando se lo indicamos haciendo uso de la palabra `go` dentro del código. Son ligeras, económicas de crear y las gestiona el runtime de Go.

Los Channels (o también conocidos como "canales") son los mecanismos principales de comunicación entre las Goroutines. Es un conducto tipado que permite enviar y recibir valores. Lo interesante de este es que un envío bloquea el proceso hasta que alguien recibe, y lo mismo viceversa, una recepción bloquea el proceso hasta que alguien envía.

## ¿Cómo sucede esta magia?

Vamos con un ejemplo bien práctico y sencillo de código:

```go
package main

import (
	"fmt"
	"time"
)

func prepareCoffee(order string, out chan<- string) {
	fmt.Printf("☕ Starting: %s\n", order)
	time.Sleep(1 * time.Second) // Simula el tiempo que tardaría la máquina de café
	out <- fmt.Sprintf("✅ %s is ready!", order)
}

func main() {
	orders := []string{"Espresso", "Latte", "Cappuccino"}
	results := make(chan string)
	start := time.Now()

	for _, coffee := range orders {
		go prepareCoffee(coffee, results) // Se comienzan a preparar los 3 cafés al mismo tiempo
	}

	for i := 0; i < len(orders); i++ {
		fmt.Println(<-results) // Recibimos cada café cuando esté listo
	}

	fmt.Printf("\nTotal time: %v (The 3 coffees took only 1s!)\n", time.Since(start))
}
```

- La definición del trabajo (`prepareCoffee`): Fijate en la firma de la función. Recibe un canal llamado `out` de tipo `chan<- string`. Esa flechita indica que este canal es solo para enviar datos. Al final de la función, la línea `out <- fmt.Sprintf(...)` es el momento donde el barista deja el café en la bandeja para que alguien más lo tome.
- Creando la bandeja de salida (`results`): Dentro de la función `main`, inicializamos nuestro canal con `results := make(chan string)`. Sin esta línea, no tendríamos dónde recibir las notificaciones de los baristas.
- La orden de prepararlo ya (`go prepareCoffee`): En el primer ciclo `for`, usamos la palabra clave `go`. Aquí es donde el programa se vuelve concurrente. En lugar de esperar 1 segundo a que se prepare el "Espresso", el código lanza la tarea al fondo y salta inmediatamente a la siguiente orden ("Latte").
- La espera inteligente (`<-results`): El segundo ciclo `for` es fundamental. La expresión `<-results` le dice al programa: "Quedate acá esperando hasta que un dato salga del canal". Como lanzamos 3 pedidos, necesitamos hacer este proceso 3 veces.

Como resultado tenemos que aunque cada café tarda 1 segundo, como todos se empezaron a preparar casi al mismo tiempo, el cronómetro final marcará apenas un poco más de 1 segundo en total.

```shell
☕ Starting: Cappuccino
☕ Starting: Espresso
☕ Starting: Latte
✅ Latte is ready!
✅ Cappuccino is ready!
✅ Espresso is ready!

Total time: 1.000344844s (The 3 coffees took only 1s!)
```

## Implementación: Sintaxis y Tipado

Acá nos ponemos más técnicos, veamos esta breve introducción para que sepas cómo podés utilizarlo en el código:

### 1. Goroutines

No necesitás configurar un thread pool complejo. Solo anteponés la palabra `go` a cualquier llamada de función:

- `go miFuncion()`: Ejecuta una función existente.

### 2. Channels

Se crean siempre con la palabra `make`:

- **Unbuffered (Sincrónicos)**: `ch := make(chan int)`. El emisor espera a que haya un receptor.
- **Buffered (Asincrónicos)**: `ch := make(chan int, 10)`. Permite enviar hasta 10 elementos antes de bloquearse, ideal para cuando el emisor es más rápido que el receptor.

### 3. Direccionalidad (Tipado fuerte)

Go te permite ser muy específico para evitar errores de lógica:

- `chan string`: Canal de lectura y escritura.
- `chan<- string`: Canal solo para enviar (el receptor dará error de compilación si intenta leer).
- `<-chan string`: Canal solo para recibir (el emisor no podrá meter datos ahí).

## Uso en procesos más avanzados

Ya tenemos lo básico de como podemos mejorar la performance de nuestro código en Go, pero ahora vamos a algo un poco más avanzado, un ejemplo de la vida real que sea más útil.

Supongamos que tenemos una página web que se encarga de bajarle el peso a las imágenes. Es común, muchas veces una imagen pesa 3mb pero es muy pesada para algunos sitios, por lo que queremos bajarle el peso sin sacrificar la calidad de la misma.

Para esto podemos tener un servidor backend desarrollado en Go que reciba las imágenes, las procese una por una y luego las devuelva con el peso reducido. Suponiendo que el procesamiento de cada imagen tarda 1 segundo, y nos llegan 10 imágenes, tardaríamos 10 segundos en procesar todas.

Pero nosotros ahora aprendimos a que podemos gestionar procesos concurrentemente, por lo cual podriamos procesar varias imágenes al mismo tiempo sin romper el flujo de trabajo, pero con un tiempo de respuesta muchísimo mejor. El siguiente ejemplo es uno un poco más avanzado:

```go
package main

import (
	"fmt"
	"image/jpeg"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"
)

const (
	inputDir  = "images"
	outputDir = "output"
	quality   = 20
)

func optimizeImage(fileName string) error {
	filePath := filepath.Join(inputDir, fileName)
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	img, err := jpeg.Decode(file)
	if err != nil {
		return err
	}

	outPath := filepath.Join(outputDir, "opt_"+fileName)
	outFile, err := os.Create(outPath)
	if err != nil {
		return err
	}
	defer outFile.Close()

	options := jpeg.Options{Quality: quality}
	return jpeg.Encode(outFile, img, &options)
}

func main() {
	files, _ := filepath.Glob(filepath.Join(inputDir, "*.jpg"))
	if len(files) == 0 {
		fmt.Println("No images found in 'images' folder. Please add some .jpg files.")
		return
	}
	_ = os.MkdirAll(outputDir, os.ModePerm)

	fmt.Printf("System: %d cores | Images to process: %d\n\n", runtime.NumCPU(), len(files))

	fmt.Println("Starting Sequential Optimization...")
	start := time.Now()
	for _, file := range files {
		_ = optimizeImage(filepath.Base(file))
	}
	seqDuration := time.Since(start)
	fmt.Printf("Sequential took: %v\n\n", seqDuration)

	_ = os.RemoveAll(outputDir)
	_ = os.MkdirAll(outputDir, os.ModePerm)

	numWorkers := runtime.NumCPU()
	jobs := make(chan string, len(files))
	var wg sync.WaitGroup

	fmt.Printf("Starting Worker Pool with %d workers...\n", numWorkers)
	start = time.Now()

	for w := 1; w <= numWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for fileName := range jobs {
				_ = optimizeImage(fileName)
			}
		}()
	}

	for _, file := range files {
		jobs <- filepath.Base(file)
	}
	close(jobs)
	wg.Wait()

	poolDuration := time.Since(start)
	fmt.Printf("Worker Pool took: %v\n", poolDuration)

	speedup := float64(seqDuration) / float64(poolDuration)
	fmt.Printf("\nPerformance gain: %.2fx faster\n", speedup)
}
```

### ¿Qué fue lo que cambió? La potencia del "Worker Pool"

En el ejemplo del café, lanzábamos una Goroutine por cada pedido. Eso funciona bien con 3 cafés, pero si tuvieras 10,000 imágenes, lanzar 10,000 procesos al mismo tiempo podría saturar la memoria y el procesador de tu servidor.

![Worker Pool](/photos/worker_pool.png)

Aquí es donde introducimos el patrón **Worker Pool**, sumando tres conceptos clave:

1. `runtime.NumCPU()`: Permite que nuestro código sea **autoconsciente del hardware**. En lugar de asignar recursos a ciegas, el programa detecta cuánta potencia real tiene el procesador para ejecutar tareas en paralelo de forma óptima, ya sea que esté corriendo en una laptop o en un servidor de alta capacidad.
2. `Worker Pool`: Este patrón establece un **límite de ejecución simultánea**. Al procesar un cupo máximo de imágenes a la vez, evitamos que el sistema intente hacer todo en un solo instante, lo cual saturaría la memoria y volvería inestable la aplicación. Así, el consumo de recursos se mantiene bajo control y predecible.
3. `sync.WaitGroup`: Dado que las tareas ocurren en segundo plano, necesitamos un mecanismo que sincronice su finalización. El `WaitGroup` funciona como un **contador de tareas activas** que le impide al programa principal cerrarse antes de que todas las imágenes se hayan guardado correctamente en el disco.

#### El veredicto del cronómetro

Si corrés este código en una carpeta con varias imágenes, verás algo impactante. Mientras que el modo secuencial usa solo un núcleo de tu CPU (el resto descansa), el Worker Pool pone a trabajar a todo el equipo en paralelo. El resultado no es solo un código más elegante, sino una mejora de rendimiento que suele ser de 4x a 10x más rápida, dependiendo de tu procesador.

```go
System: 12 cores | Images to process: 10

Starting Sequential Optimization...
Sequential took: 4.92 seconds

Starting Worker Pool with 12 workers...
Worker Pool took: 1.31 seconds

Performance gain: 3.76x faster
```

Te dejo el link al repositorio de Github por si queres probarlo vos mismo en tu propia computadora:

- https://github.com/PatricioPoncini/go-image-workerpool

## Casos de uso reales

- **Optimización de AWS Lambdas**: Al procesar lotes de forma concurrente, reducimos el tiempo de ejecución real. Esto **evita timeouts y optimiza drásticamente los costos de facturación** por milisegundo.
- **Procesamiento de Streams (Kinesis/SQS)**: Permite **procesar múltiples registros en paralelo**, balanceando la alta velocidad de ingesta de datos con la capacidad de escritura de la base de datos.
- **Cargas intensivas de CPU**: Ideal para tareas de hashing criptográfico, compresión de archivos o transcodificación, donde queremos **saturar los núcleos del procesador de forma controlada sin bloquear el hilo principal**.

## Conclusión: Eficiencia sobre velocidad

La concurrencia en Go es mucho más que una funcionalidad del lenguaje; es una filosofía de diseño que nos permite construir sistemas verdaderamente escalables.

Como vimos, pasar de una ejecución secuencial a una concurrente no solo reduce los tiempos de respuesta, sino que nos permite aprovechar al máximo el hardware que ya tenemos, manteniendo el sistema estable y predecible bajo carga masiva.

Espero que este ejemplo práctico te sirva de base para optimizar tus propios procesos. ¡Nos vemos en el próximo posteo!

### Artículos útiles

- [A Tour of Go, Concurrency](https://go.dev/tour/concurrency/11)
- [Concurrencia (informática)](<https://es.wikipedia.org/wiki/Concurrencia_(inform%C3%A1tica)>)
- [Explicación del Patron De Diseño Worker Pool](https://coffeebytes.dev/es/software-architecture/explicacion-del-patron-de-diseno-worker-pool/)
