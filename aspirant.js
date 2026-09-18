// ==========================================
// NEXUS OS ASPIRANT STRATEGY MODULE
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    // 1. DYNAMICALLY INJECT CSS STYLES
    const style = document.createElement('style');
    style.innerHTML = `
        /* Eye-Care Mode */
        body.eye-care-mode {
            filter: sepia(0.35) brightness(0.85) contrast(0.95);
            transition: filter 0.5s ease;
        }
        /* Guess Tracker Palette Styles */
        .pal-btn.guessed-tag {
            border-color: #a855f7 !important;
            box-shadow: 0 0 12px rgba(168,85,247,0.5) !important;
        }
        /* Floating HUD Controls */
        #aspirant-hud {
            position: fixed; bottom: 20px; right: 20px; display: flex; gap: 10px; z-index: 9998;
        }
        /* Quick Tooltip */
        .hud-tooltip {
            position: absolute; top: -30px; right: 0; background: rgba(0,0,0,0.8);
            color: var(--neon-cyan); font-size: 10px; padding: 4px 8px; border-radius: 4px;
            pointer-events: none; opacity: 0; transition: opacity 0.2s; white-space: nowrap;
        }
        #aspirant-hud:hover .hud-tooltip { opacity: 1; }
    `;
    document.head.appendChild(style);

    // 2. DYNAMICALLY INJECT THE HUD UI
    const hudContainer = document.createElement('div');
    hudContainer.id = "aspirant-hud";
    hudContainer.style.display = "none";
    hudContainer.innerHTML = `
        <div class="hud-tooltip">Right-Click Options to Eliminate • Press 'G' to tag Guesses</div>
        <button id="btn-eyecare" class="cyber-btn secondary" style="margin:0; width:auto; padding: 10px 14px; border-radius: 50%; font-size: 16px;" title="Toggle Eye-Care Mode">🌙</button>
    `;
    document.body.appendChild(hudContainer);

    // 3. HUD DISPLAY LOGIC (Only show when exam is active)
    const observer = new MutationObserver(() => {
        const examActive = document.getElementById('exam-active')?.style.display === 'block';
        document.getElementById('aspirant-hud').style.display = examActive ? 'flex' : 'none';
    });
    const examActiveNode = document.getElementById('exam-active');
    if (examActiveNode) {
        observer.observe(examActiveNode, { attributes: true, attributeFilter: ['style'] });
    }

    // 4. EYE-CARE MODE TOGGLE
    document.getElementById('btn-eyecare').addEventListener('click', () => {
        document.body.classList.toggle('eye-care-mode');
        const btn = document.getElementById('btn-eyecare');
        btn.style.background = document.body.classList.contains('eye-care-mode') ? 'rgba(245, 158, 11, 0.2)' : '';
    });

    // 5. OPTION ELIMINATION TOOL (Right-Click)
    window.eliminatedOptions = window.eliminatedOptions || {};

    document.addEventListener('contextmenu', (e) => {
        if (document.getElementById('exam-active')?.style.display === 'block') {
            const optionCard = e.target.closest('.option-card');
            if (optionCard) {
                e.preventDefault(); // Prevent standard right-click menu
                
                // Find which option (0-3) was clicked
                const allOptions = Array.from(optionCard.parentElement.children);
                const optIdx = allOptions.indexOf(optionCard);
                
                if (!window.eliminatedOptions[currentQIndex]) {
                    window.eliminatedOptions[currentQIndex] = [];
                }
                
                const idxInArray = window.eliminatedOptions[currentQIndex].indexOf(optIdx);
                if (idxInArray > -1) {
                    // Restore Option
                    window.eliminatedOptions[currentQIndex].splice(idxInArray, 1);
                    optionCard.style.opacity = '1';
                    optionCard.style.textDecoration = 'none';
                } else {
                    // Eliminate Option
                    window.eliminatedOptions[currentQIndex].push(optIdx);
                    optionCard.style.opacity = '0.3';
                    optionCard.style.textDecoration = 'line-through';
                    optionCard.style.textDecorationColor = 'var(--neon-red)';
                }
            }
        }
    });

    // Re-apply eliminations when user navigates back to a previous question
    const optContainer = document.getElementById('active-options-container');
    if (optContainer) {
        const optionsObserver = new MutationObserver(() => {
            if (window.eliminatedOptions[currentQIndex]) {
                const allOptions = document.querySelectorAll('#active-options-container .option-card');
                window.eliminatedOptions[currentQIndex].forEach(optIdx => {
                    if (allOptions[optIdx]) {
                        allOptions[optIdx].style.opacity = '0.3';
                        allOptions[optIdx].style.textDecoration = 'line-through';
                        allOptions[optIdx].style.textDecorationColor = 'var(--neon-red)';
                    }
                });
            }
        });
        optionsObserver.observe(optContainer, { childList: true });
    }

    // 6. BLIND GUESS TRACKER (Hotkey 'G')
    window.guessedQuestions = window.guessedQuestions || {};

    document.addEventListener('keydown', (e) => {
        if (document.getElementById('exam-active')?.style.display === 'block' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            if (e.key.toLowerCase() === 'g') {
                e.preventDefault();
                // Toggle Guess State
                window.guessedQuestions[currentQIndex] = !window.guessedQuestions[currentQIndex];
                
                // Flash UI Feedback on Palette
                const palBtn = document.getElementById(`pal-${currentQIndex}`);
                if (palBtn) {
                    if (window.guessedQuestions[currentQIndex]) {
                        palBtn.classList.add('guessed-tag');
                    } else {
                        palBtn.classList.remove('guessed-tag');
                    }
                }
            }
        }
    });

    // 7. INJECT "GUESSED" BADGE INTO FINAL RESULTS REPORT
    const examResultsNode = document.getElementById('exam-results');
    if (examResultsNode) {
        const reviewObserver = new MutationObserver(() => {
            if (examResultsNode.style.display === 'block') {
                const cards = document.querySelectorAll('#review-container .glass-card');
                cards.forEach(card => {
                    const textMatch = card.querySelector('p').innerText.match(/Q(\d+)\./);
                    if (textMatch) {
                        const qId = parseInt(textMatch[1]) - 1; // Convert back to 0-index
                        
                        // If guessed and not yet tagged
                        if (window.guessedQuestions[qId] && !card.dataset.guessTagged) {
                            card.querySelector('p').innerHTML += ` <span style="background:#a855f7; color:#fff; padding:2px 8px; border-radius:12px; font-size:10px; margin-left:12px; font-weight:800; letter-spacing:1px; box-shadow: 0 0 10px rgba(168,85,247,0.5);">❓ GUESSED</span>`;
                            card.dataset.guessTagged = "true";
                        }
                    }
                });
            }
        });
        reviewObserver.observe(examResultsNode, { attributes: true, attributeFilter: ['style'], childList: true, subtree: true });
    }

    // 8. CLEAR TRACKERS ON NEW EXAM
    const launchBtn = document.getElementById('launch-btn');
    if (launchBtn) {
        launchBtn.addEventListener('click', () => {
            window.guessedQuestions = {};
            window.eliminatedOptions = {};
        });
    }
});
