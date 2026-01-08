/**
 * Configuración del calendario Releases
 * Script para sincronizar releases desde API al calendario Releases
 */

module.exports = {
    // ID del calendario Records
    calendarId: 'c_65f6f9dd7e6a17e03a9b3e50836b041dafb42f81bcdba13ac19a94ee75762592@group.calendar.google.com',
    
    // Nombre del calendario (para logging)
    calendarName: 'Records',
    
    // Si quieres forzar el uso de un ID específico
    forceCalendarId: true,
    
    // Configuración de la API
    api: {
        url: 'https://malbec-records2-0.vercel.app/api/releases',
        headers: {
            'Origin': 'https://malbec.vercel.app'
        }
    }
};