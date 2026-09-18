// ==========================================
// NEXUS OS: DAILY EVENING NOTIFIER (FIXED)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Inject the toggle button into the Settings Page dynamically
    const settingsCard = document.querySelector('#page-settings .glass-card');
    if (settingsCard) {
        const notifSection = document.createElement('div');
        notifSection.innerHTML = `
            <hr style="border: none; border-top: 1px solid var(--border-glow); margin: 30px 0;">
            <h3 style="color: var(--neon-cyan); margin-top:0; font-size: 16px; letter-spacing: 1px;">Mobile Notifications</h3>
            <p style="color: var(--text-muted); font-size: 13px;">Daily 6:00 PM reminder based on your last taken subject.</p>
            <button id="enable-notifs-btn" class="cyber-btn secondary" style="width: auto; margin-top: 8px;">🔔 Enable Evening Reminders</button>
        `;
        settingsCard.appendChild(notifSection);

        const btn = document.getElementById('enable-notifs-btn');
        
        if (Notification.permission === "granted") {
            btn.innerHTML = "✅ Notifications Active";
            btn.style.color = "var(--neon-green)";
            btn.style.borderColor = "var(--neon-green)";
        }

        btn.addEventListener('click', async () => {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                btn.innerHTML = "✅ Notifications Active";
                btn.style.color = "var(--neon-green)";
                btn.style.borderColor = "var(--neon-green)";
                
                // Fire a test notification to confirm it works
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(registration => {
                        registration.showNotification("NEXUS OS", {
                            body: "Evening quiz reminders are now active.",
                            icon: "icon.png",
                            vibrate: [200, 100, 200]
                        });
                    });
                }
                
                scheduleOfflineNotification();
            } else {
                alert("Notification permission denied by your browser.");
            }
        });
    }

    // 2. The Core Notification Logic
    function fireEveningNotification() {
        const now = new Date();
        const currentHour = now.getHours();
        
        // Target: ANY time after 6:00 PM (18:00) until midnight
        if (currentHour >= 18) {
            const lastConfigStr = localStorage.getItem("NEXUS_LAST_CONFIG");
            const lastNotified = localStorage.getItem("NEXUS_NOTIFIED_DATE");
            const todayStr = now.toLocaleDateString();

            // Fire only if we haven't notified today and permission is granted
            if (lastConfigStr && lastNotified !== todayStr && Notification.permission === "granted") {
                
                const lastConfig = JSON.parse(lastConfigStr);
                const subject = lastConfig.subject || "General Studies";
                const topic = lastConfig.topic || "Mixed Topics";

                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(registration => {
                        registration.showNotification("Evening Revision Time! 🧠", {
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
        
        const now = new Date();
        const targetTime = new Date();
        targetTime.setHours(16, 25, 0, 0); // Set to 6:00 PM today

        // If it's already past 6 PM, schedule for tomorrow
        if (now.getTime() > targetTime.getTime()) {
            targetTime.setDate(targetTime.getDate() + 1);
        }

        const lastConfig = JSON.parse(localStorage.getItem("NEXUS_LAST_CONFIG") || "{}");
        const subject = lastConfig.subject || "General Studies";

        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification("Evening Revision Time! 🧠", {
                body: `Scheduled daily quiz reminder for ${subject}.`,
                icon: "icon.png",
                tag: "daily-quiz-reminder",
                showTrigger: new TimestampTrigger(targetTime.getTime()) // Hands scheduling to Android OS
            });
        });
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
