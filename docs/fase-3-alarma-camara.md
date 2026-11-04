# Fase 3: alarma de despertar y verificación por cámara

Estado: **prototipo implementado** (`index.html`), con **especificación para la app nativa** (React Native + Expo) y **protocolo de pruebas en dispositivo real**.

## 1. Qué hay en el prototipo

| Pieza | Dónde | Funciona en |
|---|---|---|
| Conteo de flexiones y sentadillas con cámara (pose en el dispositivo) | Retos "Push-up Pressure", "Squat Sprint", "The Hundred" (interruptor "Count with the camera"), y la tarea de la alarma | GitHub Pages, archivo abierto en el navegador, app nativa. **No en el enlace de claude.ai**, que bloquea la cámara |
| Alarma con compromiso | Pestaña Plan → "Wake-up alarm" | Solo con la app abierta (en el prototipo); la nativa suena con el móvil bloqueado |
| Foto de comida | Food → "Log a meal" y desde la pila | En todas partes. La comprobación con IA solo donde la página puede usar Claude |

### Cámara (contador de repeticiones)

- **Modelo:** MediaPipe Pose Landmarker "lite", que **se carga solo al activar la cámara**, desde jsDelivr y Google Storage. Es la única dependencia externa de la app; si falla, se cuenta tocando la pantalla.
- **Privacidad:** cada fotograma se analiza en memoria y se descarta. **No se graba, guarda ni envía nada.** Se avisa en pantalla: "Nothing is recorded or sent".
- **Algoritmo (`pose-core`, funciones puras con 9 tests):**
  - Usa el lado del cuerpo que la cámara ve mejor (el móvil en el suelo, de lado).
  - **Flexión:** ángulo del codo (hombro-codo-muñeca). Cuenta al bajar de 95° y volver por encima de 150°, con el cuerpo recto (hombro-cadera-tobillo ≥ 150°).
  - **Sentadilla:** ángulo de la rodilla (cadera-rodilla-tobillo), bajando de 105° y volviendo por encima de 160°.
  - No cuenta hasta estar en la posición inicial, ni repeticiones más rápidas de 0,45 s (ruido).
  - **Indicaciones en pantalla:** "Go a little lower", "Keep your body in a straight line", "Get your whole body in the picture", "Slow down a little".
- **Esqueleto dibujado** sobre el vídeo, en espejo, para que el usuario vea que se le detecta.
- **El botón de tocar sigue disponible** por si la cámara se pierde una repetición.

### Alarma

- **Ajustes:**
  - Hora y nº de flexiones para apagarla (5, 10 o 15).
  - Modo **Commitment** o **Gentle**.
  - En Commitment, cada cuánto vuelve a sonar si dejas la tarea (3, 5 o 10 min).
  - **Pausa por enfermedad o viaje** (1 día, 3 días o 1 semana) y "Try it now".
- **Al sonar:**
  - Pantalla con la hora, "Good morning", tu "¿por qué?" y la tarea.
  - Sonido y vibración en bucle, y la pantalla no se apaga.
- **Tarea:** flexiones contadas con la cámara, o tocando si no hay. En modo de salud suave, un minuto de movimiento fácil.
- **Si dejas la tarea ("Later"):**
  - En Commitment vuelve a sonar a los N minutos, con un tope de 60 min desde el primer aviso; después se apaga sola, sin culpa.
  - En Gentle se apaga.
- **Salida de emergencia:**
  - Mantener pulsado 3 s y luego confirmar.
  - "No points today. Nothing is taken away." **Nunca resta puntos.**
- **Puntos (`alarm-core`):** 10 si la cámara verificó la mayoría de las repeticiones, 4 si se tocaron a mano, 0 con la parada de emergencia.
- `alarm-core` son funciones puras con 6 tests: próxima alarma, días de la semana, pausa, tarea, volver a sonar o tope, y puntos.

### Foto de comida

- **Foto opcional** con la cámara o la galería. Se queda en el móvil (en memoria) y no se guarda.
- **Dos toques:** qué comida es y qué hay en el plato (proteína, verdura o fruta).
- **Comprobación con IA opcional**, con su propio consentimiento: "Sends only this photo, once. Nothing is saved".
  - Claude responde si es comida, si tiene proteína y si tiene verdura.
  - Tiene prohibido comentar raciones, cuerpo o peso.
  - Si la foto no es comida, no hay puntos.
- **Alimenta la pila:**
  - Dos comidas con proteína y verdura → comida en verde.
  - Alguna con una de las dos → "mostly".
- **Puntos:** 3 por comida, con un máximo de 3 comidas al día.

> **Por qué no se verifica "cocinar":** como dijimos en la fase 0, una cámara no puede demostrar que alguien cocinó la receta. La foto más la lista es una comprobación de verosimilitud, honesta y con poco peso en puntos.

## 2. Especificación para la app nativa

### Alarma

