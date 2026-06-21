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
        if (!window.location.pathname.includes('index.html')) {
            window.location.href = 'index.html';
        }
        return false;
    }
    
    const userObj = JSON.parse(session);
    STATE_CACHE.user = userObj.username;
    STATE_CACHE.role = userObj.role;
    STATE_CACHE.displayName = userObj.displayName || userObj.name;
    STATE_CACHE.assignedFields = userObj.assignedFields || { districts: [], blocks: [], panchayats: [], units: [] };
    
    const nameBadge = document.getElementById('sessionUserBadge');
    const roleBadge = document.getElementById('sessionRoleTag');
    if(nameBadge) nameBadge.innerText = STATE_CACHE.displayName;
    if(roleBadge) roleBadge.innerText = STATE_CACHE.role;
    
    const isMasterAdmin = (STATE_CACHE.role === 'MasterAdmin');
    const isGlobalController = (isMasterAdmin || STATE_CACHE.role === 'Admin');

    const currentPath = window.location.pathname.toLowerCase();
    
    const masterAdminPages = ['users.html', 'alerts.html', 'export-master.html'];
    if (masterAdminPages.some(page => currentPath.includes(page)) && !isMasterAdmin) {
        window.location.href = 'members.html';
        return false;
    }

    // Notice we REMOVED 'districts.html' from this block so operators can access it
    const adminPages = ['dashboard.html', 'settings.html']; 
    if (adminPages.some(page => currentPath.includes(page)) && !isGlobalController) {
        window.location.href = 'members.html';
        return false;
    }

    // --- NEW: KICK OUT UNIT OPERATORS FROM UNITS.HTML ---
    if (STATE_CACHE.role === 'UnitAdmin') {
        if (currentPath.includes('units.html')) {
            window.location.href = 'members.html';
            return false;
        }
        // Hide the Units navigation buttons globally
        const navUnits = document.getElementById('nav-units');
        const mobUnits = document.getElementById('mob-units');
        if (navUnits) navUnits.style.display = 'none';
        if (mobUnits) mobUnits.style.display = 'none';
    }
    // ----------------------------------------------------

    if (isGlobalController) {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden-force'));
    } else {
        // DYNAMIC RENAMING FOR STANDARD OPERATORS
        const navDistDesktop = document.getElementById('nav-districts');
        const navDistMobile = document.getElementById('mob-districts');
        
        if (navDistDesktop) navDistDesktop.innerHTML = '<i class="fa-solid fa-map-location-dot w-4 text-center"></i> Fields';
        if (navDistMobile) navDistMobile.innerHTML = '<i class="fa-solid fa-map-location-dot text-sm"></i><span class="text-[8px] font-bold mt-1">Fields</span>';
        
        // Rename the page header if they are currently looking at the districts page
        if (currentPath.includes('districts.html')) {
            const pageHeader = document.querySelector('h2');
            if (pageHeader) pageHeader.innerText = "My Assigned Fields";
            document.title = "Fields | SSF West Bengal";
        }
    }

    if (isMasterAdmin) {
        document.querySelectorAll('.master-admin-only').forEach(el => el.classList.remove('hidden-force'));
    }
    
    verifyLiveAccountStatus(STATE_CACHE.user);
    
    return true;
}

