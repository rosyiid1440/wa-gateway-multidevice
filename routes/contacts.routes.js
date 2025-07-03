// File: routes/contacts.routes.js
const express = require('express');
const { formatJid } = require('../utils/helpers');
const { Boom } = require('@hapi/boom');
const router = express.Router();

// GET /all - Mendapatkan seluruh daftar kontak yang tersimpan
router.get('/all', (req, res) => {
    const contacts = Array.from(req.session.store.contacts.values());
    res.status(200).json(contacts);
});

// GET / - Mendapatkan info dasar satu kontak
// Contoh: /api/{session}/contacts?number=62812...
router.get('/', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        return res.status(400).json({ error: 'Query parameter "number" wajib diisi.' });
    }
    try {
        const jid = formatJid(number);
        const [result] = await req.sock.onWhatsApp(jid);
        res.status(200).json(result || { exists: false });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /check-exists - Alias untuk /
router.get('/check-exists', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        return res.status(400).json({ error: 'Query parameter "number" wajib diisi.' });
    }
    try {
        const jid = formatJid(number);
        const [result] = await req.sock.onWhatsApp(jid);
        if (result?.exists) {
            res.status(200).json({ exists: true, jid: result.jid });
        } else {
            res.status(404).json({ exists: false, message: 'Nomor tidak terdaftar di WhatsApp.' });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /about - Mendapatkan info "About" dari kontak
// Contoh: /api/{session}/contacts/about?number=62812...
router.get('/about', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        return res.status(400).json({ error: 'Query parameter "number" wajib diisi.' });
    }
    try {
        const jid = formatJid(number);
        const result = await req.sock.fetchStatus(jid);
        res.status(200).json(result);
    } catch (e) {
        if (e instanceof Boom && e.output.statusCode === 404) {
            return res.status(404).json({ error: 'Status "About" tidak ditemukan atau disembunyikan.' });
        }
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /profile-picture - Mendapatkan URL foto profil kontak
// Contoh: /api/{session}/contacts/profile-picture?number=62812...
router.get('/profile-picture', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        return res.status(400).json({ error: 'Query parameter "number" wajib diisi.' });
    }
    try {
        const jid = formatJid(number);
        const url = await req.sock.profilePictureUrl(jid, 'image');
        res.redirect(url);
    } catch (e) {
        if (e instanceof Boom && e.output.statusCode === 404) {
            return res.status(404).json({ error: 'Foto profil tidak ditemukan.' });
        }
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /block - Memblokir kontak
router.post('/block', async (req, res) => {
    const { number } = req.body;
    if (!number) {
        return res.status(400).json({ error: 'Parameter "number" wajib diisi.' });
    }
    try {
        const jid = formatJid(number);
        await req.sock.updateBlockStatus(jid, 'block');
        res.status(200).json({ success: true, message: `Kontak ${number} telah diblokir.` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /unblock - Membuka blokir kontak
router.post('/unblock', async (req, res) => {
    const { number } = req.body;
    if (!number) {
        return res.status(400).json({ error: 'Parameter "number" wajib diisi.' });
    }
    try {
        const jid = formatJid(number);
        await req.sock.updateBlockStatus(jid, 'unblock');
        res.status(200).json({ success: true, message: `Blokir kontak ${number} telah dibuka.` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;