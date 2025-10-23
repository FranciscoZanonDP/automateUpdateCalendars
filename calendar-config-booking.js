/**
 * Configuración del calendario Booking
 * Script para sincronizar datos de booking_events al calendario Booking
 */

module.exports = {
    // ID del calendario Booking
    calendarId: 'c_7fba15b73d470d9bfbf3e8708bf13f219cfe5128b3aec41415ff0bf3a6ca0f7e@group.calendar.google.com',
    
    // Nombre del calendario (para logging)
    calendarName: 'Booking',
    
    // Si quieres forzar el uso de un ID específico
    forceCalendarId: true, // Usar el ID específico del calendario Booking
    
    // Configuración de la base de datos
    database: {
        // URL de conexión a la base de datos
        connectionString: "postgres://default:Rx3Eq5iQwMpl@ep-plain-voice-a47r1b05-pooler.us-east-1.aws.neon.tech:5432/verceldb?sslmode=require",
        
        // Tabla de origen
        tableName: 'booking_events',
        
        // Query para obtener los datos de booking_events
        query: `
            SELECT 
                be.id,
                be.title,
                be.description,
                be.start_date,
                be.end_date,
                be.venue_id,
                be.artist_id,
                be.ticketera_id,
                be.category,
                be.status,
                be.capacity,
                be.tickets_sold,
                be.price,
                be.currency,
                be.created_by,
                be.created_at,
                be.updated_at,
                be.deleted_at,
                be.show_type,
                be.festival_name,
                be.city,
                be.country,
                be.sale_date,
                be.hora_salida,
                be.comments,
                be.fecha_preventa,
                be.hs_preventa,
                be.banco,
                be.cupo_preventa,
                be.aforo,
                be.formato,
                be.acuerdo,
                be.garantia,
                be.wht,
                be.spliteo,
                be.ticketera_credential_id,
                a.name as artist_name,
                a.genre as artist_genre,
                v.name as venue_name,
                v.address as venue_address,
                t.name as ticketera_name,
                t.url as ticketera_url
            FROM booking_events be
            LEFT JOIN artists a ON be.artist_id = a.id
            LEFT JOIN venues v ON be.venue_id = v.id
            LEFT JOIN ticketeras t ON be.ticketera_id = t.id
            WHERE be.start_date IS NOT NULL 
            AND be.deleted_at IS NULL
            ORDER BY be.start_date ASC
        `
    }
};
