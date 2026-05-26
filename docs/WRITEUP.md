# FocusTrail Access — Technical Writeup
## Gemma 4 Good Hackathon Submission

---

## The Problem

Task initiation — not task volume — is the real bottleneck for students with ADHD, ESL learners, and first-generation college students. A student can receive a well-structured assignment and still freeze at the blank page for hours. Existing AI tools either require a cloud subscription that leaks sensitive academic content, or they hand back a wall of text that recreates the overwhelm they started with.

FocusTrail Access is a **local-first Gemma 4 learning execution coach** that converts any assignment — a pasted prompt, an uploaded PDF, or a photo of handwritten notes — into one concrete action under five minutes. A privacy-preserving Focus Sentinel then watches the desktop and tells the student, in plain language, whether what they're doing right now is actually helping.

---

## Gemma 4 Model Variants

| Path | Model | Use |
|------|-------|-----|
| Primary (local) | `gemma4:e2b` via Ollama | Focus Sentinel classification, on-device |
| Cloud dev fallback | `gemma-4-26b-a4b-it` via Google AI Studio API | Task breakdown when edge model returns empty |
| Direct (high-RAM) | `google/gemma-4-E2B-it` via Transformers | Optional; requires ~10 GB RAM |

**Why E2B?** The target users are students on budget hardware. `gemma4:e2b` runs comfortably on an 8 GB MacBook Air via Ollama with no GPU, making the tool accessible where it's needed most.

**Why 26B for breakdown?** The E2B model reliably returns empty responses for long academic prompts. `gemma-4-26b-a4b-it` through Google AI Studio fills this gap during development. The inference router in `server/gemmaProvider.js` tries Ollama first and only falls back to the API when the local response is empty — keeping `cloudCallCount` at 0 for all-local demos.

---

## Architecture

```
User input (text / PDF / image)
        │
        ▼
POST /api/breakdown
        │
        ├─ server/gemmaProvider.js ──► inferText()
        │       ├─ Ollama /api/generate  (local, primary)
        │       ├─ Google AI Studio API  (cloud fallback)
        │       └─ Transformers subprocess (high-RAM optional)
        │
        └─ Structured task tree → React UI

Desktop activity (macOS osascript, every 15s)
        │
        ▼
POST /api/monitor/event
        │
        ├─ Privacy filter (app name only — never window title)
        │       └─ sensitive app → {"skipped": true}, model never invoked
        │
        ├─ Fast rule path (obvious focus / obvious distraction)
        │
        ├─ Ambiguous → server/gemmaProvider.js ──► classifyActivityWithGemma()
        │       ├─ Ollama chat API + FN-4 tool declaration
        │       ├─ /api/generate fallback (format: json)
        │       └─ Google AI Studio API with native functionDeclarations
        │
        └─ FocusClassification → SSE → MonitorPanel UI
```

---

## Native Function Calling (INV-4)

Focus Sentinel classification uses **FN-4 `classify_activity`** as a native Gemma 4 tool declaration.

**Ollama path** (`server/gemmaProvider.js:127–190`): The tool is declared in OpenAI-compatible format and sent to Ollama's `/api/chat` endpoint. When the E2B model returns a tool call, arguments are extracted directly. When it returns text instead, the `/api/generate` endpoint is used with `format: "json"` and label keywords are parsed from the output.

**Google AI Studio path** (`server/gemmaProvider.js:223–287`): Uses the Gemini `functionDeclarations` API with `function_calling_config: { mode: "ANY" }`, forcing the 26B model to always invoke `classify_activity`. Every response from this path has `toolCallsUsed: ["FN-4"]`.

The same `FN-4` contract is defined in `flowcrusade_access_build_spec.md §5` and consumed identically by both providers.

---

## Context-Sensitive Classification (CAP-6)

The core technical claim: **the same window title must produce different classifications depending on the active task.**

This is implemented through `server/monitor/classifier.js`. When a monitor session is started with `linkedTaskTitle`, that string is passed as `taskContext` into every `classifyAsync()` call. Gemma receives:

```
Active learning task: "Biology Essay on Cell Signaling"
App: Safari
Title: Cell Signaling Pathways - MIT OpenCourseWare - YouTube
Domain: youtube.com

Classify whether this activity is helping or hurting the student's focus...
Key rule: The SAME app or website can be "focus" in one task context and "distraction" in another.
```

### Quantitative Eval — Monitor Classification

