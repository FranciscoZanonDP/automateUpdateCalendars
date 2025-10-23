/**
 * Configuración del calendario Management
 * Script para migrar datos de mgm_events al calendario Management
 */

module.exports = {
    // ID del calendario Management
    calendarId: 'c_7a6a9470388a244b85562ecb7268a773ca6d005d8bb142088a4d9abcd510e377@group.calendar.google.com',
    
    // Nombre del calendario (para logging)
    calendarName: 'Management (malbec@daleplay.la)',
    
    // Si quieres forzar el uso de un ID específico
    forceCalendarId: true, // Usar el ID específico del calendario Management
    
    // Configuración de la base de datos
    database: {
        // URL de conexión a la base de datos
        connectionString: "postgres://default:Rx3Eq5iQwMpl@ep-plain-voice-a47r1b05-pooler.us-east-1.aws.neon.tech:5432/verceldb?sslmode=require",
        
        // Tabla de origen
        tableName: 'mgm_events',
        
        // Query para obtener los datos (TODOS los eventos, sin filtrar por status)
        query: `
            SELECT 
                me.artist_id,
                me.show_date,
                me.country,
                me.city,
                me.venue_id,
                me.nombre_festi,
                me.status,
                me.aforo,
                me.formato,
                me.acuerdo,
                me.garantia,
                me.overage,
                me.wht,
                me.com_promotor,
                me.spliteo,
                a.name as artist_name,
                a.genre as artist_genre,
                v.name as venue_name,
                v.address as venue_address
            FROM mgm_events me
            LEFT JOIN artists a ON me.artist_id = a.id
            LEFT JOIN venues v ON me.venue_id = v.id
            WHERE me.show_date IS NOT NULL 
            AND me.artist_id IS NOT NULL
            ORDER BY me.show_date ASC
        `
    }
};
