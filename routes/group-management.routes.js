const express = require('express');
const { formatJid, formatJidToSimple, parseJid } = require('../utils/helpers');
const { Boom } = require('@hapi/boom');
const router = express.Router();

// GET / - Get all groups
router.get('/', async (req, res) => {
    try {
        const groups = await req.sock.groupFetchAllParticipating();
        res.status(200).json(groups);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST / - Create a new group
router.post('/', async (req, res) => {
    const { subject, participants } = req.body;
    if (!subject || !participants || !Array.isArray(participants)) {
        return res.status(400).json({ error: 'Parameter "subject" (string) dan "participants" (array) wajib diisi.' });
    }
    try {
        const formattedJids = participants.map(p => formatJid(p));
        const group = await req.sock.groupCreate(subject, formattedJids);
        res.status(201).json({ success: true, group });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /{id} - Get group metadata
router.get('/:id', async (req, res) => {
    try {
        const jid = formatJid(req.params.id);
        const metadata = await req.sock.groupMetadata(jid);
        res.status(200).json(metadata);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /{id}/leave - Leave the group
router.post('/:id/leave', async (req, res) => {
    try {
        const jid = formatJid(req.params.id);
        await req.sock.groupLeave(jid);
        res.status(200).json({ success: true, message: `Berhasil keluar dari grup ${jid}` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// PUT /{id}/subject - Update group subject
router.put('/:id/subject', async (req, res) => {
    const { subject } = req.body;
    if (!subject) {
        return res.status(400).json({ error: 'Parameter "subject" wajib diisi.' });
    }
    try {
        const jid = formatJid(req.params.id);
        await req.sock.groupUpdateSubject(jid, subject);
        res.status(200).json({ success: true, message: `Subjek grup berhasil diubah menjadi "${subject}"` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// PUT /{id}/description - Update group description
router.put('/:id/description', async (req, res) => {
    const { description } = req.body;
    if (typeof description !== 'string') {
        return res.status(400).json({ error: 'Parameter "description" (string) wajib diisi.' });
    }
    try {
        const jid = formatJid(req.params.id);
        await req.sock.groupUpdateDescription(jid, description);
        res.status(200).json({ success: true, message: 'Deskripsi grup berhasil diperbarui.' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /{id}/participants/add - Add participants
router.post('/:id/participants/add', async (req, res) => {
    const { participants } = req.body;
    if (!participants || !Array.isArray(participants)) {
        return res.status(400).json({ error: 'Parameter "participants" (array) wajib diisi.' });
    }
    try {
        const jid = formatJid(req.params.id);
        const formattedJids = participants.map(p => formatJid(p));
        const result = await req.sock.groupParticipantsUpdate(jid, formattedJids, 'add');
        res.status(200).json({ success: true, result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /{id}/participants/remove - Remove participants
router.post('/:id/participants/remove', async (req, res) => {
    const { participants } = req.body;
    if (!participants || !Array.isArray(participants)) {
        return res.status(400).json({ error: 'Parameter "participants" (array) wajib diisi.' });
    }
    try {
        const jid = formatJid(req.params.id);
        const formattedJids = participants.map(p => formatJid(p));
        const result = await req.sock.groupParticipantsUpdate(jid, formattedJids, 'remove');
        res.status(200).json({ success: true, result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /{id}/admin/promote - Promote participants to admin
router.post('/:id/admin/promote', async (req, res) => {
    const { participants } = req.body;
    if (!participants || !Array.isArray(participants)) {
        return res.status(400).json({ error: 'Parameter "participants" (array) wajib diisi.' });
    }
    try {
        const jid = formatJid(req.params.id);
        const formattedJids = participants.map(p => formatJid(p));
        const result = await req.sock.groupParticipantsUpdate(jid, formattedJids, 'promote');
        res.status(200).json({ success: true, result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /{id}/admin/demote - Demote participants to regular users
router.post('/:id/admin/demote', async (req, res) => {
    const { participants } = req.body;
    if (!participants || !Array.isArray(participants)) {
        return res.status(400).json({ error: 'Parameter "participants" (array) wajib diisi.' });
    }
    try {
        const jid = formatJid(req.params.id);
        const formattedJids = participants.map(p => formatJid(p));
        const result = await req.sock.groupParticipantsUpdate(jid, formattedJids, 'demote');
        res.status(200).json({ success: true, result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /{id}/invite-code - Gets the invite code for the group
router.get('/:id/invite-code', async (req, res) => {
    try {
        const jid = formatJid(req.params.id);
        const code = await req.sock.groupInviteCode(jid);
        res.status(200).json({ success: true, code });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /{id}/invite-code/revoke - Revokes the current group invite code
router.post('/:id/invite-code/revoke', async (req, res) => {
    try {
        const jid = formatJid(req.params.id);
        const code = await req.sock.groupRevokeInvite(jid);
        res.status(200).json({ success: true, message: 'Kode undangan berhasil dicabut.', new_code: code });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /join - Join group via code
router.post('/join', async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: 'Parameter "code" undangan wajib diisi.' });
    }
    try {
        const result = await req.sock.groupAcceptInvite(code);
        res.status(200).json({ success: true, message: `Berhasil bergabung ke grup dengan ID: ${result}` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});


module.exports = router;