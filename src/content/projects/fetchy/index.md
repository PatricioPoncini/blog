---
title: "Fetchy: una utilidad CLI para obtener información del sistema"
summary: "De qué se trata Fetchy, por qué lo creé y cómo funciona por dentro."
date: "2025-11-15"
draft: false
tags:
  - Go
  - CLI
  - Linux
  - Herramientas
---

## ¿Qué es Fetchy?
Fetchy es una herramienta ligera escrita en Go que permite obtener información completa del sistema directamente desde la terminal. Muestra detalles del hardware, software, kernel, memoria, GPU, CPU y más —todo con un output limpio, colorido y fácil de leer.

Nació como una versión propia de las clásicas herramientas *neofetch*-like, pero enfocada en ser más simple, minimalista y construida totalmente a mi manera.

## ¿Por qué nació Fetchy?

Siempre me gustaron las utilidades que muestran información del sistema en la terminal, pero la mayoría son muy grandes, tienen miles de configuraciones o requieren dependencias externas. Quería algo:

- **simple**
- **escrito en Go**
- **rápido de ejecutar**
- y fácil de extender para aprender más sobre hardware y reconocimiento del sistema operativo

Además, quería usarlo para mis propias máquinas, ya sea para chequear specs, mostrar información en demos o simplemente divertirme creando una herramienta CLI desde cero.

Fetchy es una mezcla entre un proyecto personal, un ejercicio técnico, y una herramienta que realmente uso en mi día a día.

## Tecnologías usadas

Para construir Fetchy, utilicé:

- **Lenguaje principal**: Go
- **Estándar de Go**: para manejo de archivos, ejecución de comandos e introspección del sistema
- **Terminal ANSI**: para aplicar colores y estilos al output
- **Makefile**: para tareas de build y ejecución

Elegí Go porque es uno de mis lenguajes favoritos para crear herramientas pequeñas, portables y extremadamente rápidas. Además, compilar un binario único sin dependencias es ideal para este tipo de proyectos.

## ¿Cómo funciona internamente?

Fetchy obtiene información del sistema combinando:

1. Lecturas directas desde `/proc` y `/sys` (en Linux).
2. Ejecución de comandos internos (por ejemplo, para GPU o kernel).
3. Parsing de archivos del sistema para CPU, memoria y producto.
4. Detección del shell y terminal en uso.
5. Render del resultado en un formato limpio con colores ANSI.

## ¿Para qué sirve Fetchy?

- Conocer la información de tu sistema de un vistazo.
- Usarlo en capturas, demos o presentaciones técnicas.
- Diagnóstico rápido de hardware.
- Herramienta liviana para desarrolladores que cambian mucho de entorno.
- Base para quienes quieran aprender a leer datos del sistema desde Go.

## Demo
```shell

    ______     __       __         
   / ____/__  / /______/ /_  __  __
  / /_  / _ \/ __/ ___/ __ \/ / / /
 / __/ /  __/ /_/ /__/ / / / /_/ / 
/_/    \___/\__/\___/_/ /_/\__, /  
                          /____/   

A Lightweight System Info Tool

System Information:
User:        tripa
Hostname:    kitt
OS name:     Ubuntu 22.04.5 LTS
OS version:  22.04
Arch:        amd64
CPU:         12th Gen Intel(R) Core(TM) i5-12400F
Product:     System Product Name (ASUSTeK COMPUTER INC.)

Terminal:    /usr/bin/zsh
Kernel:      6.8.0-48-generic
RAM:         15Gi total, 9,0Gi used
GPU:         01:00.0 VGA compatible controller: NVIDIA Corporation GM206 [GeForce GTX 950] (rev a1)

Storage Info:
Model                     Size (GB)       
---------------------------------------------
KINGSTON                       894,3G              
WD                             931,5G              
---------------------------------------------
```

## ¿Y ahora qué sigue?
Hay varias ideas para futuras mejoras:

- Agregar soporte para más sistemas operativos.
- Mostrar barras de progreso para RAM o disco.
- Permitir flags adicionales como `--json` o `--minimal`.
- Crear un instalador simple multiplataforma.

Si te interesa ver el código, probarlo, o contribuir, podés visitar el repositorio en GitHub:

**[Ver Fetchy en GitHub](https://github.com/PatricioPoncini/fetchy)**
