import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRIVACY_FILE = path.join(__dirname, '..', 'data', 'privacy.json');

const DEFAULT_PRIVACY = {
  blockedApps: ['WeChat', 'Messages', '1Password'],
  blockedDomains: ['gmail.com', 'bankofamerica.com'],
  blockedKeywords: ['password', 'login', 'ssn', 'verification'],
};

export function ensurePrivacyFile() {
  const dir = path.dirname(PRIVACY_FILE);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(PRIVACY_FILE)) {
    fs.writeFileSync(PRIVACY_FILE, JSON.stringify(DEFAULT_PRIVACY, null, 2), 'utf8');
  }
}

export function readPrivacyConfig() {
  ensurePrivacyFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(PRIVACY_FILE, 'utf8'));
    return {
      blockedApps: Array.isArray(parsed.blockedApps) ? parsed.blockedApps : [],
      blockedDomains: Array.isArray(parsed.blockedDomains) ? parsed.blockedDomains : [],
      blockedKeywords: Array.isArray(parsed.blockedKeywords) ? parsed.blockedKeywords : [],
    };
  } catch {
    return { ...DEFAULT_PRIVACY };
  }
}

export function writePrivacyConfig(config) {
  ensurePrivacyFile();
  fs.writeFileSync(PRIVACY_FILE, JSON.stringify(config, null, 2), 'utf8');
}

export function takePrivacySnapshot() {
  return readPrivacyConfig();
}

export function isBlacklisted(event, snapshot) {
  const { appName = '', windowTitle = '', domain = '' } = event;
  const { blockedApps = [], blockedDomains = [], blockedKeywords = [] } = snapshot || {};

  if (blockedApps.some((app) => appName.toLowerCase().includes(app.toLowerCase()))) return true;
  if (domain && blockedDomains.some((d) => domain.toLowerCase().includes(d.toLowerCase()))) return true;

  const combined = `${appName} ${windowTitle}`.toLowerCase();
  if (blockedKeywords.some((kw) => combined.includes(kw.toLowerCase()))) return true;

  return false;
}
