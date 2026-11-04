# Duelos: grabar el intento y retar a un amigo

Estado: **implementado en el prototipo** (`index.html`). Decisión del equipo: **vídeo + resultado**, y competir con **reto 1 contra 1**.

## Cómo funciona

1. **Antes de empezar un reto:** interruptor **"Record my attempt"**. Se graba con la cámara frontal mientras haces el reto; se ve "REC" en la imagen.
   - Funciona donde la cámara en directo está permitida: GitHub Pages, archivo abierto en el navegador y la app nativa.
   - En el enlace de claude.ai la cámara en directo está bloqueada, así que **al terminar puedes "Add a video of this attempt"**, grabándolo con la cámara del móvil o eligiéndolo de la galería.
2. **El vídeo se queda en el móvil** hasta que decides compartirlo.
   - Los vídeos grandes, o en formato .mov del iPhone, **se comprimen en el propio móvil** a 480p y menos de 20 MB.
   - Tarda lo mismo que dura el vídeo.
3. **Pantalla de resultado:**
   - Casilla **"Share my result and video"**, que avisa de que lo verán todos los que tengan acceso a la app, con tu nombre.
   - Botón **"Challenge a friend"**.
4. **Tu amigo** abre la app, entra en Challenge y ve en **Duels**: "Ana challenged you · Squat Sprint: 45 reps" [Watch] [Beat it].
   - Al aceptar, el reto se abre con el aviso **"Duel: beat Ana 45 reps"**.
   - Al terminar ve **"You beat them! 52 vs 45"** y puede enviar su respuesta, con su vídeo si quiere.
5. **Los dos ven el resultado** en Duels: "You won / You lost: 45 vs 52", con botones para ver cada vídeo.
   - Quien reta puede **retirar** el desafío mientras nadie haya respondido; se borran el desafío y su vídeo.

Los duelos ignoran el bloqueo por nivel (puedes aceptar el reto de un amigo aunque no tengas ese nivel), pero **no la seguridad**: si tu revisión de salud bloquea los retos de alto impacto, también bloquea ese duelo.

## Quién puede participar (prototipo)

La página publicada guarda los duelos en su base de datos compartida. Con una cuenta personal de Claude:

- **Para que un amigo pueda responder y subir su vídeo, invítalo por email como Editor** desde el menú **Share** de la página. Con permiso solo de lectura verá los duelos, pero no podrá responder.
- **Todos los que tengan acceso ven todos los duelos y sus vídeos.** Es un prototipo para probar con un grupo de confianza, no con usuarios reales.

## Datos

- **Colección `duels`:** un documento por duelo con `challengeId`, `scaled`, `createdAt`, `from` y `to` (cada uno con `uid`, `score`, `medal`, `video` como id del vídeo subido, y `at`) y `status` (`open` o `answered`).
- **Solo se guardan ids de usuario,** nunca nombres; los nombres se resuelven al mostrar.
- **Vídeos:** se suben como archivos de la página, de máximo 20 MB. Admite mp4 y webm; lo demás se recomprime.

## En la app nativa

- Los vídeos irán a un almacenamiento con **consentimiento explícito y separado** (línea roja de la fase 0), caducidad y borrado desde Ajustes.
- **Los duelos se enviarán con un enlace o código de invitación,** en lugar de compartir la página.
- **La verificación por cámara** (fase 3) se guarda junto al resultado. Un duelo con repeticiones verificadas mostrará un sello "Camera verified".
