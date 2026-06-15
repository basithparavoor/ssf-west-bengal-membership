// Auto-redirect if already logged in
window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('ssf_session_user')) {
        window.location.href = 'dashboard.html';
    }
});

async function digestMessageSHA256(message) {
    const msgBuffer = new TextEncoder().encode(message);                    
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

document.getElementById('authForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const u = document.getElementById('authUsername').value.trim().toLowerCase();
    const p = document.getElementById('authPassword').value;
    
    toggleInteractionLoader(true, "Validating User Credentials...");

    // Master Override Check
    if ((u === 'masteradmin' && p === 'SSF@WestBengal2026!') || (u === 'adminwb' && p === 'SSFAdmin2026!')) {
        let fallbackPayload = {
            username: u, role: u === 'masteradmin' ? 'MasterAdmin' : 'Admin',
            displayName: u === 'masteradmin' ? 'State Master Committee' : 'State Administrator',
            assignedFields: { districts: [], blocks: [], panchayats: [], units: [] }
        };
        localStorage.setItem('ssf_session_user', JSON.stringify(fallbackPayload));
        window.location.href = 'dashboard.html'; // Redirect to dashboard
        return;
    }

    try {
        const inputHash = await digestMessageSHA256(p);
        const { data, error } = await supa.from('users')
          .select('*').eq('username', u).eq('password_hash', inputHash).eq('status', 'ACTIVE').maybeSingle();

        if (error || !data) {
           spawnToastNotification("Invalid credentials or account suspended.", "error");
           toggleInteractionLoader(false);
           return;
        }

        let sessionPayload = {
           username: data.username, role: data.role, displayName: data.name,
           assignedFields: data.assigned_fields_json
        };

        localStorage.setItem('ssf_session_user', JSON.stringify(sessionPayload));
        window.location.href = 'dashboard.html'; // Redirect on success
    } catch(err) {
        spawnToastNotification("Authentication Failure.", "error");
        toggleInteractionLoader(false);
    }
});