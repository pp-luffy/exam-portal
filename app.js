// Global Session State
let currentUser = "";
let isAdmin = false;

// System Boot Sequence & Auth Handler
window.addEventListener('load', () => {
    setTimeout(() => {
        const splash = document.getElementById('boot-splash');
        if (splash) {
            splash.style.opacity = '0';
            splash.style.transform = 'scale(1.05)';
            setTimeout(() => { 
                splash.style.display = 'none'; 
                checkAuth();
            }, 600);
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
        { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B (OpenAI)", maxLimit: 80 },
        { id: "qwen/qwen3.8-27b", name: "Qwen 3.8 27B", maxLimit: 60 },
        { id: "groq/compound", name: "Groq Compound", maxLimit: 75 },
        { id: "groq/compound-mini", name: "Groq Compound Mini", maxLimit: 50 }
    ],
    openrouter: [
        { id: "deepseek/deepseek-chat:free", name: "DeepSeek V3 Chat (Free)", maxLimit: 100 },
        { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (Free)", maxLimit: 75 },
        { id: "deepseek/deepseek-v4-flash:free", name: "DeepSeek V4 Flash", maxLimit: 100 },
        { id: "thinkingmachines/inkling:free", name: "Inkling (Free)", maxLimit: 75 },
        { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nemotron 3 Ultra", maxLimit: 100 },
        { id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B", maxLimit: 75 }
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

    safeBind('login-btn', 'click', handleLogin);
    safeBind('logout-btn', 'click', logout);
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
    
    const loginInput = document.getElementById('login-username');
    if (loginInput) loginInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') handleLogin(); });

    renderVault();
});

function safeBind(id, event, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, fn);
}

function checkAuth() {
    const savedUser = localStorage.getItem("NEXUS_USER");
    if (savedUser) {
        processLogin(savedUser);
    } else {
        document.getElementById('login-screen').style.display = 'flex';
    }
}

function handleLogin() {
    const user = document.getElementById('login-username').value.trim();
    if (!user) {
        alert("Operator ID required.");
        return;
    }
    processLogin(user);
}

function processLogin(user) {
    currentUser = user;
    isAdmin = (user.trim() === "thegodsk");
    localStorage.setItem("NEXUS_USER", user);
    
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    
    const operatorSpan = document.getElementById('active-operator-name');
    if (operatorSpan) operatorSpan.textContent = user;

    applySessionEnvironment();
}

function applySessionEnvironment() {
    const orgSelect = document.getElementById('org-select');
    const diffSelect = document.getElementById('difficulty');

    if (!isAdmin) {
        if (diffSelect) diffSelect.value = "2";
        if (orgSelect) {
            Array.from(orgSelect.options).forEach(opt => {
                opt.style.display = (opt.value === 'gemini') ? 'block' : 'none';
            });
            orgSelect.value = 'gemini';
        }
    } else {
        if (orgSelect) {
            Array.from(orgSelect.options).forEach(opt => {
                opt.style.display = 'block';
            });
        }
    }

    updateModelDropdown();
}

function logout() {
    localStorage.removeItem("NEXUS_USER");
    location.reload();
}

function updateModelDropdown() {
    const orgSelect = document.getElementById('org-select');
    const modelSelect = document.getElementById('model-select');
    if (!orgSelect || !modelSelect) return;

    const org = orgSelect.value;
    modelSelect.innerHTML = "";
    
    let list = PROVIDER_MODELS[org] || [];

    if (!isAdmin) {
        list = (PROVIDER_MODELS['gemini'] || []).slice(0, 2);
    }

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
