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

try { mistakeVault = JSON.parse(localStorage.getItem("NEXUS_VAULT")) || []; } catch(e) { mistakeVault = []; }

document.addEventListener("DOMContentLoaded", function() {
    const clearChatBtn = document.getElementById('clear-chat-btn');
    if (clearChatBtn) clearChatBtn.addEventListener('click', clearChatHistory);

    const downloadBtn = document.getElementById('download-report-btn');
    if (downloadBtn) downloadBtn.addEventListener('click', downloadAssessmentReport);

    const mailBtn = document.getElementById('mail-report-btn');
    if (mailBtn) mailBtn.addEventListener('click', emailAssessmentReport);
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
// PHASE 2: QA VERIFICATION (OPTIMIZED BURST LOGIC)
// ==========================================
async function verifyAndCorrectQuizData(quizData, signal) {
    const terminal = document.getElementById('terminal');
    const groqVerifyKey = localStorage.getItem("GROQ_VERIFY_KEY");
    const groqPrimaryKey = localStorage.getItem("GROQ_KEY"); 
    
    if (!groqVerifyKey) {
        terminal.innerHTML += `<br><span style='color: var(--neon-yellow);'>[WARNING]: Verification Groq Key missing. Skipping Phase 2 QA verification.</span><br>`;
        return quizData; 
    }

    const lang = document.getElementById('lang') ? document.getElementById('lang').value : "English";
    const BATCH_SIZE = (lang === 'Odia') ? 10 : 25;

    terminal.innerHTML += `<br><span style='color: var(--neon-cyan);'>[PHASE 2]: Initiating Quality Assurance via GPT-OSS-20B (Batch Size: ${BATCH_SIZE})...</span><br>`;

    let totalCorrections = 0;
    const batches = [];
    for (let i = 0; i < quizData.length; i += BATCH_SIZE) {
        batches.push(quizData.slice(i, i + BATCH_SIZE).map((q, idx) => ({ index: i + idx, ...q })));
    }

    async function sendVerifyBatch(chunk, apiKey) {
        const verifyPrompt = `You are a strict QA Audit System for a competitive exam engine. 
Review the following JSON array of multiple-choice questions. Check for factual errors, illogical distractors, or an incorrect 'correct_option_index'.

If ALL questions are 100% accurate, return EXACTLY: {"corrections": []}

If ANY questions are flawed, return a JSON object with a "corrections" array containing ONLY the fixed questions. Use this exact schema:
{
  "corrections": [
    {
      "index": 0, // MUST be the exact 'index' integer provided in the original array
      "question": "The corrected question text...",
      "options": ["Opt1", "Opt2", "Opt3", "Opt4"],
      "correct_option_index": 2
    }
  ]
}

Original Array Chunk to Audit:
${JSON.stringify(chunk)}`;

        const payload = { 
            model: "openai/gpt-oss-20b", 
            messages: [{ role: "user", content: verifyPrompt }], 
            temperature: 0.1, 
            max_tokens: 4096,
            response_format: { type: "json_object" }
        };

        try {
            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify(payload),
                signal: signal
            });
            if (res.status === 429) return { status: 429 };
            if (!res.ok) throw new Error(`QA HTTP ${res.status}`);
            const data = await res.json();
            return { status: 200, data: JSON.parse(data.choices[0].message.content) };
        } catch (err) {
            if (err.name !== 'AbortError') console.warn("QA Batch Error:", err);
            return { status: 500, error: err };
        }
    }

    function applyCorrections(parsed) {
        if (parsed && parsed.corrections && Array.isArray(parsed.corrections) && parsed.corrections.length > 0) {
            totalCorrections += parsed.corrections.length;
            parsed.corrections.forEach(c => {
                if (c.index !== undefined && c.index >= 0 && c.index < quizData.length) {
                    quizData[c.index].question = c.question;
                    quizData[c.index].options = c.options;
                    quizData[c.index].correct_option_index = c.correct_option_index;
                }
            });
        }
    }

    let i = 0;
    let dualBurstMode = false;

    while (i < batches.length) {
        terminal.innerHTML += `<span style='color: var(--text-muted);'>[QA]: Processing Batch ${i+1}/${batches.length}...</span><br>`;
        terminal.scrollTop = terminal.scrollHeight;
        
        if (dualBurstMode && groqPrimaryKey && i + 1 < batches.length) {
            terminal.innerHTML += `<span style='color: var(--text-muted);'>[QA]: Bursting Batch ${i+2}/${batches.length} concurrently...</span><br>`;
            terminal.scrollTop = terminal.scrollHeight;
            
            let p1 = sendVerifyBatch(batches[i], groqVerifyKey);
            let p2 = sendVerifyBatch(batches[i+1], groqPrimaryKey);
            
            let [res1, res2] = await Promise.all([p1, p2]);
            
            if (res1.status === 429 || res2.status === 429) {
                terminal.innerHTML += `<span style='color: var(--neon-yellow);'>[QA WARNING]: Rate limit hit during burst. Pausing for 60 seconds...</span><br>`;
                terminal.scrollTop = terminal.scrollHeight;
                await new Promise(resolve => setTimeout(resolve, 60000));
                continue; 
            }
            
            if (res1.data) applyCorrections(res1.data);
            if (res2.data) applyCorrections(res2.data);
            
            i += 2;
            if (i < batches.length) await new Promise(r => setTimeout(r, 2000));
            
        } else {
            let res = await sendVerifyBatch(batches[i], groqVerifyKey);
            
            if (res.status === 429) {
                terminal.innerHTML += `<span style='color: var(--neon-yellow);'>[QA WARNING]: Rate limit hit. Pausing for 60 seconds to reset token buckets...</span><br>`;
                terminal.scrollTop = terminal.scrollHeight;
                
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                terminal.innerHTML += `<span style='color: var(--neon-cyan);'>[QA SYSTEM]: 60s elapsed. Dual-token burst active.</span><br>`;
                terminal.scrollTop = terminal.scrollHeight;
                dualBurstMode = true; 
                
            } else {
                if (res.data) applyCorrections(res.data);
                i++;
                if (i < batches.length) {
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        }
    }

    if (totalCorrections > 0) {
        terminal.innerHTML += `<br><span style='color: var(--neon-yellow);'>[QA ALERT]: Intercepted and dynamically patched ${totalCorrections} flawed question(s).</span><br>`;
    } else {
        terminal.innerHTML += `<br><span style='color: var(--neon-green);'>[QA CLEAR]: 0 anomalies detected. Assessment locked.</span><br>`;
    }

    return quizData;
}

async function executeFallback(prompt, signal) {
    const terminal = document.getElementById('terminal');
    terminal.innerHTML += `<br><span style='color: var(--neon-yellow);'>[WARNING]: Primary endpoint failed. Initiating automated failover to Gemini 3.8 Flash...</span><br>`;
    
    const fallbackKey = localStorage.getItem("GEMINI_KEY");
    if (!fallbackKey) throw new Error("Fallback failed: Gemini API Key not found.");

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:streamGenerateContent?key=${fallbackKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 65536, temperature: 0.4 }
        }),
        signal: signal
    });
    
    if (!res.ok) throw new Error(`Fallback HTTP ${res.status}`);
    
    let fullResponse = "";
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
    return fullResponse;
}