// NEW FUNCTION: Checks the live database to ensure the session hasn't been revoked
async function verifyLiveAccountStatus(username) {
    // Skip database check for offline fallback master accounts
    if (username === 'masteradmin' || username === 'adminwb') return;

    try {
        const { data, error } = await supa.from('users')
            .select('status')
            .eq('username', username)
            .maybeSingle();

        // If user is deleted (no data) or status is no longer ACTIVE, nuke the session
        if (error || !data || data.status !== 'ACTIVE') {
            console.warn("Security Event: Account suspended or deleted. Terminating active session.");
            spawnToastNotification("Security clearance revoked. Session terminated.", "error");
            
            // Short delay so the user can read the toast before being booted
            setTimeout(() => {
                executeSecureLogout();
            }, 2000);
        }
    } catch (err) {
        console.error("Background session validation failed:", err);
    }
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
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// ==========================================
// GLOBAL ALERT NOTIFICATIONS 
// ==========================================
async function loadGlobalUserNotifications() {
    // Only run if the user is logged in and the page has a notification bell
    if (!window.supa || !window.STATE_CACHE || !STATE_CACHE.user) return; 
    if (!document.getElementById('notifBadge')) return;

    try {
        const { data, error } = await supa.from('directive_logs').select('*').order('created_at', { ascending: false });
        if (error || !data) return;
        
        let myAlerts = [];
        const role = STATE_CACHE.role;
        const af = STATE_CACHE.assignedFields || {};
        
        // Master & Admins see everything, sub-users only see global + their specific zones
        if (role === 'MasterAdmin' || role === 'Admin') {
            myAlerts = data;
        } else {
            myAlerts = data.filter(a => {
                if(a.target_level === 'Global') return true;
                if(a.target_level === 'District' && (a.target_node === 'ALL' || af.districts?.includes(a.target_node))) return true;
                if(a.target_level === 'Block' && (a.target_node === 'ALL' || af.blocks?.includes(a.target_node))) return true;
                if(a.target_level === 'Panchayat' && (a.target_node === 'ALL' || af.panchayats?.includes(a.target_node))) return true;
                if(a.target_level === 'Unit' && (a.target_node === 'ALL' || af.units?.includes(a.target_node))) return true;
                return false;
            });
        }

        const notifList = document.getElementById('notifList');
        const badge = document.getElementById('notifBadge');
        
        if(myAlerts.length > 0) {
            badge.classList.remove('hidden');
            notifList.innerHTML = '';
            
            myAlerts.forEach(a => {
                // Strip HTML tags for the short snippet preview
                let snippet = a.advice_text.replace(/<[^>]*>?/gm, '').substring(0, 60) + '...';
                
                notifList.innerHTML += `
                    <div onclick="openGlobalNotifReader('${a.id}')" class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-[8px] font-black uppercase bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded tracking-widest">${a.target_level === 'Global' ? 'Global Alert' : a.target_node}</span>
                            <span class="text-[8px] text-slate-400 font-bold ml-auto">${new Date(a.created_at || Date.now()).toLocaleDateString()}</span>
                        </div>
                        <p class="text-[10px] text-slate-600 font-medium leading-tight">${snippet}</p>
                    </div>
                `;
            });
            window.myActiveGlobalAlerts = myAlerts;
        } else {
            badge.classList.add('hidden');
            notifList.innerHTML = '<p class="text-xs text-slate-400 font-bold text-center py-6">You have no new alerts.</p>';
        }
    } catch (e) {
        console.error("Failed to load notifications", e);
    }
}

window.openGlobalNotifReader = function(id) {
    const a = window.myActiveGlobalAlerts.find(x => x.id == id);
    if(!a) return;
    
    document.getElementById('notificationDropdown').classList.add('hidden');
    
    // Quick visual CSS fix in case the page doesn't have Quill.js loaded
    const qlStyles = `<style>.global-ql-reader img{border-radius:0.75rem;max-width:100%;margin:10px 0;} .global-ql-reader iframe{border-radius:0.75rem;width:100%;height:280px;margin:10px 0;}</style>`;
    
    const modalHTML = `
    ${qlStyles}
    <div id="notifReaderModal" class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
            <div class="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg"><i class="fa-solid fa-bullhorn"></i></div>
                    <div>
                        <h3 class="text-sm font-black text-slate-900 uppercase tracking-widest font-mono">Official Alert</h3>
                        <p class="text-[10px] text-slate-500 font-bold">${a.target_level === 'Global' ? 'Global Broadcast' : `Target: ${a.target_node}`}</p>
                    </div>
                </div>
                <button onclick="document.getElementById('notifReaderModal').remove()" class="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="p-6 overflow-y-auto custom-scrollbar flex-1 text-sm text-slate-700 bg-white global-ql-reader">
                ${a.advice_text}
            </div>
            <div class="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center">
                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sent by: ${a.created_by}</span>
                <button onclick="document.getElementById('notifReaderModal').remove()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-colors uppercase tracking-wider">Close Alert</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Automatically trigger the notification fetch 1 second after the page finishes loading
window.addEventListener('load', () => {
    setTimeout(loadGlobalUserNotifications, 1000); 
});