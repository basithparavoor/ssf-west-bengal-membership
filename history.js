let allLogs = [];
let filteredLogs = [];

let currentPage = 1;
let pageSize = 25;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Enforce active session
    if (!enforceSession()) return; 

    // 2. STRICT SECURITY: Master Admin Check
    if (STATE_CACHE.role !== 'MasterAdmin') {
        window.location.href = 'dashboard.html'; 
        return;
    }

    setActiveSidebarLink('history');
    await fetchAuditLogs();
});

// ==========================================
// CORE DATA FETCHING
// ==========================================
async function fetchAuditLogs() {
    toggleInteractionLoader(true, "Loading History Logs...");
    try {
        // Query the audit_logs table (assumes table has: id, created_at, operator_username, module, action_type, description, payload)
        const { data, error } = await supa.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(1000); // Fetch latest 1000 for client-side filtering
        
        if (error) {
            // Handle graceful failure if table doesn't exist yet
            if(error.code === '42P01') {
                spawnToastNotification("audit_logs table not found in database.", "warning");
                allLogs = [];
            } else {
                throw error;
            }
        } else {
            allLogs = data || [];
        }

        filteredLogs = [...allLogs];
        applyLogFilters();

    } catch(err) {
        console.error("Log Fetch Error:", err);
        spawnToastNotification("Failed to fetch system logs.", "error");
    }
    toggleInteractionLoader(false);
}

// ==========================================
// FILTERS & PAGINATION
// ==========================================
function applyLogFilters() {
    const q = document.getElementById('filterSearch').value.toLowerCase().trim();
    const mod = document.getElementById('filterModule').value;
    const act = document.getElementById('filterAction').value;
    
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;

    filteredLogs = allLogs.filter(log => {
        let match = true;
        
        // Text Match
        if (q && !(log.operator_username?.toLowerCase().includes(q) || log.description?.toLowerCase().includes(q))) match = false;
        
        // Dropdown Matches
        if (mod && log.module !== mod) match = false;
        if (act && log.action_type !== act) match = false;
        
        // Date Logic
        if (startDate || endDate) {
            const logDate = new Date(log.created_at);
            logDate.setHours(0,0,0,0);
            
            if (startDate) {
                const s = new Date(startDate);
                s.setHours(0,0,0,0);
                if (logDate < s) match = false;
            }
            if (endDate) {
                const e = new Date(endDate);
                e.setHours(0,0,0,0);
                if (logDate > e) match = false;
            }
        }
        
        return match;
    });

    currentPage = 1;
    renderPagination();
    renderTable();
}

function changeLogPageSize() {
    pageSize = parseInt(document.getElementById('pageSizeSelect').value);
    currentPage = 1; renderPagination(); renderTable();
}
function prevLogPage() { if (currentPage > 1) { currentPage--; renderPagination(); renderTable(); } }
function nextLogPage() {
    const maxPage = Math.ceil(filteredLogs.length / pageSize);
    if (currentPage < maxPage) { currentPage++; renderPagination(); renderTable(); }
}
function goToLogPage(p) { currentPage = p; renderPagination(); renderTable(); }

function renderPagination() {
    const totalRecords = filteredLogs.length;
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalRecords);

    document.getElementById('pageStartText').innerText = totalRecords === 0 ? 0 : startIdx + 1;
    document.getElementById('pageEndText').innerText = endIdx;
    document.getElementById('pageTotalText').innerText = totalRecords;

    document.getElementById('btnPrevPage').disabled = currentPage === 1;
    document.getElementById('btnNextPage').disabled = currentPage === totalPages;

    const numContainer = document.getElementById('paginationNumbers');
    numContainer.innerHTML = '';
    
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? 'bg-indigo-600 text-white shadow-md border-indigo-600' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200';
        numContainer.innerHTML += `<button onclick="goToLogPage(${i})" class="w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold transition-all ${activeClass}">${i}</button>`;
    }
}

