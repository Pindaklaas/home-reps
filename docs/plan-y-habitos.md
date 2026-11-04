# Cuestionario de Training, planning semanal y pila diaria

Estado: **implementado en el prototipo** (`index.html`).

## 1. Cuestionario solo en Training (5 pantallas, todo con toques)

1. **Edad.** 18+ obligatorio; si ya la sabemos, no se pregunta.
2. **Objetivo:** ganar músculo, más fuerza, perder grasa o estar en forma.
3. **Tu entreno:** experiencia en el gimnasio, días a la semana (2–6) y minutos por sesión (30–75).
4. **Tu día:** a qué hora sueles entrenar (7:00, 13:00, 18:30 o 20:30) y cuánto sueles dormir.
5. **Revisión de seguridad** (consentimiento + lista + lesiones). Se puede saltar; entonces el plan va en modo suave.

**Challenge no pregunta nada:** entras directo.
- Los retos de bajo impacto están abiertos.
- Los de alto impacto piden la revisión de seguridad, que incluye la edad si aún no la tenemos.

> Nota legal: con esto, un menor podría usar los retos de bajo impacto sin decir su edad. En la app nativa, la edad se comprobará al crear la cuenta (con las señales de edad de Apple y Google), antes de cualquier modo.

## 2. Plan según los días, colocado en tus horas

| Días | Principiante | Resto |
|---|---|---|
| 2 | Cuerpo completo ×2 | Cuerpo completo ×2 |
| 3 | Cuerpo completo ×3 | Push / Pull / Legs |
| 4 | Upper / Lower ×2 | Upper / Lower ×2 |
| 5 | Push / Pull / Legs + Upper / Lower | ídem |
| 6 | Push / Pull / Legs ×2 | ídem |

- **Días fijos** según cuántos elijas (por ejemplo, 3 = lunes, miércoles y viernes) y **a tu hora**.
- El número de ejercicios depende de los minutos: unos 10 minutos por ejercicio.
- **En modo suave:** máximo 3 sesiones de 30 minutos. Al hacer la revisión de seguridad, el plan se rehace solo.

## 3. Planning para ir siguiendo (pestaña "Plan")

- **Tarjeta de fase:** "Week 1 of 4 · Foundations", con el consejo de la semana y 4 marcas de progreso.
- **Los 7 días de la semana:** entreno (hora · minutos · nº de ejercicios) o descanso ("Walk, stretch, sleep 8 h").
  - Hoy, resaltado.
  - Los días completados, en verde con ✓.
  - Al tocar un día, abre ese entreno en Today.
- **Hábitos diarios** al pie: 8 h de sueño, 8 vasos de agua, proteína en cada comida, 8.000 pasos.
- **Debajo, "Extra exercises":** los ejercicios que añadas a mano desde Body.

### Bloques de 4 semanas

| Semana | Principiante | Resto |
|---|---|---|
| 1 | **Foundations:** hábitos primero, pesos ligeros, técnica | Base: encontrar tus pesos |
| 2 | Foundations | Build: un poco más de peso o una repetición |
| 3 | Build: +1 serie | Push: la semana más dura (+1 serie) |
| 4 | Build | Deload: −1 serie para recuperar |

## 4. La pila diaria

En Today, debajo del entreno. Al tocarla se abre un registro de 10 segundos:

- **Sueño anoche (lo principal, 50 %):** con 8 h o más puede estar verde. Con menos **nunca** está verde, y con menos de 6 h siempre está roja.
- **Comida (20 %):** proteína y verdura en la mayoría de comidas.
- **Agua (15 %):** 8 vasos, que se tocan para marcarlos.
- **Pasos (15 %):** menos de 5.000, de 5.000 a 8.000, u 8.000 o más.

**Colores:** verde ≥ 75 %, amarilla 45–74 %, roja < 45 %.

**La pila decide el entreno de hoy:**
- **Roja:** una serie menos en cada ejercicio, con un mensaje: "el sueño es tu mejor entreno esta noche".
- **Amarilla:** "entrena, pero hoy no busques récords".
- **Verde:** "entrena según el plan".

Para principiantes aparece además: "en tus primeras semanas, estos hábitos importan más que los pesos".

## 5. Datos y tests

- Datos nuevos en el navegador: `homereps.habits` (registro por día, guarda 60 días). En `onboarding.answers` se añaden `time` y `sleepUsual`, y el plan guarda `start` (día de inicio del bloque).
- La lógica está en el bloque `habits-core`, son funciones puras.
- `tests/habits.test.mjs` tiene 8 tests: pila, colores, tope por sueño, agua, semanas del bloque, fases, series y planning.
- En total hay **32 tests**.
