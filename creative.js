/**
 * NEXUS OS - Creative Features & Advanced Styles Utility
 * Handles ambient visual feedback, haptic-style ripple effects, and dynamic UI toasts.
 */

document.addEventListener("DOMContentLoaded", () => {
    // Inject custom creative styling rules dynamically
    const creativeStyle = document.createElement('style');
    creativeStyle.textContent = `
        @keyframes nexusGlowPulse {
            0% { box-shadow: 0 0 5px rgba(0, 242, 254, 0.2); }
            50% { box-shadow: 0 0 20px rgba(0, 242, 254, 0.6); }
            100% { box-shadow: 0 0 5px rgba(0, 242, 254, 0.2); }
        }
        .glass-card:hover {
            animation: nexusGlowPulse 3s infinite ease-in-out;
            border-color: rgba(0, 242, 254, 0.4);
        }
        .nexus-toast {
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            background: rgba(3, 7, 18, 0.95);
            border: 1px solid var(--neon-cyan, #00f2fe);
            color: #fff;
            padding: 12px 24px;
            border-radius: 30px;
            font-size: 13px;
            font-weight: 600;
            box-shadow: 0 10px 30px rgba(0, 242, 254, 0.3);
            z-index: 9999;
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            pointer-events: none;
        }
        .nexus-toast.show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    `;
    document.head.appendChild(creativeStyle);

    // Create persistent toast container element
    const toastEl = document.createElement('div');
    toastEl.className = 'nexus-toast';
    toastEl.id = 'nexus-global-toast';
    document.body.appendChild(toastEl);

    // Attach subtle interactive click ripples to buttons for high-tech feel
    document.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('.cyber-btn');
        if (!targetBtn) return;

        const circle = document.createElement('span');
        const diameter = Math.max(targetBtn.clientWidth, targetBtn.clientHeight);
        const radius = diameter / 2;

        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${e.clientX - targetBtn.getBoundingClientRect().left - radius}px`;
        circle.style.top = `${e.clientY - targetBtn.getBoundingClientRect().top - radius}px`;
        circle.style.position = 'absolute';
        circle.style.borderRadius = '50%';
        circle.style.background = 'rgba(255, 255, 255, 0.3)';
        circle.style.transform = 'scale(0)';
        circle.style.animation = 'rippleEffect 0.6s linear';
        circle.style.pointerEvents = 'none';

        // Ensure relative positioning on button for absolute ripple containment
        if (getComputedStyle(targetBtn).position === 'static') {
            targetBtn.style.position = 'relative';
        }
        targetBtn.style.overflow = 'hidden';
        targetBtn.appendChild(circle);

        setTimeout(() => circle.remove(), 600);
    });

    // Add ripple CSS animation dynamically
    const rippleKeyframes = document.createElement('style');
    rippleKeyframes.textContent = `
        @keyframes rippleEffect {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(rippleKeyframes);
});

/**
 * Global creative helper to display stylish floating feedback notifications.
 * @param {string} message 
 */
function showNexusToast(message) {
    const toast = document.getElementById('nexus-global-toast');
    if (!toast) return;
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
