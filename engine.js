// Using 'var' prevents fatal SyntaxErrors if aspirant.js or notifier.js use the same variable names
var currentUser = "";
var isAdmin = false;
var ADMIN_USERS = ["thegodsk", "saikiran"];

var apiKeys = [];
var currentQuizData = [];
var userAnswers = {};
var userBookmarks = {};
var currentQIndex = 0;
var timerInterval = null;
var secondsLeft = 0;
var totalSecondsTaken = 0;
var mistakeVault = [];
var activeController = null;
var isTimerPaused = false;
var timeTracker = {}; 
var posMark = 4;
var negMark = 1;

try { mistakeVault = JSON.parse(localStorage.getItem("NEXUS_VAULT")) || []; } catch(e) { mistakeVault = []; }

var PROVIDER_MODELS = {
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
        { id: "poolside/laguna-s-2.1:free", name: "Laguna S 2.1 (Fast Logic)", maxLimit: 75 },
        { id: "inclusionai/ling-3.0-flash-fin:free", name: "Ling 3.0 Flash", maxLimit: 75 },
        { id: "nex-agi/nex-n2.5-mini:free", name: "Nex-N2.5 Mini", maxLimit: 75 }
    ],
    deepseek: []
};

document.addEventListener("DOMContentLoaded", function() {
    // 🛡️ AGGRESSIVE FAILSAFE: Force the splash screen to hide after 2.5s no matter what
    var bootFailsafe = setTimeout(function() {
        var s = document.getElementById('boot-splash');
        if (s) s.style.display = 'none';
        window.checkAuth();
    }, 2500);

    try {
        if (window.location.search.includes('mode=exam')) {
            clearTimeout(bootFailsafe);
            var splash = document.getElementById('boot-splash');
            if (splash) splash.style.display = 'none';
            window.checkAuth();
        } else {
            setTimeout(function() {
                clearTimeout(bootFailsafe);
                var splash = document.getElementById('boot-splash');
                if (splash) {
                    splash.style.opacity = '0';
                    splash.style.transform = 'scale(1.05)';
                    setTimeout(function() { 
                        splash.style.display = 'none'; 
                        window.checkAuth();
                    }, 600);
                } else {
                    window.checkAuth();
                }
            }, 1200);
        }
    } catch(err) {
        console.error("Boot sequence error:", err);
        var s = document.getElementById('boot-splash');
        if (s) s.style.display = 'none';
        window.checkAuth();
    }
    
    // Core Initializations
    try { window.loadApiKeys(); } catch(e) { console.error("Key Load Error:", e); }
    
    var mailId = localStorage.getItem("DEST_MAIL") || "";
    var updateMailEl = document.getElementById('update-mail');
    if (updateMailEl && mailId) updateMailEl.value = mailId;

    var countInput = document.getElementById('count');
    if (countInput) {
        countInput.addEventListener('input', function() {
            if (!isAdmin) {
                var STRICT_LIMIT = 10;
                if (parseInt(this.value) > STRICT_LIMIT) this.value = STRICT_LIMIT;
            }
            if (parseInt(this.value) < 1 && this.value !== "") this.value = 1;
        });
    }

    try { window.renderVault(); } catch(e) { console.error("Vault Load Error:", e); }
});

// ==========================================
// GLOBALLY ACCESSIBLE METHODS
// ==========================================

window.checkAuth = function() {
    var savedUser = localStorage.getItem("NEXUS_USER");
    if (savedUser) {
        window.processLogin(savedUser);
    } else {
        var login = document.getElementById('login-screen');
        if (login) login.style.display = 'flex';
    }
};

window.handleLogin = function() {
    var loginInput = document.getElementById('login-username');
    if (!loginInput) return;
    var user = loginInput.value.trim().toLowerCase();
    if (!user) {
        alert("Operator ID required.");
        return;
    }
    window.processLogin(user);
};

window.processLogin = function(user) {
    currentUser = user.toLowerCase();
    isAdmin = ADMIN_USERS.includes(currentUser);
    localStorage.setItem("NEXUS_USER", currentUser);
    
    var login = document.getElementById('login-screen');
    if (login) login.style.display = 'none';
    
    var mainApp = document.getElementById('main-app');
    if (mainApp) mainApp.style.display = 'flex';
    
    var operatorSpan = document.getElementById('active-operator-name');
    if (operatorSpan) operatorSpan.textContent = currentUser;

    window.applySessionEnvironment();

    if (window.location.search.includes('mode=exam')) {
        if (typeof window.initStandaloneExam === 'function') {
            window.initStandaloneExam();
        }
    }
};

window.logout = function() {
    localStorage.removeItem("NEXUS_USER");
    location.reload();
};

window.applySessionEnvironment = function() {
    var orgSelect = document.getElementById('org-select');
    var diffContainer = document.getElementById('difficulty-container');
    var adminPrompt = document.getElementById('admin-prompt');
    var adminVault = document.getElementById('admin-vault-editor');
    var pauseTimerBtn = document.getElementById('pause-timer-btn');

    if (!isAdmin) {
        if (diffContainer) diffContainer.style.display = 'none';
        if (adminPrompt) adminPrompt.style.display = 'none';
        if (adminVault) adminVault.style.display = 'none';
        if (pauseTimerBtn) pauseTimerBtn.style.display = 'none';
        if (orgSelect) {
            Array.from(orgSelect.options).forEach(function(opt) {
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
            Array.from(orgSelect.options).forEach(function(opt) {
                opt.style.display = 'block';
            });
        }
    }

    window.updateModelDropdown();
    window.loadExamConfig();
};

window.loadExamConfig = function() {
    try {
        var saved = JSON.parse(localStorage.getItem("NEXUS_LAST_CONFIG"));
        if (!saved) return;
        
        if (isAdmin && document.getElementById('org-select')) {
            document.getElementById('org-select').value = saved.org || "gemini";
        }
        
        window.updateModelDropdown(); 
        
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
        
        window.enforceLanguageConstraints();
    } catch (e) {
        console.warn("Could not load previous config", e);
    }
};

window.updateModelDropdown = function() {
    var orgSelect = document.getElementById('org-select');
    var modelSelect = document.getElementById('model-select');
    if (!orgSelect || !modelSelect) return;

    var org = orgSelect.value;
    modelSelect.innerHTML = "";
    
    var list = PROVIDER_MODELS[org] || [];
    if (!isAdmin) list = (PROVIDER_MODELS['gemini'] || []).slice(0, 2);

    list.forEach(function(m) {
        var opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        modelSelect.appendChild(opt);
    });

    window.updateQuotaDisplay();
};

window.updateQuotaDisplay = function() {
    var statusVal = document.getElementById('quota-status-val');
    var orgSelect = document.getElementById('org-select');
    var modelSelect = document.getElementById('model-select');
    if (!statusVal || !orgSelect || !modelSelect) return;

    var modelId = modelSelect.value;
    var org = orgSelect.value;
    var cachedQuota = localStorage.getItem("QUOTA_" + modelId);

    if (cachedQuota) {
        statusVal.textContent = cachedQuota;
    } else {
        if (org === 'openrouter') statusVal.textContent = "Free Tier: ~20 RPM";
        else if (org === 'groq') statusVal.textContent = "Free Tier: ~30 RPM";
        else if (org === 'deepseek') statusVal.textContent = "Native API Limits";
        else statusVal.textContent = "Standard Limits";
    }
    window.enforceLanguageConstraints();
};

window.enforceLanguageConstraints = function() {
    var countInput = document.getElementById('count');
    var countLabel = document.getElementById('count-label');
    if (!countInput) return;

    if (isAdmin) {
        countInput.removeAttribute('max');
        if (countLabel) countLabel.textContent = "Questions (Admin Unlocked)";
    } else {
        var STRICT_LIMIT = 10;
        countInput.max = STRICT_LIMIT;
        if (countLabel) countLabel.textContent = "Questions (Max " + STRICT_LIMIT + ")";
        if (parseInt(countInput.value) > STRICT_LIMIT) countInput.value = STRICT_LIMIT;
    }
};

window.switchTab = function(tab) {
    document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
    document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
    document.querySelectorAll('.sidebar-nav-item').forEach(function(n) { n.classList.remove('active'); });
    
    var p = document.getElementById('page-' + tab);
    if(p) p.classList.add('active');
    var n = document.getElementById('nav-' + tab);
    if(n) n.classList.add('active');
    var s = document.getElementById('side-' + tab);
    if(s) s.classList.add('active');
    if(tab === 'vault') window.renderVault();
};

window.exportLocalStorage = function() {
    var obj = {};
    for(var i=0; i<localStorage.length; i++) {
        var k = localStorage.key(i);
        if(!["NEXUS_API_KEYS", "GEMINI_KEY", "GROQ_KEY", "OPENROUTER_KEY", "DEEPSEEK_KEY", "GROQ_VERIFY_KEY"].includes(k)) {
            obj[k] = localStorage.getItem(k);
        }
    }
    var a = document.createElement('a');
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj, null, 2));
    a.download = "nexus_backup.json";
    a.click();
};

