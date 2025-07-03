const express = require('express');
const { generateMessageID } = require('@whiskeysockets/baileys'); // Impor fungsi generator ID
const router = express.Router();

const JID_STATUS_BROADCAST = 'status@broadcast';

// POST /text - Mengirim status berupa teks
router.post('/text', async (req, res) => {
    const { text, options } = req.body;
    if (!text) {
        return res.status(400).json({ error: 'Parameter "text" wajib diisi.' });
    }
    try {
        const result = await req.sock.sendMessage(JID_STATUS_BROADCAST, { text }, options || {});
        res.status(200).json({ success: true, message: 'Status teks berhasil dikirim.', result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /image - Mengirim status berupa gambar
router.post('/image', async (req, res) => {
    const { url, caption } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'Parameter "url" wajib diisi.' });
    }
    try {
        const result = await req.sock.sendMessage(JID_STATUS_BROADCAST, { image: { url }, caption });
        res.status(200).json({ success: true, message: 'Status gambar berhasil dikirim.', result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /video - Mengirim status berupa video
router.post('/video', async (req, res) => {
    const { url, caption } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'Parameter "url" wajib diisi.' });
    }
    try {
        const result = await req.sock.sendMessage(JID_STATUS_BROADCAST, { video: { url }, caption });
        res.status(200).json({ success: true, message: 'Status video berhasil dikirim.', result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /voice - Mengirim status berupa pesan suara
router.post('/voice', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'Parameter "url" wajib diisi.' });
    }
    try {
        // Mengirim audio dengan ptt: true akan membuatnya menjadi pesan suara
        const result = await req.sock.sendMessage(JID_STATUS_BROADCAST, { audio: { url }, ptt: true });
        res.status(200).json({ success: true, message: 'Status suara berhasil dikirim.', result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /delete - Menghapus status yang sudah dikirim
router.post('/delete', async (req, res) => {
    const { key } = req.body;
    if (!key || !key.id) {
        return res.status(400).json({ error: 'Parameter "key" dari status yang akan dihapus wajib diisi.' });
    }
    try {
        // Untuk menghapus status, kita kirimkan key dari status tersebut
        // Pastikan remoteJid di dalam key adalah 'status@broadcast'
        const deleteKey = { ...key, remoteJid: JID_STATUS_BROADCAST };
        const result = await req.sock.sendMessage(JID_STATUS_BROADCAST, { delete: deleteKey });
        res.status(200).json({ success: true, message: 'Status berhasil dihapus.', result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /new-message-id - Membuat message ID baru
router.get('/new-message-id', (req, res) => {
    try {
        const messageId = generateMessageID();
        res.status(200).json({ success: true, messageId });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;