import { track } from '@vercel/analytics';

/**
 * Thin wrapper around Vercel's `track()` for custom event analytics.
 * Centralizes event names so they're easy to audit and refactor.
 *
 * Events are fire-and-forget — failures are silently ignored
 * so analytics never block the UI.
 */

// ── Tier 1: Core usage ──

export function trackDemoOpened(demoId: string, method: 'sidebar' | 'keyboard' | 'url') {
  track('demo_opened', { demo_id: demoId, method });
}

export function trackModeChanged(from: string, to: string, demoId: string) {
  track('mode_changed', { from, to, demo_id: demoId });
}

export function trackLandingCta(cta: string) {
  track('landing_cta_clicked', { cta });
}

// ── Tier 2: Feature adoption ──

export function trackPredictReveal(demoId: string, challengeId: string, correct: boolean, source: 'procedural' | 'ai') {
  track('predict_answer_revealed', { demo_id: demoId, challenge_id: challengeId, correct, source });
}

export function trackPredictAiGenerated(demoId: string, difficulty: string) {
  track('predict_ai_generated', { demo_id: demoId, difficulty });
}

export function trackAttackResult(demoId: string, scenarioId: string, succeeded: boolean) {
  track('attack_result', { demo_id: demoId, scenario_id: scenarioId, succeeded });
}

export function trackAttackStarted(demoId: string, scenarioId: string) {
  track('attack_started', { demo_id: demoId, scenario_id: scenarioId });
}

export function trackWalkthroughOpened(walkthroughId: string, source: 'curated' | 'ai') {
  track('walkthrough_opened', { walkthrough_id: walkthroughId, source });
}

export function trackPaperAnalysis(source: 'file' | 'eprint', success: boolean) {
  track('paper_analysis', { source, success });
}

// ── Tier 3: Sharing & export ──

export function trackShare(demoId: string, method: 'link' | 'hash' | 'embed' | 'png' | 'gif' | 'audit' | 'github_save') {
  track('share_export', { demo_id: demoId, method });
}

export function trackGifCompleted(demoId: string, frames: number) {
  track('gif_export_completed', { demo_id: demoId, frames });
}

// ── Tier 4: Engagement quality ──

export function trackApiKeySaved(storage: string) {
  track('api_key_saved', { storage });
}

export function trackApiKeyCleared() {
  track('api_key_cleared');
}

export function trackGitHubConnected() {
  track('github_connected');
}

export function trackDemoError(demoId: string, error: string) {
  track('demo_error', { demo_id: demoId, error: error.slice(0, 200) });
}
