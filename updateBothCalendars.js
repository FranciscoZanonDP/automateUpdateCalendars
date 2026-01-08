/**
 * Script para actualizar TODOS LOS CALENDARIOS automáticamente
 * Live + Management + Booking + Releases sin preguntas
 */

const ServiceAccountCalendarUpdater = require('./updateCalendarServiceAccount');
const ManagementCalendarUpdater = require('./updateCalendarManagement');
const BookingCalendarUpdater = require('./updateBookingCalendar');
const ReleasesCalendarUpdater = require('./updateReleasesCalendar');
const fs = require('fs');
const path = require('path');

// Archivo de credenciales del Service Account
const SERVICE_ACCOUNT_FILE = path.join(__dirname, 'service-account.json');

class AllCalendarsUpdater {
    constructor() {
        this.liveUpdater = new ServiceAccountCalendarUpdater();
        this.mgmtUpdater = new ManagementCalendarUpdater();
        this.bookingUpdater = new BookingCalendarUpdater();
        this.releasesUpdater = new ReleasesCalendarUpdater();
    }

    /**
     * Actualiza todos los calendarios secuencialmente
     */
    async updateAllCalendars() {
        try {
            console.log('🚀 ACTUALIZANDO TODOS LOS CALENDARIOS');
            console.log('='.repeat(60));
            console.log('📅 Calendarios a actualizar:');
            console.log('   • Live (shows desde API) - TODOS LOS STATUS');
            console.log('   • Management (datos desde mgm_events) - TODOS LOS STATUS');
            console.log('   • Booking (datos desde booking_events) - TODOS LOS STATUS');
            console.log('   • Records (datos desde API de releases) - TODOS LOS STATUS');
            console.log('');

            // Verificar credenciales
            if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
                console.log('❌ Archivo service-account.json no encontrado');
                console.log('📋 Asegúrate de tener el archivo de credenciales del Service Account');
                return;
            }

            const results = {
                live: false,
                management: false,
                booking: false,
                releases: false
            };

            // 1. Actualizar calendario Live
            console.log('\n🎵 PASO 1: ACTUALIZANDO CALENDARIO "LIVE"');
            console.log('='.repeat(50));
            try {
                await this.liveUpdater.updateCalendar();
                results.live = true;
                console.log('\n✅ Calendario "Live" actualizado exitosamente');
            } catch (error) {
                console.error('\n❌ Error actualizando calendario "Live":', error.message);
                results.live = false;
            }

            // 2. Actualizar calendario Management
            console.log('\n📊 PASO 2: ACTUALIZANDO CALENDARIO "MANAGEMENT"');
            console.log('='.repeat(50));
            try {
                await this.mgmtUpdater.updateCalendar();
                results.management = true;
                console.log('\n✅ Calendario "Management" actualizado exitosamente');
            } catch (error) {
                console.error('\n❌ Error actualizando calendario "Management":', error.message);
                results.management = false;
            }

            // 3. Actualizar calendario Booking
            console.log('\n📅 PASO 3: ACTUALIZANDO CALENDARIO "BOOKING"');
            console.log('='.repeat(50));
            try {
                await this.bookingUpdater.updateCalendar();
                results.booking = true;
                console.log('\n✅ Calendario "Booking" actualizado exitosamente');
            } catch (error) {
                console.error('\n❌ Error actualizando calendario "Booking":', error.message);
                results.booking = false;
            }

            // 4. Actualizar calendario Records
            console.log('\n💿 PASO 4: ACTUALIZANDO CALENDARIO "RECORDS"');
            console.log('='.repeat(50));
            try {
                await this.releasesUpdater.updateCalendar();
                results.releases = true;
                console.log('\n✅ Calendario "Records" actualizado exitosamente');
            } catch (error) {
                console.error('\n❌ Error actualizando calendario "Records":', error.message);
                results.releases = false;
            }

            // 5. Resumen final
            console.log('\n🎉 ACTUALIZACIÓN COMPLETADA');
            console.log('='.repeat(60));
            console.log('📊 Resumen:');
            console.log(`   • Calendario Live: ${results.live ? '✅ Exitoso' : '❌ Falló'}`);
            console.log(`   • Calendario Management: ${results.management ? '✅ Exitoso' : '❌ Falló'}`);
            console.log(`   • Calendario Booking: ${results.booking ? '✅ Exitoso' : '❌ Falló'}`);
            console.log(`   • Calendario Records: ${results.releases ? '✅ Exitoso' : '❌ Falló'}`);
            
            const successCount = (results.live ? 1 : 0) + (results.management ? 1 : 0) + (results.booking ? 1 : 0) + (results.releases ? 1 : 0);
            
            console.log(`\n📈 Resultado: ${successCount}/4 calendarios actualizados exitosamente`);
            
            if (successCount === 4) {
                console.log('🎊 ¡Todos los calendarios actualizados correctamente!');
                console.log('\n🔗 Enlaces a los calendarios:');
                console.log('   • Live: https://calendar.google.com/calendar/u/0/r?cid=c_b1cdbb35e2e538d44729a8d7c06c6ae7349402a3eea9509b4332c5060ddd4d26@group.calendar.google.com');
                console.log('   • Management: https://calendar.google.com/calendar/u/0/r?cid=c_7a6a9470388a244b85562ecb7268a773ca6d005d8bb142088a4d9abcd510e377@group.calendar.google.com');
                console.log('   • Booking: https://calendar.google.com/calendar/u/0/r?cid=c_7fba15b73d470d9bfbf3e8708bf13f219cfe5128b3aec41415ff0bf3a6ca0f7e@group.calendar.google.com');
            } else {
                console.log('⚠️  Algunos calendarios tuvieron errores. Revisa los logs arriba.');
            }

        } catch (error) {
            console.error('❌ Error fatal actualizando calendarios:', error.message);
            throw error;
        }
    }
}

// Función principal
async function main() {
    const updater = new AllCalendarsUpdater();
    
    try {
        await updater.updateAllCalendars();
    } catch (error) {
        console.error('❌ Error fatal:', error.message);
        process.exit(1);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main();
}

module.exports = AllCalendarsUpdater;
