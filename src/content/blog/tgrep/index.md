---
title: 'tgrep: un buscador de código pensado para agentes de IA que ya viene integrado en GitHub Copilot CLI'
summary: 'Un agente de IA puede hacer decenas de búsquedas en una sola tarea, y en un repositorio gigante cada una cuesta. tgrep, la herramienta de Microsoft que ya usa GitHub Copilot CLI, resuelve eso con un índice de trigramas. Cómo funciona y cómo le va contra ripgrep.'
date: '2026-09-25'
draft: false
tags:
  - Rust
  - Performance
  - DeveloperTools
  - AI
  - Search
---

## Contenido
- [El problema](#el-problema)
- [¿Qué es tgrep?](#qué-es-tgrep)
- [¿Cómo funciona tgrep?](#cómo-funciona-tgrep)
- [Prueba de benchmark](#prueba-de-benchmark)
- [¿Conviene usarlo?](#conviene-usarlo)

## El problema
En repositorios gigantes, donde hay miles y miles de archivos, `grep` y `ripgrep` (herramientas ya conocidas en el mundo IT) leen todos los archivos en cada búsqueda que se les pide. Esto tiene un problema y es la performance. Si bien se pueden ignorar archivos u optimizar la búsqueda con estas herramientas, muchas veces no alcanza.

`tgrep` resuelve esto con un índice. En lugar de leer todos los archivos en cada búsqueda, arma una sola vez un índice de trigramas y después lo usa para ir directo a los archivos que pueden tener lo que se está queriendo buscar. A eso le suma un servidor que mantiene el índice cargado en memoria y actualizado mientras se va modificando el código.

## ¿Qué es tgrep?
Es básicamente un motor de búsqueda indexado que utiliza búsquedas por trigramas con una arquitectura cliente/servidor para poder buscar regex de manera rápida en grandes bases de código. Está escrito en Rust al igual que `ripgrep`.

Microsoft lanzó `tgrep` para mejorar la eficiencia en las búsquedas de Github Copilot CLI, por lo que ya viene integrado en esta herramienta.

__Link al repositorio: https://github.com/microsoft/tgrep__

## ¿Cómo funciona tgrep?
`tgrep` recorre el proyecto (respetando archivos como `.gitignore` y salteando binarios y archivos de más de 64 MiB) y divide el contenido de cada archivo en trigramas: pedazos de 3 bytes que se van solapando. Por ejemplo, `hola` se parte en `hol` y `ola`. Después arma para cada trigrama una posting list con los archivos donde aparece.

### Cómo probar tgrep en un proyecto
Usaremos [gecko-dev](https://github.com/mozilla/gecko-dev) que es el código fuente de Firefox. Para esto vamos a necesitar primero indexar el proyecto, y luego levantar el servidor que nos servirá para poder hacer las búsquedas.

Para indexar un proyecto utilizando `tgrep` necesitamos ejecutar el comando `tgrep index .` y de esta manera veremos el siguiente output:
```sh
➜  gecko-dev git:(master) tgrep index .
Walking /Users/tripa/projects/pruebas/gecko-dev...
Found 375031 text files (12784 binary skipped, 1 too large, 0 errors)
Extracting trigrams...
Skipped 2398 additional binary files (detected by content)
Merging 61 spill segment(s) into the index...
Writing index (1128631 trigrams, 372633 files, 61 spill segment(s))...
Index built successfully at /Users/tripa/projects/pruebas/gecko-dev/.tgrep
Indexed in 23.9s using external strategy (peak memory 814.5 MiB)
```

Nos comparte cuantos archivos encontró, cuales omitió, si hubo errores y el tiempo que tardó en ejecutar la operación. 

Una vez indexado, ya podemos levantar el servidor y comenzar a utilizarlo. Para eso ejecutamos `tgrep serve .` y de esa manera queda levantado y listo para usar:
```sh
➜  gecko-dev git:(master) ✗ tgrep serve .
[trace] opened index: 372633 files, 1128631 trigrams in 109.0ms
[trace] serve ready in 1180.6ms. TCP on port 50665. Cache: max 50000 entries / 1024 MiB (entries over 64 MiB not cached). Memory cap: 8192 MB. Index threads: 5. Watcher queue cap: 16384.
[trace] refresh mode: auto, native watch budget=8192
[trace] watcher subscriptions deferred until the ignore matcher is ready
[trace] file watcher worker started (complete native coverage: true)
[trace] stale check: comparing index against filesystem...
[trace] gitignore matcher built from stale walk in 5.7ms (100 .gitignore + 0 .ignore files)
[trace] stale check: index is up-to-date (375031 files checked in 1213ms)
```

## Prueba de benchmark
Para la prueba de benchmark vamos a intentar buscar una interfaz de Firefox que aparece en una cantidad moderada de archivos, pero que es un buen caso de uso para probar la velocidad de búsqueda.

Para eso voy a estar utilizando [hyperfine](https://github.com/sharkdp/hyperfine) que es una herramienta CLI para benchmarking.

```sh
➜  gecko-dev git:(master) ✗ hyperfine --warmup 1 --runs 10 -N \
  'rg --no-heading --color never nsIObserverService .' \
  'tgrep --no-heading --color never nsIObserverService .'
Benchmark 1: rg --no-heading --color never nsIObserverService .
  Time (mean ± σ):      7.261 s ±  0.644 s    [User: 1.628 s, System: 31.044 s]
  Range (min … max):    6.406 s …  8.182 s    10 runs
 
Benchmark 2: tgrep --no-heading --color never nsIObserverService .
  Time (mean ± σ):      15.1 ms ±   0.8 ms    [User: 3.7 ms, System: 1.6 ms]
  Range (min … max):    14.0 ms …  16.3 ms    10 runs
 
Summary
  tgrep --no-heading --color never nsIObserverService . ran
  481.98 ± 50.32 times faster than rg --no-heading --color never nsIObserverService .
```

Como podemos observar `ripgrep` tarda unos 7 segundos en recorrer todo gecko-dev, mientras que `tgrep` responde en 15 milisegundos. Osea unas 480 veces más rápido aproximadamente.

Para comprobar que los resultados sean los mismos guardamos la salida de cada herramienta ordenada y con número de línea y las comparamos:

```sh
➜  gecko-dev git:(master) ✗ rg    --no-heading --color never -n nsIObserverService . | sort > /tmp/rg.txt
➜  gecko-dev git:(master) ✗ tgrep --no-heading --color never -n nsIObserverService . | sort > /tmp/tg.txt
➜  gecko-dev git:(master) ✗ wc -l /tmp/rg.txt /tmp/tg.txt
    1139 /tmp/rg.txt
    1139 /tmp/tg.txt
    2278 total
➜  gecko-dev git:(master) ✗ diff /tmp/rg.txt /tmp/tg.txt && echo "Resultados idénticos"
Resultados idénticos
```

Las dos encuentran las mismas 1139 coincidencias, en los mismos archivos y en las mismas líneas.

Igualmente esto tiene un tradeoff. `tgrep` trabaja sobre un índice que hay que generar previamente, consume espacio y recursos, y se mantiene actualizado con un servidor corriendo. `ripgrep` en cambio no necesita nada de esto y busca directamente en los archivos.

## ¿Conviene usarlo?
Depende (como muchas respuestas en IT). Si usás [Github Copilot CLI](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#environment-variables) ya lo estás usando sin saberlo, ya que dentro de un repositorio Git la herramienta usa `tgrep` para sus búsquedas. Aunque no lo usa siempre. Fuera de un repo Git vuelve a `ripgrep`. Si querés forzar uno u otro, está la variable de entorno `USE_TGREP`. 

Ahora, de manera personal me parece que es útil si estamos trabajando en proyectos muy grandes y queremos usar agentes de IA o hacer búsquedas muy específicas en bases de código enormes (como el proyecto gecko-dev que usamos para el benchmark).

Lo que tiene de bueno es que al indexar el proyecto, podemos levantar el servidor y el mismo escucha los cambios en los archivos, manteniendo vivo el índice, permitiendo que no tengamos que indexar seguido el proyecto, sino que este se vaya actualizando.

Para proyectos pequeños/medianos `ripgrep` me sigue pareciendo la mejor solución, aunque nunca está de más saber y conocer que existen otras herramientas que nos ayudan en casos más extremos.

__¡Gracias por leer, nos vemos en la próxima entrega! 👋__



