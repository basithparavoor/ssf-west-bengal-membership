let activeFieldLocks = [];
let structuralHierarchyData = { districts: [], blocks: [], panchayats: [], units: [] };

document.addEventListener('DOMContentLoaded', async () => {
    if (!enforceSession()) return;
    setActiveSidebarLink('settings');
    await initializeSettingsData();
});

// ==========================================
// CORE DATA INIT
// ==========================================
async function initializeSettingsData() {
    toggleInteractionLoader(true, "Synchronizing configurations...");
    try {
        // 1. Fetch User Data
        const { data: userData } = await supa.from('users').select('name, username').eq('username', STATE_CACHE.user).single();
        if(userData) {
            document.getElementById('modProfileName').value = userData.name;
            document.getElementById('modUsername').value = userData.username;
        }

        // 2. Fetch Global Settings
        const { data: settingsData } = await supa.from('settings').select('*');
        if(settingsData) {
            
            // Master Lock Status
            const masterStatus = settingsData.find(s => s.key === 'Status');
            if(masterStatus) {
                const toggle = document.getElementById('globalStateToggle');
                const label = document.getElementById('systemStateLabel');
                toggle.checked = (masterStatus.value === 'ACTIVE');
                label.innerText = `Currently: ${masterStatus.value}`;
                label.className = `text-[10px] font-mono font-bold uppercase tracking-widest block mt-0.5 ${masterStatus.value === 'ACTIVE' ? 'text-emerald-500' : 'text-rose-500'}`;
            }

            // Custom Field Labels
            const customLabels = settingsData.find(s => s.key === 'CustomLabels');
            if(customLabels && customLabels.value) {
                try {
                    const labels = JSON.parse(customLabels.value);
                    document.getElementById('lblDistrict').value = labels.district || 'District';
                    document.getElementById('lblBlock').value = labels.block || 'Block';
                    document.getElementById('lblPanchayat').value = labels.panchayat || 'Panchayat';
                    document.getElementById('lblUnit').value = labels.unit || 'Unit';
                } catch(e) {}
            }

            // Field-Level Locks
            const lockedFieldsData = settingsData.find(s => s.key === 'LockedFields');
            if(lockedFieldsData && lockedFieldsData.value) {
                try {
                    activeFieldLocks = JSON.parse(lockedFieldsData.value) || [];
                } catch(e) { activeFieldLocks = []; }
            }

            // Membership Fees
            const feeData = settingsData.find(s => s.key === 'MembershipFees');
            if(feeData && feeData.value) {
                try {
                    const fees = JSON.parse(feeData.value);
                    document.getElementById('feeState').value = fees.state || 100;
                    document.getElementById('feeDistrict').value = fees.district || 50;
                    document.getElementById('feeBlock').value = fees.block || 30;
                    document.getElementById('feePanchayat').value = fees.panchayat || 30;
                    document.getElementById('feeUnit').value = fees.unit || 30;
                    document.getElementById('feeMember').value = fees.member || 30;
                } catch(e) {}
            }

            // UPI ID
            const upiData = settingsData.find(s => s.key === 'UpiId');
            if(upiData && upiData.value) {
                document.getElementById('upiIdInput').value = upiData.value;
            }
        }

        // 3. Fetch Hierarchy for Lock Dropdowns
        const [dRes, bRes, pRes, uRes] = await Promise.all([
            supa.from('districts').select('*'),
            supa.from('blocks').select('*'),
            supa.from('panchayats').select('*'),
            supa.from('units').select('*')
        ]);
        structuralHierarchyData.districts = dRes.data || [];
        structuralHierarchyData.blocks = bRes.data || [];
        structuralHierarchyData.panchayats = pRes.data || [];
        structuralHierarchyData.units = uRes.data || [];

        syncLockTargets();
        renderActiveLocks();

    } catch(err) {
        spawnToastNotification("Failed to fetch settings.", "error");
    }
    toggleInteractionLoader(false);
}

