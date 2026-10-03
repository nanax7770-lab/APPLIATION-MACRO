// Onglet « Profil » : profil, besoins, objectifs de macros, réglages et sauvegarde.
import { $, esc, ic, fmt, parseNum, toast, todayKey, dayKey } from './util.js';
import { state, S, P, save, currentWeight, exportData, importData, resetAll } from './store.js';
import { ACTIVITIES, GOALS, needs, targets, energy, eUnit, fmtE, toUserW, fromUserW, wUnit } from './nutrition.js';
import { actions, seg, toggleRow, stepperRow, segHandlers, stepHandlers, confirmSheet, refresh, applyTheme } from './ui.js';

const pick = (id, options, value) => {
  const cur = options.find(o => String(o[0]) === String(value)) || options[0];
  return `<span class="pick"><span>${esc(cur[1])}</span>${ic('updown')}<select data-prof="${id}" aria-label="${id}">${options.map(o => `<option value="${o[0]}" ${String(o[0]) === String(value) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></span>`;
};
const numRow = (id, label, value, unit, digits = 0) =>
  `<label class="row field-num"><span class="rt"><span>${label}</span></span><input class="num" data-prof="${id}" type="text" inputmode="decimal" value="${fmt(value, digits)}" autocomplete="off"><span class="unit">${unit}</span></label>`;

export function renderProfile() {
  const N = needs(), T = targets(), w = currentWeight();
  const pct = (g, f) => T.kcal ? Math.round(g * f / T.kcal * 100) : 0;
  const act = ACTIVITIES.find(a => a[0] === P.activite) || ACTIVITIES[2];
  const autoRows = `
    ${stepperRow('protKg', 'Protéines', `${fmt(P.protKg, 1)} g par kg · ${fmt(T.prot)} g`)}
    ${stepperRow('lipKg', 'Lipides', `${fmt(P.lipKg, 1)} g par kg · ${fmt(T.lip)} g`)}
    <div class="row"><span class="rt"><span>Glucides</span><small>Le reste des calories · ${fmt(T.gluc)} g</small></span></div>`;
  const manualRows = `
    ${stepperRow('mprot', 'Protéines', `${fmt(T.prot)} g · ${fmt(T.prot / w, 1)} g par kg`)}
    ${stepperRow('mgluc', 'Glucides', `${fmt(T.gluc)} g`)}
    ${stepperRow('mlip', 'Lipides', `${fmt(T.lip)} g`)}`;
  $('#profile').innerHTML = `
    <p class="list-header">Vous</p>
    <div class="card seg-card">${seg('sexe', [['h', 'Homme'], ['f', 'Femme']], P.sexe)}</div>
    <div class="list" style="margin-top:12px">
      ${numRow('age', 'Âge', P.age, 'ans')}
      ${numRow('taille', 'Taille', P.taille, 'cm')}
      ${numRow('poids', 'Poids', toUserW(w), wUnit(), 1)}
      <div class="row"><span class="rt"><span>Activité</span><small>${esc(act[2])}</small></span>${pick('activite', ACTIVITIES, P.activite)}</div>
    </div>
    <p class="list-footer">Modifier le poids ici enregistre une pesée pour aujourd’hui.</p>

    <p class="list-header">Objectif</p>
    <div class="card seg-card">${seg('objectif', GOALS, P.objectif)}</div>
    <p class="list-footer">${{ seche: 'Sèche : environ 15 % sous vos besoins, pour perdre du gras en gardant le muscle.', maintien: 'Maintien : autant de calories que vous en dépensez.', masse: 'Prise de masse : environ 10 % au-dessus de vos besoins.' }[P.objectif]}</p>

    <h2 class="section-title">Vos besoins</h2>
    <div class="card needs">
      <div><b>${fmt(energy(N.bmr))}</b><span>Métabolisme de base</span></div>
      <div><b>${fmt(energy(N.tdee))}</b><span>Dépense par jour</span></div>
      <div><b>${fmt(energy(T.kcal))}</b><span>Objectif (${eUnit()})</span></div>
    </div>
    <p class="list-footer">Formule de Mifflin-St Jeor multipliée par votre niveau d’activité. C’est une estimation : ajustez selon l’évolution de votre poids sur 2 à 3 semaines.</p>

    <h2 class="section-title">Macros</h2>
    <div class="list">${toggleRow('auto', 'Calcul automatique', P.auto)}</div>
    <div class="list target-rows" style="margin-top:12px">${P.auto ? autoRows : manualRows}</div>
    <div class="card" style="margin-top:12px">
      <div class="split"><i style="width:${pct(T.prot, 4)}%;background:var(--prot)"></i><i style="width:${pct(T.gluc, 4)}%;background:var(--gluc)"></i><i style="width:${pct(T.lip, 9)}%;background:var(--lip)"></i></div>
      <div class="split-legend"><span style="--c:var(--prot-ink)">P <b>${fmt(T.prot)} g</b> · ${pct(T.prot, 4)} %</span><span style="--c:var(--gluc-ink)">G <b>${fmt(T.gluc)} g</b> · ${pct(T.gluc, 4)} %</span><span style="--c:var(--lip-ink)">L <b>${fmt(T.lip)} g</b> · ${pct(T.lip, 9)} %</span></div>
    </div>
    <p class="list-footer">${P.auto
      ? 'Repères pour un sportif : 1,6 à 2,2 g de protéines et 0,8 à 1 g de lipides par kg ; les glucides complètent les calories.'
      : `Objectif calculé à partir de vos grammes : ${esc(fmtE(T.kcal))} par jour (4 kcal par g de protéines ou de glucides, 9 par g de lipides).`}</p>

    <h2 class="section-title">Réglages</h2>
    <p class="list-header">Apparence</p>
    <div class="card seg-card">${seg('theme', [['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']], S.theme)}</div>
    <p class="list-header">Unités</p>
    <div class="list">
      <div class="row"><span class="rt"><span>Énergie</span></span><div style="width:150px">${seg('energy', [['kcal', 'kcal'], ['kJ', 'kJ']], S.energy)}</div></div>
      <div class="row"><span class="rt"><span>Poids</span></span><div style="width:150px">${seg('weightUnit', [['kg', 'kg'], ['lb', 'lb']], S.weightUnit)}</div></div>
    </div>
    <p class="list-header">Journal</p>
    <div class="list">${toggleRow('sport', 'Repas pré / post-entraînement', S.sport)}</div>

    <p class="list-header">Sauvegarde</p>
    <div class="list icons">
      <button class="row action" data-action="export"><span class="ri">${ic('download')}</span><span class="rt"><span>Exporter mes données</span></span></button>
      <button class="row action" data-action="import"><span class="ri">${ic('upload')}</span><span class="rt"><span>Importer une sauvegarde</span></span></button>
    </div>
    <p class="list-footer">Vos données restent uniquement sur cet appareil. Exportez-les de temps en temps pour les garder en sécurité ou les transférer.</p>
    <div class="list icons" style="margin-top:24px">
      <button class="row destructive" data-action="reset"><span class="ri" style="--c:var(--red)">${ic('trash')}</span><span class="rt"><span>Tout réinitialiser</span></span></button>
    </div>
    <p class="list-footer">MACRO · version 1.0 · Valeurs nutritionnelles d’après la table Ciqual (ANSES). Ces calculs sont des repères et ne remplacent pas l’avis d’un professionnel de santé.</p>`;
}

/* ---------- Modifications du profil ---------- */
const LIMITS = { age: [12, 100], taille: [120, 230] };
export function onProfileChange(el) {
  const id = el.dataset.prof;
  if (id === 'activite') P.activite = Number(el.value);
  else if (id === 'poids') {
    const kg = fromUserW(parseNum(el.value));
    if (kg >= 25 && kg <= 350) { state.poids[todayKey()] = Math.round(kg * 10) / 10; P.poids = state.poids[todayKey()]; }
    else toast('Indiquez un poids valide');
  } else {
    const x = parseNum(el.value), [a, b] = LIMITS[id];
    if (x >= a && x <= b) P[id] = Math.round(x);
    else toast(`Valeur entre ${a} et ${b}`);
  }
  S.setup = true;
  save(); refresh();
}
const profileSeg = name => v => { P[name] = v; S.setup = true; save(); refresh(); };
segHandlers.sexe = profileSeg('sexe');
segHandlers.objectif = profileSeg('objectif');
segHandlers.theme = v => { S.theme = v; save(); applyTheme(); };
segHandlers.energy = v => { S.energy = v; save(); refresh(); };
segHandlers.weightUnit = v => { S.weightUnit = v; save(); refresh(); };

export function onProfileSwitch(name, on) {
  if (name === 'auto') {
    // En passant en manuel, on part des valeurs automatiques actuelles
    if (!on) { const T = targets(); P.manual = { prot: T.prot, gluc: T.gluc, lip: T.lip }; }
    P.auto = on;
    S.setup = true;
  } else S[name] = on;
  save(); refresh();
}

const step = (get, set, inc, min, max) => d => { set(Math.round(Math.max(min, Math.min(max, get() + inc * d)) * 10) / 10); S.setup = true; save(); refresh(); };
stepHandlers.protKg = step(() => P.protKg, v => P.protKg = v, 0.1, 0.8, 3.5);
stepHandlers.lipKg = step(() => P.lipKg, v => P.lipKg = v, 0.1, 0.4, 2);
stepHandlers.mprot = step(() => P.manual.prot, v => P.manual.prot = v, 5, 20, 400);
stepHandlers.mgluc = step(() => P.manual.gluc, v => P.manual.gluc = v, 10, 0, 900);
stepHandlers.mlip = step(() => P.manual.lip, v => P.manual.lip = v, 5, 10, 300);

/* ---------- Sauvegarde ---------- */
actions.export = () => {
  const blob = new Blob([exportData()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `macro-sauvegarde-${dayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Fichier de sauvegarde créé');
};
actions.import = () => $('#import-file').click();
export function initImport() {
  $('#import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    try { JSON.parse(text); } catch (err) { toast('Ce fichier n’est pas une sauvegarde valide'); return; }
    confirmSheet({
      title: 'Importer', danger: false, ok: 'Remplacer mes données',
      text: 'Les données de ce fichier remplaceront celles de cet appareil (journal, pesées, aliments, recettes et profil).',
      onOk: () => {
        try { importData(text); location.reload(); }
        catch (err) { toast('Ce fichier n’est pas une sauvegarde MACRO'); }
      }
    });
  });
}
actions.reset = () => confirmSheet({
  title: 'Tout réinitialiser', ok: 'Tout effacer',
  text: 'Votre journal, vos pesées, vos aliments, vos recettes et votre profil seront effacés. Pensez à exporter une sauvegarde avant.',
  onOk: () => { resetAll(); location.reload(); }
});
