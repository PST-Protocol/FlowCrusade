const DISTRACTION_APPS = new Set([
  'tiktok', 'instagram', 'reddit', 'twitter', 'x', 'facebook', 'snapchat',
  'netflix', 'hulu', 'disney+', 'twitch', 'pinterest', 'tumblr', 'discord',
  'whatsapp', 'telegram', 'wechat', 'line',
]);

const DISTRACTION_DOMAINS = new Set([
  'tiktok.com', 'instagram.com', 'reddit.com', 'twitter.com', 'x.com',
  'facebook.com', 'snapchat.com', 'netflix.com', 'hulu.com', 'disneyplus.com',
  'twitch.tv', 'pinterest.com', 'tumblr.com',
]);

const FOCUS_APPS = new Set([
  'vscode', 'visual studio code', 'xcode', 'intellij', 'pycharm', 'webstorm',
  'sublime text', 'atom', 'vim', 'nvim', 'emacs', 'terminal', 'iterm',
  'notion', 'obsidian', 'roam', 'logseq', 'bear', 'typora',
  'figma', 'sketch', 'adobe', 'photoshop', 'illustrator',
  'word', 'google docs', 'pages', 'excel', 'google sheets',
  'zoom', 'teams', 'slack', 'meet',
]);

const FOCUS_DOMAINS = new Set([
  'github.com', 'gitlab.com', 'stackoverflow.com', 'docs.google.com',
  'notion.so', 'figma.com', 'linear.app', 'jira.atlassian.com',
  'leetcode.com', 'coursera.org', 'udemy.com', 'edx.org',
]);

export function classify(event, taskContext = null) {
  const appLower = (event.appName || '').toLowerCase();
  const domainLower = (event.domain || '').toLowerCase();
  const titleLower = (event.windowTitle || '').toLowerCase();

  // Check distraction by app name
  for (const d of DISTRACTION_APPS) {
    if (appLower.includes(d)) {
      return {
        classification: 'distraction',
        confidence: 0.95,
        method: 'rule-based',
        reason: `App '${event.appName}' matched distraction ruleset`,
      };
    }
  }

  // Check distraction by domain
  for (const d of DISTRACTION_DOMAINS) {
    if (domainLower.includes(d)) {
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
  for (const f of FOCUS_APPS) {
    if (appLower.includes(f)) {
      return {
        classification: 'focus',
        confidence: 0.9,
        method: 'rule-based',
        reason: `App '${event.appName}' matched focus ruleset`,
      };
    }
  }

  // Check focus by domain
  for (const f of FOCUS_DOMAINS) {
    if (domainLower.includes(f)) {
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
