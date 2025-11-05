/**
 * Script para actualizar el calendario "Management" con datos de mgm_events
 * Migra datos de la tabla mgm_events al calendario Management
 */

const { google } = require('googleapis');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const calendarConfig = require('./calendar-config-mgm');

// Archivo de credenciales del Service Account
const SERVICE_ACCOUNT_FILE = path.join(__dirname, 'service-account.json');

class ManagementCalendarUpdater {
    constructor() {
        this.calendar = null;
        this.calendarId = null;
    }

    /**
     * Pide confirmación al usuario
     */
    async askConfirmation(message) {
        return new Promise((resolve) => {
            process.stdout.write(message);
            process.stdin.setEncoding('utf8');
            process.stdin.once('data', (data) => {
                resolve(data.toString().toLowerCase().trim());
            });
        });
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
            await auth.authorize();
            console.log('✅ Token de autenticación obtenido');
            
            // Crear cliente de Calendar
            this.calendar = google.calendar({ version: 'v3', auth });
            console.log('✅ Cliente de Calendar creado');
            
            return true;
        } catch (error) {
            console.error('❌ Error en autenticación:', error.message);
            throw error;
        }
    }

    /**
     * Busca el calendario Management
     */
    async findManagementCalendar() {
        try {
            console.log(`🔍 Conectando al calendario: ${calendarConfig.calendarName}`);
            
            // Usar el ID específico del calendario Management
            console.log(`🔧 Usando ID: ${calendarConfig.calendarId}`);
            try {
                const calendarInfo = await this.calendar.calendars.get({
                    calendarId: calendarConfig.calendarId
                });
                
                if (calendarInfo.data) {
                    console.log('✅ Calendario Management encontrado');
                    console.log(`   • ID: ${calendarInfo.data.id}`);
                    console.log(`   • Summary: ${calendarInfo.data.summary}`);
                    console.log(`   • Time Zone: ${calendarInfo.data.timeZone}`);
                    console.log(`   • URL: https://calendar.google.com/calendar/u/0/r?cid=${calendarInfo.data.id}`);
                    
                    this.calendarId = calendarInfo.data.id;
                    return calendarInfo.data;
                }
            } catch (error) {
                console.error(`❌ Error con ID ${calendarConfig.calendarId}:`, error.message);
                throw error;
            }
        } catch (error) {
            console.error('❌ Error buscando calendario:', error);
            throw error;
        }
    }

    /**
     * Obtiene eventos de management desde la base de datos
     */
    async getManagementEvents() {
        const pool = new Pool({
            connectionString: calendarConfig.database.connectionString,
        });

        try {
            console.log('📡 Obteniendo eventos de management desde la base de datos...');
            console.log(`🔍 Consultando tabla: ${calendarConfig.database.tableName}`);
            console.log(`🔍 Query: ${calendarConfig.database.query}`);
            
            const result = await pool.query(calendarConfig.database.query);
            const events = result.rows;
            
            console.log(`✅ Se obtuvieron ${events.length} eventos de management`);
            
            // Debug: mostrar algunos ejemplos de eventos
            if (events.length > 0) {
                console.log('📋 Primeros 3 eventos encontrados:');
                events.slice(0, 3).forEach((event, index) => {
                    console.log(`   ${index + 1}. ${event.artist_name} - ${event.venue_name} (${event.status}) - ${event.show_date}`);
                });
            } else {
                console.log('⚠️  No se encontraron eventos. Verificando consulta...');
            }
            
            return events;
        } catch (error) {
            console.error('❌ Error obteniendo eventos de management:', error.message);
            throw error;
        } finally {
            await pool.end();
        }
    }

    /**
     * Convierte evento de management a evento de Google Calendar
     */
    formatManagementEventToCalendar(event) {
        const showDate = new Date(event.show_date);
        
        // Formatear fecha de inicio en formato YYYY-MM-DD (evento de todo el día)
        const startDateStr = showDate.toISOString().split('T')[0];
        
        // Fecha de fin es el día siguiente (para eventos de todo el día)
        const endDate = new Date(showDate);
        endDate.setDate(endDate.getDate() + 1);
        const endDateStr = endDate.toISOString().split('T')[0];

        // Crear descripción detallada para management
        let description = `🎤 Artista: ${event.artist_name || 'N/A'}\n`;
        description += `🏟️ Venue: ${event.venue_name || 'N/A'}\n`;
        description += `📍 Ciudad: ${event.city}, ${event.country}\n`;
        description += `📅 Fecha: ${showDate.toLocaleDateString('es-AR')}\n`;
        description += `📊 Status: ${event.status || 'N/A'}\n`;
        
        // Agregar información adicional del artista
        if (event.artist_genre) {
            description += `🎵 Género: ${event.artist_genre}\n`;
        }
        
        if (event.aforo) {
            description += `👥 Aforo: ${event.aforo.toLocaleString()}\n`;
        }
        if (event.formato) {
            description += `🎭 Formato: ${event.formato}\n`;
        }
        if (event.nombre_festi) {
            description += `🎪 Festival: ${event.nombre_festi}\n`;
        }
        if (event.garantia) {
            description += `💰 Garantía: ${event.garantia}\n`;
        }
        if (event.acuerdo) {
            description += `📋 Acuerdo: ${event.acuerdo}\n`;
        }
        if (event.overage) {
            description += `📈 Overage: ${event.overage}\n`;
        }
        if (event.com_promotor) {
            description += `🤝 Com. Promotor: ${event.com_promotor}\n`;
        }
        if (event.spliteo) {
            description += `⚖️ Spliteo: ${event.spliteo}\n`;
        }

        const eventTitle = event.nombre_festi 
            ? `${event.artist_name} - ${event.nombre_festi}`
            : `${event.artist_name} - ${event.venue_name}`;

        const calendarEvent = {
            summary: eventTitle,
            description: description,
            start: {
                date: startDateStr  // Formato YYYY-MM-DD para evento de todo el día
            },
            end: {
                date: endDateStr  // Formato YYYY-MM-DD para evento de todo el día
            },
            location: event.venue_address || `${event.venue_name}, ${event.city}, ${event.country}`,
            status: 'confirmed',
            visibility: 'public',
            colorId: this.getColorForManagementEvent(event)
        };

        return calendarEvent;
    }

    /**
     * Asigna color según el tipo de evento de management
     */
    getColorForManagementEvent(event) {
        // Colores basados en el tipo de evento
        if (event.nombre_festi) {
            return '2'; // Azul para festivales
        } else if (event.formato && event.formato.toLowerCase().includes('acústico')) {
            return '5'; // Amarillo para acústicos
        } else if (event.aforo && event.aforo > 10000) {
            return '1'; // Rojo para eventos grandes
        } else if (event.status === 'confirmed') {
            return '10'; // Verde para confirmados
        } else {
            return '6'; // Gris por defecto
        }
    }

    /**
     * Limpia el calendario (todos los eventos)
     */
    async clearCalendar() {
        try {
            console.log('🗑️  Limpiando TODOS los eventos existentes...');
            
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
                    
                    if (successCount % 10 === 0) {
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
            console.log('🔄 ACTUALIZANDO CALENDARIO "MANAGEMENT" (SERVICE ACCOUNT)');
            console.log('='.repeat(60));

            // 1. Configurar autenticación
            await this.setupAuthentication();

            // 2. Buscar calendario Management
            await this.findManagementCalendar();

            // 3. Obtener eventos de management
            const allEvents = await this.getManagementEvents();
            
            // 4. Filtrar eventos válidos (solo los que tienen datos básicos)
            const now = new Date();
            const validEvents = allEvents.filter(event => {
                return event.artist_name && 
                       event.show_date && 
                       event.city && 
                       event.country;
            });
            
            // Separar por fechas para estadísticas
            const pastEvents = validEvents.filter(event => {
                return new Date(event.show_date) < now;
            });
            
            const futureEvents = validEvents.filter(event => {
                return new Date(event.show_date) >= now;
            });

            console.log(`📊 Eventos válidos: ${validEvents.length} total`);
            console.log(`   • Eventos pasados: ${pastEvents.length}`);
            console.log(`   • Eventos futuros: ${futureEvents.length}`);

            // 5. BORRAR TODOS LOS EVENTOS EXISTENTES
            console.log('\n🗑️  PASO 1: BORRANDO TODOS LOS EVENTOS EXISTENTES...');
            await this.clearCalendar();

            // 6. CARGA AUTOMÁTICA
            console.log('\n🚀 PASO 2: CARGA AUTOMÁTICA');
            console.log(`📅 Cargando ${validEvents.length} eventos de management al calendario "Management"`);
            console.log('🔗 URL del calendario:', `https://calendar.google.com/calendar/u/0/r?cid=${this.calendarId}`);
            console.log('✅ Cargando eventos automáticamente...');

            // 7. Convertir a eventos e insertar
            const calendarEvents = validEvents.map(event => this.formatManagementEventToCalendar(event));
            const results = await this.insertEvents(calendarEvents);

            // 8. Estadísticas finales
            console.log('\n🎉 ACTUALIZACIÓN COMPLETADA');
            console.log('='.repeat(60));
            console.log(`✅ Eventos creados: ${results.successCount}`);
            console.log(`⏭️  Eventos saltados (duplicados): ${results.skippedCount || 0}`);
            console.log(`❌ Eventos fallidos: ${results.errorCount}`);
            
            const stats = {
                artists: new Set(validEvents.map(e => e.artist_name)).size,
                venues: new Set(validEvents.map(e => e.venue_name)).size,
                cities: new Set(validEvents.map(e => e.city)).size,
                countries: new Set(validEvents.map(e => e.country)).size,
                festivals: new Set(validEvents.map(e => e.nombre_festi).filter(f => f)).size
            };

            console.log('\n📈 ESTADÍSTICAS:');
            console.log(`   • Artistas: ${stats.artists}`);
            console.log(`   • Venues: ${stats.venues}`);
            console.log(`   • Ciudades: ${stats.cities}`);
            console.log(`   • Países: ${stats.countries}`);
            console.log(`   • Festivales: ${stats.festivals}`);
            
            // Mostrar rango de fechas
            if (validEvents.length > 0) {
                const dates = validEvents.map(e => new Date(e.show_date)).sort((a, b) => a - b);
                const earliest = dates[0];
                const latest = dates[dates.length - 1];
                
                console.log(`   • Rango de fechas: ${earliest.toLocaleDateString('es-AR')} - ${latest.toLocaleDateString('es-AR')}`);
                console.log(`   • Eventos pasados: ${pastEvents.length}`);
                console.log(`   • Eventos futuros: ${futureEvents.length}`);
            }

            console.log(`\n🔗 ID del calendario: ${this.calendarId}`);
            console.log(`🔗 URL del calendario: https://calendar.google.com/calendar/u/0/r?cid=${this.calendarId}`);

        } catch (error) {
            console.error('❌ Error actualizando calendario:', error.message);
            throw error;
        }
    }
}

// Función principal
async function main() {
    const updater = new ManagementCalendarUpdater();
    
    if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
        console.log('❌ Archivo service-account.json no encontrado');
        console.log('📋 Asegúrate de tener el archivo de credenciales del Service Account');
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

module.exports = ManagementCalendarUpdater;
