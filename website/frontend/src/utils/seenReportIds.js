const STORAGE_KEY = 'noumow_admin_seen_report_ids';

export function loadSeenReportIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function saveSeenReportIds(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    window.dispatchEvent(new CustomEvent('noumow-seen-reports-changed'));
  } catch {
    /* ignore */
  }
}

export function isNewReport(reportId, seenIds) {
  return Boolean(reportId && seenIds && !seenIds.has(reportId));
}
