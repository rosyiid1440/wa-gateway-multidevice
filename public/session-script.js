document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('id');

    if (!sessionId) {
        document.body.innerHTML = '<h1>Session ID tidak ditemukan.</h1>';
        return;
    }

    document.getElementById('session-title').querySelector('b').textContent = sessionId;
    const logContainer = document.getElementById('log-container');

    // === WebSocket Logic ===
    const socket = new WebSocket(`ws://${window.location.host}`);
    socket.onopen = () => addLog('WebSocket terhubung ke sesi ini.');
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // Hanya tampilkan log untuk sesi yang sedang dibuka
        if (data.sessionId === sessionId) {
            addLog(`[${data.event}]`, data.data);
        }
    };

    // === Tab Logic ===
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.tab);
            tabContents.forEach(content => content.classList.remove('active'));
            target.classList.add('active');
        });
    });

    // === API Call Helper ===
    async function apiCall(endpoint, method = 'POST', body = {}) {
        try {
            const response = await fetch(`/api/${sessionId}${endpoint}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await response.json();
            addLog(`API Response for ${endpoint}`, result);
            if (!response.ok) alert(`Error: ${result.error || 'Unknown error'}`);
        } catch (error) {
            addLog('API Call Error', error);
            alert(`Failed to call API: ${error.message}`);
        }
    }
    
    // === Form Event Listeners ===
    document.getElementById('send-text-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const number = e.target.elements.number.value;
        const message = e.target.elements.message.value;
        apiCall('/sendText', 'POST', { number, message });
    });

    document.getElementById('send-media-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const { number, url, caption, type } = e.target.elements;
        apiCall('/sendMedia', 'POST', { 
            number: number.value,
            url: url.value,
            caption: caption.value,
            type: type.value 
        });
    });
    
    document.getElementById('group-form').addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        const form = e.target.closest('form');
        const groupId = form.elements.groupId.value;
        const participants = form.elements.participants.value.split(',').map(p => p.trim());
        const action = e.target.dataset.action;
        
        if (!groupId || !participants.length) {
            return alert('Group JID dan nomor partisipan harus diisi.');
        }

        apiCall(`/groups/${groupId}/participants/${action}`, 'POST', { participants });
    });


    function addLog(message, data = null) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        const timestamp = `<strong>[${new Date().toLocaleTimeString()}]</strong>`;
        entry.innerHTML = `${timestamp} ${message}`;
        if (data) {
            entry.innerHTML += `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        }
        logContainer.prepend(entry);
    }
});