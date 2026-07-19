// SLA timers: high 8h / normal 48h / low 120h; at-risk at 75% elapsed.
import { SLA_HOURS, SLA_AT_RISK_RATIO } from '../config.js';

export function slaState(item, now = Date.now()) {
  if (['done', 'resolved', 'closed', 'cancelled'].includes(item.status)) {
    return { state: 'met', remainingMs: 0 };
  }
  const hours = SLA_HOURS[item.priority] ?? SLA_HOURS.normal;
  const due = new Date(item.createdAt).getTime() + hours * 3600_000;
  const total = hours * 3600_000;
  const remainingMs = due - now;
  let state = 'on-track';
  if (remainingMs <= 0) state = 'breached';
  else if ((total - remainingMs) / total >= SLA_AT_RISK_RATIO) state = 'at-risk';
  return { state, remainingMs, dueAt: new Date(due).toISOString() };
}

export function withSla(items, now = Date.now()) {
  return items.map(i => ({ ...i, sla: slaState(i, now) }));
}
