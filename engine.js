let currentUser = "";
let isAdmin = false;
const ADMIN_USERS = ["thegodsk", "saikiran"];

// API Key Manager State
let apiKeys = [];

window.addEventListener('load', () => {
    if (window.location.search.includes('mode=exam')) {
        const splash = document.getElementById('boot-splash');
        if (splash) splash.style.display = 'none';
        checkAuth();
        return;
    }

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
        { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B (High Reasoning)", maxLimit: 75 },
        { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B (Ultra Fast)", maxLimit: 60 },
        { id: "qwen/qwen3.8-27b", name: "Qwen 3.8 27B (STEM / Multilingual)", maxLimit: 60 }
    ],
    openrouter: [
        { id: "openrouter/free", name: "Auto Router (Best for Uptime)", maxLimit: 100 },
        { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nemotron 3 Ultra", maxLimit: 100 },
        { id: "poolside/laguna-s-2.1:free", name: "Laguna S 2.1", maxLimit: 75 }
    ],
    deepseek: [] // Models removed temporarily due to balance issues
};

document.addEventListener("DOMContentLoaded", function() {
    loadApiKeys();
    
    const mailId = localStorage.getItem("DEST_MAIL") || "";
    if (document.getElementById('update-mail') && mailId) document.getElementById('update-mail').value = mailId;

    const orgSelect = document.getElementById('org-select');
    if (orgSelect) orgSelect.addEventListener('change', () => updateModelDropdown());
    
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) modelSelect.addEventListener('change', () => updateQuotaDisplay());

    const diffSelect = document.getElementById('difficulty');
    if (diffSelect) diffSelect.addEventListener('change', () => enforceLanguageConstraints());

    const saveTokensBtn = document.getElementById('save-tokens-btn');
    if (saveTokensBtn) saveTokensBtn.addEventListener('click', () => updateTokens());
    
    const addKeyBtn = document.getElementById('add-api-key-btn');
    if (addKeyBtn) addKeyBtn.addEventListener('click', () => addEmptyKeyRow());

    const sendChatBtn = document.getElementById('send-chat-btn');
    if (sendChatBtn) sendChatBtn.addEventListener('click', () => sendChat());

    safeBind('login-btn', 'click', () => handleLogin());
    safeBind('logout-btn', 'click', () => logout());
    safeBind('launch-btn', 'click', () => startExam());
    safeBind('exit-exam-btn', 'click', () => confirmExitExam());
    safeBind('pause-timer-btn', 'click', () => toggleTimerPause());
    safeBind('fullscreen-btn', 'click', () => toggleFullscreen());
    safeBind('bookmark-btn', 'click', () => toggleBookmark());
    safeBind('prev-btn', 'click', () => navigateQ(-1));
    safeBind('skip-btn', 'click', () => skipQ());
    safeBind('clear-btn', 'click', () => clearAnswer());
    safeBind('next-btn', 'click', () => navigateQ(1));
    safeBind('submit-btn', 'click', () => confirmSubmit());
    safeBind('rev-all-btn', 'click', () => filterReview('all'));
    safeBind('rev-wrong-btn', 'click', () => filterReview('wrong'));
    safeBind('retry-btn', 'click', () => restartSameQuiz());
    safeBind('clear-vault-btn', 'click', () => clearVault());
    safeBind('export-btn', 'click', () => exportLocalStorage());

    safeBind('new-quiz-btn', 'click', () => {
        if (window.location.search.includes('mode=exam')) {
            window.close(); 
        } else {
            resetExamUI();
        }
    });

    safeBind('save-vault-json-btn', 'click', () => {
        try {
            mistakeVault = JSON.parse(document.getElementById('vault-json-textarea').value);
            localStorage.setItem("NEXUS_VAULT", JSON.stringify(mistakeVault));
            renderVault();
            alert("Vault JSON Updated Successfully.");
        } catch(e) {
            alert("Invalid JSON format! Please correct errors.");
        }
    });

    const langSelect = document.getElementById('lang');
    if (langSelect) langSelect.addEventListener('change', () => enforceLanguageConstraints());

    const countInput = document.getElementById('count');
    if (countInput) {
        countInput.addEventListener('input', function() {
            if (!isAdmin) {
                const STRICT_LIMIT = 10;
                if (parseInt(this.value) > STRICT_LIMIT) this.value = STRICT_LIMIT;
            }
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

// ==========================================
// API KEY MANAGER (MULTI-KEY SUPPORT)
// ==========================================
function loadApiKeys() {
    try {
        let stored = JSON.parse(localStorage.getItem("NEXUS_API_KEYS"));
        if (Array.isArray(stored) && stored.length > 0) {
            apiKeys = stored;
        } else {
            // Migrate legacy keys if they exist
            apiKeys = [];
            const g = localStorage.getItem("GEMINI_KEY");
            const gr = localStorage.getItem("GROQ_KEY");
            const grv = localStorage.getItem("GROQ_VERIFY_KEY");
            const or = localStorage.getItem("OPENROUTER_KEY");
            const ds = localStorage.getItem("DEEPSEEK_KEY");
            
            if(g) apiKeys.push({ id: Date.now()+1, provider: "gemini", name: "Legacy Gemini", key: g });
            if(gr) apiKeys.push({ id: Date.now()+2, provider: "groq", name: "Legacy Groq", key: gr });
            if(grv) apiKeys.push({ id: Date.now()+3, provider: "groq", name: "Legacy Groq Verify", key: grv });
            if(or) apiKeys.push({ id: Date.now()+4, provider: "openrouter", name: "Legacy OpenRouter", key: or });
            if(ds) apiKeys.push({ id: Date.now()+5, provider: "deepseek", name: "Legacy DeepSeek", key: ds });
            
            if (apiKeys.length > 0) localStorage.setItem("NEXUS_API_KEYS", JSON.stringify(apiKeys));
        }
    } catch(e) { apiKeys = []; }
    renderApiKeysUI();
}

function renderApiKeysUI() {
    const container = document.getElementById('api-keys-container');
    if (!container) return;
    container.innerHTML = "";
    
    if (apiKeys.length === 0) {
        container.innerHTML = "<p style='color: var(--text-muted); font-size: 12px; font-style: italic;'>No API tokens configured. Click '+ Add Token' to begin.</p>";
        return;
    }

    apiKeys.forEach((k, index) => {
        const row = document.createElement('div');
        row.className = "api-key-row";
        row.innerHTML = `
            <select class="key-provider" style="flex: 1; min-width: 120px;" onchange="updateKeyData(${index}, 'provider', this.value)">
                <option value="gemini" ${k.provider==='gemini'?'selected':''}>Gemini</option>
                <option value="groq" ${k.provider==='groq'?'selected':''}>Groq</option>
                <option value="openrouter" ${k.provider==='openrouter'?'selected':''}>OpenRouter</option>
                <option value="deepseek" ${k.provider==='deepseek'?'selected':''}>DeepSeek</option>
            </select>
            <input type="text" placeholder="Identifier Name" value="${k.name}" style="flex: 1; min-width: 120px;" onchange="updateKeyData(${index}, 'name', this.value)">
            <div class="key-input-wrapper">
                <input type="password" id="key-input-${index}" placeholder="API Token" value="${k.key}" onchange="updateKeyData(${index}, 'key', this.value)">
                <div style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); display:flex; gap: 4px;">
                    <button class="key-action-btn" onclick="toggleKeyVisibility(${index})" title="Toggle Visibility">👁</button>
                    <button class="key-action-btn" onclick="copyKey(${index})" title="Copy Token">📋</button>
                    <button class="key-action-btn del" onclick="deleteKey(${index})" title="Delete Token">❌</button>
                </div>
            </div>
        `;
        container.appendChild(row);
    });
}

function addEmptyKeyRow() {
    apiKeys.push({ id: Date.now(), provider: "gemini", name: "New Token", key: "" });
    renderApiKeysUI();
    const container = document.getElementById('api-keys-container');
    container.scrollTop = container.scrollHeight;
}

window.updateKeyData = function(index, field, value) {
    if (apiKeys[index]) apiKeys[index][field] = value;
}

window.toggleKeyVisibility = function(index) {
    const input = document.getElementById(`key-input-${index}`);
    if (input) input.type = input.type === "password" ? "text" : "password";
}

window.copyKey = function(index) {
    if (apiKeys[index] && apiKeys[index].key) {
        navigator.clipboard.writeText(apiKeys[index].key);
        alert(`Token '${apiKeys[index].name}' copied to clipboard.`);
    }
}

window.deleteKey = function(index) {
    if(confirm(`Delete token '${apiKeys[index].name}'?`)) {
        apiKeys.splice(index, 1);
        renderApiKeysUI();
    }
}

function updateTokens() {
    const newMail = document.getElementById('update-mail')?.value.trim() || "";
    try {
        if (newMail !== "") localStorage.setItem("DEST_MAIL", newMail);
        // Filter out empty keys
        apiKeys = apiKeys.filter(k => k.key.trim() !== "");
        localStorage.setItem("NEXUS_API_KEYS", JSON.stringify(apiKeys));
        renderApiKeysUI();

        const msgEl = document.getElementById('token-update-msg');
        if (msgEl) {
            msgEl.style.display = 'block';
            setTimeout(() => { msgEl.style.display = 'none'; }, 4000);
        } else {
            alert("Configuration saved successfully!");
        }
    } catch(e) { alert("Failed to save configuration: " + e.message); }
}

// Random Key Picker
function getRandomKey(provider) {
    const available = apiKeys.filter(k => k.provider === provider && k.key.trim() !== "");
    if (available.length === 0) return null;
    const rnd = available[Math.floor(Math.random() * available.length)];
    return rnd.key.trim();
}

// Ensure the delay can be interrupted instantly by the AbortSignal (Fixes infinite timeout bug)
function cancellableDelay(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new Error("Aborted by operator."));
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error("Aborted by operator."));
        }, { once: true });
    });
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
    const user = document.getElementById('login-username').value.trim().toLowerCase();
    if (!user) {
        alert("Operator ID required.");
        return;
    }
    processLogin(user);
}

function processLogin(user) {
    currentUser = user.toLowerCase();
    isAdmin = ADMIN_USERS.includes(currentUser);
    localStorage.setItem("NEXUS_USER", currentUser);
    
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    
    const operatorSpan = document.getElementById('active-operator-name');
    if (operatorSpan) operatorSpan.textContent = currentUser;

    applySessionEnvironment();

    if (window.location.search.includes('mode=exam')) {
        if (typeof initStandaloneExam === 'function') {
            initStandaloneExam();
        }
    }
}

function loadExamConfig() {
    try {
        const saved = JSON.parse(localStorage.getItem("NEXUS_LAST_CONFIG"));
        if (!saved) return;
        
        if (isAdmin && document.getElementById('org-select')) {
            document.getElementById('org-select').value = saved.org || "gemini";
        }
        
        updateModelDropdown(); 
        
        if (document.getElementById('model-select') && saved.model) document.getElementById('model-select').value = saved.model;
        if (document.getElementById('exam')) document.getElementById('exam').value = saved.exam || "";
        if (document.getElementById('subject')) document.getElementById('subject').value = saved.subject || "";
        if (document.getElementById('topic')) document.getElementById('topic').value = saved.topic || "";
        
        if (isAdmin && document.getElementById('difficulty')) document.getElementById('difficulty').value = saved.difficulty || "2";
        if (document.getElementById('count')) document.getElementById('count').value = saved.count || "10";
        if (document.getElementById('pos-marks')) document.getElementById('pos-marks').value = saved.posMarks || "4";
        if (document.getElementById('neg-marks')) document.getElementById('neg-marks').value = saved.negMarks || "1";
        if (document.getElementById('timer-mins')) document.getElementById('timer-mins').value = saved.timer || "15";
        if (document.getElementById('lang')) document.getElementById('lang').value = saved.lang || "English";
        if (document.getElementById('exam-mode')) document.getElementById('exam-mode').value = saved.examMode || "strict";
        if (isAdmin && document.getElementById('admin-prompt')) document.getElementById('admin-prompt').value = saved.adminPrompt || "";
        
        enforceLanguageConstraints();
    } catch (e) {
        console.warn("Could not load previous config", e);
    }
}

function applySessionEnvironment() {
    const orgSelect = document.getElementById('org-select');
    const diffContainer = document.getElementById('difficulty-container');
    const adminPrompt = document.getElementById('admin-prompt');
    const adminVault = document.getElementById('admin-vault-editor');
    const pauseTimerBtn = document.getElementById('pause-timer-btn');

    if (!isAdmin) {
        if (diffContainer) diffContainer.style.display = 'none';
        if (adminPrompt) adminPrompt.style.display = 'none';
        if (adminVault) adminVault.style.display = 'none';
        if (pauseTimerBtn) pauseTimerBtn.style.display = 'none';
        if (orgSelect) {
            Array.from(orgSelect.options).forEach(opt => {
                opt.style.display = (opt.value === 'gemini') ? 'block' : 'none';
            });
            orgSelect.value = 'gemini';
            orgSelect.disabled = true;
        }
    } else {
        if (diffContainer) diffContainer.style.display = 'block';
        if (adminPrompt) adminPrompt.style.display = 'block';
        if (adminVault) adminVault.style.display = 'block';
        if (pauseTimerBtn) pauseTimerBtn.style.display = 'inline-block';
        if (orgSelect) {
            orgSelect.disabled = false;
            Array.from(orgSelect.options).forEach(opt => {
                opt.style.display = 'block';
            });
        }
    }

    updateModelDropdown();
    loadExamConfig();
}

function logout() {
    localStorage.removeItem("NEXUS_USER");
    location.reload();
}

function confirmExitExam() {
    if (confirm("Are you sure you want to exit the examination? Current progress will be lost.")) {
        if (window.location.search.includes('mode=exam')) {
            window.close(); 
        } else {
            if (typeof cancelActiveRequest === 'function') cancelActiveRequest();
            resetExamUI();
        }
    }
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
        else if (org === 'deepseek') statusVal.textContent = "Native API Limits";
        else statusVal.textContent = "Standard Limits";
    }
    enforceLanguageConstraints();
}

