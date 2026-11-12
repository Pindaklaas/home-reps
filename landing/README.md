# Landing de Líbano

Página de captación para anuncios de Meta y TikTok. HTML, CSS y JS sin framework ni dependencias.
Es independiente de la app Home Reps del resto del repositorio.

## Verla en local

```bash
cd landing
node build.mjs
python3 -m http.server 8080 -d dist
```

Abre http://localhost:8080. En local el formulario no se guarda en ningún sitio, pero sí lleva a la página de gracias.

## Píxeles

Copia `.env.example` como `.env` y pon `META_PIXEL_ID` y `TIKTOK_PIXEL_ID`. Sin ID, ese píxel no se carga.
Los píxeles solo se cargan cuando el visitante acepta las cookies. El evento `Lead` se dispara una vez en `gracias.html` tras enviar el formulario.

## Publicar en Netlify

1. Nuevo sitio desde este repositorio. `netlify.toml` ya indica la carpeta, el comando y la salida.
2. En Environment variables, añade `META_PIXEL_ID` y `TIKTOK_PIXEL_ID`.
3. Activa Forms (detección de formularios). Los contactos llegan a Forms > lead; configura ahí el aviso por email.

## Pendiente antes de lanzar anuncios

- `src/index.html`: sustituir las 6 tarjetas de "Trabajos" por capturas reales (instrucciones en el comentario).
- `src/index.html`: revisar precios y plazos de los tres niveles.
- `src/index.html`: cuando haya testimonios reales, quitar `hidden` de la sección de opiniones.
- `src/privacidad.html` y `src/aviso-legal.html`: rellenar los datos marcados en amarillo y revisarlos.
