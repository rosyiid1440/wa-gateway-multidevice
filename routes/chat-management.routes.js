// File: routes/chat-management.routes.js
const express = require('express');
const { formatJid } = require('../utils/helpers');
const { Boom } = require('@hapi/boom');
const router = express.Router();

// GET /chats - Mendapatkan daftar semua chat dari store
// Setelah diperbaiki
router.get('/', (req, res) => {
    // Memastikan kita membaca dari Map dengan cara yang benar
    const chats = Array.from(req.session.store.chats.values());
    res.status(200).json(chats);
});

// DELETE /chats/{chatId} - Menghapus chat (menghapus dari daftar, tidak menghapus pesan)
router.delete('/:chatId', async (req, res) => {
    try {
        const jid = formatJid(req.params.chatId);
        await req.sock.chatModify({ delete: true }, jid);
        res.status(200).json({ success: true, message: `Chat ${jid} telah dihapus.` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /chats/{chatId}/picture - Mendapatkan foto profil chat/grup
router.get('/:chatId/picture', async (req, res) => {
    try {
        const jid = formatJid(req.params.chatId);
        const url = await req.sock.profilePictureUrl(jid, 'image');
        res.redirect(url);
    } catch (e) {
        if (e instanceof Boom && e.output.statusCode === 404) {
            return res.status(404).json({ error: 'Foto profil tidak ditemukan.' });
        }
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /chats/{chatId}/messages - Mendapatkan pesan dari chat (dari store, terbatas)
router.get('/:chatId/messages', (req, res) => {
    const jid = formatJid(req.params.chatId);
    const messages = req.session.store.messages[jid];
    // Catatan: Ini hanya akan mengembalikan pesan yang ada di memori store, bukan seluruh riwayat.
    res.status(200).json(messages ? Array.from(messages.values()) : []);
});

// DELETE /chats/{chatId}/messages - Membersihkan semua pesan dari chat
router.delete('/:chatId/messages', async (req, res) => {
    try {
        const jid = formatJid(req.params.chatId);
        // 'all' untuk menghapus semua pesan
        await req.sock.chatModify({ clear: 'all' }, jid);
        res.status(200).json({ success: true, message: `Semua pesan di chat ${jid} telah dibersihkan.` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /chats/{chatId}/messages/read - Menandai semua pesan di chat sebagai sudah dibaca
router.post('/:chatId/messages/read', async (req, res) => {
    try {
        const jid = formatJid(req.params.chatId);
        // Mengirim 'read receipt' untuk seluruh chat
        await req.sock.sendReceipt(jid, undefined, [], 'read');
        res.status(200).json({ success: true, message: `Chat ${jid} ditandai sudah dibaca.` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// DELETE /chats/{chatId}/messages/{messageId} - Menghapus satu pesan spesifik
router.delete('/:chatId/messages/:messageId', async (req, res) => {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Objek "key" dari pesan wajib disertakan di body.' });
    
    try {
        const jid = formatJid(req.params.chatId);
        await req.sock.sendMessage(jid, { delete: key });
        res.status(200).json({ success: true, message: `Pesan ${key.id} telah dihapus.` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// PUT /chats/{chatId}/messages/{messageId} - Mengedit pesan
router.put('/:chatId/messages/:messageId', async (req, res) => {
    const { key, newText } = req.body;
    if (!key || !newText) return res.status(400).json({ error: 'Objek "key" dan "newText" wajib disertakan di body.' });

    try {
        const jid = formatJid(req.params.chatId);
        await req.sock.sendMessage(jid, { edit: key, text: newText });
        res.status(200).json({ success: true, message: `Pesan ${key.id} telah diedit.` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /chats/{chatId}/archive - Mengarsipkan chat
router.post('/:chatId/archive', async (req, res) => {
    try {
        const jid = formatJid(req.params.chatId);
        await req.sock.chatModify({ archive: true }, jid);
        res.status(200).json({ success: true, message: `Chat ${jid} telah diarsipkan.` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /chats/{chatId}/unarchive - Mengeluarkan chat dari arsip
router.post('/:chatId/unarchive', async (req, res) => {
    try {
        const jid = formatJid(req.params.chatId);
        await req.sock.chatModify({ archive: false }, jid);
        res.status(200).json({ success: true, message: `Chat ${jid} telah dikeluarkan dari arsip.` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /chats/{chatId}/unread - Menandai chat sebagai belum dibaca
router.post('/:chatId/unread', async (req, res) => {
    try {
        const jid = formatJid(req.params.chatId);
        await req.sock.chatModify({ markRead: false }, jid);
        res.status(200).json({ success: true, message: `Chat ${jid} ditandai belum dibaca.` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

/*
 * =================================================================================
 * Catatan Penting: Pin/Unpin Pesan vs. Pin/Unpin Chat
 * =================================================================================
 * Fitur untuk pin/unpin PESAN spesifik adalah fitur baru dan tidak didukung secara
 * stabil di Baileys v6.6.0. Sebagai gantinya, kita akan mengimplementasikan fitur
 * untuk pin/unpin CHAT, yang didukung penuh.
 */

// POST /chats/{chatId}/pin - Menyematkan (pin) chat ke atas
router.post('/:chatId/pin', async (req, res) => {
    try {
        const jid = formatJid(req.params.chatId);
        // Menyematkan chat dengan memberikan timestamp saat ini
        await req.sock.chatModify({ pin: true }, jid);
        res.status(200).json({ success: true, message: `Chat ${jid} telah disematkan.` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /chats/{chatId}/unpin - Melepas sematan (unpin) chat
router.post('/:chatId/unpin', async (req, res) => {
    try {
        const jid = formatJid(req.params.chatId);
        await req.sock.chatModify({ pin: false }, jid);
        res.status(200).json({ success: true, message: `Sematan chat ${jid} telah dilepas.` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});


module.exports = router;