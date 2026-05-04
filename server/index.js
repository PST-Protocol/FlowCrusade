import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import mammoth from "mammoth";
import XLSX from "xlsx";
import JSZip from "jszip";
import {
  readStatsData, writeStatsData, computeStats, toSafeNumber, addDistractionEvent, addFocusSession,
} from "./statsStore.js";
import monitorRouter from "./monitor/routes.js";
import { recoverCrashedSessions } from "./monitor/store.js";
import { startHeartbeat } from "./monitor/stream.js";
import { maybeStartMonitorAgent } from "./monitor/agent.js";

dotenv.config();

const app = express();
const contextStore = new Map();
const CONTEXT_TTL_MS = 1000 * 60 * 60 * 6;
const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "logs");
const TEMP_ROOT_DIR = path.join(os.tmpdir(), "flow-crusade-gemini");

const SUPPORTED_TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/html",
  "text/csv",
  "text/xml",
  "application/json",
  "application/xml",
  "application/yaml",
  "text/yaml",
]);

const DIRECT_GEMINI_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const PRESENTATION_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const SPREADSHEET_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

const OFFICE_TO_PDF_MIME_TYPES = new Set([
  "application/msword",
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

function readLocalConfig() {
  const configPath = path.join(__dirname, "..", "config.json");
  try {
    if (!fs.existsSync(configPath)) return {};
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    writeLog("error", "config.read.failed", { error: error.message });
    return {};
  }
}

const LOCAL_CONFIG = readLocalConfig();
const PORT = process.env.PORT || LOCAL_CONFIG.port || 8787;

app.use(cors());
app.use(express.json({ limit: "120mb" }));

function getLogFilePath() {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `flow-crusade-${day}.log`);
}

function redactLongText(value, max = 220) {
  if (typeof value !== "string") return value;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

function writeLog(level, event, payload = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...payload,
  };

  try {
    fs.appendFileSync(getLogFilePath(), `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    console.error("[log.write.failed]", error.message);
  }

  const line = payload.message || payload.error || payload.summary || "";
  const suffix = payload.requestId ? ` (requestId: ${payload.requestId})` : "";
  if (level === "error") {
    console.error(`[${event}] ${line}${suffix}`.trim());
  } else {
    console.log(`[${event}] ${line}${suffix}`.trim());
  }
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

function inferMimeTypeFromName(filename = "") {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case ".xls":
      return "application/vnd.ms-excel";
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
  if (DIRECT_GEMINI_MIME_TYPES.has(mimeType)) return true;
  if (mimeType.startsWith("image/") && ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(mimeType)) return true;
  return false;
}

function isTextFile(file) {
  const mimeType = getNormalizedMimeType(file);
  const ext = path.extname(file?.name || "").toLowerCase();
  return SUPPORTED_TEXT_MIME_TYPES.has(mimeType) || [".txt", ".md", ".markdown", ".csv", ".json", ".xml", ".html", ".htm", ".yaml", ".yml"].includes(ext);
}

function isDocxFile(file) {
  const mimeType = getNormalizedMimeType(file);
  const ext = path.extname(file?.name || "").toLowerCase();
  return DOCX_MIME_TYPES.has(mimeType) || ext === ".docx";
}

function isPresentationFile(file) {
  const mimeType = getNormalizedMimeType(file);
  const ext = path.extname(file?.name || "").toLowerCase();
  return PRESENTATION_MIME_TYPES.has(mimeType) || ext === ".pptx";
}

function isSpreadsheetFile(file) {
  const mimeType = getNormalizedMimeType(file);
  const ext = path.extname(file?.name || "").toLowerCase();
  return SPREADSHEET_MIME_TYPES.has(mimeType) || [".xlsx", ".xls"].includes(ext);
}

function shouldConvertOfficeDocumentToPdf(file) {
  const mimeType = getNormalizedMimeType(file);
  if (OFFICE_TO_PDF_MIME_TYPES.has(mimeType)) return true;

  const ext = path.extname(file?.name || "").toLowerCase();
  return [".doc", ".odt", ".rtf"].includes(ext);
}

function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY ||
    LOCAL_CONFIG.geminiApiKey ||
    LOCAL_CONFIG.llmApiKey ||
    ""
  ).trim();
}

function hasGeminiApiKey() {
  return Boolean(getGeminiApiKey());
}

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

function sanitizeFilename(filename = "uploaded-file") {
  return filename.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim() || "uploaded-file";
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
  if (file?.textContent) {
    return {
      text: `\n\n--- Uploaded file content: ${file.originalName || file.name || "uploaded file"} ---\n${file.textContent}\n--- End uploaded file content ---`,
    };
  }

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
  const originalMime = file.originalMimeType || file.mimeType || "unknown mime";
  const originalSize = Number(file.originalSize || file.size || 0);

  if (file.wasConvertedToPdf) {
    return `Uploaded file: ${originalName} (${originalMime}, ${originalSize} bytes). It was converted to PDF for Gemini processing as ${file.name} (${file.size || 0} bytes).`;
  }

  if (file.wasExtractedToText) {
    return `Uploaded file: ${originalName} (${originalMime}, ${originalSize} bytes). It was extracted to text for Gemini processing as ${file.name} (${file.size || 0} bytes).`;
  }

  return `Uploaded file: ${originalName} (${originalMime}, ${originalSize} bytes).`;
}


function decodeBase64Text(dataBase64) {
  return Buffer.from(dataBase64 || "", "base64").toString("utf8");
}

function normalizeExtractedText(text = "") {
  return String(text)
    .replace(/\r\n/g, "\n")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function decodeXmlEntities(text = "") {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function xmlTextToPlainText(xml = "") {
  return decodeXmlEntities(
    xml
      .replace(/<a:br\s*\/>/g, "\n")
      .replace(/<w:br\s*\/>/g, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  ).trim();
}

async function extractTextFile(file, requestId) {
  const originalName = file?.name || "uploaded-text";
  const originalMimeType = getNormalizedMimeType(file);
  const originalSize = Number(file?.size || 0);

  writeLog("info", "file.text.extract.start", {
    requestId,
    message: `Reading text content from ${originalName}.`,
    file: { name: originalName, mimeType: originalMimeType, size: originalSize },
  });

  const textContent = normalizeExtractedText(decodeBase64Text(file.dataBase64));
  if (!textContent) {
    throw new AppError("The uploaded text file is empty.", {
      statusCode: 400,
      publicMessage: `The uploaded file ${originalName} does not contain readable text.`,
    });
  }

  writeLog("info", "file.text.extract.success", {
    requestId,
    message: `Read text content from ${originalName} successfully.`,
    file: { name: originalName, mimeType: originalMimeType, size: originalSize },
    extractedCharacters: textContent.length,
  });

  return {
    name: `${path.basename(originalName, path.extname(originalName)) || "uploaded-text"}.txt`,
    mimeType: "text/plain",
    size: Buffer.byteLength(textContent, "utf8"),
    textContent,
    originalName,
    originalMimeType,
    originalSize,
    wasExtractedToText: true,
    wasConvertedToPdf: false,
  };
}

async function extractDocxToText(file, requestId) {
  const originalName = file?.name || "uploaded-document.docx";
  const originalMimeType = getNormalizedMimeType(file);
  const originalSize = Number(file?.size || 0);
  const buffer = Buffer.from(file.dataBase64, "base64");

  writeLog("info", "file.docx.extract.start", {
    requestId,
    message: `Extracting text from ${originalName} for Gemini processing.`,
    file: { name: originalName, mimeType: originalMimeType, size: originalSize },
  });

  try {
    const result = await mammoth.extractRawText({ buffer });
    const textContent = normalizeExtractedText(result.value || "");

    if (!textContent) {
      throw new Error("DOCX did not contain readable text.");
    }

    writeLog("info", "file.docx.extract.success", {
      requestId,
      message: `Extracted text from ${originalName} successfully.`,
      file: { name: originalName, mimeType: originalMimeType, size: originalSize },
      extractedCharacters: textContent.length,
      warnings: result.messages?.map((message) => message.message).slice(0, 5) || [],
    });

    return {
      name: `${path.basename(originalName, path.extname(originalName)) || "uploaded-document"}.txt`,
      mimeType: "text/plain",
      size: Buffer.byteLength(textContent, "utf8"),
      textContent,
      originalName,
      originalMimeType,
      originalSize,
      wasExtractedToText: true,
      wasConvertedToPdf: false,
    };
  } catch (error) {
    writeLog("error", "file.docx.extract.failed", {
      requestId,
      message: `Failed to extract text from ${originalName}.`,
      error: error.message,
      stack: error.stack,
      file: { name: originalName, mimeType: originalMimeType, size: originalSize },
    });

    throw new AppError(error.message, {
      statusCode: 400,
      publicMessage: `Failed to read ${originalName}. Please upload a PDF, TXT, or simpler DOCX file.`,
      details: error.message,
    });
  }
}

async function extractPptxToText(file, requestId) {
  const originalName = file?.name || "uploaded-presentation.pptx";
  const originalMimeType = getNormalizedMimeType(file);
  const originalSize = Number(file?.size || 0);
  const buffer = Buffer.from(file.dataBase64, "base64");

  writeLog("info", "file.pptx.extract.start", {
    requestId,
    message: `Extracting slide text from ${originalName} for Gemini processing.`,
    file: { name: originalName, mimeType: originalMimeType, size: originalSize },
  });

  try {
    const zip = await JSZip.loadAsync(buffer);
    const slideEntries = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => Number(a.match(/slide(\d+)\.xml/i)?.[1] || 0) - Number(b.match(/slide(\d+)\.xml/i)?.[1] || 0));

    const slides = [];
    for (const entry of slideEntries) {
      const xml = await zip.files[entry].async("string");
      const slideNumber = entry.match(/slide(\d+)\.xml/i)?.[1] || String(slides.length + 1);
      const text = normalizeExtractedText(xmlTextToPlainText(xml));
      if (text) slides.push(`Slide ${slideNumber}:\n${text}`);
    }

    const textContent = normalizeExtractedText(slides.join("\n\n"));
    if (!textContent) {
      throw new Error("PPTX did not contain readable slide text.");
    }

    writeLog("info", "file.pptx.extract.success", {
      requestId,
      message: `Extracted slide text from ${originalName} successfully.`,
      file: { name: originalName, mimeType: originalMimeType, size: originalSize },
      slideCount: slides.length,
      extractedCharacters: textContent.length,
    });

    return {
      name: `${path.basename(originalName, path.extname(originalName)) || "uploaded-presentation"}.txt`,
      mimeType: "text/plain",
      size: Buffer.byteLength(textContent, "utf8"),
      textContent,
      originalName,
      originalMimeType,
      originalSize,
      wasExtractedToText: true,
      wasConvertedToPdf: false,
    };
  } catch (error) {
    writeLog("error", "file.pptx.extract.failed", {
      requestId,
      message: `Failed to extract slide text from ${originalName}.`,
      error: error.message,
      stack: error.stack,
      file: { name: originalName, mimeType: originalMimeType, size: originalSize },
    });

    throw new AppError(error.message, {
      statusCode: 400,
      publicMessage: `Failed to read ${originalName}. Please upload a PDF, TXT, or simpler PPTX file.`,
      details: error.message,
    });
  }
}

async function extractSpreadsheetToText(file, requestId) {
  const originalName = file?.name || "uploaded-spreadsheet.xlsx";
  const originalMimeType = getNormalizedMimeType(file);
  const originalSize = Number(file?.size || 0);
  const buffer = Buffer.from(file.dataBase64, "base64");

  writeLog("info", "file.spreadsheet.extract.start", {
    requestId,
    message: `Extracting spreadsheet text from ${originalName} for Gemini processing.`,
    file: { name: originalName, mimeType: originalMimeType, size: originalSize },
  });

  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetText = workbook.SheetNames.map((sheetName) => {
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { blankrows: false });
      return csv.trim() ? `Sheet: ${sheetName}\n${csv.trim()}` : "";
    }).filter(Boolean);

    const textContent = normalizeExtractedText(sheetText.join("\n\n"));
    if (!textContent) {
      throw new Error("Spreadsheet did not contain readable cells.");
    }

    writeLog("info", "file.spreadsheet.extract.success", {
      requestId,
      message: `Extracted spreadsheet text from ${originalName} successfully.`,
      file: { name: originalName, mimeType: originalMimeType, size: originalSize },
      sheetCount: sheetText.length,
      extractedCharacters: textContent.length,
    });

    return {
      name: `${path.basename(originalName, path.extname(originalName)) || "uploaded-spreadsheet"}.txt`,
      mimeType: "text/plain",
      size: Buffer.byteLength(textContent, "utf8"),
      textContent,
      originalName,
      originalMimeType,
      originalSize,
      wasExtractedToText: true,
      wasConvertedToPdf: false,
    };
  } catch (error) {
    writeLog("error", "file.spreadsheet.extract.failed", {
      requestId,
      message: `Failed to extract spreadsheet text from ${originalName}.`,
      error: error.message,
      stack: error.stack,
      file: { name: originalName, mimeType: originalMimeType, size: originalSize },
    });

    throw new AppError(error.message, {
      statusCode: 400,
      publicMessage: `Failed to read ${originalName}. Please upload a PDF, CSV, TXT, or simpler spreadsheet file.`,
      details: error.message,
    });
  }
}

async function convertOfficeDocumentToPdf(file, requestId) {
  const originalName = file?.name || "uploaded-document";
  const originalMimeType = getNormalizedMimeType(file);
  const originalSize = Number(file?.size || 0);
  const safeName = sanitizeFilename(originalName);
  const requestDir = path.join(TEMP_ROOT_DIR, requestId);
  const inputDir = path.join(requestDir, "input");
  const outputDir = path.join(requestDir, "output");
  const ext = path.extname(safeName) || ".bin";
  const baseName = path.basename(safeName, ext) || "uploaded-document";
  const inputPath = path.join(inputDir, `${baseName}${ext}`);
  const expectedPdfPath = path.join(outputDir, `${baseName}.pdf`);

  writeLog("info", "file.convert.start", {
    requestId,
    message: `Converting ${originalName} to PDF for Gemini processing.`,
    file: {
      name: originalName,
      mimeType: originalMimeType,
      size: originalSize,
    },
  });

  try {
    await fsp.mkdir(inputDir, { recursive: true });
    await fsp.mkdir(outputDir, { recursive: true });
    await fsp.writeFile(inputPath, Buffer.from(file.dataBase64, "base64"));

    const args = ["--headless", "--convert-to", "pdf", "--outdir", outputDir, inputPath];
    const { stdout = "", stderr = "" } = await execFileAsync("soffice", args, {
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        HOME: process.env.HOME || os.homedir(),
      },
    });

    let pdfPath = expectedPdfPath;
    const exists = await fsp
      .access(pdfPath)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      const outputFiles = await fsp.readdir(outputDir).catch(() => []);
      const fallbackPdf = outputFiles.find((name) => name.toLowerCase().endsWith(".pdf"));
      if (!fallbackPdf) {
        throw new Error(`LibreOffice completed without producing a PDF. stdout=${stdout} stderr=${stderr}`);
      }
      pdfPath = path.join(outputDir, fallbackPdf);
    }

    const pdfBuffer = await fsp.readFile(pdfPath);
    writeLog("info", "file.convert.success", {
      requestId,
      message: `Converted ${originalName} to PDF successfully.`,
      file: {
        name: originalName,
        mimeType: originalMimeType,
        size: originalSize,
      },
      conversion: {
        outputName: path.basename(pdfPath),
        outputSize: pdfBuffer.length,
        stdout: redactLongText(stdout, 1200),
        stderr: redactLongText(stderr, 1200),
      },
    });

    return {
      name: path.basename(pdfPath),
      mimeType: "application/pdf",
      size: pdfBuffer.length,
      dataBase64: pdfBuffer.toString("base64"),
      originalName,
      originalMimeType,
      originalSize,
      wasConvertedToPdf: true,
    };
  } catch (error) {
    writeLog("error", "file.convert.failed", {
      requestId,
      message: `Failed to convert ${originalName} to PDF.`,
      error: error.message,
      stack: error.stack,
      file: {
        name: originalName,
        mimeType: originalMimeType,
        size: originalSize,
      },
    });

    throw new AppError(error.message, {
      statusCode: 400,
      publicMessage: `Failed to convert ${originalName} to PDF for Gemini processing.`,
      details: error.message,
    });
  } finally {
    await fsp.rm(requestDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function prepareFileForGemini(file, requestId) {
  if (!file?.dataBase64) return null;

  const normalizedMimeType = getNormalizedMimeType(file);
  const normalizedFile = {
    name: file.name || "uploaded-file",
    mimeType: normalizedMimeType,
    size: Number(file.size) || 0,
    dataBase64: file.dataBase64,
    originalName: file.name || "uploaded-file",
    originalMimeType: normalizedMimeType,
    originalSize: Number(file.size) || 0,
    wasConvertedToPdf: false,
    wasExtractedToText: false,
  };

  // PDF and supported images go directly to Gemini native multimodal input.
  if (canSendRawToGemini(normalizedMimeType)) {
    writeLog("info", "file.prepare.raw", {
      requestId,
      message: `Using ${normalizedFile.originalName} as a raw Gemini input.`,
      file: buildFileMetaForLogs(normalizedFile),
    });
    return normalizedFile;
  }

  // TXT/MD/CSV/JSON/XML/HTML/YAML are read into the prompt as text.
  if (isTextFile(normalizedFile)) {
    return extractTextFile(normalizedFile, requestId);
  }

  // DOCX is parsed locally instead of being converted to PDF.
  if (isDocxFile(normalizedFile)) {
    return extractDocxToText(normalizedFile, requestId);
  }

  // PPTX is parsed locally into slide text.
  if (isPresentationFile(normalizedFile)) {
    return extractPptxToText(normalizedFile, requestId);
  }

  // XLS/XLSX is parsed locally into sheet text / CSV-like content.
  if (isSpreadsheetFile(normalizedFile)) {
    return extractSpreadsheetToText(normalizedFile, requestId);
  }

  // Legacy office formats are converted to PDF only as a fallback strategy.
  if (shouldConvertOfficeDocumentToPdf(normalizedFile)) {
    return convertOfficeDocumentToPdf(normalizedFile, requestId);
  }

  writeLog("error", "file.prepare.unsupported", {
    requestId,
    message: `Unsupported upload type for Gemini processing: ${normalizedFile.originalName}.`,
    file: buildFileMetaForLogs(normalizedFile),
  });

  throw new AppError("Unsupported upload type", {
    statusCode: 400,
    publicMessage: `Unsupported file type: ${normalizedFile.originalName}. Please upload PDF, PNG/JPG/WebP, TXT/MD, DOCX, PPTX, XLSX, or legacy DOC/RTF/ODT files.`,
    details: `Unsupported mime type: ${normalizedMimeType}`,
  });
}

async function callGemini(parts, { requestId, operation }) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    writeLog("error", "gemini.key.missing", {
      requestId,
      message: "Gemini API key was not found in the environment.",
    });
    throw new Error("Gemini API key is missing from the environment.");
  }

  const models = ["gemini-3-flash-preview"];
  let lastError = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      writeLog("info", "gemini.request.start", {
        requestId,
        summary: `${operation} via ${model} attempt ${attempt}.`,
        model,
        attempt,
        operation,
      });

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
          summary: `${operation} succeeded with ${model} on attempt ${attempt}.`,
          model,
          attempt,
          operation,
        });
        return response.json();
      }

      const errText = await response.text();
      lastError = errText;
      writeLog("error", "gemini.request.error", {
        requestId,
        message: `${operation} failed with ${model} on attempt ${attempt}.`,
        model,
        attempt,
        operation,
        status: response.status,
        error: redactLongText(errText, 1800),
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
    const data = await callGemini(parts, { requestId, operation: "initial-breakdown" });
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = safeJsonParse(content);

    if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length !== 3) {
      writeLog("info", "gemini.fallback.initial", {
        requestId,
        message: "Gemini returned an invalid initial breakdown shape. Falling back locally.",
      });
      return buildLocalInitialBreakdown(taskInput, file);
    }

    return {
      rootTitle: sanitizeTitle(parsed.rootTitle, sanitizeTitle(taskInput || (file?.originalName || file?.name || "Uploaded Task").replace(/\.[^.]+$/, ""))),
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
    writeLog("info", "gemini.fallback.initial", {
      requestId,
      message: "Initial breakdown fell back to local generation.",
      error: error.message,
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
    const data = await callGemini(parts, { requestId, operation: "breakdown-node" });
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = safeJsonParse(content);

    if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length !== 3) {
      writeLog("info", "gemini.fallback.breakdown-node", {
        requestId,
        message: "Gemini returned an invalid child breakdown shape. Falling back locally.",
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
    writeLog("info", "gemini.fallback.breakdown-node", {
      requestId,
      message: "Child breakdown fell back to local generation.",
      error: error.message,
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
    const data = await callGemini(parts, { requestId, operation: "regenerate-node" });
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = safeJsonParse(content);

    if (!parsed?.step) {
      writeLog("info", "gemini.fallback.regenerate-node", {
        requestId,
        message: "Gemini returned an invalid regenerate-node shape. Falling back locally.",
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
    writeLog("info", "gemini.fallback.regenerate-node", {
      requestId,
      message: "Regenerate-node fell back to local generation.",
      error: error.message,
    });
    return buildLocalRegeneratedStep(targetNode, slotIndex);
  }
}


// ================= STATS API + LOCAL JSON STORAGE =================
// Stats functions are in statsStore.js; imported at the top.

app.use("/api/monitor", monitorRouter);

app.get("/api/stats", (req, res) => {
  const data = readStatsData();
  res.json(computeStats(data));
});

app.post("/api/stats/focus-session", (req, res) => {
  const { taskId, taskTitle, minutes, startedAt, endedAt } = req.body ?? {};
  const safeMinutes = Math.max(0, toSafeNumber(minutes));

  if (!taskId || safeMinutes <= 0) {
    return res.status(400).json({ error: "taskId and positive minutes are required." });
  }

  const data = readStatsData();
  data.focusSessions.push({
    id: crypto.randomUUID(),
    taskId,
    taskTitle: taskTitle || "Untitled Task",
    minutes: safeMinutes,
    startedAt: startedAt || new Date().toISOString(),
    endedAt: endedAt || new Date().toISOString(),
  });

  writeStatsData(data);
  res.json(computeStats(data));
});

app.post("/api/stats/completed-task", (req, res) => {
  const { taskId, taskTitle, estimatedMinutes, completedAt } = req.body ?? {};

  if (!taskId) {
    return res.status(400).json({ error: "taskId is required." });
  }

  const data = readStatsData();
  const alreadyCompleted = data.completedTasks.some((task) => task.taskId === taskId);

  if (!alreadyCompleted) {
    data.completedTasks.push({
      id: crypto.randomUUID(),
      taskId,
      taskTitle: taskTitle || "Untitled Task",
      estimatedMinutes: Math.max(1, toSafeNumber(estimatedMinutes, 10)),
      completedAt: completedAt || new Date().toISOString(),
    });
    writeStatsData(data);
  }

  res.json(computeStats(data));
});

app.post("/api/stats/distraction", (req, res) => {
  const { appName, source, minutes, timestamp } = req.body ?? {};
  const safeMinutes = Math.max(1, toSafeNumber(minutes, 1));
  const data = readStatsData();

  data.distractionEvents.push({
    id: crypto.randomUUID(),
    appName: appName || source || "Unknown",
    minutes: safeMinutes,
    timestamp: timestamp || new Date().toISOString(),
  });

  writeStatsData(data);
  res.json(computeStats(data));
});

app.post("/api/breakdown", async (req, res) => {
  pruneOldContexts();

  const requestId = crypto.randomUUID();
  const { mode = "initial" } = req.body ?? {};

  try {
    writeLog("info", "request.received", {
      requestId,
      mode,
      summary: `Received ${mode} request.`,
    });

    if (mode === "initial") {
      const { taskInput = "", file = null } = req.body ?? {};
      const trimmedTaskInput = typeof taskInput === "string" ? taskInput.trim() : "";
      const hasTaskInput = trimmedTaskInput.length > 0;
      const hasFile = Boolean(file?.dataBase64);

      writeLog("info", "request.user-action", {
        requestId,
        mode,
        summary: hasFile && hasTaskInput
          ? "User submitted text plus a file for initial breakdown."
          : hasFile
            ? "User submitted a file-only initial breakdown request."
            : "User submitted a text-only initial breakdown request.",
        taskInputPreview: redactLongText(trimmedTaskInput),
        hasTaskInput,
        hasFile,
        file: hasFile
          ? {
              name: file.name || null,
              mimeType: getNormalizedMimeType(file),
              size: Number(file.size || 0),
            }
          : null,
      });

      if (!hasTaskInput && !hasFile) {
        throw new AppError("Please enter a task or upload a file before sending.", {
          statusCode: 400,
          publicMessage: "Please enter a task or upload a file before sending.",
        });
      }

      const processedFile = hasFile ? await prepareFileForGemini(file, requestId) : null;
      const contextId = crypto.randomUUID();

      contextStore.set(contextId, {
        createdAt: Date.now(),
        taskInput: trimmedTaskInput,
        file: processedFile,
      });

      const result = await generateInitialBreakdown({
        taskInput: trimmedTaskInput,
        file: processedFile,
        requestId,
      });

      writeLog("info", "request.succeeded", {
        requestId,
        mode,
        contextId,
        summary: `Completed ${mode} request successfully.`,
        source: result.source,
        file: buildFileMetaForLogs(processedFile),
      });

      return res.json({
        ...result,
        contextId,
        requestId,
      });
    }

    const { contextId, rootContext, targetNode, parentNode, siblingNodes = [] } = req.body ?? {};
    if (!contextId || !contextStore.has(contextId)) {
      throw new AppError("The original task context was not found.", {
        statusCode: 400,
        publicMessage: "The original task context was not found. Please re-upload and try again.",
      });
    }

    const storedContext = contextStore.get(contextId);
    storedContext.createdAt = Date.now();

    writeLog("info", "request.user-action", {
      requestId,
      mode,
      contextId,
      summary:
        mode === "breakdown-node"
          ? "User requested a deeper breakdown for a single subtask."
          : mode === "regenerate-node"
            ? "User requested regenerate for a single subtask."
            : `User requested ${mode}.`,
      targetNode: targetNode
        ? {
            id: targetNode.id || null,
            title: targetNode.title || null,
            descPreview: redactLongText(targetNode.desc || ""),
          }
        : null,
      parentNode: parentNode
        ? {
            id: parentNode.id || null,
            title: parentNode.title || null,
          }
        : null,
      hasOriginalFile: Boolean(storedContext.file),
      originalTaskInputPreview: redactLongText(storedContext.taskInput || ""),
    });

    if (!targetNode?.id) {
      throw new AppError("targetNode is required", {
        statusCode: 400,
        publicMessage: "targetNode is required.",
      });
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

      writeLog("info", "request.succeeded", {
        requestId,
        mode,
        contextId,
        summary: `Completed ${mode} request successfully.`,
        source: result.source,
      });

      return res.json({
        ...result,
        requestId,
      });
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

      writeLog("info", "request.succeeded", {
        requestId,
        mode,
        contextId,
        summary: `Completed ${mode} request successfully.`,
        source: result.source,
      });

      return res.json({
        ...result,
        requestId,
      });
    }

    throw new AppError("Unsupported breakdown mode", {
      statusCode: 400,
      publicMessage: "Unsupported breakdown mode.",
    });
  } catch (error) {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const publicMessage = error instanceof AppError ? error.publicMessage : "Internal server error";
    const details = error instanceof AppError ? error.details : error.message;

    writeLog("error", "request.failed", {
      requestId,
      mode,
      message: `Request failed while handling ${mode}.`,
      error: error.message,
      details,
      stack: error.stack,
    });

    return res.status(statusCode).json({
      error: publicMessage,
      requestId,
    });
  }
});

app.listen(PORT, () => {
  recoverCrashedSessions();
  startHeartbeat();
  const agent = maybeStartMonitorAgent({ apiBase: `http://localhost:${PORT}` });
  console.log(`🚀 AI server running at http://localhost:${PORT}`);
  console.log(`🔐 Gemini API key source: ${hasGeminiApiKey() ? "environment loaded" : "missing"}`);
  console.log(`📝 Request logs: ${LOG_DIR}`);
  if (agent.started) {
    console.log(`🖥️  Monitor agent restored for active session.`);
  }
});
