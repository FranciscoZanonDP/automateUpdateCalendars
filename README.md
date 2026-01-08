# 📅 Calendar Automation

Sistema automatizado para sincronizar datos de base de datos con calendarios de Google Calendar.

## 🎯 Funcionalidades

- **Calendario Live**: Sincroniza shows desde API externa
- **Calendario Management**: Sincroniza eventos desde tabla `mgm_events`
- **Calendario Booking**: Sincroniza eventos desde tabla `booking_events`
- **Calendario Records**: Sincroniza releases desde API de releases
- **Ejecución automática**: GitHub Actions ejecuta diariamente a las 01:00 ARG

## 🚀 Instalación

```bash
# Clonar el repositorio
git clone https://github.com/TU_USUARIO/calendar-automation.git
cd calendar-automation

# Instalar dependencias
npm install
```

## ⚙️ Configuración

### 1. Service Account de Google
1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto o selecciona uno existente
3. Habilita la API de Google Calendar
4. Crea un Service Account
5. Descarga el archivo JSON de credenciales
6. Renombra el archivo a `service-account.json`

### 2. Configurar GitHub Secrets
En el repositorio de GitHub, ve a Settings > Secrets and variables > Actions:

- `SERVICE_ACCOUNT_JSON`: Contenido completo del archivo service-account.json

### 3. Compartir calendarios
Comparte los siguientes calendarios con el email del Service Account (con permisos de escritura):
- Live Calendar
- Management Calendar  
- Booking Calendar
- Records Calendar

## 📋 Uso

### Ejecución manual
```bash
# Actualizar todos los calendarios
node updateBothCalendars.js
```

### Ejecución automática
El sistema se ejecuta automáticamente todos los días a las 01:00 hora Argentina mediante GitHub Actions.

## 🔧 Estructura del proyecto

```
calendar-automation/
├── .github/workflows/     # GitHub Actions
├── updateBothCalendars.js # Script principal
├── updateCalendarServiceAccount.js
├── updateCalendarManagement.js
├── updateBookingCalendar.js
├── updateReleasesCalendar.js
├── calendar-config-*.js   # Configuraciones
├── package.json
└── README.md
```

## 🛡️ Seguridad

- Las credenciales están protegidas por GitHub Secrets
- El archivo `service-account.json` está en `.gitignore`
- Los calendarios requieren permisos de escritura del Service Account

## 📝 Logs

Los logs de ejecución se guardan como artifacts en GitHub Actions y están disponibles por 30 días.

## 🔗 URLs de Suscripción a los Calendarios

Después de cada ejecución, GitHub Actions mostrará las URLs de suscripción para cada calendario:

### 🎵 Calendario Live
- **ID**: `c_b1cdbb35e2e538d44729a8d7c06c6ae7349402a3eea9509b4332c5060ddd4d26@group.calendar.google.com`
- **URL pública**: https://calendar.google.com/calendar/u/0?cid=c_b1cdbb35e2e538d44729a8d7c06c6ae7349402a3eea9509b4332c5060ddd4d26%40group.calendar.google.com
- **URL iCal pública**: https://calendar.google.com/calendar/ical/c_b1cdbb35e2e538d44729a8d7c06c6ae7349402a3eea9509b4332c5060ddd4d26%40group.calendar.google.com/public/basic.ics

### 📊 Calendario Management
- **ID**: `c_7a6a9470388a244b85562ecb7268a773ca6d005d8bb142088a4d9abcd510e377@group.calendar.google.com`
- **URL pública**: https://calendar.google.com/calendar/u/0?cid=c_7a6a9470388a244b85562ecb7268a773ca6d005d8bb142088a4d9abcd510e377%40group.calendar.google.com
- **URL iCal pública**: https://calendar.google.com/calendar/ical/c_7a6a9470388a244b85562ecb7268a773ca6d005d8bb142088a4d9abcd510e377%40group.calendar.google.com/public/basic.ics

### 📅 Calendario Booking
- **ID**: `c_7fba15b73d470d9bfbf3e8708bf13f219cfe5128b3aec41415ff0bf3a6ca0f7e@group.calendar.google.com`
- **URL pública**: https://calendar.google.com/calendar/u/0?cid=c_7fba15b73d470d9bfbf3e8708bf13f219cfe5128b3aec41415ff0bf3a6ca0f7e%40group.calendar.google.com
- **URL iCal pública**: https://calendar.google.com/calendar/ical/c_7fba15b73d470d9bfbf3e8708bf13f219cfe5128b3aec41415ff0bf3a6ca0f7e%40group.calendar.google.com/public/basic.ics

### 💿 Calendario Records
- **ID**: `c_65f6f9dd7e6a17e03a9b3e50836b041dafb42f81bcdba13ac19a94ee75762592@group.calendar.google.com`
- **URL pública**: https://calendar.google.com/calendar/u/0?cid=c_65f6f9dd7e6a17e03a9b3e50836b041dafb42f81bcdba13ac19a94ee75762592%40group.calendar.google.com
- **URL iCal pública**: https://calendar.google.com/calendar/ical/c_65f6f9dd7e6a17e03a9b3e50836b041dafb42f81bcdba13ac19a94ee75762592%40group.calendar.google.com/public/basic.ics

### 📱 Cómo suscribirse en Google Calendar:
1. Copia la URL pública del calendario que quieras
2. Abre Google Calendar
3. Haz clic en el `+` junto a "Otros calendarios"
4. Selecciona "Por URL"
5. Pega la URL y haz clic en "Agregar calendario"

### 📥 Para aplicaciones externas (Outlook, Apple Calendar, etc.):
- Usa la URL iCal pública si el calendario es público
- O usa la URL iCal privada desde la configuración del calendario en Google Calendar (Configuración > Integrar calendario > Dirección secreta en formato iCal)






