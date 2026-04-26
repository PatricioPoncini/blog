---
title: '¿Por qué podés saltar al final de una película 4K al instante? El secreto del protocolo HLS.'
summary: '¿Alguna vez te preguntaste cómo plataformas como Netflix o YouTube te permiten ver contenido en 4K de 2 horas y, al hacer clic en el minuto 90, la reproducción empieza casi de inmediato? No es que el navegador descargó los 20GB de la película de golpe. La respuesta está en una arquitectura de "divide y vencerás..."'
date: '2026-04-26'
draft: false
tags:
  - Go
  - Backend
  - Streaming
  - Infrastructure
  - SystemsDesign
---

# La historia detrás
Hace tiempo me encontré con un problema recurrente: necesitábamos reproducir videos muy pesados en una plataforma, pero servirlos como archivos planos (`.mp4`) era inviable. El navegador intentaba descargar bloques gigantes de datos antes de mostrar el primer frame y esto generaba una muy mala experiencia para el usuario.

Investigando cómo optimizar la entrega de estos datos, me topé con una técnica que me cambió el chip. Entendí que el video no tiene por qué ser un bloque estático de 1GB, sino que puede ser un flujo constante de eventos. Implementar HLS no solo solucionó la carga pesada, sino que cambió totalmente mi forma de entender cómo funciona el streaming. 

Pero, ¿qué es exactamente este protocolo y cómo logra que todo parezca instantáneo? Vamos a verlo.

# HLS, ¿qué es?
HLS (HTTP Live Streaming) es un **protocolo de comunicación de transmisión de tasa de bits adaptativa** basado en HTTP y fue presentado por Apple en 2009. Originalmente fue la respuesta para llevar streaming de video a los dispositivos iPhone sin que colapsaran, reemplazando tecnologías propietarias y pesadas de la época. Hoy es por defecto el estándar de la industria para streaming en la web y dispositivos móviles.

HLS funciona sobre **TCP**, lo cual es clave ya que nos **garantiza que cada paquete llegue perfecto y en orden**. Básicamente el protocolo apuesta por una **filosofía de alta fidelidad**. Asegura una entrega multimedia de máxima confianza donde la integridad del video no se negocia.

# ¿Por qué sobre HTTP y TCP?
Como mencionaba recién, HLS se apoya en 3 pilares fundamentales que lo hacen tan robusto y a la vez fácil de escalar:

### Compatibilidad Universal
Al basarse enteramente en el protocolo HTTP, **HLS es compatible con casi cualquier infraestructura web moderna**. Esto le permite atravesar sin restricciones firewalls, proxies y redes corporativas estrictas, utilizando los puertos web estándar (80 y 443). A diferencia de protocolos antiguos (como RTMP), HLS **no requiere servidores especializados ni configuraciones de red complejas**, lo que simplifica el trabajo de infraestructura y el despliegue a gran escala.

### Fiabilidad vía TCP + ABR
Se podría pensar que usar TCP (un protocolo que prioriza la retransmisión de paquetes para garantizar la integridad) introduce demasiada latencia para el streaming. Sin embargo, **HLS compensa** este trade-off **con la Tasa de Bits Adaptativa (ABR)**. Si TCP demora un poco más en asegurar que un fragmento llegue perfecto, el reproductor simplemente ajusta la calidad del siguiente segmento. **Prioriza una reproducción fluida y una imagen impecable por sobre la latencia cero** (vital en videollamadas, pero no en VOD).

### Escalabilidad Masiva con Caché
Al tratarse de simples archivos estáticos servidos por HTTP, **los segmentos de video son "cacheables"** por diseño. Esto permite integrar fácilmente CDNs (como CloudFront de AWS o Cloudflare) para almacenar el contenido muy cerca del usuario final. Esta estrategia reduce drásticamente la latencia de carga y fundamentalmente libera al servidor de origen de procesar miles de peticiones concurrentes.

![alt text](/photos/hls_and_tcp.png)

# ¿Cómo funciona específicamente?
HLS no transmite un archivo, sino que transmite una lista de reproducción.
- **Segmentación**: Previo a la reproducción, el video debe cortarse en fragmentos pequeños (segmentos `.ts`) de por ejemplo 6 segundos.
- **El Manifiesto (`.m3u8`)**: Es un archivo de texto que actúa como índice. Cuando se mueve la barra de tiempo al minuto 90, el reproductor busca en el manifiesto qué segmentos corresponden a ese tiempo y los pide por HTTP.
- **Adaptive Bitrate (ABR)**: Esta es para mí la verdadera ventaja competitiva. Durante la segmentación, HLS no crea solo un grupo de archivos, sino varios conjuntos duplicados en diferentes calidades (480p, 720p, 1080p, etc.).
  - **¿La ventaja?** El reproductor de video del usuario monitorea constantemente el ancho de banda. Si detecta que la red flaquea, no muestra un cartel de error sino que utiliza el manifiesto de menor calidad y descarga el siguiente segmento en 480p.
  - **Calidad vs. Disponibilidad**: Cuando la red se recupera, vuelve a subir a 1080p. Esto maximiza la calidad que la red pueda soportar en cada segundo, evitando que el video se corte por completo. Sin ABR, el streaming en dispositivos móviles sería bastante más complicado.

![alt text](/photos/how_hls_works.png)

# Probando HLS localmente
Mucho texto, vamos a ver cómo funciona realmente. Para esta prueba, vamos a necesitar tres cosas: un video segmentado, un servidor que lo entregue y un cliente que lo reproduzca.