// ==========================================
// USER CREDENTIAL UPDATES
// ==========================================
async function handleSecurityCredentialUpdate(e) {
    e.preventDefault(); 
    const newName = document.getElementById('modProfileName').value.trim();
    const newUsername = document.getElementById('modUsername').value.trim().toLowerCase();
    const newPass = document.getElementById('modPassword').value;

    if(!newName || !newUsername) return;

    toggleInteractionLoader(true, "Updating security credentials...");
    
    let updatePayload = { name: newName, username: newUsername };

    if (newPass) {
        const msgBuffer = new TextEncoder().encode(newPass);                    
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashed = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        updatePayload.password_hash = hashed;
        updatePayload.plain_password = newPass;
    }

    try {
        const { error } = await supa.from('users').update(updatePayload).eq('username', STATE_CACHE.user);
        if (error) throw error;
        
        spawnToastNotification("Credentials Updated Successfully.", "success");
        
        if(newUsername !== STATE_CACHE.user) {
            setTimeout(() => {
                alert("Username changed. You must log in again with your new credentials.");
                executeSecureLogout();
            }, 1500);
        } else {
            document.getElementById('modPassword').value = '';
        }
    } catch(err) {
        spawnToastNotification("Update failed. Username may be taken.", "error");
    }
    toggleInteractionLoader(false);
}

// ==========================================
// GLOBAL STATUS OVERRIDE
// ==========================================
async function dispatchGlobalStateChange(cb) {
    const newState = cb.checked ? "ACTIVE" : "STOPPED";
    toggleInteractionLoader(true, `Switching global state...`);
    try {
        await supa.from('settings').upsert([{ key: 'Status', value: newState }]);
        await initializeSettingsData();
        spawnToastNotification(`System globally set to ${newState}`, "success");
    } catch(err) {
        spawnToastNotification("Failed to update status.", "error");
        cb.checked = !cb.checked; // Revert visually
    }
    toggleInteractionLoader(false);
}

// ==========================================
// FIELD LABEL CUSTOMIZATION
// ==========================================
async function handleFieldLabelUpdate(e) {
    e.preventDefault();
    const payload = {
        district: document.getElementById('lblDistrict').value.trim() || 'District',
        block: document.getElementById('lblBlock').value.trim() || 'Block',
        panchayat: document.getElementById('lblPanchayat').value.trim() || 'Panchayat',
        unit: document.getElementById('lblUnit').value.trim() || 'Unit'
    };

    toggleInteractionLoader(true, "Updating nomenclature guidelines...");
    try {
        await supa.from('settings').upsert([{ key: 'CustomLabels', value: JSON.stringify(payload) }]);
        spawnToastNotification("Structural Labels Saved.", "success");
    } catch(err) {
        spawnToastNotification("Failed to save labels.", "error");
    }
    toggleInteractionLoader(false);
}

// ==========================================
// MEMBERSHIP FEES & UPI 
// ==========================================
async function handleFeeUpdate(e) {
    e.preventDefault();
    const payload = {
        state: document.getElementById('feeState').value,
        district: document.getElementById('feeDistrict').value,
        block: document.getElementById('feeBlock').value,
        panchayat: document.getElementById('feePanchayat').value,
        unit: document.getElementById('feeUnit').value,
        member: document.getElementById('feeMember').value
    };

    toggleInteractionLoader(true, "Updating fee structure...");
    try {
        await supa.from('settings').upsert([{ key: 'MembershipFees', value: JSON.stringify(payload) }]);
        spawnToastNotification("Membership Fees Updated.", "success");
    } catch(err) {
        spawnToastNotification("Failed to update fees.", "error");
    }
    toggleInteractionLoader(false);
}

async function handleUpiUpdate(e) {
    e.preventDefault();
    const upi = document.getElementById('upiIdInput').value.trim();

    toggleInteractionLoader(true, "Routing payment gateways...");
    try {
        await supa.from('settings').upsert([{ key: 'UpiId', value: upi }]);
        spawnToastNotification("Global UPI ID Updated.", "success");
    } catch(err) {
        spawnToastNotification("Failed to update UPI ID.", "error");
    }
    toggleInteractionLoader(false);
}

// ==========================================
// FIELD-LEVEL DATA LOCKS
// ==========================================
function syncLockTargets() {
    const lvl = document.getElementById('lockLevelSelect').value;
    const tSel = document.getElementById('lockTargetSelect');
    tSel.innerHTML = '';

    let dataset = [];
    if (lvl === 'District') dataset = structuralHierarchyData.districts.map(d => d.district_name);
    else if (lvl === 'Block') dataset = structuralHierarchyData.blocks.map(b => b.block_name);
    else if (lvl === 'Panchayat') dataset = structuralHierarchyData.panchayats.map(p => p.panchayat_name);
    else if (lvl === 'Unit') dataset = structuralHierarchyData.units.map(u => u.unit_name);

    if(dataset.length === 0) {
        tSel.innerHTML = `<option value="">-- No ${lvl}s Found --</option>`;
        tSel.disabled = true;
    } else {
        tSel.disabled = false;
        [...new Set(dataset)].sort().forEach(item => {
            tSel.innerHTML += `<option value="${item}">${item}</option>`;
        });
    }
}

