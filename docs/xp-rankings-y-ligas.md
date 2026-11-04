# XP, niveles, rankings y ligas

Fusión de la app que ya teníamos con las ideas nuevas (noviembre 2026). Todo lo anterior sigue: retos, duelos, plan, pila, comida, registro de entrenos y animaciones.

## Qué da XP

Un solo XP y un solo nivel para toda la app. Los valores están en `GAME` (bloque `game-core` de `index.html`).

| Actividad | XP | Tope |
|---|---|---|
| Alarma con cámara | 30 + 1 por repetición válida | 1 al día |
| Alarma contando a mano (sin cámara) | 10 | 1 al día |
| Racha (primer entreno, reto o alarma del día) | +10 por día seguido, máximo +50 | 1 al día |
| Reto A/B (aciertes o no) | 5 | 3 al día; cada reto, una sola vez |
| Tip leído | 2 | 3 al día; cada tip, una vez |
| Cuestionario | 20 | una vez |
| Entreno registrado | 15 | 1 al día |
| Comida registrada | 3 | 3 al día |
| Reto (challenge) | el XP del reto, máximo 150 | 6 al día |

Los días de descanso del plan no rompen la racha.

## Niveles y puntos

- XP para pasar del nivel n al n+1 = 100 × n^1,5 (100, 283, 520, 800…).
- Al subir de nivel: 10 × nivel puntos. Se guardan en un libro de solo-añadir (motivo y fecha).
- Todavía no hay canjes: el perfil solo muestra el saldo.
- Al actualizar, los puntos y el XP de retos anteriores se convierten en XP, para que nadie empiece de cero.

## Rankings y ligas

- **Por sector** (gimnasio, calistenia, peso corporal en casa), semanal (desde el lunes) y total. Ves el top 3 y a los que tienes alrededor.
- **Ligas privadas:** "New league" da un código de 6 letras; los amigos entran con "Join with a code". Puedes estar en varias.
- **Aviso cada vez que alguien de tus ligas te supera**, sin límite. En el prototipo sale dentro de la app; en la app nativa será un push que manda el servidor.
- Solo se ve el apodo, nunca el nombre de la cuenta.

## Anti-trampas

1. En la app nativa, el servidor manda: el móvil envía eventos (repeticiones, tiempos de cada repetición, confianza de la cámara) y la función `submit-event` lo comprueba todo con las mismas reglas que la app.
2. Topes diarios, un evento por tipo y límite de 20 eventos por minuto.
3. Plausibilidad: tiempo mínimo por repetición, ritmo humano, duración coherente, volumen diario máximo y detección de sesiones repetidas (mismo ritmo exacto).
4. Las cuentas sospechosas salen de los rankings hasta revisión, y no se avisa a nadie por ellas.
5. Pendiente: Play Integrity (Android) y App Attest (iOS) para rechazar apps modificadas, unos 3-5 días. Lo añadiremos antes de abrir los rankings al público.

Ninguna detección en el móvil es 100 % a prueba de trampas; por eso hay varias capas.

En el prototipo web, las comprobaciones se hacen en el propio móvil, así que alguien con conocimientos podría falsear su XP. La protección real llega con Supabase.

## Tips y retos A/B

- Las tarjetas salen en Today (y desde el perfil, el reto y Progress).
- Cada reto A/B enseña dos animaciones (una bien hecha y otra mal) o dos vídeos.
- El contenido se añade como filas en la tabla `content` sin publicar versión nueva. Hay 3 tips y 3 retos de ejemplo.