// ==========================================
// RENDER TABLE & MODALS
// ==========================================
function renderTable() {
    const tbody = document.getElementById('logsTableBody');
    const emptyState = document.getElementById('logsEmptyState');
    
    tbody.innerHTML = '';

    if (filteredLogs.length === 0) {
        emptyState.classList.remove('hidden'); 
        return;
    }
    emptyState.classList.add('hidden');

    const startIdx = (currentPage - 1) * pageSize;
    const currentSlice = filteredLogs.slice(startIdx, startIdx + pageSize);

    currentSlice.forEach((log) => {
        const dateObj = new Date(log.created_at);
        const dateStr = dateObj.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
        const timeStr = dateObj.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
        
        let actionBadge = '';
        if(log.action_type === 'INSERT') actionBadge = '<span class="bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">INSERT</span>';
        else if(log.action_type === 'UPDATE') actionBadge = '<span class="bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">UPDATE</span>';
        else if(log.action_type === 'DELETE') actionBadge = '<span class="bg-rose-50 text-rose-600 border border-rose-100 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">DELETE</span>';
        else actionBadge = `<span class="bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">${log.action_type || 'SYSTEM'}</span>`;

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors border-l-2 border-transparent hover:border-indigo-500 group">
                <td class="py-3.5 px-5">
                    <div class="font-bold text-slate-800">${dateStr}</div>
                    <div class="text-[10px] text-slate-400 font-mono mt-0.5">${timeStr}</div>
                </td>
                <td class="py-3.5 px-4 font-black text-slate-700">@${log.operator_username}</td>
                <td class="py-3.5 px-4">
                    <div class="font-bold text-slate-900 mb-1">${log.module || 'Unknown'}</div>
                    ${actionBadge}
                </td>
                <td class="py-3.5 px-4 text-slate-600 font-medium truncate max-w-[200px]" title="${log.description}">
                    ${log.description}
                </td>
                <td class="py-3.5 px-5 text-right">
                    <button onclick="openLogModal('${log.id}')" class="bg-white border border-slate-200 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-50 hover:border-indigo-200 shadow-sm transition-all uppercase tracking-wider">Inspect</button>
                </td>
            </tr>`;
    });
}

function openLogModal(id) {
    const log = filteredLogs.find(x => x.id == id);
    if(!log) return;
    
    document.getElementById('vlLogId').innerText = `#${log.id}`;
    document.getElementById('vlOperator').innerText = `@${log.operator_username}`;
    document.getElementById('vlModule').innerText = log.module || 'N/A';
    document.getElementById('vlAction').innerText = log.action_type || 'N/A';
    
    const d = new Date(log.created_at);
    document.getElementById('vlTime').innerText = `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    
    document.getElementById('vlDescription').innerText = log.description || 'No description provided.';
    
    // Format the JSON payload beautifully
    let formattedPayload = "{}";
    try {
        const parsed = typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload;
        formattedPayload = JSON.stringify(parsed, null, 4);
    } catch(e) {
        formattedPayload = String(log.payload);
    }
    
    const preBlock = document.getElementById('vlPayload');
    preBlock.innerText = formattedPayload;
    preBlock.setAttribute('data-raw', formattedPayload); // Stored for copy function

    const modal = document.getElementById('viewLogModal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
    }, 10);
}

function closeLogModal() {
    const modal = document.getElementById('viewLogModal');
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 200);
}

function copyLogPayload() {
    const data = document.getElementById('vlPayload').getAttribute('data-raw');
    navigator.clipboard.writeText(data).then(() => {
        spawnToastNotification("Payload copied to clipboard!", "success");
    }).catch(err => {
        spawnToastNotification("Failed to copy.", "error");
    });
}

function exportLogsToCSV() {
    if(filteredLogs.length === 0) return spawnToastNotification("No logs to export.", "error");
    
    const headers = ["ID", "Timestamp", "Operator", "Module", "Action", "Description"];
    let csvContent = headers.join(",") + "\n";

    filteredLogs.forEach(l => {
        let row = [
            l.id,
            `"${l.created_at}"`,
            `"${l.operator_username}"`,
            `"${l.module}"`,
            `"${l.action_type}"`,
            `"${l.description?.replace(/"/g, '""')}"`
        ];
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `SSF_Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
}

// Ensure logout logic works
function promptLogout() {
    if (!document.getElementById('dynamicLogoutModal')) {
        const modalHTML = `
        <div id="dynamicLogoutModal" class="hidden fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm transition-opacity">
            <div class="bg-white rounded-2xl p-6 w-[90%] max-w-sm shadow-xl border border-slate-200 animate-fade-in-up">
                <div class="flex flex-col items-center text-center">
                    <div class="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-4 shadow-inner">
                        <i class="fa-solid fa-right-from-bracket text-xl"></i>
                    </div>
                    <h3 class="text-lg font-black text-slate-900 mb-1">Confirm Logout</h3>
                    <p class="text-xs text-slate-500 font-medium mb-6">Are you sure you want to securely end your current session?</p>
                    <div class="flex gap-3 w-full">
                        <button onclick="closeLogoutPrompt()" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2.5 rounded-xl transition-colors font-mono uppercase tracking-wider">Cancel</button>
                        <button onclick="executeSecureLogout()" class="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-md transition-colors font-mono uppercase tracking-wider">Yes, Logout</button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    document.getElementById('dynamicLogoutModal').classList.remove('hidden');
}

function closeLogoutPrompt() {
    const modal = document.getElementById('dynamicLogoutModal');
    if (modal) modal.classList.add('hidden');
}