document.addEventListener('DOMContentLoaded', () => {
    const sessionListContainer = document.getElementById('session-list-container');
    const startSessionForm = document.getElementById('start-session-form');
    const sessionNameInput = document.getElementById('session-name-input');
    const modal = document.getElementById('qr-modal');
    const modalSessionIdEl = document.getElementById('modal-session-id');
    const modalQrImage = document.createElement('img');
    modalQrImage.id = 'modal-qr-image';
    const modalCloseBtn = document.querySelector('.modal-close');

    // === WebSocket Logic ===
    const socket = new WebSocket(`ws://${window.location.host}`);
    socket.onopen = () => console.log('Dashboard WebSocket connected.');
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'connection-update' || data.event === 'qr' || data.event === 'status') {
            fetchSessions();
        }
    };
    
    async function fetchSessions() {
        try {
            const response = await fetch('/api/sessions');
            const sessions = await response.json();
            renderSessionList(sessions);
        } catch (e) {
            console.error('Gagal memuat sesi', e);
        }
    }

    function renderSessionList(sessions) {
        sessionListContainer.innerHTML = '';
        if (!sessions || sessions.length === 0) {
            sessionListContainer.innerHTML = '<p>Belum ada sesi.</p>';
            return;
        }

        sessions.forEach(session => {
            if (!session || !session.id) return;
            const status = session.status || 'disconnected';
            const sessionDiv = document.createElement('div');
            sessionDiv.className = 'session-item';
            sessionDiv.dataset.sessionId = session.id;

            const isConnected = status === 'open' || status === 'connected';
            const phoneNumber = session.user?.id?.split(':')[0] || 'N/A';

            sessionDiv.innerHTML = `
                <div class="session-info">
                    <span class="name">${session.id}</span>
                    <span class="status">Status: ${status} | Nomor: <b>${phoneNumber}</b></span>
                </div>
                <div class="session-actions">
                    <button class="btn-manage" data-action="manage" ${!isConnected ? 'disabled' : ''}>Manage</button>
                    <button data-action="qr" ${isConnected ? 'disabled' : ''}>QR Code</button>
                    <button data-action="logout" class="btn-danger" ${!isConnected ? 'disabled' : ''}>Logout</button>
                </div>
            `;
            sessionListContainer.appendChild(sessionDiv);
        });
    }

    function showQrModal(sessionId) {
        modalSessionIdEl.textContent = sessionId;
        const qrImageContainer = document.getElementById('modal-qr-image-container');
        qrImageContainer.innerHTML = '<p>Memuat QR Code...</p>';
        modal.style.display = 'flex';

        modalQrImage.src = `/api/sessions/${sessionId}/qr?t=${Date.now()}`;
        modalQrImage.onload = () => {
            qrImageContainer.innerHTML = '';
            qrImageContainer.appendChild(modalQrImage);
        };
        modalQrImage.onerror = () => {
            qrImageContainer.innerHTML = '<p style="color:red;">Gagal memuat QR Code.</p>';
        };
    }

    startSessionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sessionId = sessionNameInput.value.trim();
        if (!sessionId) return;
        await fetch('/api/sessions/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        });
        sessionNameInput.value = '';
        showQrModal(sessionId);
        setTimeout(fetchSessions, 1000);
    });

    sessionListContainer.addEventListener('click', async (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        const action = e.target.dataset.action;
        const sessionId = e.target.closest('.session-item').dataset.sessionId;

        if (action === 'manage') {
            window.open(`/session.html?id=${sessionId}`, '_blank');
        } else if (action === 'qr') {
            showQrModal(sessionId);
        } else if (action === 'logout') {
            if (confirm(`Logout sesi "${sessionId}"?`)) {
                await fetch(`/api/sessions/${sessionId}/logout`, { method: 'DELETE' });
                fetchSessions();
            }
        }
    });

    modalCloseBtn.addEventListener('click', () => modal.style.display = 'none');
    fetchSessions();
    setInterval(fetchSessions, 5000);
});