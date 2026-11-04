# Publicación manual de P2P Mate en Cloudflare Workers

Este repositorio conserva el código fuente, las pruebas y la configuración de desarrollo. Para la publicación manual de archivos estáticos en Workers, se debe cargar **el contenido de `public/`**, no la carpeta raíz del repositorio.

## Paquete que se carga en Cloudflare

El paquete de publicación debe tener `index.html` en su raíz, junto con `app.js`, `styles.css`, `_headers` y `modules/`.

## Archivos que se conservan en GitHub

- `public/`: aplicación web publicada.
- `tests/`: pruebas automatizadas.
- `package.json`: metadatos y comandos del proyecto.
- `wrangler.jsonc`: configuración opcional para flujos de desarrollo/despliegue con Wrangler. No es necesario para la carga manual de archivos.

## Comprobaciones posteriores

1. Abrir la URL pública del Worker.
2. Navegar por las nueve secciones.
3. Verificar que los módulos cargan sin errores.
4. Confirmar que el historial permanece local en el navegador.
5. Probar exportación y copia de seguridad con datos ficticios.

No incluir claves, contraseñas, tokens ni datos personales en los archivos públicos.
