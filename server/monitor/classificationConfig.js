import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLASSIFICATION_FILE = path.join(__dirname, '..', 'data', 'classification.json');
const CURRENT_CONFIG_VERSION = 2;

export const DEFAULT_CLASSIFICATION_CONFIG = {
  configVersion: CURRENT_CONFIG_VERSION,
  distractionApps: [
    'tiktok', 'instagram', 'reddit', 'twitter', 'x', 'facebook', 'snapchat',
    'netflix', 'hulu', 'disney+', 'twitch', 'pinterest', 'tumblr', 'discord',
    'whatsapp', 'telegram', 'wechat', 'line',
  ],
  distractionDomains: [
    'tiktok.com', 'instagram.com', 'reddit.com', 'twitter.com', 'x.com',
    'facebook.com', 'snapchat.com', 'netflix.com', 'hulu.com', 'disneyplus.com',
    'twitch.tv', 'pinterest.com', 'tumblr.com',
  ],
  focusApps: [
    'cursor', 'vscode', 'visual studio code', 'code', 'xcode', 'intellij',
    'pycharm', 'webstorm', 'sublime text', 'atom', 'vim', 'nvim', 'emacs',
    'terminal', 'iterm', 'notion', 'obsidian', 'roam', 'logseq', 'bear',
    'typora', 'figma', 'sketch', 'adobe', 'photoshop', 'illustrator',
    'word', 'microsoft word', 'google docs', 'pages', 'excel', 'microsoft excel', 'google sheets',
    'canvas', 'instructure',
    'zoom', 'teams', 'slack', 'meet',
  ],
  focusDomains: [
    'github.com', 'gitlab.com', 'stackoverflow.com', 'docs.google.com',
    'drive.google.com', 'sheets.google.com',
    'notion.so', 'figma.com', 'linear.app', 'jira.atlassian.com',
    'canvas.instructure.com', 'instructure.com',
    'leetcode.com', 'coursera.org', 'udemy.com', 'edx.org',
  ],
};

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  );
}

function normalizeConfig(config = {}) {
  return {
    configVersion: CURRENT_CONFIG_VERSION,
    distractionApps: normalizeList(config.distractionApps),
    distractionDomains: normalizeList(config.distractionDomains),
    focusApps: normalizeList(config.focusApps),
    focusDomains: normalizeList(config.focusDomains),
  };
}

export function ensureClassificationFile() {
  const dir = path.dirname(CLASSIFICATION_FILE);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(CLASSIFICATION_FILE)) {
    fs.writeFileSync(CLASSIFICATION_FILE, JSON.stringify(DEFAULT_CLASSIFICATION_CONFIG, null, 2), 'utf8');
  }
}

export function readClassificationConfig() {
  ensureClassificationFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(CLASSIFICATION_FILE, 'utf8'));
    if (parsed.configVersion !== CURRENT_CONFIG_VERSION) {
      const migrated = normalizeConfig({
        distractionApps: [...DEFAULT_CLASSIFICATION_CONFIG.distractionApps, ...(parsed.distractionApps || [])],
        distractionDomains: [...DEFAULT_CLASSIFICATION_CONFIG.distractionDomains, ...(parsed.distractionDomains || [])],
        focusApps: [...DEFAULT_CLASSIFICATION_CONFIG.focusApps, ...(parsed.focusApps || [])],
        focusDomains: [...DEFAULT_CLASSIFICATION_CONFIG.focusDomains, ...(parsed.focusDomains || [])],
      });
      fs.writeFileSync(CLASSIFICATION_FILE, JSON.stringify(migrated, null, 2), 'utf8');
      return migrated;
    }
    return normalizeConfig(parsed);
  } catch {
    return normalizeConfig(DEFAULT_CLASSIFICATION_CONFIG);
  }
}

export function writeClassificationConfig(config) {
  ensureClassificationFile();
  const normalized = normalizeConfig(config);
  fs.writeFileSync(CLASSIFICATION_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

export function resetClassificationConfig() {
  writeClassificationConfig(DEFAULT_CLASSIFICATION_CONFIG);
  return readClassificationConfig();
}
