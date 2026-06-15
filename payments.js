let allPayments = [];
let filteredPayments = [];
let chartInstance = null;
let GLOBAL_UPI_ID = ""; // Added dynamic variable

let currentPage = 1;
let pageSize = 25;

document.addEventListener('DOMContentLoaded', async () => {
    if (!enforceSession()) return;
    setActiveSidebarLink('payments');
    await fetchFinanceData();
});

// ==========================================
// DATA CORE FETCH & METRICS
// ==========================================
async function fetchFinanceData() {
    toggleInteractionLoader(true, "Fetching Financial Ledgers...");
    try {
        // Fetch Payments and Global Settings concurrently
        const [payRes, setRes] = await Promise.all([
            supa.from('payments').select('*').order('id', { ascending: false }),
            supa.from('settings').select('*').eq('key', 'UpiId').maybeSingle()
        ]);
        
        allPayments = payRes.data || [];
        filteredPayments = [...allPayments];

        // Store Dynamic UPI ID (fallback to hardcoded if not set yet)
        if(setRes.data && setRes.data.value) {
            GLOBAL_UPI_ID = setRes.data.value;
        } else {
            GLOBAL_UPI_ID = "statecommittee@sbi";
        }
        
        updateMetricsAndChart();
        applyFilters();

    } catch(err) {
        spawnToastNotification("Failed to load ledgers.", "error");
    }
    toggleInteractionLoader(false);
}

function updateMetricsAndChart() {
    let verified = 0, pending = 0, rejected = 0;

    allPayments.forEach(p => {
        let amt = parseFloat(p.amount || 0);
        if(p.status === 'VERIFIED') verified += amt;
        else if(p.status === 'PENDING') pending += amt;
        else if(p.status === 'REJECTED') rejected += amt;
    });

    document.getElementById('statVerified').innerText = "₹" + verified.toLocaleString('en-IN');
    document.getElementById('statPending').innerText = "₹" + pending.toLocaleString('en-IN');
    document.getElementById('statRejected').innerText = "₹" + rejected.toLocaleString('en-IN');

    // Chart Update
    const ctx = document.getElementById('financeChart');
    if (chartInstance) chartInstance.destroy();

    // Prevent empty chart bug
    if(verified === 0 && pending === 0 && rejected === 0) return;

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Verified', 'Pending', 'Rejected'],
            datasets: [{
                data: [verified, pending, rejected],
                backgroundColor: ['#10b981', '#f59e0b', '#f43f5e'],
                borderWidth: 2, borderColor: '#ffffff', hoverOffset: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '70%',
            plugins: { legend: { display: false }, tooltip: { enabled: true } },
            animation: { animateScale: true, duration: 800 }
        }
    });
}

// ==========================================
// FILTERS & PAGINATION
// ==========================================
function applyFilters() {
    const q = document.getElementById('filterSearch').value.toLowerCase().trim();
    const status = document.getElementById('filterStatus').value;

    filteredPayments = allPayments.filter(p => {
        let match = true;
        if (status && p.status !== status) match = false;
        if (q) {
            const searchStr = `${p.tx_id} ${p.node_path} ${p.recorded_by}`.toLowerCase();
            if (!searchStr.includes(q)) match = false;
        }
        return match;
    });

    currentPage = 1;
    renderPagination();
    renderTable();
}

function changePageSize() {
    pageSize = parseInt(document.getElementById('pageSizeSelect').value);
    currentPage = 1; renderPagination(); renderTable();
}
function prevPage() { if (currentPage > 1) { currentPage--; renderPagination(); renderTable(); } }
function nextPage() {
    const maxPage = Math.ceil(filteredPayments.length / pageSize);
    if (currentPage < maxPage) { currentPage++; renderPagination(); renderTable(); }
}
function goToPage(p) { currentPage = p; renderPagination(); renderTable(); }

function renderPagination() {
    const totalRecords = filteredPayments.length;
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
        const activeClass = i === currentPage ? 'bg-emerald-600 text-white shadow-md border-emerald-600' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200';
        numContainer.innerHTML += `<button onclick="goToPage(${i})" class="w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold transition-all ${activeClass}">${i}</button>`;
    }
}

