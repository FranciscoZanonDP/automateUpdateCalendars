# 📅 Calendar Automation

Sistema automatizado para sincronizar datos de base de datos con calendarios de Google Calendar.

## 🎯 Funcionalidades

- **Calendario Live**: Sincroniza shows desde API externa
- **Calendario Management**: Sincroniza eventos desde tabla `mgm_events`
- **Calendario Booking**: Sincroniza eventos desde tabla `booking_events`
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
Comparte los siguientes calendarios con el email del Service Account:
- Live Calendar
- Management Calendar  
- Booking Calendar

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




