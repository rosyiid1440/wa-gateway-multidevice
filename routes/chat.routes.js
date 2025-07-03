// File: routes/chat.routes.js
const express = require('express');
const { formatJid } = require('../utils/helpers');
const router = express.Router();

/*
 * =================================================================================
 * Bagian Pengiriman Pesan (Messaging)
 * =================================================================================
 */

// Kirim pesan teks (via POST)
router.post('/sendText', async (req, res) => {
    const { number, message, options } = req.body;
    if (!number || !message) return res.status(400).json({ error: 'Parameter "number" dan "message" wajib diisi.' });

    try {
        const jid = formatJid(number);
        const result = await req.sock.sendMessage(jid, { text: message }, options || {});
        res.status(200).json({ success: true, result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Kirim pesan teks (via GET, untuk kemudahan integrasi)
router.get('/sendText', async (req, res) => {
    const { number, message } = req.query;
    if (!number || !message) return res.status(400).json({ error: 'Query parameter "number" dan "message" wajib diisi.' });

    try {
        const jid = formatJid(number);
        const result = await req.sock.sendMessage(jid, { text: message });
        res.status(200).json({ success: true, result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Kirim media (Gambar, Video, Audio, Dokumen)
router.post('/sendMedia', async (req, res) => {
    const { number, type, url, caption } = req.body; // type: image, video, audio, document
    if (!number || !type || !url) return res.status(400).json({ error: 'Parameter "number", "type", dan "url" wajib diisi.' });
    
    try {
        const jid = formatJid(number);
        let message;
        switch(type) {
            case 'image':
                message = { image: { url }, caption };
                break;
            case 'video':
                message = { video: { url }, caption };
                break;
            case 'audio': // Untuk voice note, tambahkan ptt: true
                message = { audio: { url }, mimetype: 'audio/mp4' };
                break;
            case 'voice': // Endpoint khusus untuk Voice Note
                message = { audio: { url }, mimetype: 'audio/mp4', ptt: true };
                break;
            case 'document':
            case 'file':
                message = { document: { url }, fileName: caption || 'Document' };
                break;
            default:
                return res.status(400).json({ error: 'Tipe media tidak valid. Gunakan: image, video, audio, voice, file.' });
        }
        const result = await req.sock.sendMessage(jid, message);
        res.status(200).json({ success: true, result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Kirim tombol interaktif (contoh sederhana)
router.post('/sendButtons', async (req, res) => {
    const { number, text, buttons, footer } = req.body;
    if (!number || !text || !buttons) return res.status(400).json({ error: 'Parameter "number", "text", dan "buttons" wajib diisi.' });
    
    try {
        const jid = formatJid(number);
        const buttonMessage = {
            text,
            footer,
            buttons: buttons, // buttons: [{ buttonId: 'id1', buttonText: { displayText: 'Button 1' }, type: 1 }]
            headerType: 1
        };
        const result = await req.sock.sendMessage(jid, buttonMessage);
        res.status(200).json({ success: true, result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Kirim lokasi
router.post('/sendLocation', async (req, res) => {
    const { number, latitude, longitude } = req.body;
    if (!number || !latitude || !longitude) return res.status(400).json({ error: 'Parameter "number", "latitude", dan "longitude" wajib diisi.' });
    
    try {
        const jid = formatJid(number);
        const result = await req.sock.sendMessage(jid, { location: { degreesLatitude: latitude, degreesLongitude: longitude } });
        res.status(200).json({ success: true, result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Kirim kontak (vCard)
router.post('/sendContactVcard', async (req, res) => {
    const { number, fullName, orgName, phoneNumber } = req.body;
    if (!number || !fullName || !phoneNumber) return res.status(400).json({ error: 'Parameter "number", "fullName", dan "phoneNumber" wajib diisi.' });
    
    try {
        const jid = formatJid(number);
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${fullName}\nORG:${orgName || ''}\nTEL;type=CELL;type=VOICE;waid=${phoneNumber}:${phoneNumber}\nEND:VCARD`;
        const result = await req.sock.sendMessage(jid, {
            contacts: {
                displayName: fullName,
                contacts: [{ vcard }]
            }
        });
        res.status(200).json({ success: true, result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});


/*
 * =================================================================================
 * Bagian Interaksi Chat (Chat Interaction)
 * =================================================================================
 */

// Menandai pesan sudah dilihat (centang biru)
router.post('/sendSeen', async (req, res) => {
    const { key } = req.body; // key: { remoteJid, id, fromMe }
    if (!key) return res.status(400).json({ error: 'Parameter "key" dari pesan wajib diisi.' });

    try {
        await req.sock.readMessages([key]);
        res.status(200).json({ success: true, message: 'Pesan ditandai sudah dilihat.' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Set status 'sedang mengetik'
router.post('/startTyping', async (req, res) => {
    const { number } = req.body;
    if (!number) return res.status(400).json({ error: 'Parameter "number" wajib diisi.' });
    
    try {
        const jid = formatJid(number);
        await req.sock.sendPresenceUpdate('composing', jid);
        res.status(200).json({ success: true, message: `Status 'mengetik' dikirim ke ${number}.` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Set status berhenti mengetik
router.post('/stopTyping', async (req, res) => {
    const { number } = req.body;
    if (!number) return res.status(400).json({ error: 'Parameter "number" wajib diisi.' });
    
    try {
        const jid = formatJid(number);
        await req.sock.sendPresenceUpdate('paused', jid);
        res.status(200).json({ success: true, message: `Status 'berhenti mengetik' dikirim ke ${number}.` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Memberi reaksi pada pesan
router.put('/reaction', async (req, res) => {
    const { key, reaction } = req.body; // key dari pesan, reaction: '👍' atau string emoji lain, atau "" untuk hapus
    if (!key) return res.status(400).json({ error: 'Parameter "key" dari pesan wajib diisi.' });
    
    try {
        const reactionMessage = {
            react: {
                text: reaction || "", // string kosong untuk menghapus reaksi
                key: key
            }
        };
        const result = await req.sock.sendMessage(key.remoteJid, reactionMessage);
        res.status(200).json({ success: true, result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;