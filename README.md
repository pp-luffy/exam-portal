# NEXUS OS | Cybernetic CBT Suite 🚀

NEXUS OS is an advanced, AI-driven Computer-Based Testing (CBT) platform designed for rigorous competitive exam preparation (e.g., JEE, NEET, UPSC, OPSC). It dynamically synthesizes high-quality, zero-duplication multiple-choice questions using a multi-provider LLM architecture, rigorously verifies them through a 2-Tier Quality Assurance pipeline, and evaluates students with real-world exam constraints.

## 🌟 Core Features

### 1. Advanced Neural Generation (Exam Engine)
* **Multi-Provider Support:** Plug-and-play support for Google Gemini, Groq Cloud (LPU Hardware), OpenRouter, and DeepSeek APIs.
* **Dynamic Batching & Token Bypass:** Automatically chunks large requests (e.g., 75+ questions) into secure batches of 25 to bypass LLM output token limits.
* **API Key Alternation:** Seamlessly ping-pongs between Primary and Secondary (Verification) API keys to bypass rate limits during heavy generations.
* **Contextual Anti-Duplication:** Dynamically injects previously generated concepts into subsequent generation batches to ensure zero repetitive questions.
* **"Index-0" Anchor Trick:** LLMs are strictly prompted to output the correct answer at Index 0 to prevent hallucinated indexing. The frontend engine then perfectly randomizes the options before rendering.

### 2. 2-Tier Quality Assurance Pipeline (Phase 2)
To ensure 100% factual accuracy and correct formatting, the engine runs a dual-layer audit on generated questions:
* **Tier 1 (Fast Flagging):** A lightweight model (e.g., 20B parameter) scans the generated batches for illogical distractors or factual errors. 
* **Tier 2 (Expert Deep Review):** If Tier 1 flags an anomaly, the flagged questions are escalated to a heavyweight reasoning model (e.g., 120B parameter) to verify the hallucination and inject the final correction.

### 3. Professional CBT Interface
* **Real-Time Question Palette:** A responsive grid showing the status of all questions (Answered, Empty, Marked for Review).
* **Quick Filters:** Instantly filter the palette to show "All", "Review" only, or "Empty" (Unanswered) questions.
* **Per-Question Time Tracking:** The engine silently counts the exact seconds spent on every individual question.
* **Critical Timer Visuals:** The countdown timer smoothly pulses "Neon Red" when the time drops below 60 seconds to simulate exam pressure.
* **Smooth Transitions:** Micro-animations smoothly fade-slide questions into view during navigation.
* **Exam-Grade Scoring:** Accurate negative marking calculations, handling complex fractional penalties (e.g., -0.33, -0.67).

### 4. Mistake Vault & Spaced Repetition System (SRS)
* **Automated Archiving:** Incorrectly answered questions are automatically transferred to the "Mistake Vault".
* **Algorithmic Spaced Repetition:** The vault acts as a dynamic flashcard system. Questions are resurfaced based on the forgetting curve (Intervals: 1 Day → 3 Days → 7 Days → 14 Days → 30 Days).
* **Active Recall Testing:** When a question is due for review, options are re-shuffled. Answering correctly increases the SRS Level; failing resets the interval back to Level 0 (1 Day).

### 5. Post-Exam Analytics & Reports
* **Time Traps Detection:** The final report highlights questions where the user spent excessive time (>120 seconds), identifying pacing bottlenecks even on correctly answered questions.
* **Rich Filtering:** Filter the final review screen by "All Questions", "Correct Only", or "Wrong/Mistakes Only".
* **Export & Dispatch:** Instantly download the assessment report as a styled HTML file or PDF, and one-click dispatch it to a pre-configured destination email ID.

### 6. Integrated NEXUS AI Tutor
* **Syllabus Support:** A dedicated chat interface connected to top-tier reasoning models.
* **Contextual Explanations:** Allows the operator to ask for conceptual breakdowns or syllabus doubts without leaving the portal.

### 7. Persistent Session Management
* **Auto-Save Configuration:** Exam targets, subjects, difficulties, timers, and marking schemes are saved locally. When the app boots, your exact previous setup is instantly restored.
* **Local Storage Telemetry:** 100% serverless data storage. Vaults, API keys, and session states are securely stored in the browser's `localStorage`.
* **Export Backup:** One-click JSON backup of all internal data, Vault progress, and configurations.

---

## 🛠️ Setup & Installation

NEXUS OS is completely client-side and requires no backend servers or databases.

1. Clone the repository:
   ```bash
   git clone [https://github.com/pp-luffy/exam-portal.git](https://github.com/pp-luffy/exam-portal.git)
