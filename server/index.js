import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8787;
const contextStore = new Map();
const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const LOG_DIR = path.join(__dirname, "logs");
const TEMP_ROOT_DIR = path.join(os.tmpdir(), "flow-crusade-gemini");
const CONTEXT_TTL_MS = 1000 * 60 * 60 * 6;

const SUPPORTED_TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/html",
  "text/csv",
  "text/xml",
  "application/json",
  "application/xml",
]);

const OFFICE_TO_PDF_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "application/rtf",
  "text/rtf",
]);

class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = options.statusCode || 500;
    this.publicMessage = options.publicMessage || message;
    this.details = options.details || message;
  }
}

function ensureDirectorySync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

ensureDirectorySync(LOG_DIR);
ensureDirectorySync(TEMP_ROOT_DIR);

function getLogFilePath() {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `flow-crusade-${day}.log`);
}

function redactLongText(value, max = 220) {
  if (typeof value !== "string") return value;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function buildFileMetaForLogs(file) {
  if (!file) return null;
  return {
    name: file.originalName || file.name || null,
    processedName: file.name || null,
    mimeType: file.originalMimeType || file.mimeType || null,
    processedMimeType: file.mimeType || null,
    size: Number(file.originalSize || file.size || 0),
    processedSize: Number(file.size || 0),
    wasConvertedToPdf: Boolean(file.wasConvertedToPdf),
  };
}

function writeLog(level, event, payload = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...payload,
  };

  const line = `${JSON.stringify(entry)}\n`;
  fs.appendFileSync(getLogFilePath(), line, "utf8");

  if (level === "error") {
    console.error(`[${event}]`, payload.message || payload.error || "error", payload.requestId ? `(requestId: ${payload.requestId})` : "");
  } else {
    console.log(`[${event}]`, payload.message || "", payload.requestId ? `(requestId: ${payload.requestId})` : "");
  }
}

function inferMimeTypeFromName(filename = "") {
  const ext = path.extname(filename).toLowerCase();

  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".odt":
      return "application/vnd.oasis.opendocument.text";
    case ".rtf":
      return "application/rtf";
    case ".txt":
      return "text/plain";
    case ".md":
      return "text/markdown";
    case ".csv":
      return "text/csv";
    case ".json":
      return "application/json";
    case ".xml":
      return "application/xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".heic":
      return "image/heic";
    case ".heif":
      return "image/heif";
    case ".bmp":
      return "image/bmp";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function getNormalizedMimeType(file) {
  return (file?.mimeType || inferMimeTypeFromName(file?.name || "") || "application/octet-stream").toLowerCase();
}

function canSendRawToGemini(mimeType = "") {
  if (!mimeType) return false;
  if (mimeType === "application/pdf") return true;
  if (SUPPORTED_TEXT_MIME_TYPES.has(mimeType)) return true;
  if (mimeType.startsWith("image/")) return true;
  if (mimeType.startsWith("audio/")) return true;
  if (mimeType.startsWith("video/")) return true;
  return false;
}

function shouldConvertOfficeDocumentToPdf(file) {
  const mimeType = getNormalizedMimeType(file);
  if (OFFICE_TO_PDF_MIME_TYPES.has(mimeType)) return true;

  const ext = path.extname(file?.name || "").toLowerCase();
  return [".doc", ".docx", ".odt", ".rtf"].includes(ext);
}

function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY ||
    ""
  ).trim();
}

function hasGeminiApiKey() {
  return Boolean(getGeminiApiKey());
}

app.use(cors());
app.use(express.json({ limit: "120mb" }));

function pruneOldContexts() {
  const now = Date.now();
  for (const [key, value] of contextStore.entries()) {
    if (!value?.createdAt || now - value.createdAt > CONTEXT_TTL_MS) {
      contextStore.delete(key);
    }
  }
}

function safeJsonParse(text) {
  if (!text || typeof text !== "string") return null;

  const candidates = [text];
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1]);

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }

  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    candidates.push(text.slice(firstBracket, lastBracket + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }

  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeTitle(text, fallback = "Uploaded Task") {
  if (!text || typeof text !== "string") return fallback;
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 80) || fallback;
}

