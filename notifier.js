// ==========================================
// NEXUS OS: DAILY EVENING NOTIFIER
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Inject a toggle button into the Settings Page dynamically
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
        
        // Update button state if already granted
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
                
                // Fire a test notification
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(registration => {
                        registration.showNotification("NEXUS OS", {
                            body: "Evening quiz reminders are now active.",
                            icon: "icon.png",
                            vibrate: [200, 100, 200]
                        });
                    });
                }
            } else {
                alert("Notification permission denied by your browser.");
            }
        });
    }

    // 2. Background Clock for the 6:00 PM Trigger
    setInterval(() => {
        const now = new Date();
        
        // Target: 6 PM (18:00)
        if (now.getHours() === 16 && now.getMinutes() === 15) {
            
            const lastConfigStr = localStorage.getItem("NEXUS_LAST_CONFIG");
            const lastNotified = localStorage.getItem("NEXUS_NOTIFIED_DATE");
            const todayStr = now.toLocaleDateString();

            // Ensure we only notify once per day and we have a previous test to reference
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
                            requireInteraction: true // Keeps the notification on screen until tapped
                        });
                    });
                }

                // Log today's date so it doesn't fire repeatedly
                localStorage.setItem("NEXUS_NOTIFIED_DATE", todayStr);
            }
        }
    }, 60000); // Check every 60 seconds
});
