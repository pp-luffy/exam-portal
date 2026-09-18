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

// Per-Question Time Tracker
let timeTracker = {}; 

// Custom marking globals
let posMark = 4;
let negMark = 1;

try { mistakeVault = JSON.parse(localStorage.getItem("NEXUS_VAULT")) || []; } catch(e) { mistakeVault = []; }

document.addEventListener("DOMContentLoaded", function() {
    const clearChatBtn = document.getElementById('clear-chat-btn');
    if (clearChatBtn) clearChatBtn.addEventListener('click', () => clearChatHistory());

    const downloadBtn = document.getElementById('download-report-btn');
    if (downloadBtn) downloadBtn.addEventListener('click', () => downloadAssessmentReport());

    const mailBtn = document.getElementById('mail-report-btn');
    if (mailBtn) mailBtn.addEventListener('click', () => emailAssessmentReport());
});

// ==========================================
// SHUFFLE QUIZ OPTIONS (Fisher-Yates Algorithm)
// ==========================================
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

// ==========================================
// PHASE 1: GENERATION (WITH CHUNKING & TOKEN DISTRIBUTION)
// ==========================================
async function startExam() {
    gKey = localStorage.getItem("GEMINI_KEY") || gKey;
    grKey = localStorage.getItem("GROQ_KEY") || grKey;
    orKey = localStorage.getItem("OPENROUTER_KEY") || orKey;
    dsKey = localStorage.getItem("DEEPSEEK_KEY") || dsKey;
    const grvKey = localStorage.getItem("GROQ_VERIFY_KEY"); 
    
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
        cancelWrapper.onclick = () => cancelActiveRequest();
        terminalScreen.querySelector('.quantum-loader-wrapper').appendChild(cancelWrapper);
    }

    const rawModel = document.getElementById('model-select').value;
    const totalCount = parseInt(document.getElementById('count').value);
    const lang = document.getElementById('lang').value;
    const mins = parseInt(document.getElementById('timer-mins').value) || 15;
    const posM = parseFloat(document.getElementById('pos-marks').value) || 1;
    const negM = parseFloat(document.getElementById('neg-marks').value) || 0;
    const adminPromptTxt = isAdmin ? (document.getElementById('admin-prompt').value || "").trim() : "";

    // Chunking Logic (Max 25 questions per API call to avoid token truncation)
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

    // Distribute tokens if using Groq
    let keysToUse = [activeKey];
    if (org === 'groq' && grvKey) keysToUse = [grKey, grvKey];

    try {
        for (let i = 0; i < chunks.length; i++) {
            let currentChunkSize = chunks[i];
            let currentApiKey = keysToUse[i % keysToUse.length]; // Alternates between primary and verify keys
            let keyLabel = (keysToUse.length > 1 && i % 2 !== 0) ? "Secondary/Verify" : "Primary";

            terminal.innerHTML += `<span style='color: var(--text-muted);'>[BATCH ${i+1}/${chunks.length}]: Requesting ${currentChunkSize} questions via${keyLabel} node...</span><br>`;
            terminal.scrollTop = terminal.scrollHeight;

            let prompt = `You are a ruthless, expert Chief Question Paper Setter for competitive examinations like ${exam}. 
Generate EXACTLY ${currentChunkSize} high-standard questions for the Subject: "${subject}", focusing on the Topic: "${topic}". 
Output language must strictly be ${lang}.
DIFFICULTY LEVEL: Level ${difficulty} out of 5.

QUALITY PROTOCOL:
1. FACT CHECK: 100% accurate.
2. SINGLE TRUE ANSWER: EXACTLY ONE unambiguously correct option.
3. INDEX CHECK: correct_option_index strictly matches the 0-based array position.
4. NO EXPLANATIONS inside the question text or options array.`;

            if (previouslyGeneratedConcepts.length > 0) {
                prompt += `\n\nCRITICAL ANTI-DUPLICATION RULE:\nYou have already generated the following questions. DO NOT REPEAT OR OVERLAP WITH THESE CONCEPTS:\n`;
                previouslyGeneratedConcepts.forEach((q, idx) => { prompt += `${idx+1}.${q.substring(0, 100)}...\n`; });
            }

            prompt += `\nOutput ONLY a valid JSON array matching this exact format:
[
  {
    "question": "Question text...",
    "options": ["Opt1", "Opt2", "Opt3", "Opt4"],
    "correct_option_index": 2
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

                const payload = { model: rawModel, messages: [{ role: "user", content: prompt }], temperature: 0.4, max_tokens: 8192 };
                if (org === 'groq' || org === 'deepseek') payload.response_format = { type: "json_object" };

                const res = await fetch(apiUrl, { method: 'POST', headers: headers, body: JSON.stringify(payload), signal: signal });
                
                if (res.status === 429) {
                    terminal.innerHTML += `<span style='color: var(--neon-yellow);'>[RATE LIMIT]: Pausing for 60s before retrying batch...</span><br>`;
                    await new Promise(r => setTimeout(r, 60000));
                    i--; // Retry this chunk
                    continue;
                }

                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message || `${org.toUpperCase()} HTTP error${res.status}`);
                fullResponse = data.choices[0].message.content;

            } else {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${rawModel}:streamGenerateContent?key=${currentApiKey}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 65536, temperature: 0.4 } }),
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
            parsedChunk.forEach(q => previouslyGeneratedConcepts.push(q.question)); // Store concepts to prevent duplicates
        }

        currentQuizData = allGeneratedQuestions;
        currentQuizData = await verifyAndCorrectQuizData(currentQuizData, signal);
        prepareExamPortalLaunch(mins, posM, negM);

    } catch (err) {
        if (err.name === 'AbortError') return;
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
window.filterPalette = filterPalette; // Expose for inline HTML handler

function renderQuestion(index) {
    currentQIndex = index;
    const q = currentQuizData[index];
    document.getElementById('q-counter').innerText = `Question ${index + 1} of${currentQuizData.length}`;
    document.getElementById('progress-fill').style.width = `${((index + 1) / currentQuizData.length) * 100}%`;
    document.getElementById('bookmark-badge').innerText = userBookmarks[index] ? "★ Marked for Review" : "";
    
    const qCard = document.getElementById('active-q-text').parentElement;
    qCard.classList.remove('q-transition');
    void qCard.offsetWidth; // Trigger DOM reflow to restart animation
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
        <div class="score-banner">SCORE: ${formattedTotal} / ${maxMarks} <br><span style="font-size: 16px; color: var(--text-muted);">(${acc}% Accuracy)</span></div>
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
        q.next_review_date = Date.now() + 86400000; // Due in 1 Day (86.4m ms)
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

    // Sort vault: Due items first
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