// ==========================================
// API KEY MANAGER (MULTI-KEY SUPPORT)
// ==========================================
window.loadApiKeys = function() {
    try {
        var stored = JSON.parse(localStorage.getItem("NEXUS_API_KEYS"));
        if (Array.isArray(stored) && stored.length > 0) {
            apiKeys = stored;
        } else {
            apiKeys = [];
            var g = localStorage.getItem("GEMINI_KEY");
            var gr = localStorage.getItem("GROQ_KEY");
            var grv = localStorage.getItem("GROQ_VERIFY_KEY");
            var or = localStorage.getItem("OPENROUTER_KEY");
            var ds = localStorage.getItem("DEEPSEEK_KEY");
            
            if(g) apiKeys.push({ id: Date.now()+1, provider: "gemini", name: "Legacy Gemini", key: g });
            if(gr) apiKeys.push({ id: Date.now()+2, provider: "groq", name: "Legacy Groq", key: gr });
            if(grv) apiKeys.push({ id: Date.now()+3, provider: "groq", name: "Legacy Groq Verify", key: grv });
            if(or) apiKeys.push({ id: Date.now()+4, provider: "openrouter", name: "Legacy OpenRouter", key: or });
            if(ds) apiKeys.push({ id: Date.now()+5, provider: "deepseek", name: "Legacy DeepSeek", key: ds });
            
            if (apiKeys.length > 0) localStorage.setItem("NEXUS_API_KEYS", JSON.stringify(apiKeys));
        }
    } catch(e) { apiKeys = []; }
    window.renderApiKeysUI();
};

window.syncKeysFromDOM = function() {
    var container = document.getElementById('api-keys-container');
    if (!container) return;
    var rows = container.querySelectorAll('.api-key-row');
    var synced = [];
    rows.forEach(function(row, i) {
        var providerNode = row.querySelector('.key-provider');
        var nameNode = row.querySelector('.key-name');
        var keyNode = row.querySelector('.key-input');
        
        var provider = providerNode ? providerNode.value : 'gemini';
        var name = nameNode ? nameNode.value : 'Token';
        var key = keyNode ? keyNode.value : '';
        
        synced.push({
            id: apiKeys[i] ? apiKeys[i].id : (Date.now() + i),
            provider: provider,
            name: name,
            key: key
        });
    });
    if (synced.length > 0) {
        apiKeys = synced;
    }
};

window.renderApiKeysUI = function() {
    var container = document.getElementById('api-keys-container');
    if (!container) return;
    container.innerHTML = "";
    
    if (apiKeys.length === 0) {
        container.innerHTML = "<p style='color: var(--text-muted); font-size: 12px; font-style: italic;'>No API tokens configured. Click '+ Add Token' to begin.</p>";
        return;
    }

    apiKeys.forEach(function(k, index) {
        var row = document.createElement('div');
        row.className = "api-key-row";
        
        var selGemini = k.provider === 'gemini' ? 'selected' : '';
        var selGroq = k.provider === 'groq' ? 'selected' : '';
        var selOpenRouter = k.provider === 'openrouter' ? 'selected' : '';
        var selDeepSeek = k.provider === 'deepseek' ? 'selected' : '';
        
        var keyName = k.name || '';
        var keyValue = k.key || '';
        
        row.innerHTML = 
            '<select class="key-provider" style="flex: 1; min-width: 120px;" onchange="window.updateKeyData(' + index + ', \'provider\', this.value)">' +
                '<option value="gemini" ' + selGemini + '>Gemini</option>' +
                '<option value="groq" ' + selGroq + '>Groq</option>' +
                '<option value="openrouter" ' + selOpenRouter + '>OpenRouter</option>' +
                '<option value="deepseek" ' + selDeepSeek + '>DeepSeek</option>' +
            '</select>' +
            '<input type="text" class="key-name" placeholder="Identifier Name" value="' + keyName + '" style="flex: 1; min-width: 120px;" oninput="window.updateKeyData(' + index + ', \'name\', this.value)">' +
            '<div class="key-input-wrapper">' +
                '<input type="password" class="key-input" id="key-input-' + index + '" placeholder="API Token" value="' + keyValue + '" oninput="window.updateKeyData(' + index + ', \'key\', this.value)">' +
                '<div style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); display:flex; gap: 4px;">' +
                    '<button type="button" class="key-action-btn" onclick="window.toggleKeyVisibility(' + index + ')" title="Toggle Visibility">👁</button>' +
                    '<button type="button" class="key-action-btn" onclick="window.copyKey(' + index + ')" title="Copy Token">📋</button>' +
                    '<button type="button" class="key-action-btn del" onclick="window.deleteKey(' + index + ')" title="Delete Token">❌</button>' +
                '</div>' +
            '</div>';
        container.appendChild(row);
    });
};

window.addEmptyKeyRow = function() {
    window.syncKeysFromDOM();
    apiKeys.push({ id: Date.now(), provider: "gemini", name: "Token " + (apiKeys.length + 1), key: "" });
    window.renderApiKeysUI();
    var container = document.getElementById('api-keys-container');
    if (container) container.scrollTop = container.scrollHeight;
};

window.updateKeyData = function(index, field, value) {
    if (apiKeys[index]) apiKeys[index][field] = value;
};

window.toggleKeyVisibility = function(index) {
    var input = document.getElementById("key-input-" + index);
    if (input) input.type = input.type === "password" ? "text" : "password";
};

window.copyKey = function(index) {
    window.syncKeysFromDOM();
    if (apiKeys[index] && apiKeys[index].key) {
        navigator.clipboard.writeText(apiKeys[index].key);
        alert("Token '" + apiKeys[index].name + "' copied to clipboard.");
    }
};