function enforceLanguageConstraints() {
    const countInput = document.getElementById('count');
    const countLabel = document.getElementById('count-label');
    
    if (!countInput) return;

    if (isAdmin) {
        countInput.removeAttribute('max');
        if (countLabel) countLabel.textContent = `Questions (Admin Unlocked)`;
    } else {
        const STRICT_LIMIT = 10;
        countInput.max = STRICT_LIMIT;
        if (countLabel) countLabel.textContent = `Questions (Max ${STRICT_LIMIT})`;
        if (parseInt(countInput.value) > STRICT_LIMIT) countInput.value = STRICT_LIMIT;
    }
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
        if(!["NEXUS_API_KEYS", "GEMINI_KEY", "GROQ_KEY", "OPENROUTER_KEY", "DEEPSEEK_KEY", "GROQ_VERIFY_KEY"].includes(k)) {
            obj[k] = localStorage.getItem(k);
        }
    }
    const a = document.createElement('a');
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj, null, 2));
    a.download = "nexus_backup.json";
    a.click();
}

let currentQuizData = [];
let userAnswers = {};
let userBookmarks = {};
let currentQIndex = 0;
let timerInterval = null;
let secondsLeft = 0;
let totalSecondsTaken = 0;
let mistakeVault = [];
let activeController = null;
let isTimerPaused = false;
let timeTracker = {}; 
let posMark = 4;
let negMark = 1;