function makeStep(idPrefix, index, title, desc) {
  return {
    id: `${idPrefix}-${index + 1}`,
    title,
    desc,
    estimatedMinutes: 10 + index * 5,
    priority: index + 1,
    status: "pending",
    children: [],
  };
}

function buildLocalInitialBreakdown(taskInput = "", fileMeta = null) {
  const sourceLabel = taskInput?.trim() || fileMeta?.originalName || fileMeta?.name || "uploaded task";
  const title = sanitizeTitle(
    taskInput?.trim() ||
      (fileMeta?.originalName || fileMeta?.name || "Uploaded Task").replace(/\.[^.]+$/, "") ||
      "Uploaded Task"
  );
  const rootDescription = taskInput?.trim()
    ? `Complete: ${taskInput.trim()}`
    : `Work through the uploaded file${fileMeta?.originalName || fileMeta?.name ? ` (${fileMeta.originalName || fileMeta.name})` : ""} and turn it into an actionable plan.`;

  return {
    rootTitle: title,
    rootDescription,
    steps: [
      makeStep("fallback-step", 0, "Understand the requirements", `Review the main goal and constraints for ${sourceLabel}.`),
      makeStep("fallback-step", 1, "Prepare the needed inputs", "Collect the key information, assets, or references required to execute the task."),
      makeStep("fallback-step", 2, "Execute the first concrete deliverable", "Produce the first visible output so the task starts moving forward."),
    ],
    source: "fallback",
  };
}

function buildLocalChildBreakdown(targetTitle = "Subtask") {
  return {
    steps: [
      makeStep("fallback-child", 0, `Clarify ${targetTitle}`, `Define exactly what success looks like for ${targetTitle}.`),
      makeStep("fallback-child", 1, `Do the core work for ${targetTitle}`, `Complete the main action required for ${targetTitle}.`),
      makeStep("fallback-child", 2, `Review and finalize ${targetTitle}`, `Check that ${targetTitle} is complete and ready to move on.`),
    ],
    source: "fallback",
  };
}

function buildLocalRegeneratedStep(targetNode, slotIndex = 0) {
  return {
    step: {
      id: targetNode?.id || `regen-${slotIndex + 1}`,
      title: sanitizeTitle(targetNode?.title || `Refined subtask ${slotIndex + 1}`),
      desc: targetNode?.desc || "Clarify this step with a more precise scope and outcome.",
      estimatedMinutes: targetNode?.estimatedMinutes || 15,
      priority: slotIndex + 1,
      status: "pending",
      children: [],
    },
    source: "fallback",
  };
}

function buildFilePart(file) {
  if (!file?.dataBase64 || !file?.mimeType) return null;
  return {
    inlineData: {
      mimeType: file.mimeType,
      data: file.dataBase64,
    },
  };
}

function getFileSummaryText(file) {
  if (!file) return "No uploaded file.";

  const originalName = file.originalName || file.name || "unnamed file";
  const originalMimeType = file.originalMimeType || file.mimeType || "unknown mime";
  const originalSize = Number(file.originalSize || file.size || 0);
  const conversionText = file.wasConvertedToPdf
    ? ` The file was converted to PDF before sending to Gemini so the layout can be preserved.`
    : "";

  return `Uploaded file: ${originalName} (${originalMimeType}, ${originalSize} bytes).${conversionText}`;
}

