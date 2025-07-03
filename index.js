const express = require('express');
const http = require('http'); // <-- TAMBAHKAN INI
const path = require('path'); // <-- Tambahkan ini
const fs = require('fs');   // <-- Tambahkan ini
const { initWebSocket } = require('./sockets/handler'); // <-- TAMBAHKAN INI
const { startSession } = require('./services/baileys.service'); // <-- Tambahkan ini
const sessionMiddleware = require('./middleware/session.middleware');

// Import semua rute
const sessionRoutes = require('./routes/session.routes');
const chatRoutes = require('./routes/chat.routes');
// const groupRoutes = require('./routes/group.routes');
const userRoutes = require('./routes/user.routes');
const statusRoutes = require('./routes/status.routes'); // <-- TAMBAHKAN INI
const chatManagementRoutes = require('./routes/chat-management.routes'); // <-- TAMBAHKAN INI
const contactRoutes = require('./routes/contacts.routes'); // <-- TAMBAHKAN INI
const groupRoutes = require('./routes/group-management.routes');
const presenceRoutes = require('./routes/presence.routes');

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app); // <-- BUAT SERVER HTTP

// Inisialisasi WebSocket
initWebSocket(server);

// Middleware
app.use(express.json());
app.use(express.static('public')); // <-- SAJIKAN FILE DARI FOLDER public

// Sajikan file docs.html di rute /api/docs
app.get('/api/docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

// Gunakan rute untuk manajemen sesi (tanpa middleware sesi)
app.use('/api/sessions', sessionRoutes);

function restartExistingSessions() {
    const sessionsDir = path.join(__dirname, 'sessions');
    console.log('🔄 Memeriksa sesi yang ada untuk di-restart...');
    
    if (fs.existsSync(sessionsDir)) {
        const sessionFolders = fs.readdirSync(sessionsDir);
        for (const sessionFolder of sessionFolders) {
            const sessionPath = path.join(sessionsDir, sessionFolder);
            if (fs.statSync(sessionPath).isDirectory()) {
                console.log(`Mencoba me-restart sesi: ${sessionFolder}`);
                // Panggil startSession untuk setiap folder sesi yang ditemukan
                startSession(sessionFolder); 
            }
        }
    } else {
        console.log('Tidak ada folder sesi yang ditemukan.');
    }
}

// Gunakan middleware sesi untuk semua rute lain yang memerlukan sesi aktif
app.use('/api/:sessionId', sessionMiddleware, chatRoutes);
app.use('/api/:sessionId/groups', sessionMiddleware, groupRoutes);
app.use('/api/:sessionId/profile', sessionMiddleware, userRoutes);
app.use('/api/:sessionId/status', sessionMiddleware, statusRoutes); // <-- TAMBAHKAN INI
app.use('/api/:sessionId/chats', sessionMiddleware, chatManagementRoutes);
app.use('/api/:sessionId/contacts', sessionMiddleware, contactRoutes); // <-- TAMBAHKAN INI
app.use('/api/:sessionId/presence', sessionMiddleware, presenceRoutes); // <-- TAMBAHKAN INI

// Ganti app.listen dengan server.listen
server.listen(port, () => {
    console.log(`🚀 Gateway & Web UI berjalan di http://localhost:${port}`);
    restartExistingSessions(); // <-- Panggil fungsi di sini
});