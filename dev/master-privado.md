# MÁSTER: cómo se activa (solo para el equipo)

No lo pongas en el README, en la app ni en ningún sitio público.

## El gesto

En la **alarma de flexiones**, con el **conteo por cámara**, en la **última flexión**: baja y **aguanta abajo 10 segundos**, luego sube.

- Solo cuenta la última repetición de la alarma y solo con flexiones (no sentadillas, no contando a mano).
- Al subir, la alarma se apaga como siempre y, un segundo después, aparece la revelación: corona, vibración y el mensaje "Ahora vas a contactar con el MÁSTER Dani."
- Queda desbloqueado para siempre en ese móvil: sale el botón dorado "MÁSTER" arriba y en el perfil.
- Se guarda quién lo encontró y cuándo (`masters/<id>` en el prototipo, `master_discoveries` en Supabase).

## Dónde se cambia

Todo en el bloque `master-core` de `index.html` (objeto `MASTER`):

- `move`, `holdMs`, `lastRepOnly`: qué ejercicio, cuánto tiempo abajo, si solo vale la última repetición.
- `message`: el texto de la revelación.
- `contact`: el enlace de contacto (ahora WhatsApp con un número de prueba: cámbialo por el de Dani).
- `options`: lo que ofrece Dani (mensual, plan de entrenamiento, de nutrición, combo con llamada).

Las solicitudes llegan a `masterRequests/<id>/items` en el prototipo y a la tabla `master_requests` en Supabase, con las respuestas del cuestionario.

## Para probarlo sin esperar a la alarma

Planificación → Alarma → "Try it now" → "Let's do it", con el móvil en el suelo de lado y todo el cuerpo en la imagen.

## Ojo: el repositorio es público

Cualquiera puede leer el código de `index.html` (y este archivo) en GitHub. Si queréis que el secreto aguante, poned el repositorio en privado. En la app nativa el gesto irá dentro del código compilado: se puede descubrir mirando el código, pero cuesta mucho más.