async function convertOfficeDocumentToPdf(file, requestId) {
  const tempDir = await fsp.mkdtemp(path.join(TEMP_ROOT_DIR, "office-"));
  const inputExt = path.extname(file?.name || "") || ".bin";
  const sourceName = `source${inputExt}`;
  const sourcePath = path.join(tempDir, sourceName);
  const outputPath = path.join(tempDir, "source.pdf");

  try {
    const rawBuffer = Buffer.from(file.dataBase64, "base64");
    await fsp.writeFile(sourcePath, rawBuffer);

    writeLog("info", "file.convert.start", {
      requestId,
      message: `Converting ${file.name || "office document"} to PDF for Gemini processing.`,
      file: buildFileMetaForLogs(file),
      tempDir,
    });

    await execFileAsync(
      "libreoffice",
      ["--headless", "--convert-to", "pdf", "--outdir", tempDir, sourcePath],
      {
        cwd: tempDir,
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    const pdfBuffer = await fsp.readFile(outputPath);
    const convertedFile = {
      name: `${path.basename(file.name || "uploaded-file", inputExt)}.pdf`,
      mimeType: "application/pdf",
      size: pdfBuffer.length,
      dataBase64: pdfBuffer.toString("base64"),
      originalName: file.name || null,
      originalMimeType: getNormalizedMimeType(file),
      originalSize: Number(file.size || rawBuffer.length || 0),
      wasConvertedToPdf: true,
    };

    writeLog("info", "file.convert.success", {
      requestId,
      message: `Converted ${file.name || "office document"} to PDF successfully.`,
      file: buildFileMetaForLogs(convertedFile),
    });

    return convertedFile;
  } catch (error) {
    writeLog("error", "file.convert.failed", {
      requestId,
      message: `Failed to convert ${file?.name || "office document"} to PDF.`,
      file: buildFileMetaForLogs(file),
      error: error.message,
    });

    throw new AppError(`Failed to convert ${file?.name || "uploaded document"} to PDF.`, {
      statusCode: 400,
      publicMessage: `We couldn't prepare your Word document (${file?.name || "unnamed file"}) for Gemini. Please retry or export it as PDF and upload again.`,
      details: error.message,
    });
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function prepareFileForGemini(file, requestId) {
  if (!file?.dataBase64) return null;

  const normalizedMimeType = getNormalizedMimeType(file);
  const normalizedFile = {
    name: file.name || "uploaded-file",
    mimeType: normalizedMimeType,
    size: Number(file.size || 0),
    dataBase64: file.dataBase64,
    originalName: file.name || null,
    originalMimeType: normalizedMimeType,
    originalSize: Number(file.size || 0),
    wasConvertedToPdf: false,
  };

  if (canSendRawToGemini(normalizedMimeType)) {
    writeLog("info", "file.prepare.raw", {
      requestId,
      message: `Sending ${normalizedFile.name} to Gemini in raw format.`,
      file: buildFileMetaForLogs(normalizedFile),
    });
    return normalizedFile;
  }

  if (shouldConvertOfficeDocumentToPdf(normalizedFile)) {
    return convertOfficeDocumentToPdf(normalizedFile, requestId);
  }

  writeLog("error", "file.prepare.unsupported", {
    requestId,
    message: `Unsupported uploaded file type: ${normalizedMimeType}`,
    file: buildFileMetaForLogs(normalizedFile),
  });

  throw new AppError(`Unsupported uploaded file type: ${normalizedMimeType}`, {
    statusCode: 400,
    publicMessage: `This upload type isn't supported yet: ${normalizedFile.name}. Please use PDF, image, plain text, or a Word document (.doc/.docx).`,
    details: `Unsupported MIME type: ${normalizedMimeType}`,
  });
}

async function callGemini(parts, requestId, actionLabel = "gemini-request") {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new AppError("Missing Gemini API key in environment.", {
      statusCode: 500,
      publicMessage: "Gemini is not configured on the server. Set GEMINI_API_KEY (or GOOGLE_API_KEY / API_KEY) in the environment and restart the server.",
      details: "Missing Gemini API key in environment.",
    });
  }

  const models = [
    "gemini-2.5-flash",
    "gemini-3-flash-preview",
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
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      });

      if (response.ok) {
        writeLog("info", "gemini.request.success", {
          requestId,
          message: `${actionLabel} succeeded on ${model}.`,
          model,
          attempt,
        });
        return response.json();
      }

      const errText = await response.text();
      lastError = errText;

      writeLog(response.status >= 500 ? "error" : "info", "gemini.request.retry", {
        requestId,
        message: `${actionLabel} failed on ${model} attempt ${attempt}.`,
        model,
        attempt,
        status: response.status,
        error: redactLongText(errText, 400),
      });

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

async function generateInitialBreakdown({ taskInput, file, requestId }) {
  const instruction = `
You are a task decomposition engine for a productivity MVP.

Use the user's typed input and/or uploaded file to infer the overall task and break it into EXACTLY 3 top-level subtasks.

Rules:
- Return VALID JSON only.
- Output exactly 3 top-level subtasks.
- The 3 subtasks must be parallel, non-overlapping, and together cover the full task.
- Make titles action-oriented and concise.
- Make descriptions concrete and useful, 1 to 2 sentences max.
- Priorities must be 1, 2, 3 in order.
- estimatedMinutes should be an integer from 5 to 30.
- status must be "pending".
- children must be [].
- If the typed input is empty, infer the task from the uploaded file.
- rootTitle should be concise and UI-friendly.
- rootDescription should summarize the goal and any key constraints you can infer.

JSON shape:
{
  "rootTitle": "string",
  "rootDescription": "string",
  "steps": [
    {
      "id": "step-1",
      "title": "string",
      "desc": "string",
      "estimatedMinutes": 10,
      "priority": 1,
      "status": "pending",
      "children": []
    }
  ]
}

Typed input:
${taskInput?.trim() || "<empty>"}

${getFileSummaryText(file)}
`.trim();

  const parts = [{ text: instruction }];
  const filePart = buildFilePart(file);
  if (filePart) parts.push(filePart);

  try {
    const data = await callGemini(parts, requestId, "initial breakdown");
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = safeJsonParse(content);

    if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length !== 3) {
      writeLog("info", "breakdown.initial.fallback", {
        requestId,
        message: "Gemini returned an invalid initial breakdown payload. Falling back to local breakdown.",
      });
      return buildLocalInitialBreakdown(taskInput, file);
    }

    return {
      rootTitle: sanitizeTitle(parsed.rootTitle, sanitizeTitle(taskInput || file?.originalName || file?.name?.replace(/\.[^.]+$/, "") || "Uploaded Task")),
      rootDescription: parsed.rootDescription || taskInput || `Plan derived from ${file?.originalName || file?.name || "uploaded file"}.`,
      steps: parsed.steps.slice(0, 3).map((step, index) => ({
        id: `step-${index + 1}`,
        title: sanitizeTitle(step.title, `Step ${index + 1}`),
        desc: step.desc || "",
        estimatedMinutes: Number(step.estimatedMinutes) || 10,
        priority: index + 1,
        status: "pending",
        children: [],
      })),
      source: "gemini",
    };
  } catch (error) {
    if (error instanceof AppError) throw error;

    writeLog("error", "breakdown.initial.error", {
      requestId,
      message: "Initial breakdown failed in Gemini. Falling back to local breakdown.",
      error: error.message,
      taskPreview: redactLongText(taskInput?.trim() || "<empty>", 180),
      file: buildFileMetaForLogs(file),
    });
    return buildLocalInitialBreakdown(taskInput, file);
  }
}

async function generateNodeBreakdown({ rootContext, targetNode, parentNode, file, requestId }) {
  const instruction = `
You are decomposing ONE selected subtask into EXACTLY 3 child subtasks.

Rules:
- Return VALID JSON only.
- Stay strictly within the selected subtask's scope.
- Do NOT expand back out to the whole project or overlap with sibling top-level tasks.
- Output exactly 3 child subtasks.
- Make them sequential and concrete.
- Titles should be concise and action-oriented.
- Descriptions should be specific and useful, 1 to 2 sentences max.
- priority must be 1, 2, 3.
- estimatedMinutes should be an integer from 5 to 25.
- status must be "pending".
- children must be [].

JSON shape:
{
  "steps": [
    {
      "id": "child-1",
      "title": "string",
      "desc": "string",
      "estimatedMinutes": 10,
      "priority": 1,
      "status": "pending",
      "children": []
    }
  ]
}

Original typed input:
${rootContext?.originalTaskInput?.trim() || "<empty>"}

Root task:
- Title: ${rootContext?.rootTitle || ""}
- Description: ${rootContext?.rootDescription || ""}

Parent scope:
- Title: ${parentNode?.title || rootContext?.rootTitle || ""}
- Description: ${parentNode?.desc || rootContext?.rootDescription || ""}

Selected subtask to expand:
- Title: ${targetNode?.title || ""}
- Description: ${targetNode?.desc || ""}

${getFileSummaryText(file)}
`.trim();

  const parts = [{ text: instruction }];
  const filePart = buildFilePart(file);
  if (filePart) parts.push(filePart);

  try {
    const data = await callGemini(parts, requestId, "node breakdown");
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = safeJsonParse(content);

    if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length !== 3) {
      writeLog("info", "breakdown.node.fallback", {
        requestId,
        message: "Gemini returned an invalid node breakdown payload. Falling back to local child breakdown.",
        targetNodeTitle: targetNode?.title || null,
      });
      return buildLocalChildBreakdown(targetNode?.title);
    }

    return {
      steps: parsed.steps.slice(0, 3).map((step, index) => ({
        id: `child-${index + 1}`,
        title: sanitizeTitle(step.title, `Sub-step ${index + 1}`),
        desc: step.desc || "",
        estimatedMinutes: Number(step.estimatedMinutes) || 10,
        priority: index + 1,
        status: "pending",
        children: [],
      })),
      source: "gemini",
    };
  } catch (error) {
    if (error instanceof AppError) throw error;

    writeLog("error", "breakdown.node.error", {
      requestId,
      message: "Node breakdown failed in Gemini. Falling back to local child breakdown.",
      error: error.message,
      targetNodeTitle: targetNode?.title || null,
      parentNodeTitle: parentNode?.title || null,
      file: buildFileMetaForLogs(file),
    });
    return buildLocalChildBreakdown(targetNode?.title);
  }
}

async function regenerateSingleNode({ rootContext, parentNode, targetNode, siblingNodes, slotIndex, file, requestId }) {
  const siblingSummary = (siblingNodes || [])
    .map((node, index) => `- Slot ${index + 1}: ${node.title} :: ${node.desc || ""}`)
    .join("\n");

  const instruction = `
You are regenerating ONLY ONE selected subtask in a task planner.

Rules:
- Return VALID JSON only.
- Output exactly one step object under the key "step".
- Keep the regenerated step in the SAME semantic lane as the current selected step.
- Keep it appropriate for slot ${slotIndex + 1} among its siblings.
- Do NOT absorb or duplicate the responsibilities of sibling steps.
- Do NOT rewrite the whole plan.
- Make the wording clearer and more specific.
- status must be "pending".
- children must be [].

JSON shape:
{
  "step": {
    "id": "slot-${slotIndex + 1}",
    "title": "string",
    "desc": "string",
    "estimatedMinutes": 10,
    "priority": ${slotIndex + 1},
    "status": "pending",
    "children": []
  }
}

Original typed input:
${rootContext?.originalTaskInput?.trim() || "<empty>"}

Root task:
- Title: ${rootContext?.rootTitle || ""}
- Description: ${rootContext?.rootDescription || ""}

Parent scope:
- Title: ${parentNode?.title || rootContext?.rootTitle || ""}
- Description: ${parentNode?.desc || rootContext?.rootDescription || ""}

Sibling list for guardrails:
${siblingSummary || "<none>"}

Selected step to regenerate (slot ${slotIndex + 1}):
- Title: ${targetNode?.title || ""}
- Description: ${targetNode?.desc || ""}

${getFileSummaryText(file)}
`.trim();

  const parts = [{ text: instruction }];
  const filePart = buildFilePart(file);
  if (filePart) parts.push(filePart);

  try {
    const data = await callGemini(parts, requestId, "single-node regeneration");
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = safeJsonParse(content);

    if (!parsed?.step) {
      writeLog("info", "breakdown.regenerate.fallback", {
        requestId,
        message: "Gemini returned an invalid regenerate payload. Falling back to local regenerated step.",
        targetNodeTitle: targetNode?.title || null,
      });
      return buildLocalRegeneratedStep(targetNode, slotIndex);
    }

    return {
      step: {
        id: targetNode?.id || `slot-${slotIndex + 1}`,
        title: sanitizeTitle(parsed.step.title, sanitizeTitle(targetNode?.title, `Step ${slotIndex + 1}`)),
        desc: parsed.step.desc || targetNode?.desc || "",
        estimatedMinutes: Number(parsed.step.estimatedMinutes) || targetNode?.estimatedMinutes || 10,
        priority: slotIndex + 1,
        status: "pending",
        children: [],
      },
      source: "gemini",
    };
  } catch (error) {
    if (error instanceof AppError) throw error;

    writeLog("error", "breakdown.regenerate.error", {
      requestId,
      message: "Single-node regenerate failed in Gemini. Falling back to local regenerated step.",
      error: error.message,
      targetNodeTitle: targetNode?.title || null,
      parentNodeTitle: parentNode?.title || null,
      file: buildFileMetaForLogs(file),
    });
    return buildLocalRegeneratedStep(targetNode, slotIndex);
  }
}

function summarizeAction(reqBody = {}) {
  const mode = reqBody?.mode || "initial";

  if (mode === "initial") {
    const taskInput = typeof reqBody?.taskInput === "string" ? reqBody.taskInput.trim() : "";
    const file = reqBody?.file || null;
    return {
      action: "initial-breakdown",
      mode,
      taskInputLength: taskInput.length,
      taskPreview: redactLongText(taskInput || "<empty>", 180),
      hasFile: Boolean(file?.dataBase64),
      fileName: file?.name || null,
      fileMimeType: file?.mimeType || inferMimeTypeFromName(file?.name || ""),
      fileSize: Number(file?.size || 0),
    };
  }

  return {
    action: mode,
    mode,
    contextId: reqBody?.contextId || null,
    targetNodeId: reqBody?.targetNode?.id || null,
    targetNodeTitle: redactLongText(reqBody?.targetNode?.title || "", 120),
    parentNodeId: reqBody?.parentNode?.id || null,
    parentNodeTitle: redactLongText(reqBody?.parentNode?.title || "", 120),
    siblingCount: Array.isArray(reqBody?.siblingNodes) ? reqBody.siblingNodes.length : 0,
  };
}

app.post("/api/breakdown", async (req, res) => {
  const requestId = crypto.randomUUID();
  const actionSummary = summarizeAction(req.body || {});

  writeLog("info", "request.received", {
    requestId,
    message: `Received ${actionSummary.action}.`,
    ...actionSummary,
  });

  try {
    pruneOldContexts();

    const { mode = "initial" } = req.body ?? {};

    if (mode === "initial") {
      const { taskInput = "", file = null } = req.body ?? {};
      const hasTaskInput = typeof taskInput === "string" && taskInput.trim().length > 0;
      const hasFile = !!file?.dataBase64;

      if (!hasTaskInput && !hasFile) {
        writeLog("info", "request.rejected", {
          requestId,
          message: "Rejected empty initial request.",
          ...actionSummary,
        });
        return res.status(400).json({
          error: "Please enter a task or upload a file before sending.",
          requestId,
        });
      }

      const preparedFile = hasFile
        ? await prepareFileForGemini(
            {
              name: file.name,
              mimeType: file.mimeType,
              size: Number(file.size) || 0,
              dataBase64: file.dataBase64,
            },
            requestId
          )
        : null;

      const contextId = crypto.randomUUID();
      contextStore.set(contextId, {
        createdAt: Date.now(),
        taskInput: hasTaskInput ? taskInput.trim() : "",
        file: preparedFile,
      });

      const result = await generateInitialBreakdown({
        taskInput: hasTaskInput ? taskInput.trim() : "",
        file: preparedFile,
        requestId,
      });

      writeLog("info", "request.completed", {
        requestId,
        message: `Completed initial-breakdown successfully.`,
        contextId,
        source: result.source,
        file: buildFileMetaForLogs(preparedFile),
      });

      return res.json({
        ...result,
        contextId,
        requestId,
      });
    }

    const { contextId, rootContext, targetNode, parentNode, siblingNodes = [] } = req.body ?? {};
    if (!contextId || !contextStore.has(contextId)) {
      writeLog("info", "request.rejected", {
        requestId,
        message: "Rejected breakdown request because original context was missing.",
        ...actionSummary,
      });
      return res.status(400).json({
        error: "The original task context was not found. Please re-upload and try again.",
        requestId,
      });
    }

    const storedContext = contextStore.get(contextId);
    storedContext.createdAt = Date.now();

    if (!targetNode?.id) {
      writeLog("info", "request.rejected", {
        requestId,
        message: "Rejected breakdown request because targetNode was missing.",
        ...actionSummary,
      });
      return res.status(400).json({ error: "targetNode is required", requestId });
    }

    if (mode === "breakdown-node") {
      const result = await generateNodeBreakdown({
        rootContext: {
          ...rootContext,
          originalTaskInput: storedContext.taskInput,
        },
        targetNode,
        parentNode,
        file: storedContext.file,
        requestId,
      });

      writeLog("info", "request.completed", {
        requestId,
        message: `Completed breakdown-node successfully for ${targetNode.title || targetNode.id}.`,
        contextId,
        targetNodeId: targetNode.id,
        targetNodeTitle: targetNode.title || null,
        file: buildFileMetaForLogs(storedContext.file),
        source: result.source,
      });

      return res.json({ ...result, requestId });
    }

    if (mode === "regenerate-node") {
      const slotIndex = Math.max(0, siblingNodes.findIndex((node) => node.id === targetNode.id));
      const result = await regenerateSingleNode({
        rootContext: {
          ...rootContext,
          originalTaskInput: storedContext.taskInput,
        },
        parentNode,
        targetNode,
        siblingNodes,
        slotIndex,
        file: storedContext.file,
        requestId,
      });

      writeLog("info", "request.completed", {
        requestId,
        message: `Completed regenerate-node successfully for ${targetNode.title || targetNode.id}.`,
        contextId,
        targetNodeId: targetNode.id,
        targetNodeTitle: targetNode.title || null,
        file: buildFileMetaForLogs(storedContext.file),
        source: result.source,
      });

      return res.json({ ...result, requestId });
    }

    writeLog("info", "request.rejected", {
      requestId,
      message: `Rejected unsupported breakdown mode: ${mode}.`,
      ...actionSummary,
    });
    return res.status(400).json({ error: "Unsupported breakdown mode", requestId });
  } catch (error) {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const publicMessage = error instanceof AppError ? error.publicMessage : "Something went wrong while processing your task request. Check the server log for details.";

    writeLog("error", "request.failed", {
      requestId,
      message: `Request failed while handling ${actionSummary.action}.`,
      ...actionSummary,
      error: error.message,
      details: redactLongText(error.details || "", 400),
      stack: redactLongText(error.stack || "", 1000),
    });

    return res.status(statusCode).json({
      error: publicMessage,
      requestId,
    });
  }
});

app.listen(PORT, () => {
  writeLog("info", "server.started", {
    message: `AI server running at http://localhost:${PORT}`,
    port: PORT,
    projectRoot: PROJECT_ROOT,
    logFilePath: getLogFilePath(),
    geminiApiKeySource: hasGeminiApiKey() ? "environment loaded" : "missing",
  });

  console.log(`🚀 AI server running at http://localhost:${PORT}`);
  console.log(`🔐 Gemini API key source: ${hasGeminiApiKey() ? "environment loaded" : "missing"}`);
  console.log(`🪵 Request logs: ${getLogFilePath()}`);
});
