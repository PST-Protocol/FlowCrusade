import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors());
app.use(express.json());

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildLocalBreakdown(task, context = "") {
  const lower = `${task} ${context}`.toLowerCase();

  let taskType = "general";
  let steps = [];

  if (lower.includes("essay") || lower.includes("write") || lower.includes("paper")) {
    taskType = "essay";
    steps = [
      {
        id: "step-1",
        title: "Gather 2 relevant sources",
        desc: "Find a couple of credible sources or notes to start with.",
        estimatedMinutes: 10,
        priority: 1,
        status: "pending",
        children: [],
      },
      {
        id: "step-2",
        title: "Draft a simple outline",
        desc: "Write down the introduction, 2 to 3 body points, and conclusion.",
        estimatedMinutes: 10,
        priority: 2,
        status: "pending",
        children: [],
      },
      {
        id: "step-3",
        title: "Write the introduction paragraph",
        desc: "Start with a rough first paragraph instead of aiming for perfection.",
        estimatedMinutes: 15,
        priority: 3,
        status: "pending",
        children: [],
      },
    ];
  } else if (lower.includes("study") || lower.includes("exam") || lower.includes("quiz")) {
    taskType = "study";
    steps = [
      {
        id: "step-1",
        title: "List the topics to review",
        desc: "Write down the key topics or chapters first.",
        estimatedMinutes: 5,
        priority: 1,
        status: "pending",
        children: [],
      },
      {
        id: "step-2",
        title: "Review one weak topic",
        desc: "Choose the hardest topic and spend a short block reviewing it.",
        estimatedMinutes: 15,
        priority: 2,
        status: "pending",
        children: [],
      },
      {
        id: "step-3",
        title: "Do 2 practice problems",
        desc: "Try a couple of problems to check understanding.",
        estimatedMinutes: 15,
        priority: 3,
        status: "pending",
        children: [],
      },
    ];
  } else if (lower.includes("meeting") || lower.includes("slides") || lower.includes("presentation")) {
    taskType = "meeting";
    steps = [
      {
        id: "step-1",
        title: "List the main points to cover",
        desc: "Write down the 3 key things that need to be discussed or shown.",
        estimatedMinutes: 5,
        priority: 1,
        status: "pending",
        children: [],
      },
      {
        id: "step-2",
        title: "Prepare supporting materials",
        desc: "Gather notes, links, or slides you will need.",
        estimatedMinutes: 15,
        priority: 2,
        status: "pending",
        children: [],
      },
      {
        id: "step-3",
        title: "Write a short opening script",
        desc: "Prepare the first few sentences so it is easier to start.",
        estimatedMinutes: 10,
        priority: 3,
        status: "pending",
        children: [],
      },
    ];
  } else {
    taskType = "general";
    steps = [
      {
        id: "step-1",
        title: "Clarify the immediate goal",
        desc: "Write one sentence describing what needs to be finished first.",
        estimatedMinutes: 5,
        priority: 1,
        status: "pending",
        children: [],
      },
      {
        id: "step-2",
        title: "Prepare what you need",
        desc: "Open the document, tab, or material needed to start.",
        estimatedMinutes: 5,
        priority: 2,
        status: "pending",
        children: [],
      },
      {
        id: "step-3",
        title: "Do one small starter action",
        desc: "Take the smallest visible step to reduce friction.",
        estimatedMinutes: 10,
        priority: 3,
        status: "pending",
        children: [],
      },
    ];
  }

  return {
    taskType,
    steps,
    nextStep: steps[0]?.title || "Start with the first small step",
    source: "fallback",
  };
}

async function callGemini(prompt) {
  const models = [
    "gemini-2.5-flash",
    "gemini-1.5-pro",
  ];

  let lastError = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      });

      console.log(`Gemini model ${model} attempt ${attempt} status:`, response.status);

      if (response.ok) {
        const data = await response.json();
        return data;
      }

      const errText = await response.text();
      console.log(`Gemini model ${model} attempt ${attempt} error:`, errText);
      lastError = errText;

      if (response.status === 503 && attempt < 3) {
        await sleep(1200 * attempt);
        continue;
      }

      if (response.status !== 503) {
        break;
      }
    }
  }

  throw new Error(lastError || "All Gemini requests failed");
}

app.post("/api/breakdown", async (req, res) => {
  try {
    const { task, context } = req.body ?? {};

    if (!task || typeof task !== "string") {
      return res.status(400).json({ error: "task is required" });
    }

    const prompt = `
You are an assistant that breaks a high-level task into small, concrete, actionable steps for a user with ADHD.

Requirements:
- Return 3 to 6 steps
- Each step must be easy to start
- Each step should take about 5 to 20 minutes
- Prioritize the best first action
- Output valid JSON only
- Do not include markdown

JSON format:
{
  "taskType": "string",
  "steps": [
    {
      "id": "string",
      "title": "string",
      "desc": "string",
      "estimatedMinutes": number,
      "priority": number,
      "status": "pending",
      "children": []
    }
  ],
  "nextStep": "string"
}

Task: ${task}
Context: ${context || "No extra context"}
`.trim();

    try {
      const data = await callGemini(prompt);
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      console.log("Gemini content:", content);

      const parsed = safeJsonParse(content);

      if (!parsed || !Array.isArray(parsed.steps)) {
        console.log("Falling back because AI response format was invalid");
        return res.json(buildLocalBreakdown(task, context));
      }

      return res.json({
        ...parsed,
        source: "gemini",
      });
    } catch (aiError) {
      console.log("Falling back to local breakdown:", aiError.message);
      return res.json(buildLocalBreakdown(task, context));
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 AI server running at http://localhost:${PORT}`);
});