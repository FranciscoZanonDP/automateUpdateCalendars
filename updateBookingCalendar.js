/**
 * Script para actualizar el calendario "Booking" con datos de booking_events
 * Autenticación completamente automática sin intervención del usuario
 * Elimina duplicados y actualiza con eventos nuevos
 */

const { google } = require('googleapis');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const calendarConfig = require('./calendar-config-booking');

// Archivo de credenciales del Service Account
const SERVICE_ACCOUNT_FILE = path.join(__dirname, 'service-account.json');

class BookingCalendarUpdater {
    constructor() {
        this.calendar = null;
        this.calendarId = null;
        this.dbPool = null;
    }

    /**
     * Configura conexión a la base de datos
     */
    setupDatabase() {
        try {
            console.log('🔗 Configurando conexión a la base de datos...');
            this.dbPool = new Pool({
                connectionString: calendarConfig.database.connectionString,
                ssl: {
                    rejectUnauthorized: false
                }
            });
            console.log('✅ Conexión a la base de datos configurada');
        } catch (error) {
            console.error('❌ Error configurando base de datos:', error.message);
            throw error;
        }
    }

    /**
     * Carga credenciales del Service Account
     */
    loadServiceAccount() {
        try {
            if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
                console.log('❌ Archivo service-account.json no encontrado');
                return null;
            }

            const credentials = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf8'));
            console.log('✅ Credenciales de Service Account cargadas');
            return credentials;
        } catch (error) {
            console.error('❌ Error cargando Service Account:', error.message);
            return null;
        }
    }

    /**
     * Configura autenticación con Service Account
     */
    async setupAuthentication() {
        const credentials = this.loadServiceAccount();
        if (!credentials) {
            throw new Error('No se pudieron cargar las credenciales del Service Account');
        }

        try {
            console.log('🔍 Información del Service Account:');
            console.log(`   • Email: ${credentials.client_email}`);
            console.log(`   • Project ID: ${credentials.project_id}`);

            // Crear cliente JWT
            const auth = new google.auth.JWT(
                credentials.client_email,
                null,
                credentials.private_key,
                ['https://www.googleapis.com/auth/calendar'],
                null
            );

            console.log('🔐 Autenticando con Google...');
            // Autenticar
            await auth.authorize();
            console.log('✅ Token de autenticación obtenido');
            
            // Crear cliente de Calendar
            this.calendar = google.calendar({ version: 'v3', auth });
            console.log('✅ Cliente de Calendar creado');
            
            console.log('✅ Autenticación con Service Account exitosa');
            return true;
        } catch (error) {
            console.error('❌ Error en autenticación:', error.message);
            throw error;
        }
    }

    /**
     * Busca el calendario "Booking" usando ID directo
     */
    async findBookingCalendar() {
        try {
            console.log(`🔍 Conectando al calendario: ${calendarConfig.calendarName}`);
            
            // Usar ID forzado del calendario Booking
            if (calendarConfig.forceCalendarId) {
                console.log(`🔧 Usando ID forzado: ${calendarConfig.calendarId}`);
                try {
                    const calendarInfo = await this.calendar.calendars.get({
                        calendarId: calendarConfig.calendarId
                    });
                    
                    if (calendarInfo.data) {
                        console.log('✅ Calendario Booking encontrado');
                        console.log(`   • ID: ${calendarInfo.data.id}`);
                        console.log(`   • Summary: ${calendarInfo.data.summary}`);
                        console.log(`   • Time Zone: ${calendarInfo.data.timeZone}`);
                        console.log(`   • URL: https://calendar.google.com/calendar/u/0/r?cid=${calendarInfo.data.id}`);
                        
                        this.calendarId = calendarInfo.data.id;
                        return calendarInfo.data;
                    }
                } catch (error) {
                    console.error(`❌ Error con ID forzado ${calendarConfig.calendarId}:`, error.message);
                    throw error;
                }
            }
            
            throw new Error('No se pudo encontrar el calendario Booking');
        } catch (error) {
            console.error('❌ Error buscando calendario:', error);
            throw error;
        }
    }

    /**
     * Obtiene eventos de booking desde la base de datos
     */
    async getBookingEvents() {
        try {
            console.log('📡 Obteniendo eventos de booking desde la base de datos...');
            
            const result = await this.dbPool.query(calendarConfig.database.query);
            const events = result.rows;
            
            console.log(`✅ Se obtuvieron ${events.length} eventos de booking`);
            return events;
        } catch (error) {
            console.error('❌ Error obteniendo eventos de booking:', error.message);
            throw error;
        }
    }

    /**
     * Convierte evento de booking a evento de Google Calendar
     */
    formatBookingEventToCalendarEvent(bookingEvent) {
        // Usar start_date como fecha del evento (como especificaste)
        const eventDate = new Date(bookingEvent.start_date);
        
        // Crear horario de inicio (21:00 por defecto, o usar hora_salida si está disponible)
        const startTime = new Date(eventDate);
        if (bookingEvent.hora_salida) {
            const [hours, minutes] = bookingEvent.hora_salida.split(':');
            startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        } else {
            startTime.setHours(21, 0, 0, 0); // 21:00 por defecto
        }
        
        // Crear horario de fin (2 horas después del inicio)
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + 2);

        // Crear título del evento (formato: Artista - Venue)
        let title = '';
        if (bookingEvent.artist_name) {
            title = bookingEvent.artist_name;
            if (bookingEvent.venue_name) {
                title += ` - ${bookingEvent.venue_name}`;
            }
        } else {
            title = 'Evento de Booking';
        }

        // Crear descripción detallada
        const description = this.buildEventDescription(bookingEvent);

        // Crear ubicación
        let location = '';
        if (bookingEvent.venue_address) {
            location = bookingEvent.venue_address;
        } else if (bookingEvent.venue_name) {
            location = bookingEvent.venue_name;
        }
        if (bookingEvent.city && bookingEvent.country) {
            location += location ? `, ${bookingEvent.city}, ${bookingEvent.country}` : `${bookingEvent.city}, ${bookingEvent.country}`;
        }

        const event = {
            summary: title || 'Evento de Booking',
            description: description,
            start: {
                dateTime: startTime.toISOString(),
                timeZone: 'America/Argentina/Buenos_Aires'
            },
            end: {
                dateTime: endTime.toISOString(),
                timeZone: 'America/Argentina/Buenos_Aires'
            },
            location: location,
            status: 'confirmed',
            visibility: 'public',
            colorId: this.getColorForCategory(bookingEvent.category)
        };

        return event;
    }

    /**
     * Construye descripción detallada del evento
     */
    buildEventDescription(bookingEvent) {
        const parts = [];
        
        if (bookingEvent.artist_name) {
            parts.push(`🎤 Artista: ${bookingEvent.artist_name}`);
        }
        if (bookingEvent.venue_name) {
            parts.push(`🏟️ Venue: ${bookingEvent.venue_name}`);
        }
        if (bookingEvent.city && bookingEvent.country) {
            parts.push(`📍 Ubicación: ${bookingEvent.city}, ${bookingEvent.country}`);
        }
        if (bookingEvent.show_type) {
            parts.push(`🎭 Tipo: ${bookingEvent.show_type}`);
        }
        if (bookingEvent.festival_name) {
            parts.push(`🎪 Festival: ${bookingEvent.festival_name}`);
        }
        if (bookingEvent.category) {
            parts.push(`📂 Categoría: ${bookingEvent.category}`);
        }
        if (bookingEvent.status) {
            parts.push(`📊 Status: ${bookingEvent.status}`);
        }
        if (bookingEvent.capacity) {
            parts.push(`👥 Capacidad: ${bookingEvent.capacity}`);
        }
        if (bookingEvent.tickets_sold) {
            parts.push(`🎫 Tickets vendidos: ${bookingEvent.tickets_sold}`);
        }
        if (bookingEvent.price && bookingEvent.currency) {
            parts.push(`💰 Precio: ${bookingEvent.currency} ${bookingEvent.price}`);
        }
        if (bookingEvent.ticketera_name) {
            parts.push(`🎟️ Ticketera: ${bookingEvent.ticketera_name}`);
        }
        if (bookingEvent.ticketera_url) {
            parts.push(`🔗 URL: ${bookingEvent.ticketera_url}`);
        }
        if (bookingEvent.sale_date) {
            parts.push(`📅 Fecha de venta: ${new Date(bookingEvent.sale_date).toLocaleDateString('es-AR')}`);
        }
        if (bookingEvent.fecha_preventa) {
            parts.push(`🎫 Preventa: ${new Date(bookingEvent.fecha_preventa).toLocaleDateString('es-AR')}`);
        }
        if (bookingEvent.comments) {
            parts.push(`💬 Comentarios: ${bookingEvent.comments}`);
        }

        return parts.join('\n');
    }

    /**
     * Asigna color según categoría
     */
    getColorForCategory(category) {
        const colorMap = {
            'Concierto': '1',
            'Festival': '2', 
            'Teatro': '3',
            'Deporte': '4',
            'Cultural': '5',
            'Comedia': '6',
            'Danza': '7',
            'Otro': '8',
            'default': '1'
        };
        return colorMap[category] || colorMap['default'];
    }

    /**
     * Obtiene eventos existentes del calendario
     */
    async getExistingEvents() {
        try {
            console.log('🔍 Obteniendo eventos existentes del calendario...');
            
            const events = await this.calendar.events.list({
                calendarId: this.calendarId,
                maxResults: 2500,
                singleEvents: true,
                orderBy: 'startTime'
            });

            console.log(`📋 Encontrados ${events.data.items.length} eventos existentes`);
            return events.data.items;
        } catch (error) {
            console.error('❌ Error obteniendo eventos existentes:', error);
            throw error;
        }
    }

    /**
     * Limpia el calendario (todos los eventos)
     */
    async clearCalendar() {
        try {
            console.log('🗑️  Limpiando TODOS los eventos existentes...');
            
            // Obtener todos los eventos
            const events = await this.calendar.events.list({
                calendarId: this.calendarId,
                maxResults: 2500,
                singleEvents: true,
                orderBy: 'startTime'
            });

            let deletedCount = 0;
            let errorCount = 0;
            
            console.log(`📋 Encontrados ${events.data.items.length} eventos para eliminar`);
            
            for (const event of events.data.items) {
                try {
                    await this.calendar.events.delete({
                        calendarId: this.calendarId,
                        eventId: event.id
                    });
                    deletedCount++;
                    
                    if (deletedCount % 50 === 0) {
                        console.log(`  📊 Progreso: ${deletedCount}/${events.data.items.length} eventos eliminados`);
                    }
                } catch (error) {
                    errorCount++;
                    console.error(`❌ Error eliminando evento ${event.id}:`, error.message);
                }
            }

            console.log(`✅ Se eliminaron ${deletedCount} eventos existentes`);
            if (errorCount > 0) {
                console.log(`⚠️  ${errorCount} eventos no se pudieron eliminar`);
            }
        } catch (error) {
            console.error('❌ Error limpiando calendario:', error);
            throw error;
        }
    }

    /**
     * Inserta eventos en el calendario
     */
    async insertEvents(events) {
        try {
            console.log(`📅 Insertando ${events.length} eventos en el calendario "${this.calendarId}"...`);
            console.log(`🔗 URL del calendario: https://calendar.google.com/calendar/u/0/r?cid=${this.calendarId}`);
            
            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < events.length; i++) {
                const event = events[i];
                try {
                    console.log(`🔨 Insertando evento ${i + 1}/${events.length}: ${event.summary} (${event.start?.dateTime || event.start?.date})`);
                    console.log(`   📍 Ubicación: ${event.location || 'No especificada'}`);
                    console.log(`   🎨 Color: ${event.colorId || 'default'}`);
                    
                    const response = await this.calendar.events.insert({
                        calendarId: this.calendarId,
                        requestBody: event
                    });
                    
                    successCount++;
                    console.log(`   ✅ Evento creado con ID: ${response.data.id}`);
                    console.log(`   🔗 URL: ${response.data.htmlLink || 'No disponible'}`);
                    
                    if (successCount % 5 === 0) {
                        console.log(`  📊 Progreso: ${successCount}/${events.length} eventos insertados`);
                    }
                } catch (error) {
                    errorCount++;
                    console.error(`❌ Error insertando evento ${i + 1}:`, error.message);
                    console.error(`   Evento: ${event.summary}`);
                    if (error.response) {
                        console.error(`   Status: ${error.response.status}`);
                        console.error(`   Data: ${JSON.stringify(error.response.data)}`);
                    }
                }
            }

            console.log(`✅ Inserción completada:`);
            console.log(`   • ${successCount} eventos insertados`);
            console.log(`   • ${errorCount} errores`);
            return { successCount, errorCount, skippedCount: 0 };
        } catch (error) {
            console.error('❌ Error insertando eventos:', error);
            throw error;
        }
    }

    /**
     * Actualiza el calendario completo
     */
    async updateCalendar() {
        try {
            console.log('🔄 ACTUALIZANDO CALENDARIO "BOOKING" CON DATOS DE booking_events');
            console.log('='.repeat(60));

            // 1. Configurar conexión a base de datos
            this.setupDatabase();

            // 2. Configurar autenticación
            await this.setupAuthentication();

            // 3. Buscar calendario Booking
            await this.findBookingCalendar();

            // 4. Obtener eventos de booking
            const allBookingEvents = await this.getBookingEvents();
            
            // 5. Filtrar eventos válidos
            const validEvents = allBookingEvents.filter(event => {
                return event.start_date && 
                       !event.deleted_at;
            });
            
            console.log(`📊 Eventos válidos: ${validEvents.length} total`);
            
            // 6. BORRAR TODOS LOS EVENTOS EXISTENTES
            console.log('\n🗑️  PASO 1: BORRANDO TODOS LOS EVENTOS EXISTENTES...');
            await this.clearCalendar();

            // 7. CARGA AUTOMÁTICA
            console.log('\n🚀 PASO 2: CARGA AUTOMÁTICA');
            console.log(`📅 Cargando ${validEvents.length} eventos nuevos al calendario "Booking"`);
            console.log('🔗 URL del calendario:', `https://calendar.google.com/calendar/u/0/r?cid=${this.calendarId}`);
            console.log('✅ Cargando eventos automáticamente...');

            // 8. Convertir a eventos e insertar
            const calendarEvents = validEvents.map(event => this.formatBookingEventToCalendarEvent(event));
            const results = await this.insertEvents(calendarEvents);

            // 9. Estadísticas finales
            console.log('\n🎉 ACTUALIZACIÓN COMPLETADA');
            console.log('='.repeat(60));
            console.log(`✅ Eventos creados: ${results.successCount}`);
            console.log(`⏭️  Eventos saltados (duplicados): ${results.skippedCount || 0}`);
            console.log(`❌ Eventos fallidos: ${results.errorCount}`);
            
            const stats = {
                artists: new Set(validEvents.map(e => e.artist_name).filter(Boolean)).size,
                venues: new Set(validEvents.map(e => e.venue_name).filter(Boolean)).size,
                cities: new Set(validEvents.map(e => e.city).filter(Boolean)).size,
                countries: new Set(validEvents.map(e => e.country).filter(Boolean)).size,
                categories: new Set(validEvents.map(e => e.category).filter(Boolean)).size
            };

            console.log('\n📈 ESTADÍSTICAS:');
            console.log(`   • Artistas: ${stats.artists}`);
            console.log(`   • Venues: ${stats.venues}`);
            console.log(`   • Ciudades: ${stats.cities}`);
            console.log(`   • Países: ${stats.countries}`);
            console.log(`   • Categorías: ${stats.categories}`);
            
            // Mostrar rango de fechas
            if (validEvents.length > 0) {
                const dates = validEvents.map(e => new Date(e.start_date)).sort((a, b) => a - b);
                const earliest = dates[0];
                const latest = dates[dates.length - 1];
                
                console.log(`   • Rango de fechas: ${earliest.toLocaleDateString('es-AR')} - ${latest.toLocaleDateString('es-AR')}`);
            }

            // 10. Mostrar información detallada del calendario
            await this.showCalendarInfo();

        } catch (error) {
            console.error('❌ Error actualizando calendario:', error.message);
            throw error;
        } finally {
            // Cerrar conexión a la base de datos
            if (this.dbPool) {
                await this.dbPool.end();
                console.log('🔌 Conexión a la base de datos cerrada');
            }
        }
    }

    /**
     * Muestra información detallada del calendario
     */
    async showCalendarInfo() {
        try {
            console.log('\n📋 INFORMACIÓN DETALLADA DEL CALENDARIO');
            console.log('='.repeat(60));
            
            const calendarInfo = await this.calendar.calendars.get({
                calendarId: this.calendarId
            });
            
            console.log(`📅 Nombre: ${calendarInfo.data.summary}`);
            console.log(`🆔 ID: ${calendarInfo.data.id}`);
            console.log(`📝 Descripción: ${calendarInfo.data.description || 'Sin descripción'}`);
            console.log(`🌍 Zona horaria: ${calendarInfo.data.timeZone}`);
            console.log(`🔗 URL: https://calendar.google.com/calendar/u/0/r?cid=${this.calendarId}`);
            
            // Obtener estadísticas de eventos
            const events = await this.getExistingEvents();
            console.log(`📊 Total de eventos: ${events.length}`);
            
        } catch (error) {
            console.error('❌ Error obteniendo información del calendario:', error.message);
        }
    }

    /**
     * Muestra instrucciones de configuración
     */
    showSetupInstructions() {
        console.log('🔧 CONFIGURACIÓN DE SERVICE ACCOUNT PARA CALENDARIO "BOOKING"');
        console.log('='.repeat(60));
        console.log('');
        console.log('Para usar autenticación automática completa:');
        console.log('');
        console.log('1️⃣  Ve a Google Cloud Console:');
        console.log('   https://console.cloud.google.com/');
        console.log('');
        console.log('2️⃣  Crea un nuevo proyecto o selecciona uno existente');
        console.log('');
        console.log('3️⃣  Habilita la API de Google Calendar:');
        console.log('   https://console.cloud.google.com/apis/library/calendar-json.googleapis.com');
        console.log('');
        console.log('4️⃣  Crea un Service Account:');
        console.log('   https://console.cloud.google.com/iam-admin/serviceaccounts');
        console.log('');
        console.log('5️⃣  Descarga el archivo JSON de credenciales');
        console.log('');
        console.log('6️⃣  Renombra el archivo a "service-account.json"');
        console.log('    y ponlo en esta carpeta');
        console.log('');
        console.log('7️⃣  IMPORTANTE: Comparte el calendario "Booking"');
        console.log('    con el email del Service Account (debe tener permisos de escritura)');
        console.log('');
        console.log('8️⃣  Ejecuta: node updateBookingCalendar.js');
        console.log('');
        console.log('✅ Después de esto, la actualización será completamente automática');
        console.log('✅ El script sincronizará booking_events con el calendario "Booking"');
    }
}

// Función principal
async function main() {
    const updater = new BookingCalendarUpdater();
    
    if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
        updater.showSetupInstructions();
        return;
    }

    try {
        await updater.updateCalendar();
    } catch (error) {
        console.error('❌ Error fatal:', error.message);
        process.exit(1);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main();
}

module.exports = BookingCalendarUpdater;
