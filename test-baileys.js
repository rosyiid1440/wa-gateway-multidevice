const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const path = require('path');
const qrcode = require('qrcode-terminal'); // <-- TAMBAHKAN IMPORT INI

async function connectToWhatsApp() {
    console.log('Memulai koneksi WhatsApp...');
    const authFolder = path.join(__dirname, 'baileys_auth_info');
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();
    
    console.log(`Menggunakan Baileys versi: ${version.join('.')}`);
    
    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop'),
        // Opsi 'printQRInTerminal' dihapus karena sudah usang
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        // --- LOGIKA BARU UNTUK MENAMPILKAN QR ---
        if (qr) {
            console.log('Silakan pindai QR Code di bawah ini:');
            // Gunakan qrcode-terminal untuk 'menggambar' QR di konsol
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.error(`Koneksi ditutup: ${DisconnectReason[statusCode] || 'Unknown'} (Code: ${statusCode})`);
            if (shouldReconnect) {
                console.log('Mencoba menyambungkan kembali...');
                connectToWhatsApp();
            } else {
                console.log('Koneksi ditutup permanen (Logged Out).');
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Terhubung:', sock.user.id);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

connectToWhatsApp();