const express = require('express');
const { Boom } = require('@hapi/boom'); // <-- Tambahkan Boom ke import
const router = express.Router();

// GET / - Mendapatkan info profil sesi saat ini
router.get('/', (req, res) => {
    // Objek 'user' sudah tersedia dari koneksi socket yang aktif
    const profile = req.sock.user;
    if (profile) {
        res.status(200).json({
            id: profile.id,
            name: profile.name,
        });
    } else {
        res.status(404).json({ error: 'Informasi profil tidak tersedia.' });
    }
});

// PUT /name - Mengatur nama profil (display name)
router.put('/name', async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Parameter "name" wajib diisi.' });
    }
    try {
        await req.sock.updateProfileName(name);
        res.status(200).json({ success: true, message: `Nama profil berhasil diubah menjadi "${name}".` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.get('/picture', async (req, res) => {
    try {
        const jid = req.sock.user.id;
        const url = await req.sock.profilePictureUrl(jid, 'image');
        // Langsung arahkan ke URL gambar
        res.redirect(url);
    } catch (e) {
        // Tangani jika foto profil tidak ada
        if (e instanceof Boom && e.output.statusCode === 404) {
            return res.status(404).json({ error: 'Foto profil tidak ditemukan.' });
        }
        res.status(500).json({ success: false, error: e.message });
    }
});

// PUT /status - Mengatur status profil (Info / About)
router.put('/status', async (req, res) => {
    const { status } = req.body;
    // Status bisa berupa string kosong, jadi kita cek tipenya
    if (typeof status !== 'string') {
        return res.status(400).json({ error: 'Parameter "status" (string) wajib diisi.' });
    }
    try {
        await req.sock.updateProfileStatus(status);
        res.status(200).json({ success: true, message: 'Status profil berhasil diperbarui.' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// PUT /picture - Mengatur foto profil dari URL
router.put('/picture', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'Parameter "url" (URL gambar) wajib diisi.' });
    }
    try {
        const jid = req.sock.user.id;
        await req.sock.updateProfilePicture(jid, { url });
        res.status(200).json({ success: true, message: 'Foto profil berhasil diperbarui.' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// DELETE /picture - Menghapus foto profil
router.delete('/picture', async (req, res) => {
    try {
        const jid = req.sock.user.id;
        await req.sock.removeProfilePicture(jid);
        res.status(200).json({ success: true, message: 'Foto profil berhasil dihapus.' });
    } catch (e) {
        // Baileys terkadang melempar error jika tidak ada foto untuk dihapus
        if (e.message?.includes('not-exist')) {
             return res.status(404).json({ success: false, error: 'Tidak ada foto profil untuk dihapus.' });
        }
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;