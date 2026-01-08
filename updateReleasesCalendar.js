/**
 * Script para actualizar el calendario "Releases" con Service Account
 * Autenticación completamente automática sin intervención del usuario
 * Obtiene datos desde API de releases y actualiza el calendario
 */

const { google } = require('googleapis');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const calendarConfig = require('./calendar-config-releases');

// Archivo de credenciales del Service Account
const SERVICE_ACCOUNT_FILE = path.join(__dirname, 'service-account.json');

class ReleasesCalendarUpdater {
    constructor() {
        this.calendar = null;
        this.calendarId = null;
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
     * Busca el calendario "Releases" usando ID directo
     */
    async findReleasesCalendar() {
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
                        console.log('✅ Calendario Records encontrado');
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
            
            // Si no funciona con ID forzado, buscar en la lista
            console.log('🔍 Buscando en lista de calendarios disponibles...');
            const calendars = await this.calendar.calendarList.list();
            console.log(`📊 Total de calendarios encontrados: ${calendars.data.items.length}`);
            
            // Mostrar todos los calendarios para debug
            calendars.data.items.forEach((cal, index) => {
                console.log(`   ${index + 1}. "${cal.summary}" (ID: ${cal.id}) - Access: ${cal.accessRole}`);
            });
            
            // Buscar calendario "Records" o "Releases"
            let releasesCalendar = calendars.data.items.find(cal => 
                cal.summary === 'Records' ||
                cal.summary === 'Releases' ||
                cal.summary.toLowerCase().includes('record') ||
                cal.summary.toLowerCase().includes('release')
            );
            
            if (releasesCalendar) {
                console.log('✅ Calendario Records encontrado en lista');
                console.log(`   • ID: ${releasesCalendar.id}`);
                console.log(`   • Summary: ${releasesCalendar.summary}`);
                console.log(`   • Access Role: ${releasesCalendar.accessRole}`);
                console.log(`   • Time Zone: ${releasesCalendar.timeZone}`);
                console.log(`   • URL: https://calendar.google.com/calendar/u/0/r?cid=${releasesCalendar.id}`);
                this.calendarId = releasesCalendar.id;
                return releasesCalendar;
            }

            // Si no se encuentra, mostrar error
            console.error('❌ Calendario "Records" NO encontrado');
            console.error('❌ Opciones disponibles:');
            console.error('   1. Crear un calendario "Records" en Google Calendar');
            console.error('   2. Compartir el calendario con el Service Account (permisos de escritura)');
            console.error('   3. Actualizar el ID en calendar-config-releases.js');
            console.error('');
            console.error('📋 Calendarios disponibles:');
            calendars.data.items.forEach((cal, index) => {
                console.error(`   ${index + 1}. "${cal.summary}" (ID: ${cal.id})`);
            });
            
            throw new Error('Calendario Records no encontrado');

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
     * Obtiene releases desde la API
     */
    async getReleases() {
        try {
            console.log('📡 Obteniendo releases desde la API...');
            console.log(`   • URL: ${calendarConfig.api.url}`);
            console.log(`   • Origin: ${calendarConfig.api.headers.Origin}`);
            
            const response = await axios.get(calendarConfig.api.url, {
                headers: calendarConfig.api.headers
            });
            
            const releases = response.data;
            
            // Verificar si es un array o un objeto con datos
            const releasesArray = Array.isArray(releases) ? releases : (releases.data || releases.releases || []);
            
            console.log(`✅ Se obtuvieron ${releasesArray.length} releases`);
            
            // Mostrar primeros 3 releases para debug
            if (releasesArray.length > 0) {
                console.log('📋 Primeros 3 releases encontrados:');
                releasesArray.slice(0, 3).forEach((release, index) => {
                    const title = release.title || release.name || 'Sin título';
                    const artist = release.artist?.name || release.artist_name || 'Artista desconocido';
                    const date = release.release_date || release.date || release.created_at || 'Sin fecha';
                    console.log(`   ${index + 1}. ${artist} - ${title} (${date})`);
                });
            }
            
            return releasesArray;
        } catch (error) {
            console.error('❌ Error obteniendo releases:', error.message);
            if (error.response) {
                console.error(`   • Status: ${error.response.status}`);
                console.error(`   • Data: ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }

    /**
     * Convierte release a evento de Google Calendar
     */
    formatReleaseToEvent(release) {
        // Validaciones de seguridad con valores por defecto
        const artistName = release.artist?.name || release.artist_name || 'Artista Desconocido';
        const releaseTitle = release.title || release.name || 'Título Desconocido';
        const releaseType = release.type || release.release_type || 'Release';
        const releaseDate = release.release_date || release.date || release.created_at;
        const genre = release.genre || release.artist?.genre || 'N/A';
        const label = release.label || release.label_name || 'N/A';
        const description = release.description || release.overview || '';
        const coverUrl = release.cover || release.cover_url || release.artwork_url || '';
        const spotifyUrl = release.spotify_url || release.external_urls?.spotify || '';
        const appleUrl = release.apple_url || release.external_urls?.apple || '';
        
        if (!releaseDate) {
            throw new Error(`Release sin fecha: ${artistName} - ${releaseTitle}`);
        }

        const releaseDateObj = new Date(releaseDate);
        
        if (isNaN(releaseDateObj.getTime())) {
            throw new Error(`Fecha inválida para release: ${artistName} - ${releaseTitle} (${releaseDate})`);
        }
        
        // Formatear fecha de inicio en formato YYYY-MM-DD (evento de todo el día)
        const startDateStr = releaseDateObj.toISOString().split('T')[0];
        
        // Fecha de fin es el día siguiente (para eventos de todo el día)
        const endDate = new Date(releaseDateObj);
        endDate.setDate(endDate.getDate() + 1);
        const endDateStr = endDate.toISOString().split('T')[0];

        // Construir descripción del evento
        let eventDescription = `🎵 Artista: ${artistName}\n📀 Título: ${releaseTitle}\n📋 Tipo: ${releaseType}\n🎭 Género: ${genre}\n🏷️  Sello: ${label}`;
        
        if (description) {
            eventDescription += `\n\n📝 Descripción:\n${description}`;
        }
        
        if (spotifyUrl) {
            eventDescription += `\n\n🎧 Spotify: ${spotifyUrl}`;
        }
        
        if (appleUrl) {
            eventDescription += `\n🍎 Apple Music: ${appleUrl}`;
        }
        
        if (coverUrl) {
            eventDescription += `\n\n🖼️  Portada: ${coverUrl}`;
        }

        const event = {
            summary: `${artistName} - ${releaseTitle}`,
            description: eventDescription,
            start: {
                date: startDateStr  // Formato YYYY-MM-DD para evento de todo el día
            },
            end: {
                date: endDateStr  // Formato YYYY-MM-DD para evento de todo el día
            },
            status: 'confirmed',
            visibility: 'public',
            colorId: this.getColorForReleaseType(releaseType)
        };

        return event;
    }

    /**
     * Asigna color según tipo de release
     */
    getColorForReleaseType(type) {
        const colorMap = {
            'album': '1',
            'single': '2',
            'ep': '3',
            'mixtape': '4',
            'compilation': '5',
            'default': '6'
        };
        const normalizedType = (type || '').toLowerCase();
        return colorMap[normalizedType] || colorMap['default'];
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
                    console.log(`🔨 Insertando evento ${i + 1}/${events.length}: ${event.summary} (${event.start?.date})`);
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
            console.log('🔄 ACTUALIZANDO CALENDARIO "RECORDS" (SERVICE ACCOUNT)');
            console.log('='.repeat(60));

            // 1. Configurar autenticación
            await this.setupAuthentication();

            // 2. Buscar calendario Records
            await this.findReleasesCalendar();

            // 3. Obtener releases desde la API
            const allReleases = await this.getReleases();
            
            // 4. Filtrar releases válidos (con fecha de lanzamiento)
            const now = new Date();
            const validReleases = allReleases.filter(release => {
                const releaseDate = release.release_date || release.date || release.created_at;
                if (!releaseDate) {
                    console.warn(`⚠️  Release sin fecha ignorado: ${release.title || release.name || 'Sin título'}`);
                    return false;
                }
                
                try {
                    const dateObj = new Date(releaseDate);
                    return !isNaN(dateObj.getTime());
                } catch (error) {
                    console.warn(`⚠️  Release con fecha inválida ignorado: ${release.title || release.name || 'Sin título'} (${releaseDate})`);
                    return false;
                }
            });
            
            // Separar por fechas para estadísticas
            const pastReleases = validReleases.filter(release => {
                const releaseDate = new Date(release.release_date || release.date || release.created_at);
                return releaseDate < now;
            });
            
            const futureReleases = validReleases.filter(release => {
                const releaseDate = new Date(release.release_date || release.date || release.created_at);
                return releaseDate >= now;
            });

            console.log(`📊 Releases válidos: ${validReleases.length} total`);
            console.log(`   • Releases pasados: ${pastReleases.length}`);
            console.log(`   • Releases futuros: ${futureReleases.length}`);
            
            if (validReleases.length === 0) {
                console.log('⚠️  No hay releases válidos para procesar');
                return;
            }

            // 5. BORRAR TODOS LOS EVENTOS EXISTENTES
            console.log('\n🗑️  PASO 1: BORRANDO TODOS LOS EVENTOS EXISTENTES...');
            await this.clearCalendar();

            // 6. CARGA AUTOMÁTICA
            console.log('\n🚀 PASO 2: CARGA AUTOMÁTICA');
            console.log(`📅 Cargando ${validReleases.length} eventos nuevos al calendario "Records"`);
            console.log('🔗 URL del calendario:', `https://calendar.google.com/calendar/u/0/r?cid=${this.calendarId}`);
            console.log('✅ Cargando eventos automáticamente...');

            // 7. Convertir a eventos e insertar
            const calendarEvents = [];
            let skippedCount = 0;
            
            for (const release of validReleases) {
                try {
                    const event = this.formatReleaseToEvent(release);
                    calendarEvents.push(event);
                } catch (error) {
                    skippedCount++;
                    console.warn(`⚠️  Error formateando release, saltado: ${error.message}`);
                }
            }
            
            const results = await this.insertEvents(calendarEvents);
            results.skippedCount = skippedCount;

            // 8. Estadísticas finales
            console.log('\n🎉 ACTUALIZACIÓN COMPLETADA');
            console.log('='.repeat(60));
            console.log(`✅ Eventos creados: ${results.successCount}`);
            console.log(`⏭️  Eventos saltados (errores): ${results.skippedCount}`);
            console.log(`❌ Eventos fallidos: ${results.errorCount}`);
            
            const stats = {
                artists: new Set(validReleases.map(r => r.artist?.name || r.artist_name || 'Desconocido')).size,
                types: new Set(validReleases.map(r => r.type || r.release_type || 'Release')).size,
                genres: new Set(validReleases.map(r => r.genre || r.artist?.genre || 'N/A')).size
            };

            console.log('\n📈 ESTADÍSTICAS:');
            console.log(`   • Artistas: ${stats.artists}`);
            console.log(`   • Tipos de release: ${stats.types}`);
            console.log(`   • Géneros: ${stats.genres}`);
            
            // Mostrar rango de fechas
            if (validReleases.length > 0) {
                const dates = validReleases
                    .map(r => new Date(r.release_date || r.date || r.created_at))
                    .filter(d => !isNaN(d.getTime()))
                    .sort((a, b) => a - b);
                    
                if (dates.length > 0) {
                    const earliest = dates[0];
                    const latest = dates[dates.length - 1];
                    
                    console.log(`   • Rango de fechas: ${earliest.toLocaleDateString('es-AR')} - ${latest.toLocaleDateString('es-AR')}`);
                    console.log(`   • Releases pasados: ${pastReleases.length}`);
                    console.log(`   • Releases futuros: ${futureReleases.length}`);
                }
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
        console.log('🔧 CONFIGURACIÓN DE SERVICE ACCOUNT PARA CALENDARIO "RECORDS"');
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
        console.log('7️⃣  IMPORTANTE: Crea un calendario "Records" en Google Calendar');
        console.log('    y compártelo con el email del Service Account (debe tener permisos de escritura)');
        console.log('');
        console.log('8️⃣  Obtén el ID del calendario y actualízalo en calendar-config-releases.js');
        console.log('    (El ID se encuentra en Configuración del calendario > Integrar calendario)');
        console.log('');
        console.log('9️⃣  Ejecuta: node updateReleasesCalendar.js');
        console.log('');
        console.log('✅ Después de esto, la actualización será completamente automática');
        console.log('✅ El script actualizará el calendario "Records" con datos de la API');
    }
}

// Función principal
async function main() {
    const updater = new ReleasesCalendarUpdater();
    
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

module.exports = ReleasesCalendarUpdater;