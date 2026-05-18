import { readClassificationConfig } from './classificationConfig.js';
import { classifyActivityWithGemma } from '../gemmaProvider.js';

function matchesRule(value, rule) {
  const normalizedRule = rule.toLowerCase();
  if (normalizedRule.length <= 2) return value === normalizedRule;
  return value.includes(normalizedRule);
}

/** Privacy-sensitive apps/domains that must never reach the model (INV-6) */
// App names only — do NOT match window titles to avoid false positives on content keywords
const SENSITIVE_APPS = [
  '1password', 'lastpass', 'bitwarden', 'dashlane', 'keychain access',
  'paypal', 'venmo', 'cash app',
  'my fitness pal', 'headspace', 'betterhelp', 'talkspace', 'calm',
  'messages', 'facetime', 'whatsapp', 'signal', 'telegram',
];
const SENSITIVE_DOMAINS = [
  'paypal.com', 'chase.com', 'wellsfargo.com', 'bankofamerica.com',
  'gmail.com', 'mail.google.com',
];

function isSensitive(event) {
  const app = (event.appName || '').toLowerCase();
  const domain = (event.domain || '').toLowerCase();

  // Only match app name, NOT window title (window titles contain content keywords like "signaling")
  if (SENSITIVE_APPS.some((p) => app.includes(p))) return true;
  if (SENSITIVE_DOMAINS.some((d) => domain.includes(d))) return true;
  return false;
}

/** Fast rule-based path. Returns null if ambiguous (Gemma should handle). */
function classifyByRules(event, taskContext) {
  const config = readClassificationConfig();
  const appLower = (event.appName || '').toLowerCase();
  const domainLower = (event.domain || '').toLowerCase();
  const titleLower = (event.windowTitle || '').toLowerCase();

  for (const d of config.distractionApps) {
    if (matchesRule(appLower, d)) {
      return { classification: 'distraction', confidence: 0.95, method: 'rule-based',
        reason: `App '${event.appName}' matched distraction ruleset.` };
    }
  }
  for (const d of config.distractionDomains) {
    if (matchesRule(domainLower, d)) {
      return { classification: 'distraction', confidence: 0.95, method: 'rule-based',
        reason: `Domain '${event.domain}' matched distraction ruleset.` };
    }
  }

  for (const f of config.focusApps) {
    if (matchesRule(appLower, f)) {
      return { classification: 'focus', confidence: 0.9, method: 'rule-based',
        reason: `App '${event.appName}' matched focus ruleset.` };
    }
  }
  for (const f of config.focusDomains) {
    if (matchesRule(domainLower, f)) {
      return { classification: 'focus', confidence: 0.9, method: 'rule-based',
        reason: `Domain '${event.domain}' matched focus ruleset.` };
    }
  }

  // YouTube: context-sensitive — check title/task keyword overlap first as fast heuristic
  const isYouTube = appLower.includes('youtube') || domainLower.includes('youtube.com');
  if (isYouTube) {
    if (taskContext) {
      const taskWords = taskContext.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
      const titleAndApp = `${titleLower} ${appLower}`;
      const overlapCount = taskWords.filter((w) => titleAndApp.includes(w)).length;
      if (overlapCount >= 2) {
        // Strong keyword match → probably a relevant lecture/resource
        return null; // Still send to Gemma for nuanced reason, but note strong overlap
      }
      if (overlapCount >= 1) {
        return null; // Ambiguous — let Gemma decide
      }
      // No keyword overlap → likely distraction
      return {
        classification: 'distraction', confidence: 0.75, method: 'rule-based',
        reason: `YouTube content ("${event.windowTitle?.slice(0, 50)}") has no overlap with your active task.`,
      };
    }
    return { classification: 'distraction', confidence: 0.65, method: 'rule-based',
      reason: `YouTube without active task context — defaulting to distraction.` };
  }

  // Task keyword match
  if (taskContext) {
    const keywords = taskContext.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const hit = keywords.some((kw) => appLower.includes(kw) || titleLower.includes(kw));
    if (hit) {
      return { classification: 'focus', confidence: 0.7, method: 'rule-based',
        reason: `Activity title or app matches active task keywords.` };
    }
  }

  return null; // ambiguous — Gemma should classify
}

/**
 * Synchronous classify — used as fast path / Gemma-unavailable fallback.
 * Returns { classification, confidence, method, reason }.
 */
export function classifySync(event, taskContext = null) {
  if (isSensitive(event)) {
    return { classification: 'sensitive-hidden', confidence: 1.0, method: 'privacy-filter',
      reason: 'Activity hidden by privacy filter.' };
  }

  const ruleResult = classifyByRules(event, taskContext);
  if (ruleResult) return ruleResult;

  return { classification: 'unknown', confidence: 0.3, method: 'rule-based',
    reason: `No rule matched for '${event.appName || event.domain || 'unknown'}'. Context-sensitive model unavailable.` };
}

/** Legacy alias for backward compatibility */
export const classify = classifySync;

/**
 * Async classify — uses Gemma for ambiguous cases.
 * Falls back to classifySync if Gemma is unavailable.
 */
export async function classifyAsync(event, taskContext = null) {
  // Privacy filter always runs first (model must never see sensitive events — INV-6)
  if (isSensitive(event)) {
    return {
      classification: 'sensitive-hidden',
      confidence: 1.0,
      method: 'privacy-filter',
      reason: 'Activity hidden by privacy filter.',
      toolCallsUsed: [],
      local: true,
    };
  }

  // Fast rule path for obvious cases
  const ruleResult = classifyByRules(event, taskContext);
  if (ruleResult) {
    return { ...ruleResult, toolCallsUsed: [], local: true };
  }

  // Ambiguous — invoke Gemma (FN-4)
  try {
    const gemmaResult = await classifyActivityWithGemma(event, taskContext);
    if (gemmaResult) {
      return {
        classification: gemmaResult.label,
        confidence: gemmaResult.confidence,
        method: gemmaResult.method || 'gemma-semantic',
        reason: gemmaResult.reason,
        suggestedAction: gemmaResult.suggestedAction,
        toolCallsUsed: gemmaResult.toolCallsUsed || ['FN-4'],
        provider: gemmaResult.provider,
        model: gemmaResult.model,
        local: gemmaResult.local,
      };
    }
  } catch (err) {
    console.error('[classifier.gemma.failed]', err.message);
  }

  // Gemma unavailable — keyword-overlap fallback for context-sensitive cases
  if (taskContext) {
    const taskWords = taskContext.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const contentText = `${(event.windowTitle || '')} ${(event.appName || '')} ${(event.domain || '')}`.toLowerCase();
    const overlap = taskWords.filter((w) => contentText.includes(w));
    if (overlap.length >= 1) {
      return {
        classification: 'focus',
        confidence: 0.6,
        method: 'rule-based-fallback',
        reason: `Window content matches task keywords (${overlap.slice(0, 3).join(', ')}). Gemma unavailable; using keyword heuristic.`,
        toolCallsUsed: [],
        local: true,
        fallbackUsed: true,
      };
    }
  }

  return {
    classification: 'neutral',
    confidence: 0.35,
    method: 'rule-based-fallback',
    reason: `No clear signal for '${event.appName || event.domain || 'unknown'}'. Gemma unavailable; install Ollama for semantic classification.`,
    toolCallsUsed: [],
    local: true,
    fallbackUsed: true,
  };
}