window.deleteKey = function(index) {
    window.syncKeysFromDOM();
    var nameToDel = apiKeys[index] ? apiKeys[index].name : 'Token';
    if(confirm("Delete token '" + nameToDel + "'?")) {
        apiKeys.splice(index, 1);
        localStorage.setItem("NEXUS_API_KEYS", JSON.stringify(apiKeys));
        window.renderApiKeysUI();
    }
};

window.updateTokens = function() {
    window.syncKeysFromDOM();
    var mailInput = document.getElementById('update-mail');
    var newMail = mailInput ? mailInput.value.trim() : "";
    try {
        if (newMail !== "") localStorage.setItem("DEST_MAIL", newMail);
        apiKeys = apiKeys.filter(function(k) { return (k.key || "").trim() !== ""; });
        localStorage.setItem("NEXUS_API_KEYS", JSON.stringify(apiKeys));
        window.renderApiKeysUI();

        var msgEl = document.getElementById('token-update-msg');
        if (msgEl) {
            msgEl.style.display = 'block';
            setTimeout(function() { msgEl.style.display = 'none'; }, 4000);
        } else {
            alert("Configuration saved successfully!");
        }
    } catch(e) { alert("Failed to save configuration: " + e.message); }
};

window.getRandomKey = function(provider) {
    var available = apiKeys.filter(function(k) { return k.provider === provider && (k.key || "").trim() !== ""; });
    if (available.length === 0) return null;
    var rnd = available[Math.floor(Math.random() * available.length)];
    return rnd.key.trim();
};

window.cancellableDelay = function(ms, signal) {
    return new Promise(function(resolve, reject) {
        if (signal && signal.aborted) return reject(new Error("Aborted by operator."));
        var timer = setTimeout(resolve, ms);
        if(signal) {
            signal.addEventListener('abort', function() {
                clearTimeout(timer);
                reject(new Error("Aborted by operator."));
            }, { once: true });
        }
    });
};

// ==========================================
// EXAM & GENERATION LOGIC
// ==========================================

window.cancelActiveRequest = function() {
    if (activeController) {
        activeController.abort();
        activeController = null;
        console.log('[SYSTEM]: Request aborted by operator.');
    }
    window.resetExamUI();
};

window.startNewQuiz = function() {
    if (window.location.search.includes('mode=exam')) {
        window.close(); 
    } else {
        window.resetExamUI();
    }
};

window.confirmExitExam = function() {
    if (confirm("Are you sure you want to exit the examination? Current progress will be lost.")) {
        if (window.location.search.includes('mode=exam')) {
            window.close(); 
        } else {
            if (typeof window.cancelActiveRequest === 'function') window.cancelActiveRequest();
            window.resetExamUI();
        }
    }
};

window.startExam = async function() {
    var org = document.getElementById('org-select').value;
    var availableKeys = apiKeys.filter(function(k) { return k.provider === org && (k.key || "").trim() !== ""; }).map(function(k) { return k.key.trim(); });
    
    if (availableKeys.length === 0) {
        alert("No valid API Key found for " + org.toUpperCase() + "! Please add one in the Config tab.");
        window.switchTab('settings');
        return;
    }

    var exam = document.getElementById('exam').value.trim();
    var subject = document.getElementById('subject').value.trim();
    var topic = document.getElementById('topic').value.trim();
    var diffNode = document.getElementById('difficulty');
    var difficulty = isAdmin && diffNode ? diffNode.value : "2";

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
    var terminalScreen = document.getElementById('terminal-screen');
    terminalScreen.style.display = 'block';
    
    var terminal = document.getElementById('terminal');
    terminal.style.display = 'block';
    terminal.innerHTML = "<span style='color: var(--neon-cyan);'>[PHASE 1]: Synthesizing base neural parameters...</span><br>";

    var cancelWrapper = document.getElementById('terminal-cancel-btn');
    if (!cancelWrapper) {
        cancelWrapper = document.createElement('button');
        cancelWrapper.id = 'terminal-cancel-btn';
        cancelWrapper.className = 'cyber-btn danger';
        cancelWrapper.style.cssText = 'margin-top: 16px; padding: 10px; font-size: 12px;';
        cancelWrapper.textContent = '❌ Cancel Generation';
        cancelWrapper.onclick = function() { window.cancelActiveRequest(); };
        terminalScreen.querySelector('.quantum-loader-wrapper').appendChild(cancelWrapper);
    }
    cancelWrapper.style.display = 'inline-flex';

    var rawModel = document.getElementById('model-select').value;
    var totalCount = parseInt(document.getElementById('count').value);
    var lang = document.getElementById('lang').value;
    var mins = parseInt(document.getElementById('timer-mins').value) || 15;
    var posM = parseFloat(document.getElementById('pos-marks').value) || 1;
    var negM = parseFloat(document.getElementById('neg-marks').value) || 0;
    var adminPromptNode = document.getElementById('admin-prompt');
    var adminPromptTxt = (isAdmin && adminPromptNode) ? (adminPromptNode.value || "").trim() : "";

    var chunks = [];
    var remaining = totalCount;
    while (remaining > 0) {
        var chunkSize = Math.min(remaining, 25);
        chunks.push(chunkSize);
        remaining -= chunkSize;
    }

    if (activeController) activeController.abort();
    activeController = new AbortController();
    var signal = activeController.signal;

    var allGeneratedQuestions = [];
    var previouslyGeneratedConcepts = [];
    var usedGenKeys = []; 

    try {
        for (var i = 0; i < chunks.length; i++) {
            var currentChunkSize = chunks[i];
            
            var currentApiKey = availableKeys[i % availableKeys.length];
            if (!usedGenKeys.includes(currentApiKey)) usedGenKeys.push(currentApiKey);

            terminal.innerHTML += "<span style='color: var(--text-muted);'>[BATCH " + (i+1) + "/" + chunks.length + "]: Requesting " + currentChunkSize + " questions...</span><br>";
            terminal.scrollTop = terminal.scrollHeight;

            var basePrompt = "You are an expert Question Paper Setter for competitive examinations like " + exam + ".\n" +
                             "Generate EXACTLY " + currentChunkSize + " high-standard questions for the Subject: \"" + subject + "\", focusing on the Topic: \"" + topic + "\".\n" +
                             "Output language must strictly be " + lang + ".\n" +
                             "DIFFICULTY LEVEL: Level " + difficulty + " out of 5.\n\n" +
                             "CRITICAL INSTRUCTIONS:\n" +
                             "1. NO EXPLANATIONS inside the options or question text.\n" +
                             "2. The FIRST option in the array (index 0) MUST ALWAYS BE THE CORRECT ANSWER. The system will randomize them later.\n" +
                             "3. Formulate highly plausible distractor traps for options 2, 3, and 4.\n" +
                             "4. CRITICAL: Do NOT use LaTeX formatting or dollar signs ($) for mathematical symbols. Write all variables and formulas in plain text (e.g., F1 = F2 = sigma * q / 2 * epsilon_0).\n" +
                             "5. Set \"correct_option_index\" strictly to 0 for every single question.";

            if (previouslyGeneratedConcepts.length > 0) {
                basePrompt += "\n\nANTI-DUPLICATION RULE:\nYou have already generated the following questions. DO NOT REPEAT THESE CONCEPTS:\n";
                previouslyGeneratedConcepts.forEach(function(q, idx) { 
                    basePrompt += (idx+1) + ". " + q.substring(0, 100) + "...\n"; 
                });
            }

            basePrompt += "\n\nOutput ONLY a valid JSON array matching this exact format:\n";
            basePrompt += "[\n  {\n    \"question\": \"Question text...\",\n    \"options\": [\"Correct Option\", \"Distractor 1\", \"Distractor 2\", \"Distractor 3\"],\n    \"correct_option_index\": 0\n  }\n]\n";
            
            if (adminPromptTxt) {
                basePrompt += "\n[ADMIN OVERRIDE RULES]:\n" + adminPromptTxt;
            }

            var promptPayload = basePrompt;
            var fullResponse = "";

            if (org === 'groq' || org === 'openrouter' || org === 'deepseek') {
                var apiUrl = "https://api.groq.com/openai/v1/chat/completions";
                if (org === 'openrouter') apiUrl = "https://openrouter.ai/api/v1/chat/completions";
                if (org === 'deepseek') apiUrl = "https://api.deepseek.com/chat/completions";

                var headers = { 'Content-Type': 'application/json', 'Authorization': "Bearer " + currentApiKey };
                if (org === 'openrouter') { headers['HTTP-Referer'] = window.location.href; headers['X-Title'] = 'NEXUS OS CBT Suite'; }

                var payload = { model: rawModel, messages: [{ role: "user", content: promptPayload }], temperature: 0.2, max_tokens: 8192 };
                if (org === 'groq' || org === 'deepseek') payload.response_format = { type: "json_object" };

                var res = await fetch(apiUrl, { method: 'POST', headers: headers, body: JSON.stringify(payload), signal: signal });
                
                if (res.status === 429) {
                    terminal.innerHTML += "<span style='color: var(--neon-yellow);'>[RATE LIMIT]: Pausing for 60s before retrying batch...</span><br>";
                    await window.cancellableDelay(60000, signal);
                    i--; 
                    continue;
                }

                var data = await res.json();
                if (!res.ok) throw new Error((data.error && data.error.message) || (org.toUpperCase() + " HTTP error " + res.status));
                fullResponse = data.choices[0].message.content;

            } else {
                var geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + rawModel + ":streamGenerateContent?key=" + currentApiKey;
                var geminiRes = await fetch(geminiUrl, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: promptPayload }] }], generationConfig: { maxOutputTokens: 65536, temperature: 0.2 } }),
                    signal: signal
                });
                
                if (!geminiRes.ok) {
                    var errJson = await geminiRes.json();
                    throw new Error((errJson.error && errJson.error.message) || ("HTTP error " + geminiRes.status));
                }
                
                var reader = geminiRes.body.getReader();
                var decoder = new TextDecoder();
                while (true) {
                    var readResult = await reader.read();
                    if (readResult.done) break;
                    var chunkText = decoder.decode(readResult.value, { stream: true });
                    var matches = [...chunkText.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g)];
                    for (var mIdx = 0; mIdx < matches.length; mIdx++) {
                        fullResponse += matches[mIdx][1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                    }
                }
            }

            var match = fullResponse.match(/\[[\s\S]*\]/);
            var parsedChunk = match ? JSON.parse(match[0]) : JSON.parse(fullResponse);
            
            allGeneratedQuestions = allGeneratedQuestions.concat(parsedChunk);
            parsedChunk.forEach(function(q) { previouslyGeneratedConcepts.push(q.question); }); 
        }

        currentQuizData = allGeneratedQuestions;
        
        if (typeof isAdmin !== 'undefined' && isAdmin) {
            currentQuizData = await window.verifyAndCorrectQuizData(currentQuizData, signal, usedGenKeys);
        } else {
            terminal.innerHTML += "<br><span style='color: var(--text-muted);'>[SYSTEM]: Neural QA Phase skipped (Standard Operator License). Assessment locked.</span><br>";
        }
        
        window.prepareExamPortalLaunch(mins, posM, negM);
        
    } catch (err) {
        if (err.name === 'AbortError' || err.message === 'Aborted by operator.') return;
        terminal.style.color = "var(--neon-red)";
        terminal.innerHTML += "<br><br>[CRITICAL FAILURE]: Generation failed. " + err.message;
        setTimeout(function() { window.resetExamUI(); }, 6000);
    }
};