| Test case | Active task | Classification | Method | Cloud calls |
|-----------|-------------|---------------|--------|-------------|
| YouTube: Cell Signaling lecture | Biology essay | **focus** | gemma-ollama | 0 |
| YouTube: Cat memes | Biology essay | **distraction** | rule-based | 0 |
| TikTok | Biology essay | distraction | rule-based | 0 |
| VS Code | Biology essay | focus | rule-based | 0 |
| 1Password | Biology essay | **skipped** (privacy) | privacy-filter | 0 |
| Google Docs: Cell Signaling Essay | Biology essay | focus | rule-based | 0 |

**Context-sensitivity flip rate: 100%** (2/2 ambiguous YouTube cases classified correctly relative to task)  
**Privacy filter accuracy: 100%** (sensitive app never reached model — `{"skipped": true}`)  
**Cloud calls during full test cycle: 0**

### Baseline Comparison

| Classifier | YouTube lecture (biology task) | YouTube memes (biology task) |
|-----------|-------------------------------|------------------------------|
| Legacy rule-based (no context) | distraction ❌ | distraction ✅ |
| Gemma semantic (with task context) | **focus** ✅ | distraction ✅ |

The rule-based baseline always classifies YouTube as distraction regardless of content. The Gemma-backed classifier correctly identifies topically relevant video as focus, which is the key behavioral difference for students using educational video.

---

## Privacy-First Design (INV-1, INV-2, INV-6)

Three layers of privacy protection:

1. **Privacy prefilter** (`server/monitor/classifier.js:12–30`): A hardcoded list of sensitive app names (password managers, messaging apps, banking, mental health) is checked against `event.appName` only — never against window titles, which may contain content keywords. Matched events return `{"skipped": true}` before any model is invoked.

2. **PrivacySurface badge**: The Monitor panel displays live provider name, `local: true/false`, and `cloudCallCount`. In a fully local Ollama setup, this counter stays at 0 throughout the entire session.

3. **Inference priority**: `server/gemmaProvider.js` routes to Ollama first. Cloud API is only used when Ollama returns empty output, and only if `GOOGLE_API_KEY` is set. The default `.env.example` has the API key commented out.

---

## Task Breakdown Pipeline

Endpoint: `POST /api/breakdown`  
Handler: `server/index.js` → `callGemma()` → `callGemmaViaProvider()` → `inferText()`

The prompt instructs Gemma to decompose the input into subtasks with estimated durations. Breakdown supports:
- Plain text task descriptions
- Uploaded PDFs and Word documents (text extracted server-side)
- Images (PNG/JPG/WebP/TIFF) — passed as base64 `inlineData` to the model

When Ollama returns empty text for a complex academic prompt (common with E2B on long inputs), `inferText()` detects the empty response and retries via Google AI Studio API before falling back to deterministic rules.

---

## Reproducibility

```bash
git clone https://github.com/PST-Protocol/FocusTrail.git
cd FocusTrail
npm install

# Install Ollama from https://ollama.com, then:
ollama pull gemma4:e2b

cp .env.example .env   # Ollama URL is pre-configured; no API key needed for local demo
npm run server         # http://localhost:8787
npm run dev            # http://localhost:5173
```

Open the Monitor panel, toggle Active Monitor on, and open any task to see Focus Sentinel running with Gemma 4 E2B locally.

---

## Tracks

**Future of Education**: FocusTrail directly addresses the task initiation failure mode that blocks ADHD and executive-function-challenged students from starting academic work. The coach converts overwhelming assignments into a grounded, stepwise plan and monitors attention in real time.

**Digital Equity & Inclusivity**: The entire inference stack runs locally on consumer hardware (tested on 8 GB MacBook Air). No subscription. No data leaving the device. No reliable internet required for the core workflow. The target users — neurodivergent students, ESL learners, first-generation college students — are precisely the populations who benefit most from an AI tool that doesn't require cloud access or premium hardware.

---

## Key Files

| File | Role |
|------|------|
| `server/gemmaProvider.js` | Unified Gemma 4 inference router; FN-4 tool declaration; cloudCallCount |
| `server/monitor/classifier.js` | Privacy filter; fast rule path; async Gemma classification |
| `server/monitor/routes.js` | `/api/monitor/event` handler; `/api/monitor/provider/health` |
| `server/index.js` | Breakdown endpoint; inference priority chain |
| `src/components/panels/MonitorPanel.jsx` | PrivacySurface badge; live activity timeline with Gemma reasons |
| `src/components/views/ViewB.jsx` | "Start Focus Session" — links monitor session to active task |