// ==========================================
// RENDER TABLE & CARDS
// ==========================================
function renderTable() {
    const tbody = document.getElementById('paymentTableBody');
    const mobileGrid = document.getElementById('paymentMobileCardsGrid');
    const emptyState = document.getElementById('emptyState');
    
    tbody.innerHTML = '';
    mobileGrid.innerHTML = '';

    if (filteredPayments.length === 0) {
        emptyState.classList.remove('hidden'); return;
    }
    emptyState.classList.add('hidden');

    const startIdx = (currentPage - 1) * pageSize;
    const currentSlice = filteredPayments.slice(startIdx, startIdx + pageSize);

    // SECURITY CHECK: Only Admins can verify payments
    const isAdmin = STATE_CACHE.role === 'Admin' || STATE_CACHE.role === 'MasterAdmin';

    currentSlice.forEach((p, index) => {
        let statusBadge = '';
        if(p.status === 'VERIFIED') statusBadge = `<span class="bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[9px]"><i class="fa-solid fa-check mr-1"></i> Verified</span>`;
        else if(p.status === 'PENDING') statusBadge = `<span class="bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[9px]"><i class="fa-solid fa-clock mr-1"></i> Pending</span>`;
        else if(p.status === 'REJECTED') statusBadge = `<span class="bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[9px]"><i class="fa-solid fa-xmark mr-1"></i> Rejected</span>`;

        let actionButtons = `<span class="text-[9px] font-mono text-slate-400">Locked</span>`;
        if (isAdmin && p.status === 'PENDING') {
            actionButtons = `
            <div class="flex items-center justify-end gap-1">
                <button onclick="updatePaymentStatus('${p.tx_id}', 'REJECTED')" class="bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg font-bold transition-colors">Reject</button>
                <button onclick="updatePaymentStatus('${p.tx_id}', 'VERIFIED')" class="bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm border border-emerald-600 px-3 py-1.5 rounded-lg font-bold transition-colors">Verify</button>
            </div>`;
        } else if (isAdmin) {
            actionButtons = `<button onclick="deletePaymentRecord('${p.tx_id}')" class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 shadow-sm transition-all flex items-center justify-center ml-auto" title="Delete Ledger"><i class="fa-solid fa-trash-can text-[10px]"></i></button>`;
        }

        const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A';

        // Desktop Row
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="py-3 px-4 text-center font-mono text-slate-400">${startIdx + index + 1}</td>
                <td class="py-3 px-4">
                    <div class="font-black text-slate-900 text-sm">₹${parseFloat(p.amount).toLocaleString('en-IN')}</div>
                    <div class="text-[9px] font-mono bg-slate-100 border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded inline-block mt-1">${p.tx_id}</div>
                </td>
                <td class="py-3 px-4">
                    <div class="font-bold text-slate-700 text-[11px]"><i class="fa-solid fa-user-tie text-slate-400 mr-1"></i> ${p.recorded_by}</div>
                    <div class="text-[10px] text-slate-500 font-medium mt-1"><i class="fa-solid fa-location-crosshairs text-indigo-400 mr-1"></i> Node: ${p.node_path}</div>
                </td>
                <td class="py-3 px-4">
                    ${statusBadge}
                    <div class="text-[9px] text-slate-400 font-mono mt-1">${dateStr}</div>
                </td>
                <td class="py-3 px-4 text-right pr-6">${actionButtons}</td>
            </tr>`;

        // Mobile Card
        mobileGrid.innerHTML += `
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative">
                <div class="flex justify-between items-start border-b border-slate-100 pb-3 mb-3">
                    <div>
                        <h4 class="text-lg font-black text-slate-900 leading-tight">₹${parseFloat(p.amount).toLocaleString('en-IN')}</h4>
                        <span class="text-[9px] font-mono bg-slate-100 border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded mt-1 inline-block">${p.tx_id}</span>
                    </div>
                    ${statusBadge}
                </div>
                <div class="grid grid-cols-2 gap-2 text-[10px] font-medium text-slate-600 mb-4">
                    <div><span class="font-bold text-slate-400 block uppercase tracking-wider mb-0.5 font-mono">Operator</span>${p.recorded_by}</div>
                    <div><span class="font-bold text-slate-400 block uppercase tracking-wider mb-0.5 font-mono">Routing Node</span>${p.node_path}</div>
                </div>
                <div class="pt-3 border-t border-slate-100 flex justify-between items-center">
                    <span class="text-[9px] font-mono text-slate-400">${dateStr}</span>
                    <div>${actionButtons}</div>
                </div>
            </div>`;
    });
}

// ==========================================
// ACTIONS & MUTATIONS
// ==========================================
function updateQR() {
    const amt = document.getElementById('payAmountInput').value || 0;
    
    // Inject Dynamic GLOBAL_UPI_ID
    const upiLink = `upi://pay?pa=${GLOBAL_UPI_ID}&pn=SSF_West_Bengal&am=${amt}&cu=INR`;
    
    document.getElementById('qrModalImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;
}

function triggerUPIPayment() {
    updateQR();
    const modal = document.getElementById('upiQRModal');
    modal.classList.remove('hidden', 'pointer-events-none', 'opacity-0');
    modal.children[0].classList.remove('scale-95');
}

function closeUPIModal() { 
    document.getElementById('upiQRModal').children[0].classList.add('scale-95');
    setTimeout(() => document.getElementById('upiQRModal').classList.add('hidden', 'pointer-events-none', 'opacity-0'), 200);
}

async function confirmPaymentIntent() {
    const amt = document.getElementById('payAmountInput').value;
    if(!amt || amt <= 0) return spawnToastNotification("Enter valid amount.", "error");

    toggleInteractionLoader(true, "Logging intent...");
    
    // Auto-resolve user territory scope
    let scopeStr = "Global Access";
    if (STATE_CACHE.assignedFields) {
        try {
            let obj = typeof STATE_CACHE.assignedFields === 'string' ? JSON.parse(STATE_CACHE.assignedFields) : STATE_CACHE.assignedFields;
            if(obj.units && obj.units.length > 0) scopeStr = `Unit: ${obj.units[0]}`;
            else if(obj.panchayats && obj.panchayats.length > 0) scopeStr = `Panchayat: ${obj.panchayats[0]}`;
            else if(obj.blocks && obj.blocks.length > 0) scopeStr = `Block: ${obj.blocks[0]}`;
            else if(obj.districts && obj.districts.length > 0) scopeStr = `District: ${obj.districts[0]}`;
        } catch(e) {}
    }

    const payload = { 
        tx_id: "TXN-" + Math.floor(10000000 + Math.random() * 90000000), 
        node_path: scopeStr, 
        amount: amt, 
        status: 'PENDING', 
        recorded_by: STATE_CACHE.user 
    };

    try {
        await supa.from('payments').insert([payload]);
        spawnToastNotification("Intent Logged. Awaiting Verification.", "success");
        closeUPIModal(); 
        await fetchFinanceData(); 
    } catch(err) {
        spawnToastNotification("Failed to log payment.", "error");
    }
    toggleInteractionLoader(false);
}

async function updatePaymentStatus(txId, status) {
    if(!confirm(`Mark transaction as ${status}?`)) return;
    toggleInteractionLoader(true, "Updating Ledger...");
    try {
        await supa.from('payments').update({ status: status }).eq('tx_id', txId);
        spawnToastNotification(`Ledger updated to ${status}.`, "success");
        await fetchFinanceData();
    } catch(err) {
        spawnToastNotification("Update failed.", "error");
    }
    toggleInteractionLoader(false);
}

async function deletePaymentRecord(txId) {
    if(!confirm(`WARNING: Erase transaction ${txId} from the ledger?`)) return;
    toggleInteractionLoader(true, "Erasing Ledger Record...");
    try {
        await supa.from('payments').delete().eq('tx_id', txId);
        spawnToastNotification("Record erased.", "success");
        await fetchFinanceData();
    } catch(err) {
        spawnToastNotification("Erase failed.", "error");
    }
    toggleInteractionLoader(false);
}

function exportToCSV() {
    if(filteredPayments.length === 0) return spawnToastNotification("No data to export.", "error");
    const headers = ["Transaction_ID", "Operator", "Territory_Node", "Amount", "Status", "Date"];
    let csvContent = headers.join(",") + "\n";

    filteredPayments.forEach(p => {
        const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A';
        let row = [`"${p.tx_id}"`, `"${p.recorded_by}"`, `"${p.node_path}"`, `"${p.amount}"`, `"${p.status}"`, `"${dateStr}"`];
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `SSF_Ledger_Export.csv`);
    link.click();
}