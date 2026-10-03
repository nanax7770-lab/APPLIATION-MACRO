// Onglet « Progrès » : poids, calories, macros moyennes, régularité.
import { $, esc, ic, chev, fmt, fmtG, parseNum, toast, plural, todayKey, addDays, lastDays, keyDate, shortDate, longDate } from './util.js';
import { state, S, save, currentWeight, dayLog } from './store.js';
import { targets, dayTotals, isLogged, onTarget, energy, eUnit, fmtE, toUserW, fromUserW, wUnit, fmtW, scale, loggedDays } from './nutrition.js';
import { actions, openSheet, closeSheet, confirmSheet, seg, segHandlers, rings, refresh } from './ui.js';
import { lineChart, barChart } from './charts.js';

const WEEKDAY = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
segHandlers.period = v => { S.period = v; save(); renderProgress(); };

/* ---------- Séries ---------- */
// Jours de suite dans l'objectif (aujourd'hui compte s'il est déjà réussi)
function streak(T) {
  let n = 0, k = todayKey();
  if (onTarget(k, T)) n++;
  for (;;) { k = addDays(k, -1); if (onTarget(k, T)) n++; else break; }
  return n;
}
function bestStreak(T) {
  let best = 0, run = 0, prev = null;
  for (const k of loggedDays()) {
    if (!onTarget(k, T)) { run = 0; prev = k; continue; }
    run = prev && addDays(prev, 1) === k && run ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

/* ---------- Écran ---------- */
export function renderProgress() {
  const period = Number(S.period) || 7, days = lastDays(period), T = targets();
  const logged = days.filter(isLogged);
  const totals = Object.fromEntries(logged.map(k => [k, dayTotals(k)]));
  const avg = key => logged.length ? logged.reduce((a, k) => a + totals[k][key], 0) / logged.length : 0;
  const hits = days.filter(k => onTarget(k, T)).length;
  const s = streak(T);
  $('#progress').innerHTML = `
    <div class="period">${seg('period', [['7', '7 jours'], ['30', '30 jours'], ['90', '3 mois']], String(period))}</div>
    ${weightCard(days)}
    ${kcalCard(days, totals, T, avg('kcal'), logged.length)}
    ${macroCard(T, logged.length, avg)}
    <h2 class="section-title">Régularité</h2>
    <div class="tiles">
      <div class="tile" style="--c:var(--accent)">${ic('calendar')}<b>${logged.length}<small> / ${period}</small></b><span>Jours suivis</span></div>
      <div class="tile" style="--c:var(--green)">${ic('target')}<b>${hits}<small> / ${period}</small></b><span>Jours dans l’objectif</span></div>
      <div class="tile" style="--c:var(--orange)">${ic('flame')}<b>${s}</b><span>${s >= 2 ? 'Jours de suite' : 'Jour de suite'}</span></div>
      <div class="tile" style="--c:var(--yellow)">${ic('award')}<b>${bestStreak(T)}</b><span>Record de jours de suite</span></div>
    </div>
    <div class="card" style="margin-top:12px">${weekStrip(T)}</div>
    <p class="list-footer">Un jour est « dans l’objectif » quand ses calories sont à ±10 % de votre cible (${esc(fmtE(T.kcal))}).</p>
    ${topFoods(days)}`;
}

function weightCard(days) {
  const pts = days.map((k, i) => [k, i]).filter(([k]) => state.poids[k] != null);
  const cur = currentWeight();
  const keys = Object.keys(state.poids).sort();
  const lastKey = keys.at(-1);
  let delta = '';
  if (pts.length >= 2) {
    const d = toUserW(state.poids[pts.at(-1)[0]]) - toUserW(state.poids[pts[0][0]]);
    const cls = Math.abs(d) < 0.05 ? 'flat' : d < 0 ? 'down' : 'up';
    delta = `<span class="delta ${cls}">${d > 0 ? '+' : d < 0 ? '−' : ''}${fmt(Math.abs(d), 1)} ${wUnit()}</span>`;
  }
  const n = days.length;
  const chart = pts.length >= 2
    ? lineChart(pts.map(([k, i]) => ({ x: i / (n - 1), v: toUserW(state.poids[k]) })), {
        color: 'var(--accent)',
        ticks: [{ x: 0, label: shortDate(days[0]) }, { x: 0.5, label: shortDate(days[Math.floor((n - 1) / 2)]) }, { x: 1, label: shortDate(days.at(-1)) }]
      })
    : `<div class="chart-empty">${pts.length ? 'Encore une pesée pour voir la courbe.' : 'Aucune pesée sur cette période.'}</div>`;
  return `<h2 class="section-title">Poids</h2>
    <div class="card">
      <div class="stat-head"><div><p class="muted">${lastKey ? `Dernière pesée · ${esc(shortDate(lastKey))}` : 'Poids du profil'}</p>
        <p class="big-num">${fmt(toUserW(cur), 1)}<span> ${wUnit()}</span></p></div>${delta}</div>
      ${chart}
      <button class="btn tinted" style="margin-top:14px" data-action="weight-add">${ic('plus')}Ajouter une pesée</button>
    </div>
    ${keys.length ? `<div class="list icons" style="margin-top:12px"><button class="row" data-action="weight-list"><span class="ri">${ic('weight')}</span><span class="rt"><span>Toutes les pesées</span></span><span class="rd">${keys.length}</span>${chev()}</button></div>` : ''}
    <p class="list-footer">Pesez-vous le matin à jeun, plusieurs fois par semaine : c’est la tendance qui compte.</p>`;
}

function kcalCard(days, totals, T, avgKcal, nLogged) {
  let bars;
  const kc = k => totals[k]?.kcal || 0;
  if (days.length <= 30) {
    bars = days.map(k => ({ v: energy(kc(k)), label: days.length <= 7 ? WEEKDAY[keyDate(k).getDay()] : String(keyDate(k).getDate()), hit: onTarget(k, T) }));
  } else {
    // 3 mois : une barre par semaine (moyenne des jours suivis)
    bars = [];
    for (let end = days.length; end > 0; end -= 7) {
      const wk = days.slice(Math.max(0, end - 7), end), lg = wk.filter(k => totals[k]);
      const v = lg.length ? lg.reduce((a, k) => a + kc(k), 0) / lg.length : 0;
      bars.unshift({ v: energy(v), label: shortDate(wk[0]).replace('.', ''), hit: lg.length && Math.abs(v - T.kcal) <= T.kcal * 0.1 });
    }
  }
  return `<h2 class="section-title">Calories</h2>
    <div class="card">
      <p class="muted">Moyenne par jour suivi</p>
      <p class="big-num">${nLogged ? fmt(energy(avgKcal)) : '—'}<span> ${eUnit()}</span></p>
      ${nLogged ? barChart(bars, { target: energy(T.kcal), every: days.length <= 7 ? 1 : days.length <= 30 ? 5 : 3, muted: 'color-mix(in srgb, var(--kcal) 35%, transparent)' }) : `<div class="chart-empty">Ajoutez vos repas pour voir vos calories jour après jour.</div>`}
    </div>
    <p class="list-footer">${days.length > 30 ? 'Une barre par semaine. ' : ''}En orange vif : dans l’objectif. Pointillés : votre objectif.</p>`;
}

function macroCard(T, nLogged, avg) {
  if (!nLogged) return '';
  const row = (key, label, c) => {
    const a = avg(key), p = T[key] ? Math.min(1, a / T[key]) : 0;
    return `<div class="bar-row" style="--c:var(--${c})"><div class="top"><b style="color:var(--${c}-ink)">${label}</b><span><b>${fmt(a)} g</b> / ${fmt(T[key])} g</span></div><div class="pbar"><i style="width:${p * 100}%"></i></div></div>`;
  };
  const kP = avg('prot') * 4, kG = avg('gluc') * 4, kL = avg('lip') * 9, sum = kP + kG + kL || 1;
  const pc = x => Math.round(x / sum * 100);
  return `<h2 class="section-title">Macros moyennes</h2>
    <div class="list">${row('prot', 'Protéines', 'prot')}${row('gluc', 'Glucides', 'gluc')}${row('lip', 'Lipides', 'lip')}</div>
    <div class="card" style="margin-top:12px">
      <p class="muted">Répartition des calories</p>
      <div class="split"><i style="width:${pc(kP)}%;background:var(--prot)"></i><i style="width:${pc(kG)}%;background:var(--gluc)"></i><i style="width:${pc(kL)}%;background:var(--lip)"></i></div>
      <div class="split-legend"><span style="--c:var(--prot-ink)">Protéines <b>${pc(kP)} %</b></span><span style="--c:var(--gluc-ink)">Glucides <b>${pc(kG)} %</b></span><span style="--c:var(--lip-ink)">Lipides <b>${pc(kL)} %</b></span></div>
    </div>
    <p class="list-footer">Moyenne des jours suivis : ${fmtG(avg('fibres'))} g de fibres, ${fmt(avg('sel'), 1)} g de sel, ${fmt(avg('sucres'))} g de sucres par jour.</p>`;
}

function weekStrip(T) {
  const s = streak(T), out = [];
  for (const k of lastDays(7)) {
    const kcal = dayTotals(k).kcal;
    out.push(`<div class="${k === todayKey() ? 'today' : ''}">${rings(30, [{ r: 11.5, w: 5, color: onTarget(k, T) ? 'var(--green)' : 'var(--kcal)', p: T.kcal ? kcal / T.kcal : 0 }])}<span>${WEEKDAY[keyDate(k).getDay()]}</span></div>`);
  }
  return `<div class="streak-head">${ic('flame', 'flame' + (s ? '' : ' off'))}
      <div><p class="streak-title">${s ? plural(s, 'jour de suite', 'jours de suite') : 'Lancez votre série'}</p>
      <p class="streak-sub">${onTarget(todayKey(), T) ? 'Objectif atteint aujourd’hui' : 'Restez à ±10 % de votre objectif'}</p></div></div>
    <div class="week">${out.join('')}</div>`;
}

function topFoods(days) {
  const agg = new Map();
  for (const k of days) for (const list of Object.values(dayLog(k))) for (const e of list) {
    const a = agg.get(e.ref) || { nom: e.nom, n: 0, kcal: 0, prot: 0 };
    const v = scale(e.n, e.g);
    a.n++; a.kcal += v.kcal; a.prot += v.prot;
    agg.set(e.ref, a);
  }
  const top = [...agg.values()].sort((a, b) => b.kcal - a.kcal).slice(0, 5);
  if (!top.length) return '';
  return `<h2 class="section-title">Vos principales sources</h2>
    <div class="list">${top.map(a => `<div class="row"><span class="rt"><span>${esc(a.nom)}</span><small>${plural(a.n, 'fois', 'fois')} · ${fmt(a.prot)} g de protéines</small></span><span class="kc"><b>${fmt(energy(a.kcal))}</b> ${eUnit()}</span></div>`).join('')}</div>
    <p class="list-footer">Les aliments qui vous ont apporté le plus de calories sur la période.</p>`;
}

/* ---------- Pesées ---------- */
actions['weight-add'] = () => {
  const t = todayKey();
  openSheet({
    title: 'Nouvelle pesée',
    left: { label: 'Annuler', close: true }, right: { label: 'OK', action: 'weight-save', strong: true },
    body: `<div class="list" style="margin-top:4px">
        <label class="row field-num"><span class="rt"><span>Poids</span></span><input class="num" id="w-val" type="text" inputmode="decimal" placeholder="${fmt(toUserW(currentWeight()), 1)}" autocomplete="off"><span class="unit">${wUnit()}</span></label>
        <label class="row"><span class="rt"><span>Date</span></span><input class="date-input" id="w-date" type="date" value="${t}" max="${t}"></label>
      </div>
      <p class="form-error" id="form-error" hidden></p>
      <p class="list-footer">Une seule pesée par jour : une nouvelle valeur remplace l’ancienne.</p>`
  });
  setTimeout(() => $('#w-val')?.focus(), 450);
};
actions['weight-save'] = () => {
  const v = parseNum($('#w-val').value), k = $('#w-date').value || todayKey();
  const kg = fromUserW(v);
  if (!(kg >= 25 && kg <= 350)) { const e = $('#form-error'); e.hidden = false; e.textContent = 'Indiquez un poids valide.'; return; }
  state.poids[k] = Math.round(kg * 10) / 10;
  save(); closeSheet(); refresh();
  toast(`Pesée enregistrée · ${fmtW(kg)}`);
};
actions['weight-list'] = () => {
  const keys = Object.keys(state.poids).sort().reverse();
  openSheet({
    title: 'Pesées', tall: keys.length > 8,
    body: `<div class="list" style="margin-top:4px">${keys.map((k, i) => {
      const next = keys[i + 1], d = next ? toUserW(state.poids[k]) - toUserW(state.poids[next]) : 0;
      return `<button class="row" data-action="weight-del" data-k="${k}"><span class="rt"><span>${fmtW(state.poids[k])}</span><small>${esc(longDate(k))}</small></span>${next ? `<span class="rd">${d > 0 ? '+' : d < 0 ? '−' : ''}${fmt(Math.abs(d), 1)}</span>` : ''}</button>`;
    }).join('')}</div>
    <p class="list-footer">Touchez une pesée pour la supprimer.</p>`
  });
};
actions['weight-del'] = el => {
  const k = el.dataset.k;
  confirmSheet({
    title: 'Supprimer', ok: 'Supprimer la pesée',
    text: `Pesée du ${esc(longDate(k))} : ${esc(fmtW(state.poids[k]))}.`,
    onOk: () => { delete state.poids[k]; save(); refresh(); toast('Pesée supprimée'); }
  });
};
