// Graphiques épurés façon app Santé, dessinés en SVG (aucune bibliothèque).
import { esc, fmt } from './util.js';

const W = 340;

// Courbe (poids). points : [{ x: 0..1, v, label }], ticks : [{ x, label }]
export function lineChart(points, { h = 150, color = 'var(--accent)', ticks = [], digits = 1 } = {}) {
  const top = 10, bottom = h - 22, left = 4, right = W - 34;
  let min = Math.min(...points.map(p => p.v)), max = Math.max(...points.map(p => p.v));
  const pad = Math.max(0.5, (max - min) * 0.15);
  min -= pad; max += pad;
  const X = x => left + x * (right - left);
  const Y = v => bottom - (v - min) / (max - min) * (bottom - top);
  const grid = [0, 0.5, 1].map(t => {
    const v = min + t * (max - min), y = Y(v);
    return `<line class="grid" x1="${left}" x2="${right}" y1="${y}" y2="${y}"/><text x="${right + 6}" y="${y + 3.5}">${fmt(v, digits)}</text>`;
  }).join('');
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(' ');
  const area = points.length > 1 ? `<path d="${d} L${X(points.at(-1).x).toFixed(1)} ${bottom} L${X(points[0].x).toFixed(1)} ${bottom} Z" fill="url(#lg)"/>` : '';
  const dots = points.length <= 31 ? points.map(p => `<circle class="dot" cx="${X(p.x)}" cy="${Y(p.v)}" r="4" style="fill:${color}"/>`).join('') : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="Évolution">
    <defs><linearGradient id="lg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:${color}" stop-opacity=".22"/><stop offset="1" style="stop-color:${color}" stop-opacity="0"/></linearGradient></defs>
    ${grid}${area}<path class="line" d="${d}" style="stroke:${color}"/>${dots}
    ${ticks.map(t => `<text x="${X(t.x)}" y="${h - 4}" text-anchor="${t.x < 0.05 ? 'start' : t.x > 0.95 ? 'end' : 'middle'}">${esc(t.label)}</text>`).join('')}
  </svg>`;
}

// Barres (calories par jour). bars : [{ v, label, hit }], target : ligne pointillée
export function barChart(bars, { h = 160, target = 0, color = 'var(--kcal)', muted = 'var(--fill-2)', unit = '', every = 1 } = {}) {
  const top = 12, bottom = h - 20, left = 0, right = W - 34;
  const max = Math.max(target * 1.15, ...bars.map(b => b.v), 1);
  const n = bars.length, slot = (right - left) / n, bw = Math.max(3, Math.min(26, slot * 0.62));
  const Y = v => bottom - v / max * (bottom - top);
  const out = bars.map((b, i) => {
    const x = left + i * slot + (slot - bw) / 2, y = Y(b.v), hgt = Math.max(b.v > 0 ? 3 : 0, bottom - y);
    // Une étiquette toutes les « every » barres, en partant de la plus récente
    const label = b.label && (n - 1 - i) % every === 0
      ? `<text x="${x + bw / 2}" y="${h - 4}" text-anchor="middle">${esc(b.label)}</text>` : '';
    return (hgt ? `<rect class="bar" x="${x.toFixed(1)}" y="${(bottom - hgt).toFixed(1)}" width="${bw.toFixed(1)}" height="${hgt.toFixed(1)}" rx="${Math.min(4, bw / 2)}" style="fill:${b.hit ? color : muted};animation-delay:${i * 12}ms"/>` : '') + label;
  }).join('');
  const t = target ? `<line class="target" x1="${left}" x2="${right}" y1="${Y(target)}" y2="${Y(target)}"/><text x="${right + 6}" y="${Y(target) + 3.5}">${fmt(target)}</text>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="Calories par jour${unit ? ' en ' + unit : ''}">
    <line class="grid" x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}"/>${out}${t}</svg>`;
}
