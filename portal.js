// Store the active member globally so the download function can access their DOB and Phone
window.currentPortalMember = null;

// ==========================================
// FETCHING LOGIC (ADDED)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('searchForm');
    
    if (searchForm) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const phone = document.getElementById('searchPhone').value.trim();
            const dob = document.getElementById('searchDob').value;
            const btn = document.getElementById('searchBtn');
            const errorMsg = document.getElementById('errorMessage');
            
            const originalBtnText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Searching...';
            btn.disabled = true;
            errorMsg.classList.add('hidden');

            try {
                // Query Supabase for the member based on Phone AND Date of Birth
                const { data, error } = await supa.from('memberships')
                    .select('*')
                    .eq('phone', phone)
                    .eq('dob', dob)
                    .maybeSingle();

                if (error || !data) {
                    errorMsg.innerText = "Identity Not Found. Please check the Phone Number and Date of Birth.";
                    errorMsg.classList.remove('hidden');
                } else {
                    // Hide search form, show result, and render the card
                    document.getElementById('searchSection').classList.add('hidden');
                    document.getElementById('resultSection').classList.remove('hidden');
                    renderPortalCard(data);
                }
            } catch (err) {
                errorMsg.innerText = "Network error connecting to the registry. Please try again.";
                errorMsg.classList.remove('hidden');
            } finally {
                btn.innerHTML = originalBtnText;
                btn.disabled = false;
            }
        });
    }
});

function resetPortal() {
    document.getElementById('searchForm').reset();
    document.getElementById('errorMessage').classList.add('hidden');
    document.getElementById('resultSection').classList.add('hidden');
    document.getElementById('searchSection').classList.remove('hidden');
    window.currentPortalMember = null;
}