### Requisitos previos
Antes de empezar, asegurate de tener instaladas estas herramientas en tu máquina:
- [Go](https://go.dev/doc/install): Para correr el servidor que despacha los archivos.
- [FFmpeg](https://ffmpeg.org/download.html): Para procesar y segmentar el video (_Opcional: en el repo ya dejé el video segmentado por si queres saltearte este paso_).
- [Git](https://git-scm.com/install/): Para clonar el repositorio de ejemplo.

Como siempre, hice un mini-repo básico para este blog para que puedas probar directamente:

#### **Link al repo: 👉 https://github.com/PatricioPoncini/hls-server**

Para automatizar todo, preparé este script (`init.sh`) que prepara el video y levanta el servidor:
```shell
#!/bin/sh

# 1. Crea la carpeta de salida
mkdir -p hls_output

# 2. Segmenta el video 'video.mp4' con parámetros específicos
ffmpeg -i video.mp4 \
  -codec:v libx264 -codec:a aac \
  -map 0 \
  -f hls \
  -hls_time 6 \
  -hls_playlist_type vod \
  -hls_segment_filename "hls_output/seg_%03d.ts" \
  hls_output/index.m3u8

# 3. Levanta el servidor en Go
go run .
```

### ¿Qué hace cada comando?

Cada comando tiene su explicación:
- `-codec:v libx264` y `-codec:a aac`: Usamos los formatos estándar de video y audio para asegurar que cualquier navegador lo entienda.
- `-hls_time 6`: Le decimos a FFmpeg que corte el video en fragmentos de 6 segundos.
- `hls_playlist_type vod`: Indicamos que es "Video on Demand". Esto le dice al reproductor que el archivo tiene un principio y un fin (a diferencia de un vivo).
- `hls_segment_filename`: Definimos el patrón de nombres. En este caso, los archivos se verán como `seg_001.ts`, `seg_002.ts`, etc.

## Verificando en el navegador
Una vez que ejecutes `./init.sh`, el servidor de Go estará escuchando en el puerto `:8080`. Ahora abrí el archivo `index.html` en tu navegador.

¿Por qué abrir el HTML manualmente? Porque el servidor de Go solo se encarga de "servir" los archivos estáticos del video (`.m3u8` y `.ts`) con los headers de CORS correctos. El `index.html` contiene el reproductor que hará de cliente pidiéndole los datos al servidor.

Una vez que ejecutes el script y abras el archivo `index.html` seguí los siguientes pasos:
- Abrí las DevTools (F12) y andá a la pestaña Network.
- Filtrá por "All" y dale Play al video.
- Jaja, sí... fuiste Rickrolleado.

## ¿Qué es lo que vas a ver?

### Las primeras descargas
Vas a ver que lo primero que se descarga es el archivo `index.m3u8`, e inmediatamente después el primer segmento (`seg_000.ts` en este caso).

- **¿Por qué?** El manifiesto es solo el mapa. El reproductor lo lee para saber dónde empezar, pero para evitar que te quedes viendo un círculo de carga, pide el primer segmento de video al instante para llenar el buffer.
    
![alt text](/photos/hls-network-0.png)

Al hacerle doble click al archivo `.m3u8` este se descarga localmente, y si lo abrimos vemos que es solo una lista de texto con los nombres de los segmentos.
![alt text](/photos/hls-network-3.png)

### La catarata de segmentos
Al darle play se va a notar que no se descarga todo el video. A medida que el reproductor necesita datos, va a hacer peticiones HTTP nuevas para cada `seg_XXX.ts`.
![alt text](/photos/hls-network-1.png)

### El salto
Hacé la prueba de saltar mucho más adelante. Vas a ver cómo el navegador inmediatamente cancela lo que estaba bajando y pide el segmento exacto que corresponde a ese minuto. Ahí es donde realmente entendés por qué HLS es tan potente.
![alt text](/photos/hls-network-2.png)

_(En el ejemplo que estoy mostrando pasa del segmento `_005.ts` al `_030.ts`. Esto fue porque adelanté bastante el video)._

Esta capacidad de pedir solo lo que necesitamos es lo que hace que HLS sea tan eficiente. No solo ahorramos ancho de banda en el servidor, sino que le damos al usuario una experiencia fluida, sin importar si está viendo una publicidad de 15 segundos o el Dakar en 4K.

# Alternativas actuales

Aunque estamos hablando del protocolo HLS, no es el único. Existen diferentes alternativas:
- **MPEG-DASH**: El gran competidor "agnóstico". A diferencia de HLS (Apple), DASH es un estándar internacional. Funciona de forma muy similar pero es más común en entornos Android y Smart TVs.
- **WebRTC**: Si necesitás latencia menor a 500ms (como en una videollamada por ejemplo) HLS es muy lento. Ahí entra WebRTC, aunque es más complejo de escalar.
- **Low-Latency HLS (LL-HLS)**: La evolución de Apple para reducir el retraso a pocos segundos.

## Conclusión

Implementar esta solución en su momento me enseñó que, muchas veces, la clave no está en buscar la herramienta más compleja, sino en entender profundamente los protocolos que ya tenemos a disposición. Pasar de ver un video como un "archivo pesado" a entenderlo como un flujo inteligente de datos cambió mi perspectiva como desarrollador backend.

Espero que este posteo te haya servido para comprender qué hay detrás de ese botón de "Play" que apretamos mil veces al día. ¡Gracias por leer y espero que te haya gustado el experimento local! Nos vemos en la próxima entrega 👋