window.verifyAndCorrectQuizData = async function(quizData, signal, usedGenKeys) {
    if (!usedGenKeys) usedGenKeys = [];
    var terminal = document.getElementById('terminal');
    var allGroqKeys = apiKeys.filter(function(k) { return k.provider === "groq" && (k.key || "").trim() !== ""; }).map(function(k) { return k.key.trim(); });
    
    if (allGroqKeys.length === 0) {
        terminal.innerHTML += "<br><span style='color: var(--neon-yellow);'>[WARNING]: Groq API Key required for 2-Tier QA. Skipping QA phase.</span><br>";
        return quizData; 
    }

    var groqVerifyKey = allGroqKeys[0];
    var groqPrimaryKey = allGroqKeys[0];

    if (allGroqKeys.length >= 2) {
        var freshKeys = allGroqKeys.filter(function(k) { return !usedGenKeys.includes(k); });
        if (freshKeys.length >= 2) {
            groqVerifyKey = freshKeys[0];
            groqPrimaryKey = freshKeys[1];
        } else if (freshKeys.length === 1) {
            groqVerifyKey = freshKeys[0];
            groqPrimaryKey = allGroqKeys.find(function(k) { return k !== groqVerifyKey; }); 
        } else {
            groqVerifyKey = allGroqKeys[0];
            groqPrimaryKey = allGroqKeys[1];
        }
    }

    var langNode = document.getElementById('lang');
    var langVal = langNode ? langNode.value : "English";
    var BATCH_SIZE = (langVal === 'Odia') ? 10 : 25;

    terminal.innerHTML += "<br><span style='color: var(--neon-cyan);'>[PHASE 2]: Initiating 2-Tier Neural Quality Assurance...</span><br>";

    var totalCorrections = 0;
    var batches = [];
    for (var j = 0; j < quizData.length; j += BATCH_SIZE) {
        var batchSlice = quizData.slice(j, j + BATCH_SIZE).map(function(q, idx) {
            return Object.assign({ index: j + idx }, q);
        });
        batches.push(batchSlice);
    }

    async function sendTier1Verify(chunkArr, apiKey) {
        var verifyPromptText = "You are a strict QA Audit System for a competitive exam engine.\n" +
            "Review the following JSON array of multiple-choice questions. Check for factual errors, illogical distractors, or an incorrect 'correct_option_index'.\n" +
            "If ALL questions are 100% accurate, return EXACTLY: {\"corrections\": []}\n" +
            "If ANY questions are flawed, return a JSON object with a \"corrections\" array containing the flawed questions and your suggested fixes.\n" +
            "Schema: {\"corrections\": [{\"index\": 0, \"question\": \"...\", \"options\": [\"...\", \"...\"], \"correct_option_index\": 0}]}\n" +
            "Array to Audit:\n" + JSON.stringify(chunkArr);

        var verifyPayload = { 
            model: "openai/gpt-oss-20b", 
            messages: [{ role: "user", content: verifyPromptText }], 
            temperature: 0.1, 
            max_tokens: 4096,
            response_format: { type: "json_object" }
        };

        var verifyRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': "Bearer " + apiKey },
            body: JSON.stringify(verifyPayload), signal: signal
        });
        if (verifyRes.status === 429) return { status: 429 };
        if (!verifyRes.ok) throw new Error("Tier 1 HTTP " + verifyRes.status);
        var verifyData = await verifyRes.json();
        return { status: 200, data: JSON.parse(verifyData.choices[0].message.content) };
    }

    async function sendTier2ExpertReview(flaggedItemsArr, apiKey) {
        terminal.innerHTML += "<span style='color: var(--neon-yellow);'>[EXPERT QA]: " + flaggedItemsArr.length + " anomaly(s) flagged. Escalating to 120B node...</span><br>";
        terminal.scrollTop = terminal.scrollHeight;

        var expertPromptText = "You are an Expert Chief QA Reviewer (120B parameter model).\n" +
            "A preliminary fast QA system flagged the following multiple-choice questions for potential errors.\n" +
            "Review each flagged item carefully.\n" +
            "- If the original question HAS an issue, FIX IT and return the corrected version.\n" +
            "- If the original question IS PERFECTLY FINE and the fast QA was hallucinating, KEEP the original version intact.\n" +
            "Return ONLY a JSON object with a \"corrections\" array in this exact schema:\n" +
            "{\"corrections\": [{\"index\": 0, \"question\": \"...\", \"options\": [\"...\"], \"correct_option_index\": 0}]}\n\n" +
            "Flagged items to review:\n" + JSON.stringify(flaggedItemsArr);

        var expertPayload = { 
            model: "openai/gpt-oss-120b", 
            messages: [{ role: "user", content: expertPromptText }], 
            temperature: 0.1, 
            max_tokens: 4096,
            response_format: { type: "json_object" }
        };

        var expertRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': "Bearer " + apiKey },
            body: JSON.stringify(expertPayload), signal: signal
        });
        if (expertRes.status === 429) {
            terminal.innerHTML += "<span style='color: var(--neon-red);'>[RATE LIMIT]: 120B node throttled. Retrying escalation in 30s...</span><br>";
            await window.cancellableDelay(30000, signal);
            return await sendTier2ExpertReview(flaggedItemsArr, apiKey); 
        }
        if (!expertRes.ok) throw new Error("Tier 2 HTTP " + expertRes.status);
        var expertData = await expertRes.json();
        return { status: 200, data: JSON.parse(expertData.choices[0].message.content) };
    }

    for (var b = 0; b < batches.length; b++) {
        terminal.innerHTML += "<span style='color: var(--text-muted);'>[QA]: Scanning Batch " + (b+1) + "/" + batches.length + " (20B Fast Node)...</span><br>";
        terminal.scrollTop = terminal.scrollHeight;
        
        var t1Res = await sendTier1Verify(batches[b], groqVerifyKey);
        
        if (t1Res.status === 429) {
            terminal.innerHTML += "<span style='color: var(--neon-yellow);'>[QA WARNING]: Rate limit hit on 20B node. Pausing for 60s...</span><br>";
            await window.cancellableDelay(60000, signal);
            b--; 
            continue;
        }

        if (t1Res.data && t1Res.data.corrections && t1Res.data.corrections.length > 0) {
            var flaggedPayloadObj = t1Res.data.corrections.map(function(c) {
                var original = batches[b].find(function(orig) { return orig.index === c.index; });
                return {
                    index: c.index,
                    original_question: original,
                    tier1_suggested_fix: c
                };
            });

            var t2Res = await sendTier2ExpertReview(flaggedPayloadObj, groqPrimaryKey);
            
            if (t2Res.data && t2Res.data.corrections) {
                t2Res.data.corrections.forEach(function(finalFix) {
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
        terminal.innerHTML += "<br><span style='color: var(--neon-yellow);'>[QA RESOLVED]: Expert 120B node finalized " + totalCorrections + " correction(s).</span><br>";
    } else {
        terminal.innerHTML += "<br><span style='color: var(--neon-green);'>[QA CLEAR]: 0 anomalies confirmed. Assessment locked.</span><br>";
    }

    return quizData;
};

window.prepareExamPortalLaunch = function(mins, posM, negM) {
    localStorage.setItem("NEXUS_PENDING_EXAM", JSON.stringify({
        quizData: currentQuizData, mins: mins, posMark: posM, negMark: negM
    }));
    
    var terminal = document.getElementById('terminal');
    terminal.innerHTML += "<br><span style='color: var(--neon-green);'>[SYSTEM]: Assessment successfully compiled.</span><br>";
    
    var launchBtnId = 'launch-portal-btn-' + Date.now();
    terminal.innerHTML += "<br><button type=\"button\" id=\"" + launchBtnId + "\" class=\"cyber-btn\" style=\"margin-top: 10px; width: 100%;\" onclick=\"window.open(window.location.pathname + '?mode=exam', '_blank'); window.resetExamUI();\">🚀 ENTER EXAM PORTAL</button>";
    
    var cancelBtn = document.getElementById('terminal-cancel-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';
};

window.initStandaloneExam = function() {
    var dataStr = localStorage.getItem("NEXUS_PENDING_EXAM");
    if (!dataStr) {
        alert("No active exam data found. Returning to dashboard.");
        window.location.href = window.location.pathname;
        return;
    }
    var data = JSON.parse(dataStr);

    var sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = 'none';
    var bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) bottomNav.style.display = 'none';
    
    var mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.style.marginLeft = '0';
        mainContent.style.maxWidth = '1400px'; 
        mainContent.style.paddingBottom = '20px';
    }

    currentQuizData = window.shuffleQuizOptions(data.quizData);
    secondsLeft = data.mins * 60;
    posMark = data.posMark || 1;
    negMark = data.negMark || 0;
    
    totalSecondsTaken = 0;
    userAnswers = {};
    userBookmarks = {};
    currentQIndex = 0;
    timeTracker = {}; 
    
    document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
    var pageExam = document.getElementById('page-exam');
    if (pageExam) pageExam.classList.add('active');
    
    document.getElementById('exam-setup').style.display = 'none';
    document.getElementById('terminal-screen').style.display = 'none';
    document.getElementById('exam-results').style.display = 'none';
    document.getElementById('exam-active').style.display = 'block';
    
    var headerTitle = document.querySelector('#page-exam .header-title');
    if (headerTitle) headerTitle.style.display = 'none';

    isTimerPaused = false;
    var pBtn = document.getElementById('pause-timer-btn');
    if(pBtn) { pBtn.innerHTML = '⏸ Pause'; pBtn.style.color = ''; pBtn.style.borderColor = ''; }

    window.buildPalette();
    window.renderQuestion(currentQIndex);
    window.startTimer();
};

window.shuffleQuizOptions = function(quizData) {
    var clonedData = JSON.parse(JSON.stringify(quizData)); 
    clonedData.forEach(function(q) {
        if (!q.options || q.options.length === 0) return;
        var mappedOptions = q.options.map(function(opt, idx) {
            return {
                text: opt,
                isCorrect: idx === q.correct_option_index
            };
        });
        for (var i = mappedOptions.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = mappedOptions[i];
            mappedOptions[i] = mappedOptions[j];
            mappedOptions[j] = temp;
        }
        q.options = mappedOptions.map(function(m) { return m.text; });
        q.correct_option_index = mappedOptions.findIndex(function(m) { return m.isCorrect; });
    });
    return clonedData;
};

window.buildPalette = function() {
    var palette = document.getElementById('q-palette');
    if (!palette) return;
    palette.innerHTML = "";
    currentQuizData.forEach(function(q, i) {
        palette.innerHTML += "<button type=\"button\" class=\"pal-btn\" id=\"pal-" + i + "\" onclick=\"window.jumpToQuestion(" + i + ")\">" + (i + 1) + "</button>";
    });
    window.updatePaletteStates();
};

window.updatePaletteStates = function() {
    currentQuizData.forEach(function(q, i) {
        var btn = document.getElementById("pal-" + i);
        if (!btn) return;
        btn.className = "pal-btn";
        if (i === currentQIndex) btn.classList.add('current');
        if (userBookmarks[i]) btn.classList.add('bookmarked');
        else if (userAnswers[i] !== undefined) btn.classList.add('answered');
    });
};

window.filterPalette = function(filterType) {
    currentQuizData.forEach(function(q, i) {
        var btn = document.getElementById("pal-" + i);
        if (!btn) return;
        var isAnswered = userAnswers[i] !== undefined;
        var isBookmarked = userBookmarks[i] === true;
        if (filterType === 'all') btn.style.display = 'flex';
        else if (filterType === 'review') btn.style.display = isBookmarked ? 'flex' : 'none';
        else if (filterType === 'unanswered') btn.style.display = (!isAnswered && !isBookmarked) ? 'flex' : 'none';
    });
};

window.renderQuestion = function(index) {
    currentQIndex = index;
    var q = currentQuizData[index];
    document.getElementById('q-counter').innerText = "Question " + (index + 1) + " of " + currentQuizData.length;
    document.getElementById('progress-fill').style.width = (((index + 1) / currentQuizData.length) * 100) + "%";
    document.getElementById('bookmark-badge').innerText = userBookmarks[index] ? "★ Marked for Review" : "";
    
    var qCard = document.getElementById('active-q-text').parentElement;
    qCard.classList.remove('q-transition');
    void qCard.offsetWidth; 
    qCard.classList.add('q-transition');

    document.getElementById('active-q-text').innerText = (index + 1) + ". " + q.question;
    
    var optContainer = document.getElementById('active-options-container');
    optContainer.innerHTML = "";
    q.options.forEach(function(opt, oIdx) {
        var isSelected = userAnswers[index] === oIdx ? "selected" : "";
        var checkedAttr = isSelected ? "checked" : "";
        optContainer.innerHTML += 
            "<div class=\"option-card " + isSelected + "\" onclick=\"window.selectOption(" + index + "," + oIdx + ")\">" +
                "<input type=\"radio\" style=\"margin-right:12px;\" " + checkedAttr + ">" +
                "<span>" + opt + "</span>" +
            "</div>";
    });
    window.updatePaletteStates();
};

window.selectOption = function(qIdx, oIdx) { 
    userAnswers[qIdx] = oIdx; 
    try {
        localStorage.setItem("NEXUS_ACTIVE_PROGRESS", JSON.stringify({
            quizData: currentQuizData, answers: userAnswers, currentIndex: qIdx, secondsLeft: secondsLeft
        }));
    } catch(e) {}
    window.renderQuestion(qIdx); 
};

window.clearAnswer = function() { delete userAnswers[currentQIndex]; window.renderQuestion(currentQIndex); };
window.skipQ = function() { window.navigateQ(1); };
window.toggleBookmark = function() { userBookmarks[currentQIndex] = !userBookmarks[currentQIndex]; window.renderQuestion(currentQIndex); };
window.navigateQ = function(dir) { if (currentQIndex + dir >= 0 && currentQIndex + dir < currentQuizData.length) window.renderQuestion(currentQIndex + dir); };
window.jumpToQuestion = function(idx) { window.renderQuestion(idx); };

window.startTimer = function() {
    if (timerInterval) clearInterval(timerInterval);
    var timerDisplay = document.getElementById('timer-display');
    timerDisplay.classList.remove('timer-critical');

    timerInterval = setInterval(function() {
        if (isTimerPaused) return; 
        if (secondsLeft <= 0) { clearInterval(timerInterval); window.submitExam(); return; }
        
        secondsLeft--; 
        totalSecondsTaken++;
        timeTracker[currentQIndex] = (timeTracker[currentQIndex] || 0) + 1;

        if (secondsLeft <= 60) timerDisplay.classList.add('timer-critical');

        timerDisplay.innerText = Math.floor(secondsLeft/60).toString().padStart(2,'0') + ":" + (secondsLeft%60).toString().padStart(2,'0');
    }, 1000);
};

window.toggleTimerPause = function() {
    if (!isAdmin) return;
    isTimerPaused = !isTimerPaused;
    var btn = document.getElementById('pause-timer-btn');
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
};

window.toggleFullscreen = function() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(function(){});
    else if (document.exitFullscreen) document.exitFullscreen();
};

window.confirmSubmit = function() { if (confirm("Submit examination?")) window.submitExam(); };

window.submitExam = function() {
    if (timerInterval) clearInterval(timerInterval);
    
    var correct = 0, wrong = 0, skipped = 0;
    
    currentQuizData.forEach(function(q, i) {
        var sel = userAnswers[i];
        if (sel === undefined) { skipped++; }
        else if (sel === q.correct_option_index) { correct++; }
        else { wrong++; window.addToVault(q); }
    });

    var maxMarks = currentQuizData.length * posMark;
    var totalMarks = (correct * posMark) - (wrong * negMark);
    var acc = Math.round((correct / currentQuizData.length) * 100);
    
    var formattedTotal = Number.isInteger(totalMarks) ? totalMarks : totalMarks.toFixed(2);
    var penaltyApplied = Number.isInteger(wrong * negMark) ? (wrong * negMark) : (wrong * negMark).toFixed(2);

    document.getElementById('exam-active').style.display = 'none';
    document.getElementById('exam-results').style.display = 'block';
    
    document.getElementById('score-summary-banner').innerHTML = 
        "<div class=\"score-banner\">SCORE: " + formattedTotal + " / " + maxMarks + " <br><span style=\"font-size: 16px; color: var(--text-muted);\">(" + acc + "% Accuracy)</span></div>" +
        "<div style=\"display:flex; justify-content:space-around; color:var(--text-muted); font-size:14px; flex-wrap: wrap; gap: 10px;\">" +
            "<div>✅ Correct: <strong>" + correct + "</strong> <span style=\"color:var(--neon-green);\">(+" + (correct * posMark) + ")</span></div>" +
            "<div>❌ Wrong: <strong>" + wrong + "</strong> <span style=\"color:var(--neon-red);\">(-" + penaltyApplied + ")</span></div>" +
            "<div>⏭ Skipped: <strong>" + skipped + "</strong> <span style=\"color:var(--text-muted);\">(0)</span></div>" +
        "</div>";
        
    window.renderReviewList('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.filterReview = function(mode) { window.renderReviewList(mode); };

window.renderReviewList = function(mode) {
    var container = document.getElementById('review-container');
    container.innerHTML = "";
    
    currentQuizData.forEach(function(q, i) {
        var sel = userAnswers[i];
        var isSkipped = sel === undefined;
        var corr = sel === q.correct_option_index;
        
        if (mode === 'wrong' && corr) return;
        
        var statusText = corr ? 'CORRECT' : (isSkipped ? 'SKIPPED' : 'INCORRECT');
        var statusColor = corr ? 'var(--neon-green)' : (isSkipped ? 'var(--neon-yellow)' : 'var(--neon-red)');

        var timeSpent = timeTracker[i] || 0;
        var timeStr = Math.floor(timeSpent/60) + "m" + (timeSpent%60) + "s";
        var timeTrapHtml = timeSpent >= 120 
            ? "<span style=\"color: var(--neon-red); font-size: 12px; margin-left: 10px; font-weight:bold;\">⚠️ Time Trap (" + timeStr + ")</span>" 
            : "<span style=\"color: var(--text-muted); font-size: 12px; margin-left: 10px;\">⏱ " + timeStr + "</span>";

        var html = "<div class=\"glass-card\" style=\"border-left: 4px solid " + statusColor + "; padding: 18px;\">" +
            "<p style=\"font-weight:700; color:" + statusColor + "; margin-top:0; display:flex; align-items:center;\">Q" + (i+1) + ". " + statusText + timeTrapHtml + "</p>" +
            "<p class=\"q-text\" style=\"font-size:15px;\">" + q.question + "</p>";
            
        q.options.forEach(function(opt, oIdx) {
            var cls = oIdx === q.correct_option_index ? "correct" : (oIdx === sel ? "wrong" : "");
            html += "<div class=\"option-card " + cls + "\" style=\"padding:10px 14px; margin:4px 0; font-size:14px;\"><span>" + opt + "</span></div>";
        });
        
        container.innerHTML += html + "</div>";
    });
};

window.generateReportHTML = function() {
    var filterNode = document.getElementById('export-filter');
    var filter = filterNode ? filterNode.value : 'all';
    var htmlContent = "<html><head><style>body{font-family:sans-serif;padding:20px;background:#f8fafc;color:#0f172a;} .card{background:#fff;border:1px solid #cbd5e1;padding:16px;border-radius:12px;margin-bottom:12px;} .correct{color:#10b981;font-weight:bold;} .wrong{color:#ef4444;font-weight:bold;} .skipped{color:#f59e0b;font-weight:bold;}</style></head><body>";
    htmlContent += "<h2>NEXUS OS - Assessment Report</h2><hr>";
    
    currentQuizData.forEach(function(q, i) {
        var sel = userAnswers[i];
        var corr = sel === q.correct_option_index;
        if (filter === 'correct' && !corr) return;
        if (filter === 'wrong' && corr) return;

        var statusText = (sel === undefined) ? " [Skipped]" : "";
        var timeSpent = timeTracker[i] || 0;
        var timeStr = " (Time: " + Math.floor(timeSpent/60) + "m" + (timeSpent%60) + "s)";

        htmlContent += "<div class=\"card\">" +
            "<p><strong>Q" + (i+1) + ".</strong>" + q.question + " <span class=\"skipped\">" + statusText + "</span> <span style=\"font-size:12px; color:#64748b;\">" + timeStr + "</span></p>" +
            "<ul>";
        q.options.forEach(function(opt, oIdx) {
            var tag = oIdx === q.correct_option_index ? " ✔ [Correct]" : (oIdx === sel ? " ❌ [Your Answer]" : "");
            htmlContent += "<li>" + opt + tag + "</li>";
        });
        htmlContent += "</ul></div>";
    });
    return htmlContent + "</body></html>";
};

window.downloadAssessmentReport = function() {
    var format = document.getElementById('export-format').value;
    var html = window.generateReportHTML();
    if (format === 'pdf') {
        var win = window.open('', '_blank'); win.document.write(html); win.document.close(); win.print();
    } else {
        var blob = new Blob([html], { type: 'text/html' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = "nexus_exam_report_" + Date.now() + ".html"; a.click();
    }
};

window.emailAssessmentReport = function() {
    var mailId = localStorage.getItem("DEST_MAIL") || "";
    if (!mailId) return alert("Destination Mail ID is not set!");
    window.downloadAssessmentReport();
    setTimeout(function() { window.location.href = "mailto:" + mailId + "?subject=CBT Report&body=Please find the attached report."; }, 1500);
};

window.restartSameQuiz = function() { userAnswers = {}; window.initStandaloneExam(); };

window.resetExamUI = function() {
    if(timerInterval) clearInterval(timerInterval);
    document.getElementById('terminal-screen').style.display = 'none';
    document.getElementById('exam-results').style.display = 'none';
    document.getElementById('exam-active').style.display = 'none';
    document.getElementById('exam-setup').style.display = 'block';

    if (typeof isAdmin !== 'undefined' && !isAdmin) {
        var diffSelect = document.getElementById('difficulty');
        if (diffSelect) diffSelect.value = "2";
    }
};

// ==========================================
// VAULT LOGIC
// ==========================================
window.addToVault = function(q) {
    var existingItem = mistakeVault.find(function(v) { return v.question === q.question; });
    if (!existingItem) {
        q.user_failed_at = new Date().toLocaleDateString();
        q.srs_stage = 0; 
        q.next_review_date = Date.now() + 86400000;
        mistakeVault.push(q);
        try { localStorage.setItem("NEXUS_VAULT", JSON.stringify(mistakeVault)); } catch(e){}
    }
};

window.renderVault = function() {
    var c = document.getElementById('vault-container');
    if (!c) return;
    c.innerHTML = "";
    
    var adminJsonBox = document.getElementById('vault-json-textarea');
    if (adminJsonBox) adminJsonBox.value = JSON.stringify(mistakeVault, null, 2);

    if (mistakeVault.length === 0) { c.innerHTML = "<p style=\"color:var(--neon-green); text-align:center;\">Vault is empty.</p>"; return; }
    
    var now = Date.now();
    mistakeVault.sort(function(a, b) { return (a.next_review_date || 0) - (b.next_review_date || 0); });

    mistakeVault.forEach(function(q, idx) {
        var isDue = now >= (q.next_review_date || 0);
        var dueText = isDue 
            ? "<span style=\"color:var(--neon-yellow); font-weight:bold;\">⚠️ Review Due</span>" 
            : "<span style=\"color:var(--text-muted);\">Next Review: " + new Date(q.next_review_date).toLocaleDateString() + "</span>";
        
        var btnHtml = isDue 
            ? "<button type=\"button\" class=\"cyber-btn\" style=\"padding: 6px 14px; font-size: 11px; margin-top: 14px; width: auto;\" onclick=\"window.startVaultReview(" + idx + ")\">🧠 Review Now</button>"
            : "";

        var answerHtml = !isDue 
            ? "<p style=\"color:var(--neon-green); font-size:14px; margin:0;\">✔ " + q.options[q.correct_option_index] + "</p>"
            : "";

        c.innerHTML += "<div class=\"glass-card\" id=\"vault-card-" + idx + "\" style=\"border-left:4px solid var(--neon-red); padding:16px;\">" +
            "<div style=\"display:flex; justify-content:space-between; flex-wrap:wrap; margin-bottom:10px;\">" +
                "<p style=\"font-size:11px; color:var(--neon-red); margin:0; font-weight:bold;\">Failed: " + q.user_failed_at + " | Level: " + (q.srs_stage || 0) + "</p>" +
                "<p style=\"font-size:11px; margin:0;\">" + dueText + "</p>" +
            "</div>" +
            "<p class=\"q-text\" style=\"font-size:15px; margin-bottom:8px;\">" + q.question + "</p>" +
            answerHtml + btnHtml +
        "</div>";
    });
};

window.startVaultReview = function(idx) {
    var c = document.getElementById("vault-card-" + idx);
    var q = mistakeVault[idx];
    
    var reviewOptions = q.options.map(function(opt, i) { return { text: opt, originalIndex: i }; });
    reviewOptions.sort(function() { return Math.random() - 0.5; });
    
    var optsHtml = "";
    reviewOptions.forEach(function(opt) {
        optsHtml += "<div class=\"option-card\" onclick=\"window.submitVaultReview(" + idx + ", " + opt.originalIndex + ")\" style=\"padding:10px 14px; font-size:14px; margin:6px 0;\">" + opt.text + "</div>";
    });

    c.innerHTML = "<p style=\"color:var(--neon-cyan); font-weight:bold; font-size:12px; margin-top:0;\">[ ACTIVE SRS RECALL ]</p>" +
        "<p class=\"q-text\" style=\"font-size:15px; margin-bottom:12px;\">" + q.question + "</p>" +
        optsHtml +
        "<button type=\"button\" class=\"cyber-btn secondary\" style=\"margin-top:10px; padding: 6px 12px; font-size:11px; width:auto;\" onclick=\"window.renderVault()\">Cancel</button>";
};

window.submitVaultReview = function(idx, selectedOriginalIdx) {
    var q = mistakeVault[idx];
    if (selectedOriginalIdx === q.correct_option_index) {
        q.srs_stage = (q.srs_stage || 0) + 1;
        var intervals = [1, 3, 7, 14, 30, 90]; 
        var addDays = intervals[Math.min(q.srs_stage, intervals.length - 1)];
        q.next_review_date = Date.now() + (addDays * 86400000);
        alert("Correct! Moving to SRS Level " + q.srs_stage + ". Next review in " + addDays + " days.");
    } else {
        q.srs_stage = 0;
        q.next_review_date = Date.now() + 86400000;
        alert("Incorrect. The right answer was:\n\n" + q.options[q.correct_option_index] + "\n\nSRS Level reset to 0. Try again tomorrow.");
    }
    localStorage.setItem("NEXUS_VAULT", JSON.stringify(mistakeVault));
    window.renderVault();
};

window.clearVault = function() { if(confirm("Purge vault?")) { mistakeVault = []; localStorage.removeItem("NEXUS_VAULT"); window.renderVault(); } };

window.saveVaultJson = function() {
    try {
        mistakeVault = JSON.parse(document.getElementById('vault-json-textarea').value);
        localStorage.setItem("NEXUS_VAULT", JSON.stringify(mistakeVault));
        window.renderVault();
        alert("Vault JSON Updated Successfully.");
    } catch(e) {
        alert("Invalid JSON format! Please correct errors.");
    }
};

window.clearChatHistory = function() {
    var box = document.getElementById('chat-box');
    if (box) {
        box.innerHTML = "<div class=\"msg-wrapper ai\" style=\"display: flex; flex-direction: column; align-items: flex-start;\">" +
            "<div class=\"msg ai\">Chat history cleared. Ready for new queries.</div>" +
            "<span class=\"timestamp\" style=\"font-size: 10px; color: var(--text-muted); margin-top: 4px; padding-left: 4px;\">Just now</span>" +
        "</div>";
    }
};

window.sendChat = async function() {
    var chatModelSelect = document.getElementById('chat-model-select');
    var rawModel = chatModelSelect ? chatModelSelect.value : "gemini-3.8-flash";
    
    var org = "gemini";
    if (rawModel.includes(":free")) org = "openrouter";
    else if (rawModel.includes("openai/") || rawModel.includes("qwen/") || rawModel.includes("groq/")) org = "groq";
    else if (rawModel.includes("deepseek-v4")) org = "deepseek";

    var activeKey = window.getRandomKey(org);
    if (!activeKey) {
        alert("No valid API Key found for " + org.toUpperCase() + "! Please add it in the Config tab.");
        window.switchTab('settings');
        return;
    }

    var inp = document.getElementById('chat-input');
    if (!inp) return;
    var msg = inp.value.trim();
    if (!msg) return;

    var currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    var box = document.getElementById('chat-box');

    box.innerHTML += "<div class=\"msg-wrapper user\" style=\"display: flex; flex-direction: column; align-items: flex-end;\">" +
        "<div class=\"msg user\">" + msg + "</div>" +
        "<span class=\"timestamp\" style=\"font-size: 10px; color: var(--text-muted); margin-top: 4px; padding-right: 4px;\">" + currentTime + "</span>" +
    "</div>";
    
    inp.value = "";
    box.scrollTop = box.scrollHeight;

    var aiWrapperId = 'ai-msg-' + Date.now();
    box.innerHTML += "<div id=\"" + aiWrapperId + "\" class=\"msg-wrapper ai\" style=\"display: flex; flex-direction: column; align-items: flex-start;\">" +
        "<div class=\"msg ai\">Analyzing with " + rawModel + "...</div>" +
        "<span class=\"timestamp\" style=\"font-size: 10px; color: var(--text-muted); margin-top: 4px; padding-left: 4px;\">" + currentTime + "</span>" +
    "</div>";
    box.scrollTop = box.scrollHeight;
    
    try {
        var resText = "";
        if (org === 'groq' || org === 'openrouter' || org === 'deepseek') {
            var apiUrl = "https://api.groq.com/openai/v1/chat/completions";
            if (org === 'openrouter') apiUrl = "https://openrouter.ai/api/v1/chat/completions";
            if (org === 'deepseek') apiUrl = "https://api.deepseek.com/chat/completions";

            var headers = { 'Content-Type': 'application/json', 'Authorization': "Bearer " + activeKey };
            if (org === 'openrouter') { headers['HTTP-Referer'] = window.location.href; headers['X-Title'] = 'NEXUS OS CBT Suite'; }

            var res = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ 
                    model: rawModel, 
                    messages: [{ role: "user", content: "Tutor: " + msg }],
                    max_tokens: 4096
                })
            });
            
            var data = await res.json();
            if (!res.ok) throw new Error((data.error && data.error.message) || (org.toUpperCase() + " HTTP " + res.status + " error"));
            resText = data.choices[0].message.content;
        } else {
            var geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + rawModel + ":generateContent?key=" + activeKey;
            var geminiRes = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents: [{ parts: [{ text: "Tutor: " + msg }] }],
                    generationConfig: { maxOutputTokens: 4096 }
                })
            });
            var geminiData = await geminiRes.json();
            if (!geminiRes.ok) throw new Error((geminiData.error && geminiData.error.message) || ("HTTP " + geminiRes.status + " error"));
            resText = geminiData.candidates[0].content.parts[0].text;
        }

        var wrapper = document.getElementById(aiWrapperId);
        if (wrapper) {
            var finalTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            wrapper.innerHTML = "<div class=\"msg ai\">" + resText + "</div>" +
                "<span class=\"timestamp\" style=\"font-size: 10px; color: var(--text-muted); margin-top: 4px; padding-left: 4px;\">" + finalTime + "</span>";
        }
    } catch(e) { 
        var errWrapper = document.getElementById(aiWrapperId);
        if (errWrapper) {
            errWrapper.innerHTML = "<div class=\"msg ai\" style=\"color: var(--neon-red);\">[Error]: " + e.message + "</div>" +
                "<span class=\"timestamp\" style=\"font-size: 10px; color: var(--text-muted); margin-top: 4px; padding-left: 4px;\">Failed</span>";
        }
    }
    box.scrollTop = box.scrollHeight;
};
