// Petits outils utilisés partout dans l'application.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Protège le texte avant de l'insérer dans la page.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const ic = (id, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
export const chev = () => ic('chev-r', 'chev');

export const buzz = p => { try { navigator.vibrate?.(p); } catch (e) { /* non disponible */ } };

/* ---------- Dates ---------- */
// Une journée est repérée par une clé « AAAA-MM-JJ » (heure locale).
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const keyDate = k => new Date(k + 'T12:00:00');
export const addDays = (k, n) => { const d = keyDate(k); d.setDate(d.getDate() + n); return dayKey(d); };
export const todayKey = () => dayKey();
// Les n derniers jours, du plus ancien au plus récent (aujourd'hui inclus)
export function lastDays(n, end = todayKey()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export function dayLabel(k) {
  const t = todayKey();
  if (k === t) return 'Aujourd’hui';
  if (k === addDays(t, -1)) return 'Hier';
  if (k === addDays(t, 1)) return 'Demain';
  return cap(keyDate(k).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' }));
}
export const longDate = k => keyDate(k).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
export const shortDate = k => keyDate(k).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/* ---------- Texte ---------- */
export const slug = s => String(s).toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Minuscules sans accents, pour chercher « epinard » et trouver « Épinards »
export const fold = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/œ/g, 'oe').replace(/’/g, "'");

// Pluriel français : 0 et 1 au singulier.
export const plural = (n, one, many) => `${n} ${Math.abs(n) >= 2 ? many : one}`;

/* ---------- Nombres ---------- */
// Format français : 1 250 et 2,5
const nf = [0, 1, 2].map(d => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }));
export const fmt = (x, digits = 0) => nf[digits].format(Number.isFinite(x) ? x : 0);
// Grammes : une décimale sous 10 g, entier au-dessus
export const fmtG = x => fmt(x, Math.abs(x) < 10 && x % 1 ? 1 : 0);
// Lit un nombre tapé avec une virgule ou un point
export const parseNum = v => { const n = parseFloat(String(v).replace(',', '.').replace(/\s/g, '')); return Number.isFinite(n) ? n : NaN; };
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
