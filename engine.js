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
    
    // Backend enforced difficulty check
    const difficulty = isAdmin ? document.getElementById('difficulty').value : "2";

    if (!exam || !subject || !topic) {
        alert("Please fill in the Target Exam Name, Subject Name, and Syllabus Topic.");
        return;
    }

    document.getElementById('exam-setup').style.display = 'none';
    document.getElementById('terminal-screen').style.display = 'block';
    const terminal = document.getElementById('terminal');
    terminal.style.display = 'block';
    terminal.innerHTML = "<span style='color: var(--neon-cyan);'>[CORE INITIALIZED]: Connecting to neural parameters...</span><br>";

    const rawModel = document.getElementById('model-select').value;
    const count = document.getElementById('count').value;
    const lang = document.getElementById('lang').value;
    const mins = parseInt(document.getElementById('timer-mins').value) || 15;

    secondsLeft = mins * 60;
    totalSecondsTaken = 0;

    const prompt = `You are a ruthless, expert Chief Question Paper Setter for competitive examinations like ${exam}. 
Generate EXACTLY ${count} high-standard questions for the Subject: "${subject}", focusing on the Topic: "${topic}". 
Output language must be strictly in ${lang}.

DIFFICULTY LEVEL: Level ${difficulty} out of 5.
- Formulate deep analytical questions, multi-statement evaluation traps, pairing mismatches, and subtle conceptual nuances matching top-tier competitive exams.
- Construct ruthless, multi-concept integration traps with highly tricky options where superficial working leads directly to distractor options.

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

            const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeKey}` };
            if (org === 'openrouter') { headers['HTTP-Referer'] = window.location.href; headers['X-Title'] = 'NEXUS OS CBT Suite'; }

            const payload = { 
                model: rawModel, 
                messages: [{ role: "user", content: prompt }], 
                temperature: 0.4, 
                max_tokens: 8192 
            };

            if (org === 'groq') {
                payload.response_format = { type: "json_object" };
            }

            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });
            
            const remainingTokens = res.headers.get('x-ratelimit-remaining-tokens') || res.headers.get('x-ratelimit-tokens-remaining');
            if (remainingTokens) {
                let statusMsg = `Remaining Tokens: ${remainingTokens}`;
                document.getElementById('quota-status-val').textContent = statusMsg;
                localStorage.setItem(`QUOTA_${rawModel}`, statusMsg);
            }
            
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
                })
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
        terminal.innerHTML += `<br><br>[FAILURE]: ${err.message}`;
        setTimeout(resetExamUI, 6000);
    }
}