async function applyFieldLock() {
    const lvl = document.getElementById('lockLevelSelect').value;
    const target = document.getElementById('lockTargetSelect').value;
    
    if(!target) return spawnToastNotification("Select a valid target field.", "error");

    if(activeFieldLocks.some(lock => lock.level === lvl && lock.target === target)) {
        return spawnToastNotification("This field is already locked.", "error");
    }

    activeFieldLocks.push({ level: lvl, target: target });
    await saveActiveLocksToDatabase("Field Locked Successfully.");
}

async function removeFieldLock(index) {
    activeFieldLocks.splice(index, 1);
    await saveActiveLocksToDatabase("Field Unlocked Successfully.");
}

async function saveActiveLocksToDatabase(successMsg) {
    toggleInteractionLoader(true, "Updating security locks...");
    try {
        await supa.from('settings').upsert([{ key: 'LockedFields', value: JSON.stringify(activeFieldLocks) }]);
        spawnToastNotification(successMsg, "success");
        renderActiveLocks();
    } catch(err) {
        spawnToastNotification("Failed to update locks.", "error");
    }
    toggleInteractionLoader(false);
}

function renderActiveLocks() {
    const container = document.getElementById('activeLocksContainer');
    container.innerHTML = '';
    
    if(activeFieldLocks.length === 0) {
        container.innerHTML = `<p class="text-[10px] text-slate-400 italic">No specific fields are currently locked.</p>`;
        return;
    }

    activeFieldLocks.forEach((lock, index) => {
        container.innerHTML += `
        <div class="flex justify-between items-center bg-white p-2 rounded-lg border border-rose-100 shadow-sm animate-fade-in-up">
            <div class="flex items-center gap-2 text-[10px]">
                <span class="font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-1.5 py-0.5 rounded">${lock.level}</span>
                <span class="font-bold text-slate-700">${lock.target}</span>
            </div>
            <button onclick="removeFieldLock(${index})" class="w-6 h-6 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-emerald-500 transition-colors"><i class="fa-solid fa-unlock text-[10px]"></i></button>
        </div>`;
    });
}

// ==========================================
// BULK MEMBERSHIP IMPORT TOOLS
// ==========================================
function downloadBulkMembershipTemplate() {
    const headers = ['name', 'father_name', 'dob', 'district', 'block', 'panchayat', 'unit', 'committee_role', 'phone', 'whatsapp', 'ps', 'pin_code'];
    const blob = new Blob([headers.join(",") + "\n"], { type: 'text/csv;charset=utf-8;' });
    const el = document.createElement("a"); 
    el.href = URL.createObjectURL(blob); 
    el.setAttribute("download", "SSF_Bulk_Membership_Template.csv"); 
    el.click();
}

function processBulkMembershipUpload(e) {
    const file = e.target.files[0]; 
    if(!file) return;

    const reader = new FileReader(); 
    toggleInteractionLoader(true, "Ingesting Bulk Database...");
    
    reader.onload = async function(evt) {
        try {
            const lines = evt.target.result.split(/\r?\n/);
            const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
            const rows = [];
            
            if(!headers.includes('name') || !headers.includes('district') || !headers.includes('phone')) {
                throw new Error("Invalid Template format.");
            }

            for(let i=1; i<lines.length; i++) {
                let currentLine = lines[i].trim();
                if(!currentLine) continue;
                
                let cols = currentLine.split(',');
                if(cols.length !== headers.length) continue;

                let rowObj = {};
                headers.forEach((header, index) => {
                    rowObj[header] = cols[index] ? cols[index].trim() : '';
                });

                rowObj.membership_id = "SSF" + Date.now().toString().slice(-6) + Math.floor(Math.random()*1000);
                rowObj.created_by = STATE_CACHE.user;
                rowObj.status = 'ACTIVE';

                rows.push(rowObj);
            }

            if(rows.length > 0) {
                const { error } = await supa.from('memberships').insert(rows);
                if(error) throw error;
                spawnToastNotification(`Successfully ingested ${rows.length} records.`, "success");
            } else {
                spawnToastNotification("File is empty or formatted incorrectly.", "error");
            }
        } catch(err) {
            spawnToastNotification("Import Error. Ensure template headers remain unaltered.", "error");
        }
        toggleInteractionLoader(false);
    }; 
    
    reader.readAsText(file);
    e.target.value = ''; 
}