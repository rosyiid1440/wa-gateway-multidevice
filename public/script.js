document.addEventListener('DOMContentLoaded', () => {
    // === DOM Elements ===
    const sessionListContainer = document.getElementById('session-list-container');
    const startSessionForm = document.getElementById('start-session-form');
    const sessionNameInput = document.getElementById('session-name-input');
    const webhookUrlInput = document.getElementById('webhook-url-input');
    const logContainer = document.getElementById('log-container');
    
    // QR Modal
    const qrModal = document.getElementById('qr-modal');
    const qrModalSessionIdEl = document.getElementById('modal-session-id-qr');
    const qrModalImageContainer = document.getElementById('modal-qr-image-container');
    
    // Webhook Modal
    const webhookModal = document.getElementById('webhook-modal');
    const webhookModalSessionIdEl = document.getElementById('modal-session-id-webhook');
    const editWebhookForm = document.getElementById('edit-webhook-form');
    const editWebhookInput = document.getElementById('edit-webhook-input');

    // === WebSocket Logic ===
    const socket = new WebSocket(`ws://${window.location.host}`);
    socket.onopen = () => addLog('System', 'WebSocket connection established.');
    socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        addLog(payload.event, `Session: ${payload.sessionId}`, payload.data);
        handleWebSocketEvent(payload);
    };

    // === State ===
    let currentEditingSession = null;

    // === Main Functions ===
    async function fetchSessions() {
        try {
            const response = await fetch('/api/sessions');
            const sessions = await response.json();
            renderSessionList(sessions);
        } catch (e) { addLog('Error', 'Gagal memuat sesi', e); }
    }

    function renderSessionList(sessions) {
        sessionListContainer.innerHTML = '';
        if (!Array.isArray(sessions) || sessions.length === 0) {
            sessionListContainer.innerHTML = '<p class="placeholder-text">Belum ada sesi.</p>';
            return;
        }
        sessions.forEach(session => {
            if (!session || !session.id) return;
            const status = session.status || 'disconnected';
            const isConnected = status === 'open' || status === 'connected';
            const sessionDiv = document.createElement('div');
            sessionDiv.className = 'session-item';
            sessionDiv.dataset.sessionId = session.id;
            sessionDiv.style.borderColor = isConnected ? 'var(--primary)' : 'var(--border)';
            
            const phoneNumber = session.user?.id?.split(':')[0] || 'N/A';
            const webhookDisplay = session.webhookUrl 
                ? `<a href="${session.webhookUrl}" target="_blank" title="${session.webhookUrl}">${session.webhookUrl}</a>` 
                : 'Tidak diatur';

            sessionDiv.innerHTML = `
                <div class="session-item-header">
                    <div class="session-info">
                        <span class="name">${session.id}</span>
                        <span class="status">Status: ${status} | Nomor: <b>${phoneNumber}</b></span>
                        <span class="status webhook-url">Webhook: ${webhookDisplay}</span>
                    </div>
                    <button data-action="delete" class="btn-danger" style="padding: 0.2rem 0.5rem; font-size: 0.7rem;">Hapus</button>
                </div>
                <div class="session-actions">
                    <button data-action="qr" ${isConnected ? 'disabled' : ''}>QR Code</button>
                    <button data-action="edit-webhook" class="btn-info">Edit Webhook</button>
                    <button data-action="set-online" class="btn-success" ${!isConnected ? 'disabled' : ''}>Set Online</button>
                    <button data-action="set-offline" class="btn-offline" ${!isConnected ? 'disabled' : ''}>Set Offline</button>
                </div>
            `;
            sessionListContainer.appendChild(sessionDiv);
        });
    }

    function handleWebSocketEvent(event) {
        if (event.event === 'qr') {
            showQrModal(event.sessionId, event.data);
        }
        if (event.event === 'connection-update' || event.event === 'status') {
            if (event.data?.connection === 'open') {
                qrModal.style.display = 'none';
            }
            fetchSessions();
        }
    }
    
    function showQrModal(sessionId, qrString) {
        qrModalSessionIdEl.textContent = sessionId;
        qrModalImageContainer.innerHTML = '';
        if (!qrString) {
            qrModalImageContainer.innerHTML = '<p>Menunggu data QR...</p>';
        } else {
            const qr = qrcode(0, 'M');
            qr.addData(qrString);
            qr.make();
            qrModalImageContainer.innerHTML = qr.createImgTag(8);
        }
        qrModal.style.display = 'flex';
    }

    function openWebhookModal(sessionId) {
        currentEditingSession = sessionId;
        webhookModalSessionIdEl.textContent = sessionId;
        const sessionRow = document.querySelector(`.session-item[data-session-id="${sessionId}"]`);
        const webhookUrl = sessionRow.querySelector('.webhook-url a')?.href || '';
        editWebhookInput.value = webhookUrl;
        webhookModal.style.display = 'flex';
    }

    // === Event Listeners ===
    startSessionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sessionId = sessionNameInput.value.trim();
        const webhookUrl = webhookUrlInput.value.trim();
        if (!sessionId) return;
        
        showQrModal(sessionId, null);
        const body = { sessionId };
        if (webhookUrl) body.webhookUrl = webhookUrl;
        
        await fetch('/api/sessions/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        startSessionForm.reset();
        fetchSessions();
    });
    
    // Listener terpusat untuk semua tombol aksi di daftar sesi
    sessionListContainer.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;

        const sessionId = button.closest('.session-item').dataset.sessionId;
        const action = button.dataset.action;
        
        if (action === 'delete') {
            if (confirm(`Yakin ingin menghapus sesi "${sessionId}"?`)) {
                fetch(`/api/sessions/${sessionId}/logout`, { method: 'DELETE' }).then(() => fetchSessions());
            }
        } else if (action === 'qr') {
            showQrModal(sessionId, null);
            fetch(`/api/sessions/${sessionId}/qr`).then(res => res.json()).then(data => {
                if (data.qr) showQrModal(sessionId, data.qr);
            }).catch(err => addLog('Error', `Gagal fetch QR untuk [${sessionId}]`, err));
        } else if (action === 'edit-webhook') {
            openWebhookModal(sessionId);
        } else if (action === 'set-online' || action === 'set-offline') {
            const presence = action === 'set-online' ? 'available' : 'unavailable';
            fetch(`/api/${sessionId}/presence`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ presence })
            });
        }
    });

    // Listener untuk form di modal webhook
    editWebhookForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentEditingSession) return;
        
        const newWebhookUrl = editWebhookInput.value.trim();
        await fetch(`/api/sessions/${currentEditingSession}/webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhookUrl: newWebhookUrl })
        });
        
        webhookModal.style.display = 'none';
        fetchSessions();
    });
    
    // Listener untuk menutup modal
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById(btn.dataset.modalId).style.display = 'none';
        });
    });

    function addLog(type, message, data) {
        const entry = document.createElement('div');
        const timestamp = `<strong>[${new Date().toLocaleTimeString('en-GB')}]</strong>`;
        entry.innerHTML = `${timestamp} [${type.toUpperCase()}] ${message}`;
        if (data && Object.keys(data).length > 0) {
            entry.innerHTML += `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        }
        logContainer.prepend(entry);
    }

    fetchSessions();
    setInterval(fetchSessions, 5000);
});