try { mistakeVault = JSON.parse(localStorage.getItem("NEXUS_VAULT")) || []; } catch(e) { mistakeVault = []; }

function shuffleQuizOptions(quizData) {
    let clonedData = JSON.parse(JSON.stringify(quizData)); 
    clonedData.forEach(q => {
        if (!q.options || q.options.length === 0) return;
        let mappedOptions = q.options.map((opt, idx) => ({
            text: opt,
            isCorrect: idx === q.correct_option_index
        }));
        for (let i = mappedOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [mappedOptions[i], mappedOptions[j]] = [mappedOptions[j], mappedOptions[i]];
        }
        q.options = mappedOptions.map(m => m.text);
        q.correct_option_index = mappedOptions.findIndex(m => m.isCorrect);
    });
    return clonedData;
}

function clearChatHistory() {
    const box = document.getElementById('chat-box');
    if (box) {
        box.innerHTML = `
            <div class="msg-wrapper ai" style="display: flex; flex-direction: column; align-items: flex-start;">
                <div class="msg ai">Chat history cleared. Ready for new queries.</div>
                <span class="timestamp" style="font-size: 10px; color: var(--text-muted); margin-top: 4px; padding-left: 4px;">Just now</span>
            </div>`;
    }
}

function cancelActiveRequest() {
    if (activeController) {
        activeController.abort();
        activeController = null;
        console.log('[SYSTEM]: Request aborted by operator.');
    }
    resetExamUI();
}

function toggleTimerPause() {
    if (!isAdmin) return;
    isTimerPaused = !isTimerPaused;
    const btn = document.getElementById('pause-timer-btn');
    if (btn) {
        if (isTimerPaused) {
            btn.innerHTML = '▶ Resume';
            btn.style.color = 'var(--neon-yellow)';
            btn.style.borderColor = 'var(--neon-yellow)';
        } else {
            btn.innerHTML = '⏸ Pause';
            btn.style.color = ''; 
            btn.style.borderColor = '';
        }
    }
}

