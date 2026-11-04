# Retos, selector de modo y onboarding corto

Estado: **implementado en el prototipo** (`index.html`).

## 1. Menos preguntas

| Flujo | Antes | Ahora |
|---|---|---|
| Onboarding | ~13 pantallas | **5**: edad · meta (+ "¿por qué?" opcional) · ritmo · revisión de seguridad · primera victoria |
| Plan personal | ~14 pantallas | **3–4 + generación**: qué cubre y material · sobre ti, dieta y alergias (si hay nutrición) · tú y la comida (si hay nutrición) · confirmar |
| Revisión de seguridad suelta | — | **1** pantalla (desde Today o Retos) |

Cómo se ha reducido sin saltarse las líneas rojas:

- **Varias preguntas en una pantalla, todo con toques:** nivel, días y minutos van en la pantalla "Your rhythm".
- **Revisión de salud (PAR-Q+) y cribado de comida (SCOFF) como listas** "¿Te pasa algo de esto?" con "None of these", en lugar de 8 y 5 preguntas de sí o no. Por dentro se convierten a las mismas respuestas, así que el motor de seguridad y sus tests no cambian.
- **El consentimiento de salud sigue siendo una casilla explícita** antes de responder. Sin ella las listas están desactivadas, y el botón dice "Skip safety check".
- **Fuera del onboarding:**
  - La hora de despertar y el modo de alarma se preguntarán al activar la alarma en la app nativa.
  - "Forma de entrenar" lo sustituye el selector Reto/Entreno.
  - Los datos del cuerpo solo se piden si el plan incluye nutrición.
  - El ritmo de pérdida de peso es "steady" por defecto y siempre limitado por el validador.

## 2. Selector "Challenge o Training"

Aparece **cada vez que se abre la app** (después del onboarding), a pantalla completa:

- Dos tarjetas grandes que entran con rebote desde arriba y desde abajo, con iconos que flotan, anillos que laten y un brillo que las recorre.
- Al tocar una, se agranda y la otra desaparece.
- La de retos muestra tu rango; la de entreno, el entreno de hoy.
- En la cabecera hay una píldora con el modo actual; al tocarla vuelve a salir el selector.
- **Modo Training:** la app de siempre (Body, Today, Food, Recipes, Schedule).
- **Modo Challenge:** el centro de retos, sin la barra de pestañas, para que no distraiga.

## 3. Retos

### Formatos

| Formato | Qué es | Puntuación |
|---|---|---|
| **3 o 5 min** (AMRAP) | Máximo de repeticiones o rondas en el tiempo | Más es mejor |
| **For time** (carrera) | Un número fijo de repeticiones, lo antes posible | Menos tiempo es mejor |
| **Hold** | Aguantar una postura el máximo tiempo | Más es mejor |
| **EMOM** | X repeticiones al empezar cada minuto, descanso el resto. Si no llegas, se acaba | Rondas completadas |

### Catálogo (15 retos, 5 niveles)

| Nivel | Retos |
|---|---|
| 1 · Rookie | Squat Sprint (3 min sentadillas) · Plank Clock (plancha) · Push-up Pressure (3 min flexiones) · Jack Attack (3 min jumping jacks) |
| 2 · Grinder | The Hundred (100 sentadillas a tiempo) · Core Grinder (5 min abdominales) · Climber Rush (3 min escaladores) · Minute Maker (EMOM 5 min, 8 burpees) |
| 3 · Athlete | Burpee Storm (3 min burpees) · Lunge Line (5 min zancadas) · 30-20-10 (sentadillas, flexiones y abdominales, 180 repeticiones a tiempo) |
| 4 · Beast | Fifty (50 burpees a tiempo) · The Furnace (5 min: rondas de 5 burpees + 10 sentadillas + 15 jacks) |
| 5 · Legend | The Centurion (100 burpees a tiempo) · The Pyramid (escalera de 1 a 10 burpees, con el doble de sentadillas) |

Los nombres son propios. Freeletics es la inspiración en formato, no en contenido.

### Graduación (progresión natural)

1. **Medallas por reto:** bronce, plata, oro y leyenda, con objetivos claros y cada uno más difícil que el anterior.
2. **Siguiente objetivo:** siempre se ve la próxima medalla que te falta. Cuando las tienes todas, el objetivo es mejorar un 5 % tu marca.
3. **Niveles que se abren solos:** un nivel se desbloquea al ganar medalla en 2 retos del nivel anterior. Nunca te encuentras de golpe con algo imposible.
4. **XP y rango:** cada reto da XP según su nivel, la medalla y si es marca personal.
   - La curva es suave: cada nivel pide un poco más que el anterior.
   - Rangos: Rookie (nivel 1), Grinder (5), Athlete (10), Beast (16), Legend (23).
5. **Versión fácil** en todos los retos: da XP (60 %) pero no medallas que desbloqueen niveles. Así se puede progresar de la versión fácil a la completa.

### La pantalla del reto

- **Antes de empezar:**
  - Medallas con sus objetivos, tu mejor marca y tu próximo objetivo.
  - Cómo se hace cada movimiento.
  - Interruptor de versión fácil y aviso de calentar.
- **Cuenta atrás 3-2-1-GO** con sonido y vibración.
- **Durante el reto:**
  - Gran contador dentro de un anillo de tiempo.
  - Botón gigante para contar cada repetición, con onda y vibración.
  - Barra con las medallas: se iluminan al conseguirlas, con rótulo y sonido.
  - **"Fantasma" de tu mejor marca:** "Ghost of your best: 23 · you +2".
  - En las carreras, las medallas que ya no son posibles se apagan.
  - La pantalla no se apaga mientras dura el reto, si el navegador lo permite.
- **Resultado:**
  - La medalla entra girando, el resultado cuenta hacia arriba y la XP se llena; hay confeti con marca personal, oro, leyenda o subida de nivel.
  - "Fix count" para corregir con honestidad un conteo mal tocado.
  - "Go again" para repetir.
- **Historial:** "Recent battles" en el centro de retos.

### Seguridad en los retos

- **Sin revisión de seguridad, o con algún "sí":** los retos de alto impacto (burpees, jacks, escaladores…) quedan bloqueados, con un botón para hacer la revisión en 20 segundos.
- **Lesiones:** bloquean los retos con movimientos que cargan esa zona.
- **Aviso de calentar** antes de cada reto, y "uno o dos retos al día es suficiente".
- El conteo es manual (tocando) en el prototipo. **El conteo por cámara es la fase 3.**

## 4. Datos y tests

- Datos nuevos en el navegador: `homereps.challenges` (XP, mejores marcas e historial) y `homereps.mode`.
- La lógica de retos está en el bloque `challenge-core` de `index.html`, son funciones puras.
- `tests/challenges.test.mjs` tiene 10 tests: catálogo coherente, medallas, marcas personales, XP, curva de niveles, objetivos, desbloqueo y seguridad.
- Con los 14 de seguridad, hay **24 tests** en total.

## 5. Pendiente

- Validar con Dani los objetivos de cada medalla (son una propuesta razonable, ajustables en `CHALLENGES`).
- Retos semanales y retos en grupo (fase 4, con el sistema de puntos).
- Conteo automático con la cámara (fase 3).
