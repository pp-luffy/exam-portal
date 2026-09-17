let gKey = "";
let grKey = "";
let orKey = "";
let currentQuizData = [];
let userAnswers = {};
let userBookmarks = {};
let currentQIndex = 0;
let timerInterval = null;
let secondsLeft = 0;
let totalSecondsTaken = 0;
let mistakeVault = [];

// Clean provider models map
const PROVIDER_MODELS = {
    gemini: [
        { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash (High Speed / Latest)", maxLimit: 50 },
        { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", maxLimit: 50 },
        { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite", maxLimit: 40 },
        { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite", maxLimit: 40 }
    ],
    groq: [
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile", maxLimit: 50 },
        { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant (Ultra Fast)", maxLimit: 40 }
    ],
    openrouter: [
        { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nemotron 3 Ultra (Massive Capacity)", maxLimit: 100 },
        { id: "nvidia/nemotron-3-super:free", name: "Nemotron 3 Super", maxLimit: 100 },
        { id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B", maxLimit: 80 },
        { id: "google/gemma-4-26b-a4b-it:free", name: "Gemma 4 26B A4B", maxLimit: 80 },
        { id: "nvidia/nemotron-3.5-lightning:free", name: "Nemotron 3.5 Lightning", maxLimit: 80 },
        { id: "nvidia/nemotron-nano-9b-v2:free", name: "Nemotron Nano 9B V2", maxLimit: 50 },
        { id: "dots-studio/dots3-note-preview:free", name: "Dots3 Note Preview", maxLimit: 80 }
    ]
};

try { mistakeVault = JSON.parse(localStorage.getItem("NEXUS_VAULT")) || []; } catch(e) { mistakeVault = []; }

document.addEventListener("DOMContentLoaded", function() {
    gKey = localStorage.getItem("GEMINI_KEY") || "";
    grKey = localStorage.getItem("GROQ_KEY") || "";
    orKey = localStorage.getItem("OPENROUTER_KEY") || "";

    if (document.getElementById('update-gemini') && gKey) document.getElementById('update-gemini').value = gKey;
    if (document.getElementById('update-groq') && grKey) document.getElementById('update-groq').value = grKey;
    if (document.getElementById('update-openrouter') && orKey) document.getElementById('update-openrouter').value = orKey;

    const orgSelect = document.getElementById('org-select');
    if (orgSelect) orgSelect.addEventListener('change', updateModelDropdown);
    
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) modelSelect.addEventListener('change', updateQuotaDisplay);

    // Force populate dropdown immediately on boot
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

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendChat(); });
    }

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
        if (org === 'openrouter') {
            statusVal.textContent = "Free Tier: ~20 RPM / 200 RPD (OpenRouter)";
        } else if (org === 'groq') {
            statusVal.textContent = "Free Tier: ~30 RPM / 14.4K RPD (Groq LPU)";
        } else {
            statusVal.textContent = "Free Tier: Standard Rate Limits (Gemini)";
        }
    }
    enforceLanguageConstraints();
}

function enforceLanguageConstraints() {
    const modelSelect = document.getElementById('model-select');
    const langSelect = document.getElementById('lang');
    const countInput = document.getElementById('count');
    const orgSelect = document.getElementById('org-select');
    
    if (!modelSelect || !langSelect || !countInput || !orgSelect) return;

    let baseLimit = 50;
    const list = PROVIDER_MODELS[orgSelect.value] || [];
    const found = list.find(m => m.id === modelSelect.value);
    if (found) baseLimit = found.maxLimit;

    if (langSelect.value === 'Odia') {
        baseLimit = Math.floor(baseLimit * 0.75);
    }

    countInput.max = baseLimit;
    if (parseInt(countInput.value) > baseLimit) {
        countInput.value = baseLimit;
    }
}

function updateTokens() {
    const newGemini = document.getElementById('update-gemini')?.value.trim() || "";
    const newGroq = document.getElementById('update-groq')?.value.trim() || "";
    const newOpenRouter = document.getElementById('update-openrouter')?.value.trim() || "";
    const msgEl = document.getElementById('token-update-msg');

    if (!newGemini && !newGroq && !newOpenRouter) {
        alert("Please enter at least one token to update.");
        return;
    }

    try {
        if (newGemini) { localStorage.setItem("GEMINI_KEY", newGemini); gKey = newGemini; }
        if (newGroq) { localStorage.setItem("GROQ_KEY", newGroq); grKey = newGroq; }
        if (newOpenRouter) { localStorage.setItem("OPENROUTER_KEY", newOpenRouter); orKey = newOpenRouter; }
        
        if (msgEl) {
            msgEl.style.display = 'block';
            setTimeout(() => { msgEl.style.display = 'none'; }, 4000);
        } else {
            alert("Tokens updated successfully!");
        }
    } catch(e) {
        alert("Failed to save tokens: " + e.message);
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

async function startExam() {
    gKey = localStorage.getItem("GEMINI_KEY") || gKey;
    grKey = localStorage.getItem("GROQ_KEY") || grKey;
    orKey = localStorage.getItem("OPENROUTER_KEY") || orKey;
    
    const org = document.getElementById('org-select').value;
    const activeKey = org === 'groq' ? grKey : (org === 'openrouter' ? orKey : gKey);
    
    if (!activeKey) {
        alert(`API Key missing for ${org.toUpperCase()}! Please enter it in the Config tab.`);
        switchTab('settings');
        return;
    }

    const exam = document.getElementById('exam').value.trim();
    const topic = document.getElementById('topic').value.trim();

    if (!exam || !topic) {
        alert("Please fill in both the Target Standard and Syllabus Topic.");
        return;
    }

    document.getElementById('exam-setup').style.display = 'none';
    document.getElementById('terminal-screen').style.display = 'block';
    const terminal = document.getElementById('terminal');
    terminal.style.display = 'block';
    terminal.innerHTML = "";

    const rawModel = document.getElementById('model-select').value;
    const count = document.getElementById('count').value;
    const lang = document.getElementById('lang').value;
    const mins = parseInt(document.getElementById('timer-mins').value) || 15;

    secondsLeft = mins * 60;
    totalSecondsTaken = 0;

    const prompt = `You are an expert examiner for ${exam}. Generate EXACTLY ${count} TRICKY practice questions about "${topic}". Output language must be strictly in ${lang}. 
RULES: 1. NO EXPLANATIONS. 2. Plausible distractor traps. 3. Output ONLY a valid JSON array matching this exact format:
[
  {
    "question": "Question text...",
    "options": ["Opt1", "Opt2", "Opt3", "Opt4"],
    "correct_option_index": 2
  }
]`;

    try {
        let fullResponse = "";
        if (org === 'groq' || org === 'openrouter') {
            const apiUrl = org === 'openrouter' 
                ? "https://openrouter.ai/api/v1/chat/completions" 
                : "https://api.groq.com/openai/v1/chat/completions";

            const headers = { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${activeKey}` 
            };
            if (org === 'openrouter') {
                headers['HTTP-Referer'] = window.location.href;
                headers['X-Title'] = 'NEXUS OS CBT Suite';
            }

            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ 
                    model: rawModel, 
                    messages: [{ role: "user", content: prompt }], 
                    temperature: 0.3, 
                    response_format: { type: "json_object" } 
                })
            });
            
            if (!res.ok) throw new Error(`${org.toUpperCase()} HTTP error ${res.status}`);
            const data = await res.json();
            fullResponse = data.choices[0].message.content;
        } else {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${rawModel}:streamGenerateContent?key=${activeKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
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
                for (const m of matches) {
                    const snippet = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                    terminal.textContent += snippet;
                    terminal.scrollTop = terminal.scrollHeight;
                    fullResponse += snippet;
                }
            }
        }

        const match = fullResponse.match(/\[[\s\S]*\]/);
        currentQuizData = match ? JSON.parse(match[0]) : JSON.parse(fullResponse);
        userAnswers = {};
        userBookmarks = {};
        currentQIndex = 0;
        initCBTExam();

    } catch (err) {
        terminal.style.color = "var(--neon-red)";
        terminal.textContent += `\n\n[FAILURE]: ${err.message}`;
        setTimeout(resetExamUI, 6000);
    }
}

function initCBTExam() {
    document.getElementById('terminal-screen').style.display = 'none';
    document.getElementById('exam-active').style.display = 'block';
    document.getElementById('exam-results').style.display = 'none';
    buildPalette();
    renderQuestion(currentQIndex);
    startTimer();
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

function renderQuestion(index) {
    currentQIndex = index;
    const q = currentQuizData[index];
    document.getElementById('q-counter').innerText = `Question ${index + 1} of ${currentQuizData.length}`;
    document.getElementById('progress-fill').style.width = `${((index + 1) / currentQuizData.length) * 100}%`;
    document.getElementById('bookmark-badge').innerText = userBookmarks[index] ? "★ Bookmarked" : "";
    document.getElementById('active-q-text').innerText = `${index + 1}. ${q.question}`;
    
    const optContainer = document.getElementById('active-options-container');
    optContainer.innerHTML = "";
    q.options.forEach((opt, oIdx) => {
        const isSelected = userAnswers[index] === oIdx ? "selected" : "";
        optContainer.innerHTML += `
            <div class="option-card ${isSelected}" onclick="selectOption(${index}, ${oIdx})">
                <input type="radio" style="margin-right:12px;" ${isSelected ? "checked" : ""}> 
                <span>${opt}</span>
            </div>`;
    });
    updatePaletteStates();
}

function selectOption(qIdx, oIdx) { userAnswers[qIdx] = oIdx; renderQuestion(qIdx); }
function clearAnswer() { delete userAnswers[currentQIndex]; renderQuestion(currentQIndex); }
function skipQ() { navigateQ(1); }
function toggleBookmark() { userBookmarks[currentQIndex] = !userBookmarks[currentQIndex]; renderQuestion(currentQIndex); }
function navigateQ(dir) { if (currentQIndex + dir >= 0 && currentQIndex + dir < currentQuizData.length) renderQuestion(currentQIndex + dir); }
function jumpToQuestion(idx) { renderQuestion(idx); }

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (secondsLeft <= 0) { clearInterval(timerInterval); submitExam(); return; }
        secondsLeft--; totalSecondsTaken++;
        document.getElementById('timer-display').innerText = `${Math.floor(secondsLeft/60).toString().padStart(2,'0')}:${(secondsLeft%60).toString().padStart(2,'0')}`;
    }, 1000);
}

function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
    else if (document.exitFullscreen) document.exitFullscreen();
}

function confirmSubmit() { if (confirm("Submit examination?")) submitExam(); }

function submitExam() {
    if (timerInterval) clearInterval(timerInterval);
    let score = 0, wrong = 0, skipped = 0;
    currentQuizData.forEach((q, i) => {
        const sel = userAnswers[i];
        if (sel === undefined) { skipped++; addToVault(q); }
        else if (sel === q.correct_option_index) { score++; }
        else { wrong++; addToVault(q); }
    });

    document.getElementById('exam-active').style.display = 'none';
    document.getElementById('exam-results').style.display = 'block';
    const acc = Math.round((score / currentQuizData.length) * 100);
    document.getElementById('score-summary-banner').innerHTML = `
        <div class="score-banner">SCORE: ${score} / ${currentQuizData.length} (${acc}%)</div>
        <div style="display:flex; justify-content:space-around; color:var(--text-muted); font-size:14px;">
            <div>✅ Correct: <strong>${score}</strong></div>
            <div>❌ Wrong: <strong>${wrong}</strong></div>
            <div>⏭ Skipped: <strong>${skipped}</strong></div>
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
        const corr = sel === q.correct_option_index;
        if (mode === 'wrong' && corr) return;
        let html = `<div class="glass-card" style="border-left: 4px solid ${corr ? 'var(--neon-green)' : 'var(--neon-red)'}; padding: 18px;">
            <p style="font-weight:700; color:${corr ? 'var(--neon-green)' : 'var(--neon-red)'}; margin-top:0;">Q${i+1}. ${corr ? 'CORRECT' : 'INCORRECT'}</p>
            <p class="q-text" style="font-size:15px;">${q.question}</p>`;
        q.options.forEach((opt, oIdx) => {
            let cls = oIdx === q.correct_option_index ? "correct" : (oIdx === sel ? "wrong" : "");
            html += `<div class="option-card ${cls}" style="padding:10px 14px; margin:4px 0; font-size:14px;"><span>${opt}</span></div>`;
        });
        container.innerHTML += html + `</div>`;
    });
}

function restartSameQuiz() { userAnswers = {}; initCBTExam(); }

function addToVault(q) {
    if (!mistakeVault.some(v => v.question === q.question)) {
        q.user_failed_at = new Date().toLocaleDateString();
        mistakeVault.push(q);
        try { localStorage.setItem("NEXUS_VAULT", JSON.stringify(mistakeVault)); } catch(e){}
    }
}

function renderVault() {
    const c = document.getElementById('vault-container');
    if (!c) return;
    c.innerHTML = "";
    if (mistakeVault.length === 0) { c.innerHTML = `<p style="color:var(--neon-green); text-align:center;">Vault is empty.</p>`; return; }
    mistakeVault.forEach(q => {
        c.innerHTML += `<div class="glass-card" style="border-left:4px solid var(--neon-red); padding:16px;">
            <p style="font-size:11px; color:var(--neon-red); margin:0 0 6px 0; font-weight:bold;">Failed: ${q.user_failed_at}</p>
            <p class="q-text" style="font-size:15px; margin-bottom:8px;">${q.question}</p>
            <p style="color:var(--neon-green); font-size:14px; margin:0;">✔ ${q.options[q.correct_option_index]}</p>
        </div>`;
    });
}

function clearVault() { if(confirm("Purge vault?")) { mistakeVault = []; localStorage.removeItem("NEXUS_VAULT"); renderVault(); } }

async function sendChat() {
    gKey = localStorage.getItem("GEMINI_KEY") || gKey;
    grKey = localStorage.getItem("GROQ_KEY") || grKey;
    orKey = localStorage.getItem("OPENROUTER_KEY") || orKey;

    const org = document.getElementById('org-select').value;
    const activeKey = org === 'groq' ? grKey : (org === 'openrouter' ? orKey : gKey);
    
    if (!activeKey) {
        alert(`API Key missing for ${org.toUpperCase()}! Please enter it in the Config tab.`);
        switchTab('settings');
        return;
    }

    const inp = document.getElementById('chat-input');
    const msg = inp.value.trim();
    if (!msg) return;
    const box 
