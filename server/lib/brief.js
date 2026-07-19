// Server wrapper for the briefing: gathers signals from storage, optional
// Anthropic synthesis with deterministic fallback.
import { read } from './store.js';
import { composeCore, meetingCore } from './brief-core.js';

export function gatherSignals(property) {
  const signals = read('signals', { mode: 'stub', slack: [], gmail: [], calendar: [] });
  const units = read('units', []).filter(u => u.property === property);
  const wos = read('workorders', []).filter(w => w.property === property);
  const moves = read('moves', []).filter(m => m.property === property && m.status !== 'done');
  return { signals, units, wos, moves };
}

export function composeBriefDeterministic(property) {
  return composeCore(gatherSignals(property));
}

export async function composeBrief(property) {
  const base = composeBriefDeterministic(property);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return base;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `Write a calm 3-sentence shift briefing for a serviced-living duty manager in Riyadh. No exclamation points. Facts: ${base.summary} Top actions: ${base.actions.slice(0, 4).map(a => a.title).join('; ')}`
        }]
      })
    });
    if (res.ok) {
      const data = await res.json();
      const text = data.content?.map(c => c.text).join(' ').trim();
      if (text) return { ...base, engine: 'anthropic', summary: text };
    }
  } catch { /* fall back silently */ }
  return base;
}

export function meetingBrief(property) {
  return meetingCore(composeBriefDeterministic(property));
}

