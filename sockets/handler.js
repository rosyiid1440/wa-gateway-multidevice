const WebSocket = require('ws');

let wss;
const clients = new Set();

const initWebSocket = (server) => {
    wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
        console.log('Frontend terhubung via WebSocket');
        clients.add(ws);

        ws.on('close', () => {
            console.log('Koneksi WebSocket ditutup');
            clients.delete(ws);
        });

        ws.on('error', (error) => {
            console.error('WebSocket Error:', error);
            clients.delete(ws);
        });
    });
};

const broadcast = (data) => {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
};

module.exports = { initWebSocket, broadcast };