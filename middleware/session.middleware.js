const { getSession } = require('../services/baileys.service');

const sessionMiddleware = (req, res, next) => {
    const sessionId = req.params.sessionId;
    if (!sessionId) {
        return res.status(400).json({ error: 'Session ID wajib diisi pada parameter URL.' });
    }
    const session = getSession(sessionId);
    if (!session || session.status !== 'connected') {
        return res.status(404).json({ error: 'Sesi tidak ditemukan atau belum terhubung.' });
    }
    req.session = session;
    req.sock = session.sock;
    next();
};

module.exports = sessionMiddleware;