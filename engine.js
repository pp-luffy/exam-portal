let currentQuizData = [];
let userAnswers = {};
let userBookmarks = {};
let currentQIndex = 0;
let timerInterval = null;
let secondsLeft = 0;
let totalSecondsTaken = 0;
let mistakeVault = [];

try { mistakeVault = JSON.parse(localStorage.getItem("NEXUS_VAULT")) || []; } catch(e) { mistakeVault = []; }

document.addEventListener("DOMContentLoaded", function() {
    const clearChatBtn = document.getElementById('clear-chat-btn');
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', clearChatHistory);
    }
});

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
    const subject = document.getElementById('subject').value.trim();
    const topic = document.getElementById('topic').value.trim();
    const difficulty = document.getElementById('difficulty').value;

    if (!exam || !subject || !topic) {
        alert("Please fill in the Target Exam Name, Subject Name, and Syllabus Topic.");
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

    // Advanced Behavioral Prompt Engineering based on Exam & Difficulty Matrix
    const prompt = `You are a ruthless, expert Chief Question Paper Setter for competitive examinations like ${exam}. 
Generate EXACTLY ${count} high-standard questions for the Subject: "${subject}", focusing on the Topic: "${topic}". 
Output language must be strictly in ${lang}.

DIFFICULTY LEVEL: Level ${difficulty} out of 5.
- If exam is UPSC CSE or OPSC CSE/ASO: NEVER ask direct factual questions. Use deep analytical statements, multi-statement evaluation traps (e.g., "Consider the following statements... Which of the above are correct?"), pairing mismatches, and subtle conceptual nuances.
- If exam is JEE Main: Construct deep conceptual or multi-step computational problems requiring solid application of formulas without standard direct lookups.
- If exam is JEE Advanced: Construct ruthless, multi-concept integration traps with highly tricky options where superficial working leads directly to distractor options.

RULES: 
1. NO EXPLANATIONS inside the question text or options array.
2. Formulate highly plausible distractor traps.
3. Output ONLY a valid JSON array matching this exact format with no extra markdown text:
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
                    temperature: 0.4, 
                    response_format: { type: "json_object" } 
                })
            });
            
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error?.message || `${org.toUpperCase()} HTTP error ${res.status}`);
            }
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

    const chatModelSelect = document.getElementById('chat-model-select');
    const rawModel = chatModelSelect ? chatModelSelect.value : "gemini-3.8-flash";
    
    let org = "gemini";
    if (rawModel.includes("llama") || rawModel.includes("instant")) org = "groq";
    else if (rawModel.includes("nvidia") || rawModel.includes("google/gemma") || rawModel.includes("dots-studio")) org = "openrouter";

    const activeKey = org === 'groq' ? grKey : (org === 'openrouter' ? orKey : gKey);
    
    if (!activeKey) {
        alert(`API Key missing for ${org.toUpperCase()}! Please enter it in the Config tab.`);
        switchTab('settings');
        return;
    }

    const inp = document.getElementById('chat-input');
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
                    messages: [{ role: "user", content: "Tutor: " + msg }] 
                })
            });
            
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error?.message || `${org.toUpperCase()} HTTP ${res.status} error`);
            }
            resText = data.choices[0].message.content;
        } else {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${rawModel}:generateContent?key=${activeKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: "Tutor: " + msg }] }] })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error?.message || `HTTP ${res.status} error`);
            }
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
    document.getElementById('exam-results').style.display = 'none';
    document.getElementById('exam-active').style.display = 'none';
    document.getElementById('exam-setup').style.display = 'block';
}