function prepareExamPortalLaunch(mins) {
    localStorage.setItem("NEXUS_PENDING_EXAM", JSON.stringify({
        quizData: currentQuizData,
        mins: mins
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
        mainContent.style.maxWidth = '1000px';
        mainContent.style.paddingBottom = '20px';
    }

    currentQuizData = data.quizData;
    secondsLeft = data.mins * 60;
    totalSecondsTaken = 0;
    userAnswers = {};
    userBookmarks = {};
    currentQIndex = 0;
    
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
    gKey = localStorage.getItem("GEMINI_KEY") || gKey;
    grKey = localStorage.getItem("GROQ_KEY") || grKey;
    orKey = localStorage.getItem("OPENROUTER_KEY") || orKey;
    dsKey = localStorage.getItem("DEEPSEEK_KEY") || dsKey;
    
    const org = document.getElementById('org-select').value;
    let activeKey = gKey;
    if (org === 'groq') activeKey = grKey;
    else if (org === 'openrouter') activeKey = orKey;
    else if (org === 'deepseek') activeKey = dsKey;
    
    if (!activeKey) {
        alert(`API Key missing for ${org.toUpperCase()}! Please enter it in the Config tab.`);
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
        cancelWrapper.onclick = cancelActiveRequest;
        terminalScreen.querySelector('.quantum-loader-wrapper').appendChild(cancelWrapper);
    }

    const rawModel = document.getElementById('model-select').value;
    const count = document.getElementById('count').value;
    const lang = document.getElementById('lang').value;
    const mins = parseInt(document.getElementById('timer-mins').value) || 15;

    const adminPromptTxt = isAdmin ? (document.getElementById('admin-prompt').value || "").trim() : "";

    const prompt = `You are a ruthless, expert Chief Question Paper Setter AND a rigorous Quality Reviewer for competitive examinations like ${exam}. 
Generate EXACTLY ${count} high-standard questions for the Subject: "${subject}", focusing on the Topic: "${topic}". 
Output language must strictly be ${lang}.

DIFFICULTY LEVEL: Level ${difficulty} out of 5.
- Formulate deep analytical questions, multi-statement evaluation traps, pairing mismatches, and subtle conceptual nuances matching top-tier competitive exams.
- Construct ruthless, multi-concept integration traps with highly tricky options where superficial working leads directly to distractor options.

QUALITY & VERIFICATION PROTOCOL (MANDATORY):
Before writing each question into the JSON, you MUST internally execute this strict verification checklist:
1. FACT CHECK: Is the underlying concept and answer 100% factually accurate without ambiguity?
2. SINGLE TRUE ANSWER: Is there EXACTLY ONE unambiguously correct option? Are all other distractors definitively incorrect?
3. INDEX CHECK: Does the correct_option_index strictly match the 0-based array position (0 to 3) of the correct answer?

RULES: 
1. NO EXPLANATIONS inside the question text or options array.
2. Formulate highly plausible distractor traps.
3. Output ONLY a valid JSON array matching this exact format, with no extra markdown text outside of it:
[
  {
    "question": "Question text...",
    "options": ["Opt1", "Opt2", "Opt3", "Opt4"],
    "correct_option_index": 2
  }
]
${adminPromptTxt ? "\n[ADMIN OVERRIDE RULES]:\n" + adminPromptTxt : ""}`;

    if (activeController) activeController.abort();
    activeController = new AbortController();
    const signal = activeController.signal;

    try {
        let fullResponse = "";

        if (org === 'groq' || org === 'openrouter' || org === 'deepseek') {
            let apiUrl = "https://api.groq.com/openai/v1/chat/completions";
            if (org === 'openrouter') apiUrl = "https://openrouter.ai/api/v1/chat/completions";
            if (org === 'deepseek') apiUrl = "https://api.deepseek.com/chat/completions";

            const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeKey}` };
            if (org === 'openrouter') { headers['HTTP-Referer'] = window.location.href; headers['X-Title'] = 'NEXUS OS CBT Suite'; }

            const payload = { 
                model: rawModel, 
                messages: [{ role: "user", content: prompt }], 
                temperature: 0.4, 
                max_tokens: 8192 
            };

            if (org === 'groq' || org === 'deepseek') {
                payload.response_format = { type: "json_object" };
            }

            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload),
                signal: signal
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || `${org.toUpperCase()} HTTP error ${res.status}`);
            fullResponse = data.choices[0].message.content;

        } else {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${rawModel}:streamGenerateContent?key=${activeKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 65536, temperature: 0.4 }
                }),
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

        currentQuizData = await verifyAndCorrectQuizData(currentQuizData, signal);
        prepareExamPortalLaunch(mins);

    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('[SYSTEM]: Request aborted.');
            return;
        }
        
        try {
            const fallbackResponse = await executeFallback(prompt, signal);
            const match = fallbackResponse.match(/\[[\s\S]*\]/);
            currentQuizData = match ? JSON.parse(match[0]) : JSON.parse(fallbackResponse);
            
            currentQuizData = await verifyAndCorrectQuizData(currentQuizData, signal);
            prepareExamPortalLaunch(mins);
            
        } catch (fallbackErr) {
            terminal.style.color = "var(--neon-red)";
            terminal.innerHTML += `<br><br>[CRITICAL FAILURE]: Primary and Fallback models both failed. ${err.message}`;
            setTimeout(resetExamUI, 6000);
        }
    }
}

function initCBTExam() {
    document.getElementById('terminal-screen').style.display = 'none';
    document.getElementById('exam-active').style.display = 'block';
    document.getElementById('exam-results').style.display = 'none';
    
    isTimerPaused = false;
    const pBtn = document.getElementById('pause-timer-btn');
    if(pBtn) { pBtn.innerHTML = '⏸ Pause'; pBtn.style.color = ''; pBtn.style.borderColor = ''; }

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

function selectOption(qIdx, oIdx) { 
    userAnswers[qIdx] = oIdx; 
    try {
        localStorage.setItem("NEXUS_ACTIVE_PROGRESS", JSON.stringify({
            quizData: currentQuizData,
            answers: userAnswers,
            currentIndex: qIdx,
            secondsLeft: secondsLeft
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
    timerInterval = setInterval(() => {
        if (isTimerPaused) return; 
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

function generateReportHTML() {
    const filter = document.getElementById('export-filter').value;
    let htmlContent = `<html><head><style>body{font-family:sans-serif;padding:20px;background:#f8fafc;color:#0f172a;} .card{background:#fff;border:1px solid #cbd5e1;padding:16px;border-radius:12px;margin-bottom:12px;} .correct{color:#10b981;font-weight:bold;} .wrong{color:#ef4444;font-weight:bold;}</style></head><body>`;
    htmlContent += `<h2>NEXUS OS - Assessment Report</h2><hr>`;
    
    currentQuizData.forEach((q, i) => {
        const sel = userAnswers[i];
        const corr = sel === q.correct_option_index;
        if (filter === 'correct' && !corr) return;
        if (filter === 'wrong' && corr) return;

        htmlContent += `<div class="card">
            <p><strong>Q${i+1}.</strong> ${q.question}</p>
            <ul>`;
        q.options.forEach((opt, oIdx) => {
            let tag = "";
            if (oIdx === q.correct_option_index) tag = " ✔ [Correct Answer]";
            else if (oIdx === sel) tag = " ❌ [Your Answer]";
            htmlContent += `<li>${opt}${tag}</li>`;
        });
        htmlContent += `</ul></div>`;
    });
    htmlContent += `</body></html>`;
    return htmlContent;
}

function downloadAssessmentReport() {
    const format = document.getElementById('export-format').value;
    const html = generateReportHTML();

    if (format === 'pdf') {
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        win.print();
    } else {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nexus_exam_report_${Date.now()}.html`;
        a.click();
    }
}

function emailAssessmentReport() {
    const mailId = localStorage.getItem("DEST_MAIL") || "";
    if (!mailId) {
        alert("Destination Mail ID is not set! Please configure it in the Config tab.");
        switchTab('settings');
        return;
    }

    const format = document.getElementById('export-format').value;
    const exam = document.getElementById('exam').value || "Assessment";
    
    alert(`Downloading the ${format.toUpperCase()} report now. Please ATTACH this downloaded file to the email window that opens next.`);
    downloadAssessmentReport();

    const subject = encodeURIComponent(`NEXUS OS CBT Assessment Report: ${exam}`);
    const body = encodeURIComponent(`Hello,\n\nPlease find the attached ${format.toUpperCase()} CBT test report.\n\nExam Target: ${document.getElementById('exam').value}\nSubject: ${document.getElementById('subject').value}\nTopic: ${document.getElementById('topic').value}\n\n(Note to operator: Ensure you have attached the downloaded file before sending).`);

    setTimeout(() => {
        window.location.href = `mailto:${mailId}?subject=${subject}&body=${body}`;
    }, 1500);
}

function restartSameQuiz() { userAnswers = {}; initStandaloneExam(); }

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
    
    const adminJsonBox = document.getElementById('vault-json-textarea');
    if (adminJsonBox) {
        adminJsonBox.value = JSON.stringify(mistakeVault, null, 2);
    }

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
    dsKey = localStorage.getItem("DEEPSEEK_KEY") || dsKey;

    const chatModelSelect = document.getElementById('chat-model-select');
    const rawModel = chatModelSelect ? chatModelSelect.value : "gemini-3.8-flash";
    
    let org = "gemini";
    if (rawModel.includes(":free")) org = "openrouter";
    else if (rawModel.includes("openai/") || rawModel.includes("qwen/") || rawModel.includes("groq/")) org = "groq";
    else if (rawModel.includes("deepseek-v4")) org = "deepseek";

    let activeKey = gKey;
    if (org === 'groq') activeKey = grKey;
    else if (org === 'openrouter') activeKey = orKey;
    else if (org === 'deepseek') activeKey = dsKey;
    
    if (!activeKey) {
        alert(`API Key missing for ${org.toUpperCase()}! Please enter it in the Config tab.`);
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
