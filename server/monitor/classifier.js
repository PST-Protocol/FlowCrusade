import { readClassificationConfig } from './classificationConfig.js';

function matchesRule(value, rule) {
  const normalizedRule = rule.toLowerCase();
  if (normalizedRule.length <= 2) return value === normalizedRule;
  return value.includes(normalizedRule);
}

export function classify(event, taskContext = null) {
  const config = readClassificationConfig();
  const appLower = (event.appName || '').toLowerCase();
  const domainLower = (event.domain || '').toLowerCase();
  const titleLower = (event.windowTitle || '').toLowerCase();

  // Check distraction by app name
  for (const d of config.distractionApps) {
    if (matchesRule(appLower, d)) {
      return {
        classification: 'distraction',
        confidence: 0.95,
        method: 'rule-based',
        reason: `App '${event.appName}' matched distraction ruleset`,
      };
    }
  }

  // Check distraction by domain
  for (const d of config.distractionDomains) {
    if (matchesRule(domainLower, d)) {
      return {
        classification: 'distraction',
        confidence: 0.95,
        method: 'rule-based',
        reason: `Domain '${event.domain}' matched distraction ruleset`,
      };
    }
  }

  // YouTube edge case: could be focus (lectures) or distraction
  if (appLower.includes('youtube') || domainLower.includes('youtube.com')) {
    // If task context suggests watching, lean focus
    if (taskContext && /watch|lecture|video|course/i.test(taskContext)) {
      return {
        classification: 'neutral',
        confidence: 0.55,
        method: 'rule-based',
        reason: `YouTube with task context '${taskContext}' — ambiguous`,
      };
    }
    return {
      classification: 'distraction',
      confidence: 0.75,
      method: 'rule-based',
      reason: `App 'YouTube' is likely distraction without matching task context`,
    };
  }

  // Check focus by app name
  for (const f of config.focusApps) {
    if (matchesRule(appLower, f)) {
      return {
        classification: 'focus',
        confidence: 0.9,
        method: 'rule-based',
        reason: `App '${event.appName}' matched focus ruleset`,
      };
    }
  }

  // Check focus by domain
  for (const f of config.focusDomains) {
    if (matchesRule(domainLower, f)) {
      return {
        classification: 'focus',
        confidence: 0.9,
        method: 'rule-based',
        reason: `Domain '${event.domain}' matched focus ruleset`,
      };
    }
  }

  // Task-linked context: if app/title matches task keywords, lean focus
  if (taskContext) {
    const keywords = taskContext.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const hit = keywords.some((kw) => appLower.includes(kw) || titleLower.includes(kw));
    if (hit) {
      return {
        classification: 'focus',
        confidence: 0.7,
        method: 'rule-based',
        reason: `Activity matches task context keywords`,
      };
    }
  }

  return {
    classification: 'unknown',
    confidence: 0.4,
    method: 'rule-based',
    reason: `No rule matched for '${event.appName || event.domain || 'unknown'}'`,
  };
}