// ==========================================
// PHASE 2: 2-TIER QA VERIFICATION
// ==========================================
async function verifyAndCorrectQuizData(quizData, signal, usedGenKeys = []) {
    const terminal = document.getElementById('terminal');
    
    const allGroqKeys = apiKeys.filter(k => k.provider === "groq" && k.key.trim() !== "").map(k => k.key.trim());
    
    if (allGroqKeys.length === 0) {
        terminal.innerHTML += `<br><span style='color: var(--neon-yellow);'>[WARNING]: Groq API Key required for 2-Tier QA. Skipping QA phase.</span><br>`;
        return quizData; 
    }

    // Smart Key Rotation: Separate Generation from Verification
    let groqVerifyKey = allGroqKeys[0];
    let groqPrimaryKey = allGroqKeys[0];

    if (allGroqKeys.length >= 2) {
        let freshKeys = allGroqKeys.filter(k => !usedGenKeys.includes(k));
        
        if (freshKeys.length >= 2) {
            // Plenty of unused keys (e.g., Phase 1 used OpenRouter)
            groqVerifyKey = freshKeys[0];
            groqPrimaryKey = freshKeys[1];
        } else if (freshKeys.length === 1) {
            // Dedicate the fresh key to the high-volume Tier 1 validation node
            groqVerifyKey = freshKeys[0];
            // Reuse an older key for the lower-volume Tier 2 escalation node
            groqPrimaryKey = allGroqKeys.find(k => k !== groqVerifyKey); 
        } else {
            // All keys were used in Phase 1, spread Tier 1 and Tier 2 across distinct keys
            groqVerifyKey = allGroqKeys[0];
            groqPrimaryKey = allGroqKeys[1];
        }
    }

    const lang = document.getElementById('lang') ? document.getElementById('lang').value : "English";
    const BATCH_SIZE = (lang === 'Odia') ? 10 : 25;

    terminal.innerHTML += `<br><span style='color: var(--neon-cyan);'>[PHASE 2]: Initiating 2-Tier Neural Quality Assurance...</span><br>`;

    let totalCorrections = 0;
    const batches = [];
    for (let i = 0; i < quizData.length; i += BATCH_SIZE) {
        batches.push(quizData.slice(i, i + BATCH_SIZE).map((q, idx) => ({ index: i + idx, ...q })));
    }

    async function sendTier1Verify(chunk, apiKey) {
        const verifyPrompt = `You are a strict QA Audit System for a competitive exam engine. 
Review the following JSON array of multiple-choice questions. Check for factual errors, illogical distractors, or an incorrect 'correct_option_index'.
If ALL questions are 100% accurate, return EXACTLY: {"corrections": []}
If ANY questions are flawed, return a JSON object with a "corrections" array containing the flawed questions and your suggested fixes.
Schema: {"corrections": [{"index": 0, "question": "...", "options": ["...", "..."], "correct_option_index": 0}]}
Array to Audit:\n${JSON.stringify(chunk)}`;

        const payload = { 
            model: "openai/gpt-oss-20b", 
            messages: [{ role: "user", content: verifyPrompt }], 
            temperature: 0.1, 
            max_tokens: 4096,
            response_format: { type: "json_object" }
        };

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(payload), signal: signal
        });
        if (res.status === 429) return { status: 429 };
        if (!res.ok) throw new Error(`Tier 1 HTTP ${res.status}`);
        const data = await res.json();
        return { status: 200, data: JSON.parse(data.choices[0].message.content) };
    }

    async function sendTier2ExpertReview(flaggedItems, apiKey) {
        terminal.innerHTML += `<span style='color: var(--neon-yellow);'>[EXPERT QA]: ${flaggedItems.length} anomaly(s) flagged. Escalating to 120B node...</span><br>`;
        terminal.scrollTop = terminal.scrollHeight;

        const reviewPrompt = `You are an Expert Chief QA Reviewer (120B parameter model).
A preliminary fast QA system flagged the following multiple-choice questions for potential errors.
Review each flagged item carefully. 
- If the original question HAS an issue, FIX IT and return the corrected version.
- If the original question IS PERFECTLY FINE and the fast QA was hallucinating, KEEP the original version intact.
Return ONLY a JSON object with a "corrections" array in this exact schema:
{"corrections": [{"index": <int>, "question": "...", "options": ["..."], "correct_option_index": <int>}]}

Flagged items to review:\n${JSON.stringify(flaggedItems)}`;

        const payload = { 
            model: "openai/gpt-oss-120b", 
            messages: [{ role: "user", content: reviewPrompt }], 
            temperature: 0.1, 
            max_tokens: 4096,
            response_format: { type: "json_object" }
        };

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(payload), signal: signal
        });
        if (res.status === 429) {
            terminal.innerHTML += `<span style='color: var(--neon-red);'>[RATE LIMIT]: 120B node throttled. Retrying escalation in 30s...</span><br>`;
            await cancellableDelay(30000, signal);
            return await sendTier2ExpertReview(flaggedItems, apiKey); 
        }
        if (!res.ok) throw new Error(`Tier 2 HTTP ${res.status}`);
        const data = await res.json();
        return { status: 200, data: JSON.parse(data.choices[0].message.content) };
    }

    for (let i = 0; i < batches.length; i++) {
        terminal.innerHTML += `<span style='color: var(--text-muted);'>[QA]: Scanning Batch ${i+1}/${batches.length} (20B Fast Node)...</span><br>`;
        terminal.scrollTop = terminal.scrollHeight;
        
        let t1Res = await sendTier1Verify(batches[i], groqVerifyKey);
        
        if (t1Res.status === 429) {
            terminal.innerHTML += `<span style='color: var(--neon-yellow);'>[QA WARNING]: Rate limit hit on 20B node. Pausing for 60s...</span><br>`;
            await cancellableDelay(60000, signal);
            i--; // Retry this chunk
            continue;
        }

        if (t1Res.data && t1Res.data.corrections && t1Res.data.corrections.length > 0) {
            let flaggedPayload = t1Res.data.corrections.map(c => {
                let original = batches[i].find(orig => orig.index === c.index);
                return {
                    index: c.index,
                    original_question: original,
                    tier1_suggested_fix: c
                };
            });

            let t2Res = await sendTier2ExpertReview(flaggedPayload, groqPrimaryKey);
            
            if (t2Res.data && t2Res.data.corrections) {
                t2Res.data.corrections.forEach(finalFix => {
                    if (finalFix.index !== undefined && finalFix.index >= 0 && finalFix.index < quizData.length) {
                        quizData[finalFix.index].question = finalFix.question;
                        quizData[finalFix.index].options = finalFix.options;
                        quizData[finalFix.index].correct_option_index = finalFix.correct_option_index;
                        totalCorrections++;
                    }
                });
            }
        }
    }

    if (totalCorrections > 0) {
        terminal.innerHTML += `<br><span style='color: var(--neon-yellow);'>[QA RESOLVED]: Expert 120B node finalized ${totalCorrections} correction(s).</span><br>`;
    } else {
        terminal.innerHTML += `<br><span style='color: var(--neon-green);'>[QA CLEAR]: 0 anomalies confirmed. Assessment locked.</span><br>`;
    }

    return quizData;
}

function prepareExamPortalLaunch(mins, posM, negM) {
    localStorage.setItem("NEXUS_PENDING_EXAM", JSON.stringify({
        quizData: currentQuizData, mins: mins, posMark: posM, negMark: negM
    }));
    
    const terminal = document.getElementById('terminal');
    terminal.innerHTML += `<br><span style='color: var(--neon-green);'>[SYSTEM]: Assessment successfully compiled.</span><br>`;
    
    const launchBtnId = 'launch-portal-btn-' + Date.now();
    terminal.innerHTML += `<br><button id="${launchBtnId}" class="cyber-btn" style="margin-top: 10px; width: 100%;">🚀 ENTER EXAM PORTAL</button>`;
    
    const cancelBtn = document.getElementById('terminal-cancel-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';

    document.getElementById(launchBtnId).addEventListener('click', () => {
        window.open(window.location.pathname + "?mode=exam", "_blank");
        resetExamUI();
    });
}

function initStandaloneExam() {
    const data = JSON.parse(localStorage.getItem("NEXUS_PENDING_EXAM"));
    if (!data) {
        alert("No active exam data found. Returning to dashboard.");
        window.location.href = window.location.pathname;
        return;
    }

    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = 'none';
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) bottomNav.style.display = 'none';
    
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.style.marginLeft = '0';
        mainContent.style.maxWidth = '1400px'; 
        mainContent.style.paddingBottom = '20px';
    }

    currentQuizData = shuffleQuizOptions(data.quizData);
    secondsLeft = data.mins * 60;
    posMark = data.posMark || 1;
    negMark = data.negMark || 0;
    
    totalSecondsTaken = 0;
    userAnswers = {};
    userBookmarks = {};
    currentQIndex = 0;
    timeTracker = {}; 
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageExam = document.getElementById('page-exam');
    if (pageExam) pageExam.classList.add('active');
    
    document.getElementById('exam-setup').style.display = 'none';
    document.getElementById('terminal-screen').style.display = 'none';
    document.getElementById('exam-results').style.display = 'none';
    document.getElementById('exam-active').style.display = 'block';
    
    const headerTitle = document.querySelector('#page-exam .header-title');
    if (headerTitle) headerTitle.style.display = 'none';

    isTimerPaused = false;
    const pBtn = document.getElementById('pause-timer-btn');
    if(pBtn) { pBtn.innerHTML = '⏸ Pause'; pBtn.style.color = ''; pBtn.style.borderColor = ''; }

    buildPalette();
    renderQuestion(currentQIndex);
    startTimer();
}

