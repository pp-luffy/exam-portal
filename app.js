// System Boot Sequence Handler
window.addEventListener('load', () => {
    setTimeout(() => {
        const splash = document.getElementById('boot-splash');
        if (splash) {
            splash.style.opacity = '0';
            splash.style.transform = 'scale(1.05)';
            setTimeout(() => { splash.style.display = 'none'; }, 600);
        }
    }, 1600);
});

let gKey = "";
let grKey = "";
let orKey = "";

const PROVIDER_MODELS = {
    gemini: [
        { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", maxLimit: 75 },
        { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash", maxLimit: 75 },
        { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", maxLimit: 75 },
        { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", maxLimit: 75 },
        { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite", maxLimit: 60 },
        { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite", maxLimit: 60 }
    ],
    groq: [
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", maxLimit: 60 },
        { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", maxLimit: 40 },
        { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", maxLimit: 50 },
        { id: "gemma2-9b-it", name: "Gemma 2 9B", maxLimit: 40 }
    ],
    openrouter: [
        { id: "nvidia/llama-3.1-nemotron-70b-instruct:free", name: "Nemotron 70B (Free)", maxLimit: 80 },
        { id: "meta-llama/llama-3.1-8b-instruct:free", name: "Llama 3.1 8B (Free)", maxLimit: 50 },
        { id: "google/gemma-2-9b-it:free", name: "Gemma 2 9B (Free)", maxLimit: 50 },
        { id: "mistralai/mistral-7b-instruct:free", name: "Mistral 7B (Free)", maxLimit: 50 },
        { id: "qwen/qwen-2.5-7b-instruct:free", name: "Qwen 2.5 7B (Free)", maxLimit: 50 },
        { id: "qwen/qwen-2-72b-instruct:free", name: "Qwen 2 72B (Free)", maxLimit: 80 },
        { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nemotron 3 Ultra", maxLimit: 100 },
        { id: "nvidia/nemotron-3-super:free", name: "Nemotron 3 Super", maxLimit: 100 },
        { id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B", maxLimit: 75 },
        { id: "google/gemma-4-26b-a4b-it:free", name: "Gemma 4 26B", maxLimit: 75 }
    ]
};

document.addEventListener("DOMContentLoaded", function() {
    gKey = localStorage.getItem("GEMINI_KEY") || "";
    grKey = localStorage.getItem("GROQ_KEY") || "";
    orKey = localStorage.getItem("OPENROUTER_KEY") || "";
    const mailId = localStorage.getItem("DEST_MAIL") || "";

    if (document.getElementById('update-mail') && mailId) document.getElementById('update-mail').value = mailId;
    if (document.getElementById('update-gemini') && gKey) document.getElementById('update-gemini').value = gKey;
    if (document.getElementById('update-groq') && grKey) document.getElementById('update-groq').value = grKey;
    if (document.getElementById('update-openrouter') && orKey) document.getElementById('update-openrouter').value = orKey;

    const orgSelect = document.getElementById('org-select');
    if (orgSelect) orgSelect.addEventListener('change', updateModelDropdown);
    
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) modelSelect.addEventListener('change', updateQuotaDisplay);

    updateModelDropdown();

    safeBind('launch-btn', 'click', startExam);
    safeBind('fullscreen-btn', 'click', toggleFullscreen);
    safeBind('bookmark-btn', 'click', toggleBookmark);
    safeBind('prev-btn', 'click', () => navigateQ(-1));
    safeBind('skip-btn', 'click', skipQ);
    safeBind('clear-btn', 'click', clearAnswer);
    safeBind('next-btn', 'click', () => navigateQ(1));
    safeBind('submit-btn', 'click', confirmSubmit);
    safeBind('rev-all-btn', 'click', () => filterReview('all'));
    safeBind('rev-wrong-btn', 'click', () => filterReview('wrong'));
    safeBind('retry-btn', 'click', restartSameQuiz);
    safeBind('new-quiz-btn', 'click', resetExamUI);
    safeBind('clear-vault-btn', 'click', clearVault);
    safeBind('send-chat-btn', 'click', sendChat);
    safeBind('save-tokens-btn', 'click', updateTokens);
    safeBind('export-btn', 'click', exportLocalStorage);

    const langSelect = document.getElementById('lang');
    if (langSelect) langSelect.addEventListener('change', enforceLanguageConstraints);

    const countInput = document.getElementById('count');
    if (countInput) {
        countInput.addEventListener('input', function() {
            const maxVal = parseInt(this.max) || 100;
            if (parseInt(this.value) > maxVal) this.value = maxVal;
            if (parseInt(this.value) < 1 && this.value !== "") this.value = 1;
        });
    }

    const chatInput = document.getElementById('chat-input');
    if (chatInput) chatInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendChat(); });

    renderVault();
});

function safeBind(id, event, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, fn);
}

function updateModelDropdown() {
    const orgSelect = document.getElementById('org-select');
    const modelSelect = document.getElementById('model-select');
    if (!orgSelect || !modelSelect) return;

    const org = orgSelect.value;
    modelSelect.innerHTML = "";
    
    const list = PROVIDER_MODELS[org] || [];
    list.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        modelSelect.appendChild(opt);
    });
    updateQuotaDisplay();
}

function updateQuotaDisplay() {
    const statusVal = document.getElementById('quota-status-val');
    const orgSelect = document.getElementById('org-select');
    const modelSelect = document.getElementById('model-select');
    if (!statusVal || !orgSelect || !modelSelect) return;

    const modelId = modelSelect.value;
    const org = orgSelect.value;
    const cachedQuota = localStorage.getItem(`QUOTA_${modelId}`);

    if (cachedQuota) {
        statusVal.textContent = cachedQuota;
    } else {
        if (org === 'openrouter') statusVal.textContent = "Free Tier: ~20 RPM";
        else if (org === 'groq') statusVal.textContent = "Free Tier: ~30 RPM";
        else statusVal.textContent = "Standard Limits";
    }
    enforceLanguageConstraints();
}

function enforceLanguageConstraints() {
    const modelSelect = document.getElementById('model-select');
    const langSelect = document.getElementById('lang');
    const countInput = document.getElementById('count');
    const countLabel = document.getElementById('count-label');
    const orgSelect = document.getElementById('org-select');
    
    if (!modelSelect || !langSelect || !countInput || !orgSelect) return;

    let baseLimit = 75;
    const list = PROVIDER_MODELS[orgSelect.value] || [];
    const found = list.find(m => m.id === modelSelect.value);
    if (found) baseLimit = found.maxLimit;

    if (langSelect.value === 'Odia') baseLimit = Math.floor(baseLimit * 0.70);

    countInput.max = baseLimit;
    if (countLabel) countLabel.textContent = `Questions (Max ${baseLimit})`;
    if (parseInt(countInput.value) > baseLimit) countInput.value = baseLimit;
}

function updateTokens() {
    const newMail = document.getElementById('update-mail')?.value.trim() || "";
    const newGemini = document.getElementById('update-gemini')?.value.trim() || "";
    const newGroq = document.getElementById('update-groq')?.value.trim() || "";
    const newOpenRouter = document.getElementById('update-openrouter')?.value.trim() || "";
    const msgEl = document.getElementById('token-update-msg');

    try {
        if (newMail) localStorage.setItem("DEST_MAIL", newMail);
        if (newGemini) { localStorage.setItem("GEMINI_KEY", newGemini); gKey = newGemini; }
        if (newGroq) { localStorage.setItem("GROQ_KEY", newGroq); grKey = newGroq; }
        if (newOpenRouter) { localStorage.setItem("OPENROUTER_KEY", newOpenRouter); orKey = newOpenRouter; }
        
        if (msgEl) {
            msgEl.style.display = 'block';
            setTimeout(() => { msgEl.style.display = 'none'; }, 4000);
        } else {
            alert("Configuration saved successfully!");
        }
    } catch(e) { alert("Failed to save configuration: " + e.message); }
}

function switchTab(tab) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav-item').forEach(n => n.classList.remove('active'));
    
    const p = document.getElementById('page-' + tab);
    if(p) p.classList.add('active');
    const n = document.getElementById('nav-' + tab);
    if(n) n.classList.add('active');
    const s = document.getElementById('side-' + tab);
    if(s) s.classList.add('active');
    if(tab === 'vault') renderVault();
}

function exportLocalStorage() {
    const obj = {};
    for(let i=0; i<localStorage.length; i++) {
        const k = localStorage.key(i);
        if(k !== "GEMINI_KEY" && k !== "GROQ_KEY" && k !== "OPENROUTER_KEY") obj[k] = localStorage.getItem(k);
    }
    const a = document.createElement('a');
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj, null, 2));
    a.download = "nexus_backup.json";
    a.click();
}
