const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers,
    getContentType,
    downloadContentFromMessage // <-- Impor fungsi download
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { broadcast } = require('../sockets/handler');

const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');
// --- LOKASI BARU UNTUK MENYIMPAN HISTORY CHAT ---
const HISTORY_DIR = path.join(__dirname, '..', 'chat_history');
// --- LOKASI BARU UNTUK MENYIMPAN MEDIA ---
const MEDIA_DIR = path.join(__dirname, '..', 'media_downloads');
const RECONNECT_DELAY = 5000;

const sessions = new Map();

// --- FUNGSI BARU UNTUK MENGUNDUH DAN MENYIMPAN MEDIA ---
const downloadAndSaveMedia = async (sessionId, message) => {
    const messageContent = message.message;
    if (!messageContent) return;

    const contentType = getContentType(messageContent);
    const mediaType = contentType.replace('Message', '');
    
    if (['image', 'video', 'audio', 'document', 'sticker'].includes(mediaType)) {
        try {
            const stream = await downloadContentFromMessage(messageContent[contentType], mediaType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            
            const sessionMediaDir = path.join(MEDIA_DIR, sessionId);
            const chatJid = message.key.remoteJid;
            const chatMediaDir = path.join(sessionMediaDir, chatJid);
            const extension = messageContent[contentType].mimetype.split('/')[1]?.split(';')[0] || 'bin';
            const fileName = `${message.key.id}.${extension}`;
            const filePath = path.join(chatMediaDir, fileName);

            if (!fs.existsSync(chatMediaDir)) {
                fs.mkdirSync(chatMediaDir, { recursive: true });
            }

            fs.writeFileSync(filePath, buffer);
            console.log(`[${sessionId}] Media dari ${chatJid} berhasil disimpan di: ${filePath}`);

            // =======================================================
            // KIRIM WEBHOOK BARU SETELAH FILE TERSIMPAN
            // =======================================================
            sendWebhook({
                event: 'media.saved',
                sessionId: sessionId,
                data: {
                    path: filePath, // Kirim path absolut dari file
                    jid: chatJid,
                    messageId: message.key.id
                }
            });

        } catch (e) {
            console.error(`[${sessionId}] Gagal mengunduh media dari ${message.key.remoteJid}:`, e);
        }
    }
};

// --- FUNGSI BARU UNTUK MENYEDERHANAKAN OBJEK PESAN ---
// Objek pesan asli dari Baileys terlalu kompleks untuk disimpan langsung ke JSON.
const simplifyMessage = (msg) => {
    const messageContent = msg.message;
    if (!messageContent) return null;

    const contentType = getContentType(messageContent);
    let textContent = '';

    if (contentType === 'conversation') {
        textContent = messageContent.conversation;
    } else if (contentType === 'extendedTextMessage') {
        textContent = messageContent.extendedTextMessage.text;
    } else if (contentType === 'imageMessage') {
        textContent = msg.message.imageMessage.caption || '[Image]';
    } else if (contentType === 'videoMessage') {
        textContent = msg.message.videoMessage.caption || '[Video]';
    } else {
        // Tipe lain bisa ditambahkan di sini
        textContent = `[${contentType}]`;
    }

    return {
        id: msg.key.id,
        fromMe: msg.key.fromMe,
        jid: msg.key.remoteJid,
        participant: msg.key.participant,
        pushName: msg.pushName,
        timestamp: msg.messageTimestamp,
        text: textContent,
    };
};

// --- FUNGSI BARU UNTUK MENYIMPAN PESAN ---
const saveMessageToHistory = (sessionId, message) => {
    const simplifiedMsg = simplifyMessage(message);
    if (!simplifiedMsg) return;

    const sessionHistoryDir = path.join(HISTORY_DIR, sessionId);
    const chatJid = simplifiedMsg.jid;
    const chatHistoryFile = path.join(sessionHistoryDir, `${chatJid}.json`);

    try {
        // Pastikan direktori sesi ada
        if (!fs.existsSync(sessionHistoryDir)) {
            fs.mkdirSync(sessionHistoryDir, { recursive: true });
        }

        let history = [];
        // Baca file history yang sudah ada jika ada
        if (fs.existsSync(chatHistoryFile)) {
            history = JSON.parse(fs.readFileSync(chatHistoryFile, 'utf-8'));
        }

        // Tambahkan pesan baru
        history.push(simplifiedMsg);

        // Tulis kembali ke file
        fs.writeFileSync(chatHistoryFile, JSON.stringify(history, null, 2));
    } catch (e) {
        console.error(`Gagal menyimpan history untuk chat ${chatJid} di sesi ${sessionId}:`, e);
    }
};


const sendWebhook = async (payload) => {
    broadcast(payload);
    const session = sessions.get(payload.sessionId);
    if (!session || !session.webhookUrl) return;
    try {
        await axios.get(session.webhookUrl, payload, { headers: { 'Content-Type': 'application/json' }});
    } catch (error) {
        console.error(`Gagal mengirim webhook HTTP untuk sesi ${payload.sessionId}:`, error.message);
    }
};

const startSession = async (sessionId, phoneNumber = null, webhookUrl = null) => {
    const existingSession = sessions.get(sessionId);
    if (existingSession && existingSession.status !== 'close') {
        return existingSession;
    }

    console.log(`Memulai sesi '${sessionId}'...`);

    const sessionAuthDir = path.join(SESSIONS_DIR, sessionId);
    if (!fs.existsSync(sessionAuthDir)) {
        fs.mkdirSync(sessionAuthDir, { recursive: true });
    }

    // --- Menyimpan Webhook saat Sesi Dimulai ---
    if (webhookUrl) {
        const webhookFilePath = path.join(sessionAuthDir, 'webhook.json');
        fs.writeFileSync(webhookFilePath, JSON.stringify({ url: webhookUrl }));
    }
    
    // =======================================================
    // MEMBUAT STORE MANUAL UNTUK SETIAP SESI
    // =======================================================
    const store = {
        chats: new Map(),
        contacts: new Map(),
        messages: {}, // key: jid, value: Map<messageId, WAMessage>
    };

    const { state, saveCreds } = await useMultiFileAuthState(sessionAuthDir);
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: Browsers.macOS('Desktop'),
        shouldIgnoreJid: (jid) => !jid || jid.includes('@broadcast'),
    });

    const sessionData = { 
        id: sessionId,
        sock,
        webhookUrl,
        store, // <-- MENAMBAHKAN STORE KE DATA SESI
        status: 'connecting',
    };
    sessions.set(sessionId, sessionData);
    
    // Pairing code logic... (jika ingin diaktifkan kembali nanti)

    // =======================================================
    // MENGHUBUNGKAN EVENT SOCKET KE STORE MANUAL KITA
    // =======================================================
    sock.ev.on('chats.set', (update) => {
        console.log(`[${sessionId}] Menerima event 'chats.set', memuat ${update.chats.length} chat awal...`);
        const newChats = new Map(update.chats.map(c => [c.id, c]));
        store.chats = newChats; // Langsung ganti dengan data lengkap yang baru
    });

    sock.ev.on('contacts.set', (update) => {
        console.log(`[${sessionId}] Menerima event 'contacts.set', memuat ${update.contacts.length} kontak...`);
        for (const contact of update.contacts) {
            store.contacts.set(contact.id, contact);
        }
    });

    // Event listener utama
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        sessionData.status = connection;

        // --- PERBAIKAN DI SINI ---
        // Simpan QR ke dalam data sesi jika ada
        if (qr) {
            sessionData.qr = qr;
            // Kita juga kirim event QR via webhook dari sini agar terpusat
            sendWebhook({ event: 'qr', sessionId, data: qr });
        }
        // -------------------------

        if (connection === 'close') {
            const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            sendWebhook({ event: 'connection-update', sessionId, data: { connection: 'close', reason: DisconnectReason[statusCode] || 'Unknown' } });
            
            if (shouldReconnect) {
                console.log(`Koneksi '${sessionId}' ditutup, reconnect dalam ${RECONNECT_DELAY / 1000} detik...`);
                setTimeout(() => startSession(sessionId, phoneNumber, webhookUrl), RECONNECT_DELAY);
            } else {
                console.log(`Sesi '${sessionId}' logout, menghapus data.`);
                deleteSession(sessionId);
            }
        }

        if (connection === 'open') {
            sessionData.status = 'connected'; // <-- TAMBAHKAN BARIS INI
            console.log(`✅ WhatsApp Terhubung untuk sesi '${sessionId}':`, sock.user.id);
            sendWebhook({ event: 'connection-update', sessionId, data: { connection: 'open', jid: sock.user.id } });
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Setelah diperbaiki
    sock.ev.on('messages.upsert', (m) => {
        if (m.type === 'notify') {
            sendWebhook({ event: 'message.any', sessionId, data: m });

            if (!m.messages[0].key.fromMe) {
                sendWebhook({ event: 'message', sessionId, data: m });
            }

            for (const msg of m.messages) {
                saveMessageToHistory(sessionId, msg);
                downloadAndSaveMedia(sessionId, msg);

                // JID kontak (bisa grup atau perorangan)
                const jid = msg.key.remoteJid;
                
                // Logika untuk menambahkan chat baru (tetap ada)
                if (jid && !store.chats.has(jid)) {
                    const newChat = { id: jid, name: msg.pushName || jid };
                    store.chats.set(jid, newChat);
                    console.log(`[${sessionId}] Chat baru ditambahkan dari pesan masuk: ${jid}`);
                }

                // --- LOGIKA BARU UNTUK MENAMBAHKAN KONTAK ---
                const contactJid = msg.key.fromMe ? sock.user.id : (msg.key.participant || msg.key.remoteJid);
                if (contactJid && !store.contacts.has(contactJid)) {
                    store.contacts.set(contactJid, { id: contactJid, name: msg.pushName || contactJid });
                    console.log(`[${sessionId}] Kontak baru ditambahkan dari pesan masuk: ${contactJid}`);
                }
                // ------------------------------------------
            }
        }
        // sendWebhook({ event: 'messages.upsert', sessionId, data: m });
    });

    // 3. Event Update Pesan (ACK, Revoke, dll)
    sock.ev.on('messages.update', (updates) => {
        for(const update of updates) {
            // Event untuk ACK (delivered, read, played)
            if (update.update?.status) {
                sendWebhook({ event: 'message.ack', sessionId, data: update });
            }
            // Event untuk pesan yang dihapus (revoke)
            if (update.message?.protocolMessage?.type === 'REVOKE') {
                sendWebhook({ event: 'message.revoked', sessionId, data: { revoked_key: update.key } });
            }
        }
    });

    // 4. Event Reaksi Pesan
    sock.ev.on('messages.reaction', (reactions) => {
        sendWebhook({ event: 'message.reaction', sessionId, data: reactions[0] });
    });

    // 5. Event Grup (Lengkap)
    sock.ev.on('groups.update', (updates) => {
        sendWebhook({ event: 'group.v2.update', sessionId, data: updates[0] });
    });

    sock.ev.on('group-participants.update', (update) => {
        sendWebhook({ event: 'group.v2.participants', sessionId, data: update });
        const myJid = sock.user.id;
        // Cek jika saya yang join atau leave
        if (update.action === 'add' && update.participants.includes(myJid)) {
            sendWebhook({ event: 'group.v2.join', sessionId, data: update });
        } else if (update.action === 'remove' && update.participants.includes(myJid)) {
            sendWebhook({ event: 'group.v2.leave', sessionId, data: update });
        }
    });

    // 6. Event Presence (Online/Offline/Typing)
    sock.ev.on('presence.update', (update) => {
        sendWebhook({ event: 'presence.update', sessionId, data: update });
    });

    // CATATAN: Fitur Call, Label, dan Poll memerlukan penanganan khusus dan
    // mungkin tidak sepenuhnya didukung di akun biasa atau versi Baileys ini.
    // Listener di bawah ini adalah dasar, mungkin perlu penyesuaian lebih lanjut.

    // 7. Event Panggilan (Call)
    sock.ev.on('call', (calls) => {
        const call = calls[0];
        if (call.isNew) {
            sendWebhook({ event: 'call.received', sessionId, data: call });
        }
        // Anda bisa menambahkan logika untuk 'call.accepted' atau 'call.rejected'
        // dengan memeriksa status call yang ada.
    });
    
    sock.ev.on('creds.update', saveCreds);

    return sessionData;
};

const getSession = (sessionId) => sessions.get(sessionId);

const deleteSession = (sessionId) => {
    const sessionAuthDir = path.join(SESSIONS_DIR, sessionId);
    const webhookFilePath = path.join(sessionAuthDir, 'webhook.json');
    if (fs.existsSync(webhookFilePath)) {
        fs.unlinkSync(webhookFilePath);
    }
    sessions.delete(sessionId);
    if (fs.existsSync(sessionAuthDir)) {
        fs.rmSync(sessionAuthDir, { recursive: true, force: true });
    }
    sendWebhook({ event: 'status', sessionId, message: 'deleted' });
};

module.exports = {
    startSession,
    getSession,
    deleteSession,
    sessions,
    SESSIONS_DIR
};