| | iOS (26 o superior) | Android (13 o superior) |
|---|---|---|
| Programar | **AlarmKit**: alarma del sistema, suena aunque el móvil esté en silencio o en modo concentración | `AlarmManager.setAlarmClock()` + permiso `USE_EXACT_ALARM` (permitido para apps de alarma) |
| Al sonar | UI del sistema con botón "Stop" (no se puede quitar) y botón secundario que abre la app en la pantalla de tarea (App Intent) | Notificación a pantalla completa (`USE_FULL_SCREEN_INTENT`, permitido para alarmas) + servicio en primer plano con sonido en bucle |
| "No se para hasta hacer la tarea" | Al programar se crea una **serie**: la alarma principal + repeticiones cada N min hasta el tope (60 min). Al verificar la tarea **se cancelan las pendientes**. Si el usuario pulsa "Stop" del sistema, la siguiente de la serie vuelve a sonar | Igual: serie de alarmas exactas. El servicio también vuelve a sonar si se cierra la pantalla de tarea sin terminar |
| Salida de emergencia | En la app: mantener + confirmar → cancela la serie | Igual |
| Modo enfermo o viaje | No se programa en esos días | Igual |
| Después de reiniciar el móvil | AlarmKit las conserva | Receptor `BOOT_COMPLETED` que reprograma |
| iOS < 26 | Notificaciones locales repetidas (menos potentes, sin sonido en silencio) | — |

**Módulos nativos propios:** `alarm-ios` (Swift, AlarmKit) y `alarm-android` (Kotlin), con la misma API JS: `schedule(series)`, `cancelSeries(id)`, `onRing(cb)`, `onTaskOpen(cb)`.

### Cámara

- **VisionCamera** con un *frame processor*: en iOS, Apple Vision (`VNDetectHumanBodyPoseRequest`); en Android, ML Kit Pose Detection (modo stream).
- Ambos dan articulaciones equivalentes a las 33 de MediaPipe. Un adaptador las convierte al formato de `pose-core`, **así las reglas y los tests son los mismos**.
- **Procesamiento 100 % en el dispositivo.** Al servidor solo se envía el resumen: repeticiones, duración, confianza media y el token de integridad (App Attest o Play Integrity).
- **Antifraude no hostil:** si la confianza media es baja, o el patrón no es humano (demasiado regular o rápido), el intento queda "en revisión" con la mitad de puntos y sin acusar a nadie.

## 3. Protocolo de pruebas en dispositivo real

**Dispositivos mínimos:** un iPhone con iOS 26 o superior y un Android de gama media con Android 13 o superior. Si se puede, un móvil antiguo (rendimiento).

**Cómo probar el prototipo con cámara:** abrir la app desde GitHub Pages cuando el pull request esté en `main`, o abrir `index.html` en el navegador del móvil. En el enlace de claude.ai la cámara no está disponible.

| # | Prueba | Cómo | Correcto si |
|---|---|---|---|
| 1 | Colocación | Móvil en el suelo, de lado, a 1,5–2 m | Se ve el esqueleto y desaparece "Step into the picture" |
| 2 | 10 flexiones bien hechas | Ritmo normal | Cuenta 10 (±1) |
| 3 | Medias flexiones | 5 sin bajar | Cuenta 0 y dice "Go a little lower" |
| 4 | Cadera caída | 5 con la cadera hundida | Cuenta 0 y dice "Keep your body in a straight line" |
| 5 | Poca luz | Luz de noche | Avisa o cuenta con ≤ 2 fallos; si falla, el botón de tocar funciona |
| 6 | Ropa holgada u oscura | — | Cuenta con ≤ 1 fallo de cada 10 |
| 7 | Sentadillas | 10 de frente o de lado | Cuenta 10 (±1) |
| 8 | Alarma, camino feliz | Activar, "Try it now", hacer las flexiones | Se apaga, +10 (cámara) o +4 (toques) |
| 9 | Alarma, abandono | "Later" en modo Commitment | Vuelve a sonar a los N min; tras 60 min se apaga sola |
| 10 | Emergencia | Mantener 3 s y confirmar | Se apaga sin restar puntos |
| 11 | Pausa | "Pause 1 day" | No suena mañana; vuelve pasado mañana |
| 12 | Foto de comida | Foto real + IA | Detecta comida, proteína y verdura; no comenta la cantidad |
| 13 | Foto que no es comida | Foto de una mesa vacía | "That doesn’t look like a meal", sin puntos |
| 14 | Privacidad | Modo avión durante el reto con cámara (tras cargar el modelo) | Sigue contando (todo es local) |

Anotar en cada prueba: modelo de móvil, sistema, luz, fallos, y si la batería o el calor fueron un problema (más de 5 min de cámara).

## 4. Pendiente

- Pruebas en dispositivo real (la tabla de arriba), que no puedo hacer desde aquí.
- La alarma real que suena con el móvil bloqueado necesita la app nativa: empieza cuando deis la señal de React Native.
- Rachas, comodines y canjes completos: fase 4.
