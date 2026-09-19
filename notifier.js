// ==========================================
// NEXUS OS: DYNAMIC DAILY NOTIFIER
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Inject the configuration UI into the Settings Page dynamically
    const settingsCard = document.querySelector('#page-settings .glass-card');
    if (settingsCard) {
        const notifSection = document.createElement('div');
        notifSection.innerHTML = `
            <hr style="border: none; border-top: 1px solid var(--border-glow); margin: 30px 0;">
            <h3 style="color: var(--neon-cyan); margin-top:0; font-size: 16px; letter-spacing: 1px;">Assessment Reminders</h3>
            <p style="color: var(--text-muted); font-size: 13px;">Schedule a daily revision notification based on your last active subject.</p>
            
            <div style="display: flex; gap: 14px; align-items: center; margin-top: 12px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 140px;">
                    <label style="margin-top:0;">Reminder Time</label>
                    <input type="time" id="notif-time" style="padding: 12px; margin-top: 6px; font-family: 'JetBrains Mono', monospace;">
                </div>
                <div style="flex: 1; min-width: 140px; display: flex; align-items: flex-end;">
                    <button id="toggle-notifs-btn" class="cyber-btn secondary" style="margin: 0; padding: 13px;">🔔 Enable Reminders</button>
                </div>
            </div>
            <p id="notif-status-msg" style="color: var(--neon-green); font-size: 12px; display: none; margin-top: 12px; font-weight: 600;"></p>
        `;
        settingsCard.appendChild(notifSection);

        const toggleBtn = document.getElementById('toggle-notifs-btn');
        const timeInput = document.getElementById('notif-time');
        const statusMsg = document.getElementById('notif-status-msg');

        // Load saved preferences
        let isEnabled = localStorage.getItem("NEXUS_NOTIF_ENABLED") === "true";
        let savedTime = localStorage.getItem("NEXUS_NOTIF_TIME") || "18:00"; // Default 6:00 PM
        timeInput.value = savedTime;

        // UI Updater Function
        const updateUI = () => {
            if (isEnabled && Notification.permission === "granted") {
                toggleBtn.innerHTML = "🔕 Disable Reminders";
                toggleBtn.style.color = "var(--bg-deep)";
                toggleBtn.style.background = "var(--neon-cyan)";
                toggleBtn.style.borderColor = "var(--neon-cyan)";
            } else {
                toggleBtn.innerHTML = "🔔 Enable Reminders";
                toggleBtn.style.color = "";
                toggleBtn.style.background = "";
                toggleBtn.style.borderColor = "";
                isEnabled = false; // Sync state if permission revoked externally
                localStorage.setItem("NEXUS_NOTIF_ENABLED", "false");
            }
        };

        const showStatus = (msg, color = "var(--neon-green)") => {
            statusMsg.textContent = msg;
            statusMsg.style.color = color;
            statusMsg.style.display = "block";
            setTimeout(() => { statusMsg.style.display = "none"; }, 3500);
        };

        updateUI();

        // Handle Toggle Button Click
        toggleBtn.addEventListener('click', async () => {
            if (isEnabled) {
                // User is DISABLING notifications
                isEnabled = false;
                localStorage.setItem("NEXUS_NOTIF_ENABLED", "false");
                updateUI();
                cancelOfflineNotification();
                showStatus("Reminders successfully disabled.", "var(--neon-yellow)");
            } else {
                // User is ENABLING notifications
                const permission = await Notification.requestPermission();
                if (permission === "granted") {
                    isEnabled = true;
                    localStorage.setItem("NEXUS_NOTIF_ENABLED", "true");
                    localStorage.setItem("NEXUS_NOTIF_TIME", timeInput.value);
                    updateUI();
                    
                    // Fire a test notification
                    if ('serviceWorker' in navigator) {
                        navigator.serviceWorker.ready.then(registration => {
                            registration.showNotification("NEXUS OS", {
                                body: `Daily reminders set for ${timeInput.value}.`,
                                icon: "icon.png",
                                vibrate: [200, 100, 200]
                            });
                        });
                    }
                    
                    scheduleOfflineNotification();
                    showStatus("Reminders activated!");
                } else {
                    alert("Notification permission denied by your browser settings.");
                }
            }
        });

        // Handle Time Change
        timeInput.addEventListener('change', () => {
            localStorage.setItem("NEXUS_NOTIF_TIME", timeInput.value);
            localStorage.removeItem("NEXUS_NOTIFIED_DATE"); // Reset today's flag so new time can trigger
            
            if (isEnabled) {
                scheduleOfflineNotification();
                showStatus("Reminder time updated to " + timeInput.value);
            }
        });
    }

    // 2. The Core Notification Logic
    function fireEveningNotification() {
        if (localStorage.getItem("NEXUS_NOTIF_ENABLED") !== "true") return;
        if (Notification.permission !== "granted") return;

        const savedTime = localStorage.getItem("NEXUS_NOTIF_TIME") || "18:00";
        const [targetHour, targetMinute] = savedTime.split(':').map(Number);
        
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // Target: Any time after the user's selected time
        const isPastTargetTime = (currentHour > targetHour) || (currentHour === targetHour && currentMinute >= targetMinute);
        
        if (isPastTargetTime) {
            const lastConfigStr = localStorage.getItem("NEXUS_LAST_CONFIG");
            const lastNotified = localStorage.getItem("NEXUS_NOTIFIED_DATE");
            const todayStr = now.toLocaleDateString();

            // Fire only if we haven't notified today
            if (lastConfigStr && lastNotified !== todayStr) {
                
                const lastConfig = JSON.parse(lastConfigStr);
                const subject = lastConfig.subject || "General Studies";
                const topic = lastConfig.topic || "Mixed Topics";

                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(registration => {
                        registration.showNotification("Revision Time! 🧠", {
                            body: `Ready for your daily quiz on ${subject} - ${topic}?`,
                            icon: "icon.png",
                            badge: "icon.png",
                            vibrate: [200, 100, 200, 100, 200],
                            tag: "daily-quiz-reminder",
                            requireInteraction: true 
                        });
                    });
                }

                // Log today's date to prevent spamming
                localStorage.setItem("NEXUS_NOTIFIED_DATE", todayStr);
            }
        }
    }

    // 3. Strategy A: Chrome Offline OS Scheduler (Supported Androids Only)
    function scheduleOfflineNotification() {
        if (!('showTrigger' in Notification.prototype)) return; // Exit if browser doesn't support it
        if (localStorage.getItem("NEXUS_NOTIF_ENABLED") !== "true") return;

        const savedTime = localStorage.getItem("NEXUS_NOTIF_TIME") || "18:00";
        const [targetHour, targetMinute] = savedTime.split(':').map(Number);

        const now = new Date();
        const targetTime = new Date();
        targetTime.setHours(targetHour, targetMinute, 0, 0);

        // If it's already past the target time, schedule for tomorrow
        if (now.getTime() > targetTime.getTime()) {
            targetTime.setDate(targetTime.getDate() + 1);
        }

        const lastConfig = JSON.parse(localStorage.getItem("NEXUS_LAST_CONFIG") || "{}");
        const subject = lastConfig.subject || "General Studies";

        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification("Revision Time! 🧠", {
                body: `Scheduled daily quiz reminder for ${subject}.`,
                icon: "icon.png",
                tag: "daily-quiz-reminder",
                showTrigger: new TimestampTrigger(targetTime.getTime()) // Hands scheduling to Android OS
            });
        });
    }

    // Safely close and cancel pending OS-level triggers
    function cancelOfflineNotification() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                // Fetch scheduled triggers using `includeTriggered: true`
                registration.getNotifications({ tag: "daily-quiz-reminder", includeTriggered: true }).then(notifications => {
                    notifications.forEach(notification => notification.close());
                });
            });
        }
    }

    // 4. Strategy B: Event-Driven Catch-Up (Works everywhere)
    // Fires instantly when you switch tabs or unlock the phone
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === 'visible') {
            fireEveningNotification();
            scheduleOfflineNotification(); // Re-schedule for tomorrow
        }
    });

    // 5. Strategy C: Lightweight Backup Polling
    // Runs in the background only when the app is actively open on the screen
    setInterval(fireEveningNotification, 60000); 
});
