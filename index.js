const express = require('express');
const http = require('http'); // <-- TAMBAHKAN INI
const path = require('path'); // <-- Tambahkan ini
const fs = require('fs');   // <-- Tambahkan ini
const { initWebSocket } = require('./sockets/handler'); // <-- TAMBAHKAN INI
const sessionMiddleware = require('./middleware/session.middleware');
const { startSession, SESSIONS_DIR } = require('./services/baileys.service'); // <-- Impor SESSIONS_DIR

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

// --- GANTI SELURUH FUNGSI INI ---
function restartExistingSessions() {
    console.log('🔄 Memeriksa sesi yang ada untuk di-restart...');
    
    if (fs.existsSync(SESSIONS_DIR)) {
        const sessionFolders = fs.readdirSync(SESSIONS_DIR);
        for (const sessionFolder of sessionFolders) {
            const sessionPath = path.join(SESSIONS_DIR, sessionFolder);
            if (fs.statSync(sessionPath).isDirectory()) {
                
                // Baca URL webhook dari file jika ada
                let webhookUrl = null;
                const webhookFilePath = path.join(sessionPath, 'webhook.json');
                if (fs.existsSync(webhookFilePath)) {
                    try {
                        const webhookData = JSON.parse(fs.readFileSync(webhookFilePath, 'utf-8'));
                        webhookUrl = webhookData.url;
                    } catch (e) {
                        console.error(`Gagal membaca webhook.json untuk sesi ${sessionFolder}:`, e);
                    }
                }
                
                console.log(`Mencoba me-restart sesi: ${sessionFolder} dengan webhook: ${webhookUrl || 'tidak ada'}`);
                // Panggil startSession dengan webhook yang sudah dimuat
                startSession(sessionFolder, null, webhookUrl); 
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