// ==========================================
// RENDER & DOWNLOAD LOGIC
// ==========================================
function renderPortalCard(m) {
    window.currentPortalMember = m;
    const container = document.getElementById('cardTargetNode');
    
    // Generate QR Code URL dynamically
    const verifyUrl = window.location.href.replace('portal.html', `verify.html?id=${m.membership_id}`);
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(verifyUrl)}&margin=0`;

    container.innerHTML = `
    <div class="w-full overflow-x-auto custom-scrollbar pb-4" style="text-align: left;">
        <div class="w-max mx-auto p-1">
            
            <div id="digitalCardPrintArea" class="w-[680px] h-[440px] bg-white relative overflow-hidden border border-slate-200 shadow-md rounded-xl flex flex-col" style="background-color: #f8fafc; background-image: radial-gradient(#e2e8f0 1px, transparent 1px); background-size: 20px 20px;">
                
                <div class="flex justify-between items-start pt-6 pl-8">
                    <h1 class="text-[#b91c1c] text-[65px] leading-none tracking-wider font-cooper" style="text-shadow: 2px 2px 0px rgba(0,0,0,0.05);">SSF</h1>
                    <div id="cardPrintRoleBox" class="bg-[#b91c1c] text-white font-bold text-xl px-6 py-2.5 rounded-l-2xl shadow-md uppercase tracking-widest mt-2 whitespace-nowrap">${m.committee_role || 'MEMBERSHIP'}</div>
                </div>

                <div class="px-8 mt-4 flex justify-between gap-6 relative z-10 flex-1">
                    <div class="bg-gradient-to-r from-[#ebd699] to-[#d6bc6d] rounded-2xl p-5 flex-1 shadow-sm text-[15px] font-bold text-slate-900 z-10 relative h-fit">
                        <table class="w-full">
                            <tr><td class="w-24 pb-2 opacity-80">No</td><td class="pb-2">: <span>${m.membership_id}</span></td></tr>
                            <tr><td class="pb-2 opacity-80">Name</td><td class="pb-2 text-[#b91c1c] uppercase">: <span>${m.name}</span></td></tr>
                            <tr><td class="pb-2 opacity-80">S/O</td><td class="pb-2 uppercase">: <span>${m.father_name}</span></td></tr>
                            <tr><td class="pb-2 opacity-80">Unit</td><td class="pb-2 uppercase">: <span>${m.unit}</span></td></tr>
                            <tr><td class="pb-2 opacity-80">Division</td><td class="pb-2 uppercase">: <span>${m.district}</span></td></tr>
                            <tr><td class="pb-2 opacity-80">Mobile</td><td class="pb-2">: <span>${m.phone}</span></td></tr>
                            <tr><td class="pb-0 opacity-80">Blood</td><td class="pb-0 text-[#b91c1c]">: <span>${m.blood_group || 'Unknown'}</span></td></tr>
                        </table>
                    </div>

                    <div class="flex flex-col items-center gap-3 relative z-10 mr-4">
                        <div class="w-[110px] h-[135px] shrink-0 bg-white rounded-[1rem] shadow-md overflow-hidden border-[4px] border-white z-10 relative">
                            <img src="${m.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80'}" crossorigin="anonymous" class="w-full h-full object-cover">
                        </div>
                        <div class="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm w-20 h-20 z-20">
                            <img src="${qrApiUrl}" crossorigin="anonymous" class="w-full h-full object-contain">
                        </div>
                    </div>
                    
                    <div class="absolute right-0 top-0 bottom-0 flex items-center justify-center w-6">
                        <div class="text-[11px] font-bold tracking-widest text-slate-800 transform -rotate-90 whitespace-nowrap">
                            Valid Upto : 2028 December 31
                        </div>
                    </div>
                </div>

                <div class="w-full px-8 pb-3 relative z-20 mt-auto">
                    <div class="flex justify-between items-end mb-2">
                        <div class="flex items-center gap-4">
                            <div class="w-16 h-16 flex items-center justify-center overflow-hidden">
                                <img src="https://corsproxy.io/?https%3A%2F%2Fdrive.google.com%2Fuc%3Fexport%3Dview%26id%3D1HPuNAPX_dq_HY5jAsZaIq9tpSc5tR0sf" crossorigin="anonymous" class="w-full h-full object-contain mix-blend-multiply opacity-90" onerror="this.style.display='none'">
                            </div>
                            <div class="flex flex-col items-center relative min-w-[150px]">
                                <img src="https://corsproxy.io/?https%3A%2F%2Fdrive.google.com%2Fuc%3Fexport%3Dview%26id%3D1-dNg9lxhjaw5HdLexa_1EM0jNYM4KBrB" crossorigin="anonymous" class="h-10 w-auto absolute -top-8 mix-blend-multiply opacity-90" onerror="this.style.display='none'">
                                <span class="font-black text-[13px] text-slate-900 mt-2 z-10">Abdul Rahman Saqafi</span>
                                <span class="text-[9px] font-bold text-slate-600">(General Secretary, SSF West Bengal)</span>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-col items-center border-t border-slate-300/50 pt-2">
                        <h2 class="text-[#b91c1c] font-black text-[22px] tracking-wide font-sans">West Bengal State Sunni Student's Federation</h2>
                        <div class="flex gap-4 text-[9px] font-bold text-slate-600 mt-1">
                            <span class="flex items-center gap-1"><i class="fa-solid fa-location-dot"></i> Students' Centre Kolkata</span>
                            <span class="flex items-center gap-1"><i class="fa-solid fa-globe"></i> www.ssfwestbengal.org</span>
                            <span class="flex items-center gap-1"><i class="fa-solid fa-envelope"></i> ssf.wbstate@gmail.com</span>
                            <span class="flex items-center gap-1"><i class="fa-solid fa-phone"></i> +91 7025 292 136</span>
                        </div>
                        <div class="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Generated On: <span class="text-slate-600 font-black">${new Date().toISOString().split('T')[0]}</span></div>
                    </div>
                </div>
            </div>

        </div>
    </div>
    `;
}

async function downloadDigitalCardAsPDF(event) {
    const m = window.currentPortalMember;
    if(!m || !window.jspdf) return;
    
    const cardNode = document.getElementById('digitalCardPrintArea');
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating Secure PDF...';
    btn.disabled = true;
    
    try {
        const canvas = await html2canvas(cardNode, { 
            scale: 3, 
            useCORS: true, 
            allowTaint: false,
            backgroundColor: "#ffffff",
            width: 680,
            height: 440
        });
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        
        const { jsPDF } = window.jspdf;
        
        const dobYear = m.dob ? new Date(m.dob).getFullYear().toString() : "0000";
        const phoneLast4 = m.phone ? m.phone.slice(-4) : "0000";
        const userPassword = dobYear + phoneLast4;

        const pdf = new jsPDF({ 
            orientation: 'landscape', 
            unit: 'mm', 
            format: [86, 55.65],
            encryption: {
                userPassword: userPassword,
                ownerPassword: userPassword,
                userPermissions: ["print", "copy", "modify", "annot-forms"]
            }
        });
        
        pdf.addImage(imgData, 'JPEG', 0, 0, 86, 55.65);
        pdf.save(`SSF_Card_${m.membership_id}.pdf`);
        
        alert(`Downloaded Successfully!\n\nYour PDF Password is: ${userPassword}`);
    } catch (e) {
        alert("PDF generation failed. Please try again.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}