async function startExam() {
    const org = document.getElementById('org-select').value;
    const availableKeys = apiKeys.filter(k => k.provider === org && k.key.trim() !== "").map(k => k.key.trim());
    
    if (availableKeys.length === 0) {
        alert(`No valid API Key found for ${org.toUpperCase()}! Please add one in the Config tab.`);
        switchTab('settings');
        return;
    }

    const exam = document.getElementById('exam').value.trim();
    const subject = document.getElementById('subject').value.trim();
    const topic = document.getElementById('topic').value.trim();
    const difficulty = isAdmin ? document.getElementById('difficulty').value : "2";

    if (!exam || !subject || !topic) {
        alert("Please fill in the Target Exam Name, Subject Name, and Syllabus Topic.");
        return;
    }

    try {
        localStorage.setItem("NEXUS_LAST_CONFIG", JSON.stringify({
            org: document.getElementById('org-select').value,
            model: document.getElementById('model-select').value,
            exam: exam,
            subject: subject,
            topic: topic,
            difficulty: difficulty,
            count: document.getElementById('count').value,
            posMarks: document.getElementById('pos-marks').value,
            negMarks: document.getElementById('neg-marks').value,
            timer: document.getElementById('timer-mins').value,
            lang: document.getElementById('lang').value,
            examMode: document.getElementById('exam-mode').value,
            adminPrompt: isAdmin && document.getElementById('admin-prompt') ? document.getElementById('admin-prompt').value : ""
        }));
    } catch(e) { console.warn("Failed to cache config", e); }

    document.getElementById('exam-setup').style.display = 'none';
    const terminalScreen = document.getElementById('terminal-screen');
    terminalScreen.style.display = 'block';
    
    const terminal = document.getElementById('terminal');
    terminal.style.display = 'block';
    terminal.innerHTML = "<span style='color: var(--neon-cyan);'>[PHASE 1]: Synthesizing base neural parameters...</span><br>";

    let cancelWrapper = document.getElementById('terminal-cancel-btn');
    if (!cancelWrapper) {
        cancelWrapper = document.createElement('button');
        cancelWrapper.id = 'terminal-cancel-btn';
        cancelWrapper.className = 'cyber-btn danger';
        cancelWrapper.style.cssText = 'margin-top: 16px; padding: 10px; font-size: 12px;';
        cancelWrapper.textContent = '❌ Cancel Generation';
        cancelWrapper.onclick = () => cancelActiveRequest();
        terminalScreen.querySelector('.quantum-loader-wrapper').appendChild(cancelWrapper);
    }
    cancelWrapper.style.display = 'inline-flex';

    const rawModel = document.getElementById('model-select').value;
    const totalCount = parseInt(document.getElementById('count').value);
    const lang = document.getElementById('lang').value;
    const mins = parseInt(document.getElementById('timer-mins').value) || 15;
    const posM = parseFloat(document.getElementById('pos-marks').value) || 1;
    const negM = parseFloat(document.getElementById('neg-marks').value) || 0;
    const adminPromptTxt = isAdmin ? (document.getElementById('admin-prompt').value || "").trim() : "";

    let chunks = [];
    let remaining = totalCount;
    while (remaining > 0) {
        let chunkSize = Math.min(remaining, 25);
        chunks.push(chunkSize);
        remaining -= chunkSize;
    }

    if (activeController) activeController.abort();
    activeController = new AbortController();
    const signal = activeController.signal;

    let allGeneratedQuestions = [];
    let previouslyGeneratedConcepts = [];
    let usedGenKeys = []; // Tracks which keys are burned out by Phase 1

    try {
        for (let i = 0; i < chunks.length; i++) {
            let currentChunkSize = chunks[i];
            
            // Deterministically rotate across all available keys for this org batch-by-batch
            let currentApiKey = availableKeys[i % availableKeys.length];
            if (!usedGenKeys.includes(currentApiKey)) usedGenKeys.push(currentApiKey);

            terminal.innerHTML += `<span style='color: var(--text-muted);'>[BATCH ${i+1}/${chunks.length}]: Requesting${currentChunkSize} questions...</span><br>`;
            terminal.scrollTop = terminal.scrollHeight;

            let prompt = `You are an expert Question Paper Setter for competitive examinations like ${exam}. 
Generate EXACTLY ${currentChunkSize} high-standard questions for the Subject: "${subject}", focusing on the Topic: "${topic}". 
Output language must strictly be ${lang}.
DIFFICULTY LEVEL: Level ${difficulty} out of 5.

CRITICAL INSTRUCTIONS:
1. NO EXPLANATIONS inside the options or question text.
2. The FIRST option in the array (index 0) MUST ALWAYS BE THE CORRECT ANSWER. The system will randomize them later.
3. Formulate highly plausible distractor traps for options 2, 3, and 4.
4. CRITICAL: Do NOT use LaTeX formatting or dollar signs ($) for mathematical symbols. Write all variables and formulas in plain text (e.g., F1 = F2 = sigma * q / 2 * epsilon_0).
5. Set "correct_option_index" strictly to 0 for every single question.`;

            if (previouslyGeneratedConcepts.length > 0) {
                prompt += `\n\nANTI-DUPLICATION RULE:\nYou have already generated the following questions. DO NOT REPEAT THESE CONCEPTS:\n`;
                previouslyGeneratedConcepts.forEach((q, idx) => { prompt += `${idx+1}.${q.substring(0, 100)}...\n`; });
            }

            prompt += `\n\nOutput ONLY a valid JSON array matching this exact format:
[
  {
    "question": "Question text...",
    "options": ["Correct Option", "Distractor 1", "Distractor 2", "Distractor 3"],
    "correct_option_index": 0
  }
]
${adminPromptTxt ? "\n[ADMIN OVERRIDE RULES]:\n" + adminPromptTxt : ""}`;

            let fullResponse = "";

            if (org === 'groq' || org === 'openrouter' || org === 'deepseek') {
                let apiUrl = "https://api.groq.com/openai/v1/chat/completions";
                if (org === 'openrouter') apiUrl = "https://openrouter.ai/api/v1/chat/completions";
                if (org === 'deepseek') apiUrl = "https://api.deepseek.com/chat/completions";

                const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` };
                if (org === 'openrouter') { headers['HTTP-Referer'] = window.location.href; headers['X-Title'] = 'NEXUS OS CBT Suite'; }

                const payload = { model: rawModel, messages: [{ role: "user", content: prompt }], temperature: 0.2, max_tokens: 8192 };
                if (org === 'groq' || org === 'deepseek') payload.response_format = { type: "json_object" };

                const res = await fetch(apiUrl, { method: 'POST', headers: headers, body: JSON.stringify(payload), signal: signal });
                
                if (res.status === 429) {
                    terminal.innerHTML += `<span style='color: var(--neon-yellow);'>[RATE LIMIT]: Pausing for 60s before retrying batch...</span><br>`;
                    await cancellableDelay(60000, signal);
                    i--; 
                    continue;
                }

                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message || `${org.toUpperCase()} HTTP error${res.status}`);
                fullResponse = data.choices[0].message.content;

            } else {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${rawModel}:streamGenerateContent?key=${currentApiKey}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 65536, temperature: 0.2 } }),
                    signal: signal
                });
                
                if (!res.ok) {
                    const errJson = await res.json();
                    throw new Error(errJson.error?.message || `HTTP error ${res.status}`);
                }
                
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    const matches = [...chunk.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g)];
                    for (const m of matches) fullResponse += m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                }
            }

            const match = fullResponse.match(/\[[\s\S]*\]/);
            let parsedChunk = match ? JSON.parse(match[0]) : JSON.parse(fullResponse);
            
            allGeneratedQuestions = allGeneratedQuestions.concat(parsedChunk);
            parsedChunk.forEach(q => previouslyGeneratedConcepts.push(q.question)); 
        }

        currentQuizData = allGeneratedQuestions;
        
        if (typeof isAdmin !== 'undefined' && isAdmin) {
            // Pass the usedGenKeys array into the QA function so it can route around them
            currentQuizData = await verifyAndCorrectQuizData(currentQuizData, signal, usedGenKeys);
        } else {
            terminal.innerHTML += `<br><span style='color: var(--text-muted);'>[SYSTEM]: Neural QA Phase skipped (Standard Operator License). Assessment locked.</span><br>`;
        }
        
        prepareExamPortalLaunch(mins, posM, negM);
        
    } catch (err) {
        if (err.name === 'AbortError' || err.message === 'Aborted by operator.') return;
        terminal.style.color = "var(--neon-red)";
        terminal.innerHTML += `<br><br>[CRITICAL FAILURE]: Generation failed. ${err.message}`;
        setTimeout(() => resetExamUI(), 6000);
    }
}

function buildPalette() {
    const palette = document.getElementById('q-palette');
    if (!palette) return;
    palette.innerHTML = "";
    currentQuizData.forEach((q, i) => {
        palette.innerHTML += `<button class="pal-btn" id="pal-${i}" onclick="jumpToQuestion(${i})">${i + 1}</button>`;
    });
    updatePaletteStates();
}

function updatePaletteStates() {
    currentQuizData.forEach((q, i) => {
        const btn = document.getElementById(`pal-${i}`);
        if (!btn) return;
        btn.className = "pal-btn";
        if (i === currentQIndex) btn.classList.add('current');
        if (userBookmarks[i]) btn.classList.add('bookmarked');
        else if (userAnswers[i] !== undefined) btn.classList.add('answered');
    });
}

function filterPalette(filterType) {
    currentQuizData.forEach((q, i) => {
        const btn = document.getElementById(`pal-${i}`);
        if (!btn) return;
        const isAnswered = userAnswers[i] !== undefined;
        const isBookmarked = userBookmarks[i] === true;
        if (filterType === 'all') btn.style.display = 'flex';
        else if (filterType === 'review') btn.style.display = isBookmarked ? 'flex' : 'none';
        else if (filterType === 'unanswered') btn.style.display = (!isAnswered && !isBookmarked) ? 'flex' : 'none';
    });
}
window.filterPalette = filterPalette; 

function renderQuestion(index) {
    currentQIndex = index;
    const q = currentQuizData[index];
    document.getElementById('q-counter').innerText = `Question ${index + 1} of${currentQuizData.length}`;
    document.getElementById('progress-fill').style.width = `${((index + 1) / currentQuizData.length) * 100}%`;
    document.getElementById('bookmark-badge').innerText = userBookmarks[index] ? "★ Marked for Review" : "";
    
    const qCard = document.getElementById('active-q-text').parentElement;
    qCard.classList.remove('q-transition');
    void qCard.offsetWidth; 
    qCard.classList.add('q-transition');

    document.getElementById('active-q-text').innerText = `${index + 1}.${q.question}`;
    
    const optContainer = document.getElementById('active-options-container');
    optContainer.innerHTML = "";
    q.options.forEach((opt, oIdx) => {
        const isSelected = userAnswers[index] === oIdx ? "selected" : "";
        optContainer.innerHTML += `
            <div class="option-card ${isSelected}" onclick="selectOption(${index},${oIdx})">
                <input type="radio" style="margin-right:12px;" ${isSelected ? "checked" : ""}> 
                <span>${opt}</span>
            </div>`;
    });
    updatePaletteStates();
}

function selectOption(qIdx, oIdx) { 
    userAnswers[qIdx] = oIdx; 
    try {
        localStorage.setItem("NEXUS_ACTIVE_PROGRESS", JSON.stringify({
            quizData: currentQuizData, answers: userAnswers, currentIndex: qIdx, secondsLeft: secondsLeft
        }));
    } catch(e) {}
    renderQuestion(qIdx); 
}

function clearAnswer() { delete userAnswers[currentQIndex]; renderQuestion(currentQIndex); }
function skipQ() { navigateQ(1); }
function toggleBookmark() { userBookmarks[currentQIndex] = !userBookmarks[currentQIndex]; renderQuestion(currentQIndex); }
function navigateQ(dir) { if (currentQIndex + dir >= 0 && currentQIndex + dir < currentQuizData.length) renderQuestion(currentQIndex + dir); }
function jumpToQuestion(idx) { renderQuestion(idx); }

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    const timerDisplay = document.getElementById('timer-display');
    timerDisplay.classList.remove('timer-critical');

    timerInterval = setInterval(() => {
        if (isTimerPaused) return; 
        if (secondsLeft <= 0) { clearInterval(timerInterval); submitExam(); return; }
        
        secondsLeft--; 
        totalSecondsTaken++;
        timeTracker[currentQIndex] = (timeTracker[currentQIndex] || 0) + 1;

        if (secondsLeft <= 60) timerDisplay.classList.add('timer-critical');

        timerDisplay.innerText = `${Math.floor(secondsLeft/60).toString().padStart(2,'0')}:${(secondsLeft%60).toString().padStart(2,'0')}`;
    }, 1000);
}

function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
    else if (document.exitFullscreen) document.exitFullscreen();
}

function confirmSubmit() { if (confirm("Submit examination?")) submitExam(); }

function submitExam() {
    if (timerInterval) clearInterval(timerInterval);
    
    let correct = 0, wrong = 0, skipped = 0;
    
    currentQuizData.forEach((q, i) => {
        const sel = userAnswers[i];
        if (sel === undefined) { skipped++; }
        else if (sel === q.correct_option_index) { correct++; }
        else { wrong++; addToVault(q); }
    });

    const maxMarks = currentQuizData.length * posMark;
    const totalMarks = (correct * posMark) - (wrong * negMark);
    const acc = Math.round((correct / currentQuizData.length) * 100);
    
    const formattedTotal = Number.isInteger(totalMarks) ? totalMarks : totalMarks.toFixed(2);
    const penaltyApplied = Number.isInteger(wrong * negMark) ? (wrong * negMark) : (wrong * negMark).toFixed(2);

    document.getElementById('exam-active').style.display = 'none';
    document.getElementById('exam-results').style.display = 'block';
    
    document.getElementById('score-summary-banner').innerHTML = `
        <div class="score-banner">SCORE: ${formattedTotal} /${maxMarks} <br><span style="font-size: 16px; color: var(--text-muted);">(${acc}% Accuracy)</span></div>
        <div style="display:flex; justify-content:space-around; color:var(--text-muted); font-size:14px; flex-wrap: wrap; gap: 10px;">
            <div>✅ Correct: <strong>${correct}</strong> <span style="color:var(--neon-green);">(+${correct * posMark})</span></div>
            <div>❌ Wrong: <strong>${wrong}</strong> <span style="color:var(--neon-red);">(-${penaltyApplied})</span></div>
            <div>⏭ Skipped: <strong>${skipped}</strong> <span style="color:var(--text-muted);">(0)</span></div>
        </div>`;
        
    renderReviewList('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function filterReview(mode) { renderReviewList(mode); }

function renderReviewList(mode) {
    const container = document.getElementById('review-container');
    container.innerHTML = "";
    
    currentQuizData.forEach((q, i) => {
        const sel = userAnswers[i];
        const isSkipped = sel === undefined;
        const corr = sel === q.correct_option_index;
        
        if (mode === 'wrong' && corr) return;
        
        let statusText = corr ? 'CORRECT' : (isSkipped ? 'SKIPPED' : 'INCORRECT');
        let statusColor = corr ? 'var(--neon-green)' : (isSkipped ? 'var(--neon-yellow)' : 'var(--neon-red)');

        let timeSpent = timeTracker[i] || 0;
        let timeStr = `${Math.floor(timeSpent/60)}m${timeSpent%60}s`;
        let timeTrapHtml = timeSpent >= 120 
            ? `<span style="color: var(--neon-red); font-size: 12px; margin-left: 10px; font-weight:bold;">⚠️ Time Trap (${timeStr})</span>` 
            : `<span style="color: var(--text-muted); font-size: 12px; margin-left: 10px;">⏱ ${timeStr}</span>`;

        let html = `<div class="glass-card" style="border-left: 4px solid ${statusColor}; padding: 18px;">
            <p style="font-weight:700; color:${statusColor}; margin-top:0; display:flex; align-items:center;">Q${i+1}. ${statusText}${timeTrapHtml}</p>
            <p class="q-text" style="font-size:15px;">${q.question}</p>`;
            
        q.options.forEach((opt, oIdx) => {
            let cls = oIdx === q.correct_option_index ? "correct" : (oIdx === sel ? "wrong" : "");
            html += `<div class="option-card ${cls}" style="padding:10px 14px; margin:4px 0; font-size:14px;"><span>${opt}</span></div>`;
        });
        
        container.innerHTML += html + `</div>`;
    });
}

function generateReportHTML() {
    const filter = document.getElementById('export-filter').value;
    let htmlContent = `<html><head><style>body{font-family:sans-serif;padding:20px;background:#f8fafc;color:#0f172a;} .card{background:#fff;border:1px solid #cbd5e1;padding:16px;border-radius:12px;margin-bottom:12px;} .correct{color:#10b981;font-weight:bold;} .wrong{color:#ef4444;font-weight:bold;} .skipped{color:#f59e0b;font-weight:bold;}</style></head><body>`;
    htmlContent += `<h2>NEXUS OS - Assessment Report</h2><hr>`;
    
    currentQuizData.forEach((q, i) => {
        const sel = userAnswers[i];
        const corr = sel === q.correct_option_index;
        if (filter === 'correct' && !corr) return;
        if (filter === 'wrong' && corr) return;

        let statusText = (sel === undefined) ? " [Skipped]" : "";
        let timeSpent = timeTracker[i] || 0;
        let timeStr = ` (Time: ${Math.floor(timeSpent/60)}m${timeSpent%60}s)`;

        htmlContent += `<div class="card">
            <p><strong>Q${i+1}.</strong>${q.question} <span class="skipped">${statusText}</span> <span style="font-size:12px; color:#64748b;">${timeStr}</span></p>
            <ul>`;
        q.options.forEach((opt, oIdx) => {
            let tag = oIdx === q.correct_option_index ? " ✔ [Correct]" : (oIdx === sel ? " ❌ [Your Answer]" : "");
            htmlContent += `<li>${opt}${tag}</li>`;
        });
        htmlContent += `</ul></div>`;
    });
    return htmlContent + `</body></html>`;
}

function downloadAssessmentReport() {
    const format = document.getElementById('export-format').value;
    const html = generateReportHTML();
    if (format === 'pdf') {
        const win = window.open('', '_blank'); win.document.write(html); win.document.close(); win.print();
    } else {
        const blob = new Blob([html], { type: 'text/html' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `nexus_exam_report_${Date.now()}.html`; a.click();
    }
}

function emailAssessmentReport() {
    const mailId = localStorage.getItem("DEST_MAIL") || "";
    if (!mailId) return alert("Destination Mail ID is not set!");
    downloadAssessmentReport();
    setTimeout(() => { window.location.href = `mailto:${mailId}?subject=CBT Report&body=Please find the attached report.`; }, 1500);
}

function restartSameQuiz() { userAnswers = {}; initStandaloneExam(); }

// ==========================================
// SPACED REPETITION SYSTEM (SRS)
// ==========================================
function addToVault(q) {
    let existingItem = mistakeVault.find(v => v.question === q.question);
    if (!existingItem) {
        q.user_failed_at = new Date().toLocaleDateString();
        q.srs_stage = 0; 
        q.next_review_date = Date.now() + 86400000; // Due in 1 Day
        mistakeVault.push(q);
        try { localStorage.setItem("NEXUS_VAULT", JSON.stringify(mistakeVault)); } catch(e){}
    }
}

function renderVault() {
    const c = document.getElementById('vault-container');
    if (!c) return;
    c.innerHTML = "";
    
    const adminJsonBox = document.getElementById('vault-json-textarea');
    if (adminJsonBox) adminJsonBox.value = JSON.stringify(mistakeVault, null, 2);

    if (mistakeVault.length === 0) { c.innerHTML = `<p style="color:var(--neon-green); text-align:center;">Vault is empty.</p>`; return; }
    
    const now = Date.now();
    mistakeVault.sort((a, b) => (a.next_review_date || 0) - (b.next_review_date || 0));

    mistakeVault.forEach((q, idx) => {
        const isDue = now >= (q.next_review_date || 0);
        let dueText = isDue 
            ? `<span style="color:var(--neon-yellow); font-weight:bold;">⚠️ Review Due</span>` 
            : `<span style="color:var(--text-muted);">Next Review: ${new Date(q.next_review_date).toLocaleDateString()}</span>`;
        
        let btnHtml = isDue 
            ? `<button class="cyber-btn" style="padding: 6px 14px; font-size: 11px; margin-top: 14px; width: auto;" onclick="startVaultReview(${idx})">🧠 Review Now</button>`
            : ``;

        c.innerHTML += `<div class="glass-card" id="vault-card-${idx}" style="border-left:4px solid var(--neon-red); padding:16px;">
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; margin-bottom:10px;">
                <p style="font-size:11px; color:var(--neon-red); margin:0; font-weight:bold;">Failed: ${q.user_failed_at} | Level: ${q.srs_stage || 0}</p>
                <p style="font-size:11px; margin:0;">${dueText}</p>
            </div>
            <p class="q-text" style="font-size:15px; margin-bottom:8px;">${q.question}</p>
            ${!isDue ? `<p style="color:var(--neon-green); font-size:14px; margin:0;">✔ ${q.options[q.correct_option_index]}</p>` : ''}
            ${btnHtml}
        </div>`;
    });
}

function startVaultReview(idx) {
    const c = document.getElementById(`vault-card-${idx}`);
    const q = mistakeVault[idx];
    
    let reviewOptions = q.options.map((opt, i) => ({ text: opt, originalIndex: i }));
    reviewOptions.sort(() => Math.random() - 0.5);
    
    let optsHtml = "";
    reviewOptions.forEach((opt) => {
        optsHtml += `<div class="option-card" onclick="submitVaultReview(${idx}, ${opt.originalIndex})" style="padding:10px 14px; font-size:14px; margin:6px 0;">${opt.text}</div>`;
    });

    c.innerHTML = `
        <p style="color:var(--neon-cyan); font-weight:bold; font-size:12px; margin-top:0;">[ ACTIVE SRS RECALL ]</p>
        <p class="q-text" style="font-size:15px; margin-bottom:12px;">${q.question}</p>
        ${optsHtml}
        <button class="cyber-btn secondary" style="margin-top:10px; padding: 6px 12px; font-size:11px; width:auto;" onclick="renderVault()">Cancel</button>
    `;
}

function submitVaultReview(idx, selectedOriginalIdx) {
    const q = mistakeVault[idx];
    if (selectedOriginalIdx === q.correct_option_index) {
        q.srs_stage = (q.srs_stage || 0) + 1;
        const intervals = [1, 3, 7, 14, 30, 90]; 
        const addDays = intervals[Math.min(q.srs_stage, intervals.length - 1)];
        q.next_review_date = Date.now() + (addDays * 86400000);
        alert(`Correct! Moving to SRS Level ${q.srs_stage}. Next review in ${addDays} days.`);
    } else {
        q.srs_stage = 0;
        q.next_review_date = Date.now() + 86400000;
        alert(`Incorrect. The right answer was:\n\n${q.options[q.correct_option_index]}\n\nSRS Level reset to 0. Try again tomorrow.`);
    }
    localStorage.setItem("NEXUS_VAULT", JSON.stringify(mistakeVault));
    renderVault();
}

function clearVault() { if(confirm("Purge vault?")) { mistakeVault = []; localStorage.removeItem("NEXUS_VAULT"); renderVault(); } }

async function sendChat() {
    const chatModelSelect = document.getElementById('chat-model-select');
    const rawModel = chatModelSelect ? chatModelSelect.value : "gemini-3.8-flash";
    
    let org = "gemini";
    if (rawModel.includes(":free")) org = "openrouter";
    else if (rawModel.includes("openai/") || rawModel.includes("qwen/") || rawModel.includes("groq/")) org = "groq";
    else if (rawModel.includes("deepseek-v4")) org = "deepseek";

    let activeKey = getRandomKey(org);
    if (!activeKey) {
        alert(`No valid API Key found for ${org.toUpperCase()}! Please add it in the Config tab.`);
        switchTab('settings');
        return;
    }

    const inp = document.getElementById('chat-input');
    if (!inp) return;
    const msg = inp.value.trim();
    if (!msg) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const box = document.getElementById('chat-box');

    box.innerHTML += `
        <div class="msg-wrapper user" style="display: flex; flex-direction: column; align-items: flex-end;">
            <div class="msg user">${msg}</div>
            <span class="timestamp" style="font-size: 10px; color: var(--text-muted); margin-top: 4px; padding-right: 4px;">${currentTime}</span>
        </div>`;
    
    inp.value = "";
    box.scrollTop = box.scrollHeight;

    const aiWrapperId = 'ai-msg-' + Date.now();
    box.innerHTML += `
        <div id="${aiWrapperId}" class="msg-wrapper ai" style="display: flex; flex-direction: column; align-items: flex-start;">
            <div class="msg ai">Analyzing with ${rawModel}...</div>
            <span class="timestamp" style="font-size: 10px; color: var(--text-muted); margin-top: 4px; padding-left: 4px;">${currentTime}</span>
        </div>`;
    box.scrollTop = box.scrollHeight;
    
    try {
        let resText = "";
        if (org === 'groq' || org === 'openrouter' || org === 'deepseek') {
            let apiUrl = "https://api.groq.com/openai/v1/chat/completions";
            if (org === 'openrouter') apiUrl = "https://openrouter.ai/api/v1/chat/completions";
            if (org === 'deepseek') apiUrl = "https://api.deepseek.com/chat/completions";

            const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeKey}` };
            if (org === 'openrouter') { headers['HTTP-Referer'] = window.location.href; headers['X-Title'] = 'NEXUS OS CBT Suite'; }

            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ 
                    model: rawModel, 
                    messages: [{ role: "user", content: "Tutor: " + msg }],
                    max_tokens: 4096
                })
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || `${org.toUpperCase()} HTTP ${res.status} error`);
            resText = data.choices[0].message.content;
        } else {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${rawModel}:generateContent?key=${activeKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents: [{ parts: [{ text: "Tutor: " + msg }] }],
                    generationConfig: { maxOutputTokens: 4096 }
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status} error`);
            resText = data.candidates[0].content.parts[0].text;
        }

        const wrapper = document.getElementById(aiWrapperId);
        if (wrapper) {
            const finalTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            wrapper.innerHTML = `
                <div class="msg ai">${resText}</div>
                <span class="timestamp" style="font-size: 10px; color: var(--text-muted); margin-top: 4px; padding-left: 4px;">${finalTime}</span>`;
        }
    } catch(e) { 
        const wrapper = document.getElementById(aiWrapperId);
        if (wrapper) {
            wrapper.innerHTML = `
                <div class="msg ai" style="color: var(--neon-red);">[Error]: ${e.message}</div>
                <span class="timestamp" style="font-size: 10px; color: var(--text-muted); margin-top: 4px; padding-left: 4px;">Failed</span>`;
        }
    }
    box.scrollTop = box.scrollHeight;
}

function resetExamUI() {
    if(timerInterval) clearInterval(timerInterval);
    document.getElementById('terminal-screen').style.display = 'none';
    document.getElementById('exam-results').style.display = 'none';
    document.getElementById('exam-active').style.display = 'none';
    document.getElementById('exam-setup').style.display = 'block';

    if (typeof isAdmin !== 'undefined' && !isAdmin) {
        const diffSelect = document.getElementById('difficulty');
        if (diffSelect) diffSelect.value = "2";
    }
}
