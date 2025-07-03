const express = require('express');
const qrcode = require('qrcode');
const { startSession, getSession, deleteSession } = require('../services/baileys.service');
const { sessions } = require('../services/baileys.service'); // Anda perlu mengekspor 'sessions' dari service

const router = express.Router();

router.get('/', (req, res) => {
    const sessionList = Array.from(sessions.values()).map(s => ({
        id: s.id,
        status: s.status,
        user: s.sock?.user
    }));
    res.status(200).json(sessionList);
});

router.post('/start', async (req, res) => {
    // Ambil phoneNumber dari body request
    const { sessionId, phoneNumber, webhookUrl } = req.body; 
    
    if (!sessionId) return res.status(400).json({ error: 'Parameter "sessionId" wajib diisi.' });
    if (getSession(sessionId)) return res.status(200).json({ success: true, message: 'Sesi sudah ada.', status: getSession(sessionId).status });
    
    // Teruskan phoneNumber ke fungsi startSession
    await startSession(sessionId, phoneNumber, webhookUrl);
    
    res.status(201).json({ success: true, message: 'Sesi sedang dimulai...' });
});

router.get('/:sessionId/status', (req, res) => {
    const session = getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
    res.status(200).json({
        id: session.id,
        status: session.status,
        webhookUrl: session.webhookUrl,
        user: session.status === 'connected' ? session.sock.user : null
    });
});

router.get('/:sessionId/qr', async (req, res) => {
    const session = getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
    if (session.status === 'connected') return res.status(200).json({ message: 'Sesi sudah terhubung.' });
    if (!session.qr) return res.status(404).json({ error: 'QR code belum tersedia, coba lagi.' });
    
    qrcode.toBuffer(session.qr, (err, buffer) => {
        if (err) return res.status(500).json({ error: 'Gagal membuat QR code.' });
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(buffer);
    });
});

router.delete('/:sessionId/logout', async (req, res) => {
    const { sessionId } = req.params;
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
    
    try {
        await session.sock.logout();
    } catch (e) {
        console.error("Gagal logout:", e.message);
    } finally {
        deleteSession(sessionId);
        res.status(200).json({ success: true, message: 'Logout berhasil dan sesi dihapus.' });
    }
});

router.post('/:sessionId/webhook', (req, res) => {
    const { sessionId } = req.params;
    const { webhookUrl } = req.body;
    const session = getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });

    session.webhookUrl = webhookUrl || null;
    res.status(200).json({ success: true, message: `Webhook untuk sesi ${sessionId} telah diatur ke: ${session.webhookUrl}` });
});

module.exports = router;