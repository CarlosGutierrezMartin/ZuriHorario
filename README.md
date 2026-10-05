# ZuriHorario 🌸

Una PWA para iPhone y ordenador: registra horas reales, planifica turnos por semana y expórtalos a Google Calendar. Rosa suave, mensajes de ánimo y un recordatorio de que su novio la quiere mucho.

## Funciones

- **Inicio**: entrada y salida, pausas, jornadas partidas, turnos nocturnos, notas y resumen mensual. Las pausas se descuentan. Los turnos de noche se atribuyen al día de entrada.
- **Calendario**: vista mensual y editor semanal. Puedes planificar la semana actual o las siguientes, copiar la anterior y repetir una semana hasta 8 semanas más. Descansos incluidos.
- **Configuración**: nombre, objetivo mensual fijo, excepciones por mes, copias JSON y exportación CSV.
- **Exportación de turnos**: selecciona un intervalo y descarga un `.ics`, o envía los turnos a un calendario propio de Google tras autorizarlo. La exportación directa actualiza los eventos enviados previamente desde esta app sin duplicarlos. No elimina eventos de Google cuando borras un turno local.
- **PWA**: iconos, manifiesto, uso sin conexión, tipografías locales y aviso de nueva versión. Funciona sin servidores ni Firebase.

Los eventos previstos nunca cuentan como horas reales. La pausa aparece en la descripción del evento exportado; el evento ocupa el intervalo completo de entrada a salida.

## Arrancar

Node.js 22.12+ (o 24+) y npm.

```sh
npm ci
npm run dev
```

Para comprobar la versión instalable:

```sh
npm run build
npm run preview
```

La app funciona sin ninguna variable de entorno. No exige cuentas, tarjetas ni suscripciones. Para usarla desde el iPhone debe publicarse en una dirección **HTTPS**; `localhost` solo funciona en el ordenador que ejecuta el servidor.

## Instalar en iPhone

1. Abre el enlace HTTPS en **Safari**.
2. Toca **Compartir → Añadir a pantalla de inicio**.
3. Abre ZuriHorario desde su icono y configura tu objetivo mensual.

Los datos se almacenan en `localStorage` del dispositivo y del dominio. Se pide almacenamiento persistente si el navegador lo permite. Esto no equivale a una copia de seguridad: borrar datos del navegador, cambiar de dominio, usar navegación privada o cambiar de móvil puede perderlos. Descarga copias JSON periódicamente y usa «Importar copia» para recuperarlas. La app conserva una copia de los datos que no pueda leer en vez de sobrescribirlos silenciosamente.

## Google Calendar: dos formas de exportar

### Archivo .ics, sin configuración

En **Calendario → Exportar turnos**, elige las fechas y descarga el archivo. Google Calendar importa `.ics` desde su web **en un ordenador**, en **Configuración → Importar y exportar**. Luego los eventos aparecen en el iPhone con esa misma cuenta. La importación de archivos de Google puede duplicar eventos si se repite; para actualizar turnos sin duplicarlos, usa la conexión directa.

Referencia: [Importar eventos a Google Calendar](https://support.google.com/calendar/answer/37118?hl=es).

### Exportación directa desde el iPhone

Necesita una configuración inicial del propietario de la app; no usa Firebase ni un backend:

1. Crea o utiliza un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Activa **Google Calendar API**.
3. Configura Google Auth Platform (nombre de app, correo de soporte y audiencia). Para pruebas, añade la cuenta de Zuri como usuaria de prueba. Google puede pedir consentimientos adicionales o verificación según el estado de publicación y los permisos. No prometemos una autorización permanente: el acceso temporal se vuelve a solicitar desde un botón.
4. Crea un **OAuth client ID de aplicación web**. Registra `http://localhost:5173`, `http://localhost:4173` y el origen HTTPS definitivo en **Authorized JavaScript origins**. No incluyas rutas en los orígenes. No se necesita un client secret.
5. Copia `.env.example` a `.env.local` y rellena `VITE_GOOGLE_CLIENT_ID` con el identificador público.
6. Compila y publica de nuevo. En la app, conecta Google Calendar y elige un calendario propio. Es recomendable crear uno específico para trabajo.

Permisos mínimos solicitados: `calendar.events.owned` para leer/crear/actualizar eventos en calendarios propios y `calendar.calendarlist.readonly` para elegir el destino. El token se conserva **solo en memoria**, caduca y no se guarda en copias ni en el dispositivo. Desconectar revoca el permiso de la app. Las horas reales y las notas nunca se envían a Google.

Los identificadores de eventos se derivan de un UUID de la copia local y la fecha; se mantienen al restaurar la copia en otro dispositivo. Si cambia ese UUID o se cambia de calendario de destino, los eventos se consideran distintos. Los errores parciales muestran cuántos turnos se enviaron y permiten reintentar. La app verifica que un evento es suyo antes de actualizarlo.

Referencias: [Google Identity Services, token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth), [Create events](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert).

## Publicar como web estática

`npm run build` genera `dist/`, listo para cualquier alojamiento estático con HTTPS. No requiere una base de datos ni funciones de servidor. Hay opciones gratuitas de alojamiento para uso personal, sujetas a los límites de cada proveedor.

Para GitHub Pages en `/ZuriHorario/`, compila con `BASE_PATH=/ZuriHorario/ npm run build`. Se incluye un workflow manual de Pages; hay que activar Pages con **GitHub Actions** en los ajustes del repositorio. GitHub Free requiere un repositorio público para Pages; los repositorios privados necesitan un plan compatible. El código no contiene datos personales guardados ni credenciales secretas. No cambies la visibilidad del repositorio sin decidirlo expresamente.

El uso local y la exportación `.ics` no generan costes de infraestructura. «Sin mantenimiento» absoluto no se puede garantizar: navegadores, Google y dependencias pueden cambiar. Esta arquitectura evita servidores, bases de datos y tareas programadas.

## Verificación

```sh
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
```

Pruebas de cálculo, copias, calendarios, `.ics`, idempotencia y errores de exportación directa; flujos de interfaz en Chromium y WebKit con tamaño de iPhone. El modo offline de Playwright WebKit presenta un error interno al navegar: se verifican allí el guardado offline y la copia en caché, y en Chromium también la recarga sin red. La instalación en un iPhone físico y la autorización real de Google deben comprobarse en el dominio final con el cliente OAuth configurado.

GitHub Actions ejecuta estas comprobaciones. Las reglas de Firestore y Firebase no forman parte del proyecto.
