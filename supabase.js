// Initialize Supabase Client
const SUPABASE_URL = "https://nefrtapsazuwopouqene.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_X0YE3PEm6XYOIY4UgEesog_ky8_HV4m";

// Check if window.supabase exists
if (!window.supabase) {
    console.error("Supabase library not loaded. Check your CDN links.");
}

const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test Connection
supa.from('districts').select('count').limit(1).then(({ data, error }) => {
    if (error) console.error("Supabase Connection Error:", error.message);
    else console.log("Supabase Connection Established.");
});
// Global Variables
let STATE_CACHE = {
    user: null, role: null, displayName: "",
    assignedFields: { districts: [], blocks: [], panchayats: [], units: [] }
};

// UI Helpers
function toggleInteractionLoader(show, text = "") {
    const loader = document.getElementById('globalLoader'); if(!loader) return;
    if(text) document.getElementById('globalLoaderText').innerText = text;
    show ? loader.classList.remove('hidden') : loader.classList.add('hidden');
}

function spawnToastNotification(msg, type='success') {
    const container = document.getElementById('toastContainer');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `p-3.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all duration-300 ${type==='success'?'bg-slate-900':'bg-rose-600'}`;
    toast.innerText = msg; 
    container.appendChild(toast); 
    setTimeout(() => toast.remove(), 3500);
}

// ==========================================
// SESSION & ROLE-BASED PAGE SECURITY
// ==========================================
function enforceSession() {
    const session = localStorage.getItem('ssf_session_user');
    if (!session) {
        window.location.href = 'index.html'; // Kick to login if not authenticated
        return false;
    }
    
    const userObj = JSON.parse(session);
    STATE_CACHE.user = userObj.username;
    STATE_CACHE.role = userObj.role;
    STATE_CACHE.displayName = userObj.name;
    STATE_CACHE.assignedFields = userObj.assigned_fields_json;
    
    // 1. Update Header Badges
    const nameBadge = document.getElementById('sessionUserBadge');
    const roleBadge = document.getElementById('sessionRoleTag');
    if(nameBadge) nameBadge.innerText = STATE_CACHE.displayName;
    if(roleBadge) roleBadge.innerText = STATE_CACHE.role;
    
    // 2. Identify Admin Status
    const isMasterAdmin = (STATE_CACHE.role === 'MasterAdmin');
    const isGlobalController = (isMasterAdmin || STATE_CACHE.role === 'Admin');

    // 3. PAGE-LEVEL ROUTING LOCK (New Feature)
    // List the files that only Admins should be allowed to open
    const adminOnlyPages = ['users.html', 'settings.html']; 
    const currentPath = window.location.pathname.toLowerCase();
    
    const isTryingToAccessAdminPage = adminOnlyPages.some(page => currentPath.includes(page));

    if (isTryingToAccessAdminPage && !isGlobalController) {
        // If a lower-level operator tries to type "settings.html" into the URL, 
        // they are instantly kicked back to the dashboard.
        window.location.href = 'dashboard.html';
        return false;
    }

    // 4. ELEMENT-LEVEL SECURITY (Unhide secure tools for Admins)
    if (isGlobalController) {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden-force'));
    }
    if (isMasterAdmin) {
        document.querySelectorAll('.master-admin-only').forEach(el => el.classList.remove('hidden-force'));
    }
    
    return true;
}

function executeSecureLogout() {
    localStorage.removeItem('ssf_session_user');
    window.location.href = 'index.html';
}

// Function to highlight both Desktop and Mobile navigation links
function setActiveSidebarLink(pageId) {
    // Highlight Desktop Link
    const desktopLink = document.getElementById(`nav-${pageId}`);
    if(desktopLink) {
        desktopLink.classList.remove('text-slate-600', 'hover:bg-slate-100');
        desktopLink.classList.add('bg-slate-900', 'text-white', 'shadow-md');
    }

    // Highlight Mobile Link
    const mobileLink = document.getElementById(`mob-${pageId}`);
    if(mobileLink) {
        mobileLink.classList.remove('text-slate-400');
        mobileLink.classList.add('text-emerald-600');
    }
}
// ==========================================
// UI HELPER: TOGGLE PASSWORD VISIBILITY
// ==========================================
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        // Change icon to eye-slash (hidden)
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        // Change icon back to normal eye
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}