const express = require('express');
const { formatJid } = require('../utils/helpers');
const router = express.Router();

// POST / - Mengatur status presence sesi saat ini
// Ini akan mengubah status Anda menjadi 'online', 'offline', dll.
router.post('/', async (req, res) => {
    const { presence } = req.body; // 'available' (online), 'unavailable' (offline)
    if (!presence || !['available', 'unavailable'].includes(presence)) {
        return res.status(400).json({ error: 'Parameter "presence" wajib diisi dengan nilai "available" atau "unavailable".' });
    }
    try {
        await req.sock.sendPresenceUpdate(presence);
        res.status(200).json({ success: true, message: `Status presence diubah menjadi '${presence}'.` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET / - Mendapatkan semua informasi presence yang sudah di-subscribe
router.get('/', (req, res) => {
    // Mengambil data presence langsung dari store
    const presences = req.session.store.presences || {};
    res.status(200).json(presences);
});

// POST /{chatId}/subscribe - Subscribe ke update presence dari sebuah chat/kontak
router.post('/:chatId/subscribe', async (req, res) => {
    try {
        const jid = formatJid(req.params.chatId);
        await req.sock.presenceSubscribe(jid);
        res.status(200).json({ success: true, message: `Berhasil subscribe ke presence dari ${jid}.` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /{chatId} - Mendapatkan presence terakhir dari sebuah chat/kontak
// Endpoint ini juga akan otomatis subscribe jika belum.
router.get('/:chatId', async (req, res) => {
    try {
        const jid = formatJid(req.params.chatId);
        // Otomatis subscribe terlebih dahulu untuk memastikan kita mendapatkan update
        await req.sock.presenceSubscribe(jid);
        // Ambil data dari store
        const presence = req.session.store.presences[jid] || { not_subscribed: true };
        res.status(200).json(presence);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;