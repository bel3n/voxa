# Nerdearla Live Captions

Aplicación web para seguir charlas técnicas con subtítulos en vivo, traducción al español y una minuta ejecutiva generada con IA. Desarrollada en Google AI Studio para una hackathon.

Una persona transmite audio desde su navegador y quienes ingresan a la misma sala reciben los subtítulos. La transcripción continua y la traducción se procesan por separado: el texto original aparece primero y la traducción se incorpora cuando está disponible.

[Proyecto en Google AI Studio](https://ai.studio/apps/559bafa3-e238-48be-8d55-94d248695ca4)

## Funcionalidades

- **Transcripción en vivo:** texto provisional mientras se habla y fragmentos finales en el historial.
- **Traducción inglés → español:** vistas original, español y bilingüe, con estados de traducción pendiente, completa o fallida y opción de reintento.
- **Salas independientes:** identificador, título, glosario e historial por sala; un transmisor activo y múltiples espectadores.
- **Glosario técnico:** términos de referencia para la transcripción y la traducción.
- **Control del micrófono:** iniciar, detener y silenciar, medidor de volumen y estados de permiso, captura, conexión y transcripción.
- **Minuta ejecutiva:** resumen, aprendizajes, tecnologías mencionadas y conclusiones; permite copiar Markdown, descargar `.md` y regenerar el contenido.
- **Modo overlay:** subtítulos para proyector o fuente de navegador de OBS/vMix, con fondos transparente, oscuro, vidrio y croma verde/azul; posición, tamaño y desaparición por inactividad configurables.
- **Exportación TXT:** descarga del original o del español, identificando traducciones pendientes o fallidas.
- **Enlace de espectador:** permite compartir la sala sin que la otra persona active el micrófono.
- **Panel de validación:** herramientas manuales para revisar silencio, frases y métricas de latencia.

### Estado de Q&A y QR en esta exportación

El código incluye `QAPanelModal.tsx`, `QRModal.tsx`, los mensajes WebSocket de preguntas y una API de análisis con IA. Sin embargo, los dos componentes no están importados ni montados desde la aplicación principal de esta copia, por lo que su presencia en los archivos no implica que estén accesibles en la interfaz exportada.

El módulo Q&A implementa preguntas de la audiencia, votos, marcado como respondidas, eliminación y selección de preguntas destacadas con IA. El análisis usa las preguntas y un extracto de la charla para sugerir hasta 3–5 preguntas relevantes con una justificación; no implementa un chatbot de respuestas automáticas.

Si Q&A y QR ya aparecen en la versión de AI Studio, conviene exportar esa revisión más reciente para mantener esta copia sincronizada.

## Cómo funciona

```text
Navegador del transmisor
  Micrófono → Web Audio / AudioWorklet
            → PCM mono de 16 bits a 16 kHz, bloques de ~100 ms
            → WebSocket /ws
                         │
Servidor Node.js + Express
  Sala → Gemini Live → subtítulos provisionales y finales
                         │
                         ├─ WebSocket → transmisor y espectadores
                         ├─ Traducción asíncrona → actualización del fragmento
                         ├─ Historial → minuta ejecutiva
                         └─ Preguntas + contexto → selección Q&A con IA
```

### Captura y envío

`AudioCaptureService` obtiene el micrófono mediante `getUserMedia`. Un `AudioWorklet` remuestrea el audio a 16 kHz y produce fragmentos PCM de 1.600 muestras, equivalentes a 100 ms. El cliente los codifica en Base64 y los envía por WebSocket. La conexión de audio continúa mientras se reciben los resultados.

El cliente deja de enviar fragmentos cuando su buffer WebSocket supera 256 KB. El servidor mantiene una cola de hasta 20 fragmentos y descarta los más antiguos si se llena. Estos límites evitan acumular audio indefinidamente, pero pueden provocar pérdida de contenido si la conexión no alcanza a procesarlo.

### Transcripción y traducción

Cada sala del servidor administra su propia sesión de Gemini Live. Los resultados provisionales actualizan el subtítulo actual y los finales se agregan al historial. Los resultados finales que se identifican como español se conservan sin traducir; los restantes se envían al proceso de traducción inglés → español.

La identificación combina el idioma devuelto por el proveedor con una heurística de palabras y caracteres españoles. Puede equivocarse en frases cortas o ambiguas.

Las traducciones se asocian al identificador de cada fragmento, por lo que se actualizan sin reemplazar el orden de la transcripción. Si fallan, se mantiene el original y se comunica el estado del error.

### Modelos configurados en el código

| Función | Modelo |
| --- | --- |
| Transcripción continua | `gemini-3.5-transcribe-live` |
| Traducción principal | `gemini-flash-lite-latest` |
| Alternativa de traducción tras un error | `gemini-3.1-flash-lite`, hasta dos intentos |
| Minuta ejecutiva | `gemini-flash-lite-latest` |
| Selección de preguntas Q&A | `gemini-flash-lite-latest` |

Los nombres están definidos en `server.ts`. Las llamadas a Gemini se realizan desde el servidor usando `GEMINI_API_KEY`.

## Tecnologías

Las versiones indicadas son las declaradas en `package.json`, no versiones instaladas verificadas en esta revisión.

| Tecnología | Uso |
| --- | --- |
| React 19 y React DOM | Componentes, estado y renderizado de la interfaz. |
| TypeScript | Tipos compartidos, frontend y servidor. |
| Vite 8 + plugin React | Desarrollo con recarga y compilación del frontend. |
| Tailwind CSS 4 | Estilos, diseño adaptable y variantes visuales. |
| Node.js + Express 4 | Servidor HTTP, rutas de API y entrega de la aplicación. |
| `ws` 8 / WebSocket del navegador | Comunicación bidireccional de audio, subtítulos y estado de las salas. |
| Google Gen AI SDK (`@google/genai`) | Sesiones de Gemini Live y generación de traducciones, minutas y análisis Q&A. |
| Web Audio API y AudioWorklet | Captura, remuestreo, conversión PCM y medición del volumen. |
| Lucide React | Iconos de la interfaz. |
| `qrcode` | Generación de QR en el componente todavía pendiente de integración. |
| `dotenv` | Carga de variables del archivo `.env` en el servidor local. |
| `tsx` | Ejecución del servidor TypeScript. |
| Web Speech API (`speechSynthesis`) | Lectura de frases de prueba desde el navegador. |

`motion` figura como dependencia, pero no se encontraron importaciones en `src`. El proyecto incluye `bun.lock`; también define scripts ejecutables con npm. No utiliza una base de datos: salas, historial y preguntas viven en la memoria del proceso Node.js.

## Ejecutar localmente

Requisitos: Node.js, npm, acceso a los modelos Gemini configurados y un navegador con micrófono, Web Audio y AudioWorklet. `package.json` no fija una versión de Node mediante `engines`; el runtime elegido debe ser compatible con las versiones de las dependencias.

1. Abrí una terminal en esta carpeta:

   ```bash
   cd /Users/valegliesse/Documents/nerdearla-live-captions
   npm install
   ```

2. Creá un archivo `.env` en la raíz y completá:

   ```dotenv
   GEMINI_API_KEY=tu_clave
   ```

   El código usa `dotenv.config()`, que carga `.env` por defecto. El `.env.local` mencionado por el README original de AI Studio no es cargado explícitamente por este servidor. También podés definir `GEMINI_API_KEY` como variable del entorno o secreto del servidor. `.gitignore` excluye los archivos `.env*`, salvo `.env.example`.

3. Iniciá el servidor:

   ```bash
   npm run dev
   ```

4. Abrí `http://localhost:3000`.

El puerto está fijado en **3000** en `server.ts`. En desarrollo, Express integra Vite como middleware, por lo que no hace falta iniciar dos servidores.

### Compilación y ejecución de producción

```bash
npm run build
NODE_ENV=production npm start
```

La segunda línea usa sintaxis de macOS/Linux. En producción, Express sirve el frontend generado en `dist/` y mantiene el backend HTTP/WebSocket. `npm run preview` sirve para revisar el frontend compilado y no sustituye al servidor completo de la aplicación.

El micrófono requiere `localhost` o un sitio con HTTPS. Un enlace que apunte a `localhost` solo funciona en la misma computadora; para acceder desde celulares o equipos de espectadores se necesita una dirección accesible para ellos.

## Uso durante una charla

1. Elegí la sala y el rol de transmisor.
2. Configurá el título y el glosario técnico antes de iniciar la sesión.
3. Activá el micrófono, aceptá el permiso y verificá el medidor y el estado de Gemini.
4. Compartí el enlace de espectador con las personas que seguirán la charla.
5. Elegí la vista original, español o bilingüe según la necesidad.
6. Usá **Modo Overlay / OBS** para proyectar subtítulos o integrarlos a una transmisión.
7. Abrí **Minuta IA** cuando haya contenido y regenerala si querés incluir intervenciones posteriores.
8. Descargá el TXT y la minuta antes de reiniciar el servidor.

Ejemplo de enlace de espectador:

```text
http://localhost:3000/?room=sala-principal&role=viewer
```

Ejemplo de overlay:

```text
http://localhost:3000/?room=sala-principal&overlay=1&bg=chroma-green&pos=bottom
```

## Estructura del proyecto

```text
server.ts                         Backend, salas, Gemini y rutas HTTP/WebSocket
src/App.tsx                       Estado y composición de la aplicación
src/types.ts                      Tipos compartidos de la interfaz
src/services/audioCapture.ts      Captura y procesamiento del micrófono
src/services/socketClient.ts      Cliente WebSocket y reconexión
public/audio-processor.js         Procesador AudioWorklet
src/components/CaptionsViewer.tsx Subtítulos, historial y exportación TXT
src/components/OverlayView.tsx    Vista de proyección y fondos
src/components/MeetingSummaryModal.tsx  Minuta ejecutiva
src/components/QAPanelModal.tsx   Panel Q&A pendiente de montaje
src/components/QRModal.tsx        QR pendiente de montaje
src/components/ValidationBench.tsx      Validaciones manuales
metadata.json                    Metadatos y permiso de micrófono en AI Studio
vite.config.ts                   Configuración del frontend
```

## Rutas principales

| Ruta | Función |
| --- | --- |
| WebSocket `/ws` | Ingreso a salas, audio, subtítulos, traducciones y eventos Q&A. |
| `GET /api/health` | Estado del servidor y salas; incluye historiales de transcripción. |
| `POST /api/rooms/:roomId/summary` | Generación de minuta a partir del historial o transcripción enviada. |
| `POST /api/rooms/:roomId/qa/analyze` | Selección de preguntas relevantes con IA. |

## Validación

```bash
npm run lint
npm run build
```

`lint` ejecuta `tsc --noEmit`: comprueba tipos, no es una suite de pruebas funcionales. No hay un script `test` definido en esta exportación.

Para la demo, probar con voz real español e inglés, 15 segundos de silencio, una charla de un minuto, dos espectadores, traducciones pendientes/fallidas, descarga y modo overlay. El panel **Validar** muestra métricas y permite reproducir frases con síntesis de voz del navegador. Esa reproducción sale por los altavoces: no inyecta audio directamente en Gemini, y la cancelación de eco o el uso de auriculares puede impedir que llegue al micrófono.

Esta documentación se verificó contra los archivos exportados; no implica una nueva validación de ejecución o de llamadas a Gemini en esta carpeta.

## Límites de esta versión

- Salas, transcripciones y preguntas se pierden al reiniciar el servidor. La memoria de salas e historiales no tiene un límite global implementado.
- No hay autenticación ni almacenamiento compartido entre procesos. Los roles de transmisor/espectador no equivalen a usuarios autenticados; el panel Q&A tampoco tiene autorización de moderadores en el backend.
- `GET /api/health` devuelve historiales; tenerlo accesible equivale a hacer accesible ese contenido.
- La reconexión del cliente no recupera el audio descartado ni garantiza restaurar una sesión del proveedor sin interrupciones.
- Resúmenes, traducciones y selección de preguntas pueden equivocarse. La minuta recibe referencias de tiempo calculadas por índice de fragmento, no tiempos precisos del audio.
- La cabecera del TXT todavía menciona `gemini-3.8-flash` para la traducción; los modelos efectivos son los indicados en la tabla de `server.ts` anterior.
- La disponibilidad, cuota y demora dependen del proveedor. El prototipo no garantiza una latencia fija.
