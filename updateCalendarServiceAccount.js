/**
 * Script para actualizar el calendario "Live" con Service Account
 * Autenticación completamente automática sin intervención del usuario
 * Elimina duplicados y actualiza con shows nuevos
 */

const { google } = require('googleapis');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const calendarConfig = require('./calendar-config');

// Configuración
const CONFIG = {
    showsApiUrl: 'https://malbec-tcsm.vercel.app/api/calendar/events-shows'
};

// Archivo de credenciales del Service Account
const SERVICE_ACCOUNT_FILE = path.join(__dirname, 'service-account.json');

class ServiceAccountCalendarUpdater {
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
            console.log(`   • Private Key ID: ${credentials.private_key_id}`);
            console.log(`   • Auth URI: ${credentials.auth_uri}`);
            console.log(`   • Token URI: ${credentials.token_uri}`);

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
            console.error('❌ Detalles del error:', error);
            throw error;
        }
    }

    /**
     * Busca el calendario "Live" de malbec@daleplay.la usando ID directo
     */
    async findMalbecCalendar() {
        try {
            console.log(`🔍 Conectando al calendario: ${calendarConfig.calendarName}`);
            
            // Si está configurado para forzar un ID específico
            if (calendarConfig.forceCalendarId) {
                console.log(`🔧 Usando ID forzado: ${calendarConfig.calendarId}`);
                try {
                    const calendarInfo = await this.calendar.calendars.get({
                        calendarId: calendarConfig.calendarId
                    });
                    
                    if (calendarInfo.data) {
                        console.log('✅ Calendario encontrado con ID forzado');
                        console.log(`   • ID: ${calendarInfo.data.id}`);
                        console.log(`   • Summary: ${calendarInfo.data.summary}`);
                        console.log(`   • Time Zone: ${calendarInfo.data.timeZone}`);
                        console.log(`   • URL: https://calendar.google.com/calendar/u/0/r?cid=${calendarInfo.data.id}`);
                        
                        this.calendarId = calendarInfo.data.id;
                        return calendarInfo.data;
                    }
                } catch (error) {
                    console.error(`❌ Error con ID forzado ${calendarConfig.calendarId}:`, error.message);
                }
            }
            
            // Intentar conectar directamente usando el ID del calendario principal
            const possibleIds = [
                calendarConfig.calendarId,  // ID configurado
                'malbec@daleplay.la',       // ID principal del calendario
                'primary',                  // Calendario principal por defecto
                'malbec@daleplay.la#live@group.calendar.google.com'  // Posible ID del calendario Live
            ];
            
            for (const calendarId of possibleIds) {
                try {
                    console.log(`🔍 Probando ID: ${calendarId}`);
                    
                    // Intentar obtener información del calendario
                    const calendarInfo = await this.calendar.calendars.get({
                        calendarId: calendarId
                    });
                    
                    if (calendarInfo.data) {
                        console.log('✅ Calendario encontrado directamente');
                        console.log(`   • ID: ${calendarInfo.data.id}`);
                        console.log(`   • Summary: ${calendarInfo.data.summary}`);
                        console.log(`   • Time Zone: ${calendarInfo.data.timeZone}`);
                        console.log(`   • URL: https://calendar.google.com/calendar/u/0/r?cid=${calendarInfo.data.id}`);
                        
                        this.calendarId = calendarInfo.data.id;
                        return calendarInfo.data;
                    }
                } catch (error) {
                    console.log(`   ❌ ID ${calendarId} no válido: ${error.message}`);
                    continue;
                }
            }
            
            // Si no funciona con IDs directos, intentar buscar en la lista
            console.log('🔍 Buscando en lista de calendarios disponibles...');
            const calendars = await this.calendar.calendarList.list();
            console.log(`📊 Total de calendarios encontrados: ${calendars.data.items.length}`);
            
            // Mostrar todos los calendarios para debug
            calendars.data.items.forEach((cal, index) => {
                console.log(`   ${index + 1}. "${cal.summary}" (ID: ${cal.id}) - Access: ${cal.accessRole}`);
            });
            
            // Buscar calendario "Live" de malbec@daleplay.la
            let malbecCalendar = calendars.data.items.find(cal => 
                cal.summary === 'Live' ||
                cal.id === 'malbec@daleplay.la' || 
                cal.summary === 'malbec@daleplay.la' ||
                cal.summary === 'malbec Tech' ||
                cal.id.includes('malbec@daleplay.la') ||
                cal.summary.includes('malbec')
            );
            
            if (malbecCalendar) {
                console.log('✅ Calendario de malbec@daleplay.la encontrado en lista');
                console.log(`   • ID: ${malbecCalendar.id}`);
                console.log(`   • Summary: ${malbecCalendar.summary}`);
                console.log(`   • Access Role: ${malbecCalendar.accessRole}`);
                console.log(`   • Time Zone: ${malbecCalendar.timeZone}`);
                console.log(`   • URL: https://calendar.google.com/calendar/u/0/r?cid=${malbecCalendar.id}`);
                this.calendarId = malbecCalendar.id;
                return malbecCalendar;
            }

            // Si no se encuentra, mostrar error
            console.error('❌ Calendario de malbec@daleplay.la NO encontrado');
            console.error('❌ Opciones disponibles:');
            console.error('   1. Compartir el calendario "Live" de malbec@daleplay.la con el Service Account');
            console.error('   2. Usar el ID directo del calendario');
            console.error('   3. Verificar que el calendario existe');
            console.error('');
            console.error('📋 Calendarios disponibles:');
            calendars.data.items.forEach((cal, index) => {
                console.error(`   ${index + 1}. "${cal.summary}" (ID: ${cal.id})`);
            });
            
            throw new Error('Calendario de malbec@daleplay.la no encontrado');

        } catch (error) {
            console.error('❌ Error buscando calendario:', error);
            console.error('❌ Detalles del error:', error.message);
            if (error.response) {
                console.error('❌ Response data:', error.response.data);
                console.error('❌ Response status:', error.response.status);
            }
            throw error;
        }
    }

    /**
     * Obtiene shows desde la API
     */
    async getShows() {
        try {
            console.log('📡 Obteniendo shows desde la API...');
            const response = await axios.get(CONFIG.showsApiUrl);
            const shows = response.data;
            
            console.log(`✅ Se obtuvieron ${shows.length} shows`);
            return shows;
        } catch (error) {
            console.error('❌ Error obteniendo shows:', error.message);
            throw error;
        }
    }

    /**
     * Convierte show a evento de Google Calendar
     */
    formatShowToEvent(show) {
        const showDate = new Date(show.show_date);
        
        const startTime = new Date(showDate);
        startTime.setHours(21, 0, 0, 0);
        
        const endTime = new Date(showDate);
        endTime.setDate(endTime.getDate() + 1);
        endTime.setHours(0, 0, 0, 0);

        const event = {
            summary: `${show.artist.name} - ${show.venue.name}`,
            description: `🎤 Artista: ${show.artist.name}\n🏟️ Venue: ${show.venue.name}\n📍 Ciudad: ${show.city}, ${show.country}\n📊 Status: ${show.status || 'N/A'}\n🎫 Ticketera: ${show.ticketera.name}\n🔗 URL: ${show.ticketera.url}\n⭐ Género: ${show.artist.genre}`,
            start: {
                dateTime: startTime.toISOString(),
                timeZone: 'America/Argentina/Buenos_Aires'
            },
            end: {
                dateTime: endTime.toISOString(),
                timeZone: 'America/Argentina/Buenos_Aires'
            },
            location: show.venue.address || `${show.venue.name}, ${show.city}, ${show.country}`,
            status: 'confirmed',
            visibility: 'public',
            colorId: this.getColorForGenre(show.artist.genre)
        };

        return event;
    }

    /**
     * Asigna color según género
     */
    getColorForGenre(genre) {
        const colorMap = {
            'Pop': '1', 'Rock': '2', 'Hip Hop': '3', 'Electronic': '4',
            'Jazz': '5', 'Classical': '6', 'Country': '7', 'R&B': '8',
            'Reggae': '9', 'Folk': '10', 'default': '1'
        };
        return colorMap[genre] || colorMap['default'];
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
     * Verifica si un evento ya existe basado en título y fecha
     */
    eventExists(newEvent, existingEvents) {
        return existingEvents.some(existing => {
            const sameTitle = existing.summary === newEvent.summary;
            const sameStartTime = existing.start?.dateTime === newEvent.start?.dateTime;
            return sameTitle && sameStartTime;
        });
    }

    /**
     * Limpia eventos duplicados del calendario
     */
    async clearDuplicateEvents() {
        try {
            console.log('🔍 Buscando eventos duplicados...');
            
            const existingEvents = await this.getExistingEvents();
            const duplicates = [];
            const seen = new Set();
            
            // Identificar duplicados
            for (const event of existingEvents) {
                const key = `${event.summary}|${event.start?.dateTime || event.start?.date}`;
                if (seen.has(key)) {
                    duplicates.push(event);
                } else {
                    seen.add(key);
                }
            }
            
            if (duplicates.length === 0) {
                console.log('✅ No se encontraron eventos duplicados');
                return;
            }
            
            console.log(`🔄 Encontrados ${duplicates.length} eventos duplicados, eliminando...`);
            
            let deletedCount = 0;
            for (const duplicate of duplicates) {
                try {
                    await this.calendar.events.delete({
                        calendarId: this.calendarId,
                        eventId: duplicate.id
                    });
                    deletedCount++;
                    console.log(`   🗑️  Eliminado duplicado: ${duplicate.summary}`);
                } catch (error) {
                    console.error(`❌ Error eliminando duplicado ${duplicate.id}:`, error.message);
                }
            }
            
            console.log(`✅ Se eliminaron ${deletedCount} eventos duplicados`);
        } catch (error) {
            console.error('❌ Error limpiando duplicados:', error);
            throw error;
        }
    }

    /**
     * Limpia el calendario (todos los eventos)
     */
    async clearCalendar() {
        try {
            console.log('🗑️  Limpiando TODOS los eventos existentes...');
            
            // Obtener todos los eventos (pasados, presentes y futuros)
            const events = await this.calendar.events.list({
                calendarId: this.calendarId,
                maxResults: 2500, // Máximo permitido por Google
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
     * Inserta eventos en el calendario (sin verificar duplicados ya que se borró todo)
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
            console.log('🔄 ACTUALIZANDO CALENDARIO DE malbec@daleplay.la (SERVICE ACCOUNT)');
            console.log('='.repeat(60));

            // 1. Configurar autenticación
            await this.setupAuthentication();

            // 2. Buscar calendario de malbec@daleplay.la
            await this.findMalbecCalendar();

            // 3. Obtener shows
            const allShows = await this.getShows();
            
            // 4. Filtrar shows válidos (incluyendo pasados, actuales y futuros) - TODOS LOS STATUS
            const now = new Date();
            const validShows = allShows.filter(show => {
                return show.artist?.name && 
                       show.venue?.name && 
                       show.show_date && 
                       show.city && 
                       show.country;
            });
            
            // Separar por fechas para estadísticas
            const pastShows = validShows.filter(show => {
                return new Date(show.show_date) < now;
            });
            
            const futureShows = validShows.filter(show => {
                return new Date(show.show_date) >= now;
            });

            console.log(`📊 Shows válidos: ${validShows.length} total`);
            console.log(`   • Shows pasados: ${pastShows.length}`);
            console.log(`   • Shows futuros: ${futureShows.length}`);
            
            // Usar todos los shows válidos (pasados + futuros)
            const allValidShows = validShows;

            // 5. BORRAR TODOS LOS EVENTOS EXISTENTES
            console.log('\n🗑️  PASO 1: BORRANDO TODOS LOS EVENTOS EXISTENTES...');
            await this.clearCalendar();

            // 6. CARGA AUTOMÁTICA
            console.log('\n🚀 PASO 2: CARGA AUTOMÁTICA');
            console.log(`📅 Cargando ${allValidShows.length} eventos nuevos al calendario "Live"`);
            console.log('🔗 URL del calendario:', `https://calendar.google.com/calendar/u/0/r?cid=${this.calendarId}`);
            console.log('✅ Cargando eventos automáticamente...');

            // 7. Convertir a eventos e insertar
            const calendarEvents = allValidShows.map(show => this.formatShowToEvent(show));
            const results = await this.insertEvents(calendarEvents);

            // 8. Estadísticas finales
            console.log('\n🎉 ACTUALIZACIÓN COMPLETADA');
            console.log('='.repeat(60));
            console.log(`✅ Eventos creados: ${results.successCount}`);
            console.log(`⏭️  Eventos saltados (duplicados): ${results.skippedCount || 0}`);
            console.log(`❌ Eventos fallidos: ${results.errorCount}`);
            
            const stats = {
                artists: new Set(allValidShows.map(s => s.artist.name)).size,
                venues: new Set(allValidShows.map(s => s.venue.name)).size,
                cities: new Set(allValidShows.map(s => s.city)).size,
                countries: new Set(allValidShows.map(s => s.country)).size,
                genres: new Set(allValidShows.map(s => s.artist.genre)).size
            };

            console.log('\n📈 ESTADÍSTICAS:');
            console.log(`   • Artistas: ${stats.artists}`);
            console.log(`   • Venues: ${stats.venues}`);
            console.log(`   • Ciudades: ${stats.cities}`);
            console.log(`   • Países: ${stats.countries}`);
            console.log(`   • Géneros: ${stats.genres}`);
            
            // Mostrar rango de fechas
            if (allValidShows.length > 0) {
                const dates = allValidShows.map(s => new Date(s.show_date)).sort((a, b) => a - b);
                const earliest = dates[0];
                const latest = dates[dates.length - 1];
                
                console.log(`   • Rango de fechas: ${earliest.toLocaleDateString('es-AR')} - ${latest.toLocaleDateString('es-AR')}`);
                console.log(`   • Shows pasados: ${pastShows.length}`);
                console.log(`   • Shows futuros: ${futureShows.length}`);
            }

            // 9. Mostrar información detallada del calendario
            await this.showCalendarInfo();

        } catch (error) {
            console.error('❌ Error actualizando calendario:', error.message);
            throw error;
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
            
            if (events.length > 0) {
                const now = new Date();
                const pastEvents = events.filter(event => {
                    const eventDate = new Date(event.start?.dateTime || event.start?.date);
                    return eventDate < now;
                });
                const futureEvents = events.filter(event => {
                    const eventDate = new Date(event.start?.dateTime || event.start?.date);
                    return eventDate >= now;
                });
                
                console.log(`   • Eventos pasados: ${pastEvents.length}`);
                console.log(`   • Eventos futuros: ${futureEvents.length}`);
            }
            
        } catch (error) {
            console.error('❌ Error obteniendo información del calendario:', error.message);
        }
    }

    /**
     * Muestra instrucciones de configuración
     */
    showSetupInstructions() {
        console.log('🔧 CONFIGURACIÓN DE SERVICE ACCOUNT PARA CALENDARIO "LIVE"');
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
        console.log('7️⃣  IMPORTANTE: Comparte el calendario "Live"');
        console.log('    con el email del Service Account (debe tener permisos de escritura)');
        console.log('');
        console.log('8️⃣  Ejecuta: node updateCalendarServiceAccount.js');
        console.log('');
        console.log('✅ Después de esto, la actualización será completamente automática');
        console.log('✅ El script actualizará el calendario "Live" eliminando duplicados');
    }
}

// Función principal
async function main() {
    const updater = new ServiceAccountCalendarUpdater();
    
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

module.exports = ServiceAccountCalendarUpdater;
