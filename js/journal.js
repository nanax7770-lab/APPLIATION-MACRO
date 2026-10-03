// Écran « Aujourd'hui » : anneaux, repas du jour, ajout et modification des aliments.
import { $, esc, ic, fmt, fmtG, parseNum, uid, toast, plural, todayKey, addDays, dayLabel, longDate } from './util.js';
import { state, S, save, dayLog, mealList, tidyDay, isFav, toggleFav, touchRecent } from './store.js';
import { foodByRef, foodLook, search, catById, persoFoods, recipeFoods } from './data.js';
import { NUTR, LABELS, MEALS, mealById, visibleMeals, defaultMeal, scale, mealTotals, dayTotals, targets, energy, eUnit, fmtE } from './nutrition.js';
import { actions, openSheet, closeSheet, confirmSheet, rings, playRings, seg, refresh, segHandlers } from './ui.js';
import { openFoodForm, recipeFromItems } from './foods.js';

/* ---------- Jour affiché ---------- */
let viewDay = todayKey();
export const getViewDay = () => viewDay;
actions['day-prev'] = () => { viewDay = addDays(viewDay, -1); renderToday(); };
actions['day-next'] = () => { viewDay = addDays(viewDay, 1); renderToday(); };
actions['day-today'] = () => { viewDay = todayKey(); renderToday(); };

/* ---------- Petits morceaux d'affichage ---------- */
export const macLine = n =>
  `<span class="mac"><i class="p">P ${fmtG(n.prot)}</i><i class="g">G ${fmtG(n.gluc)}</i><i class="l">L ${fmtG(n.lip)}</i></span>`;
const kcalCell = kcal => `<span class="kc"><b>${fmt(energy(kcal))}</b> ${eUnit()}</span>`;

// Ligne d'aliment (valeurs pour 100 g)
export function foodRow(f, action = 'pick') {
  const look = foodLook(f);
  const where = f.kind === 'recette' ? 'Recette' : f.kind === 'perso' ? 'Mon aliment' : '100 g';
  return `<button class="row" data-action="${action}" data-ref="${esc(f.ref)}"><span class="ri food" style="--c:${look.c}">${ic(look.icon)}</span><span class="rt"><span>${esc(f.nom)}</span><small>${f.kind === 'recette' ? `1 portion · ${fmtE(f.n.kcal * f.portions[0].g / 100)}` : `${where} · ${macLine(f.n)}`}</small></span>${f.kind === 'recette' ? '' : kcalCell(f.n.kcal)}</button>`;
}

// « 150 g » ou « 2 × tranche · 50 g »
export function qtyLabel(it) {
  if (it.u === 'g' || !it.u) return `${fmtG(it.g)} g`;
  if (it.u === 'ml') return `${fmt(it.q)} ml`;
  const name = Number(it.q) === 1 ? it.u : `${fmt(it.q, 2)} × ${it.u.replace(/^1 /, '')}`;
  return `${name} · ${fmt(it.g)} g`;
}

/* ---------- Écran du jour ---------- */
export function renderToday() {
  const k = viewDay, T = targets(), tot = dayTotals(k), rem = T.kcal - tot.kcal;
  $('#today-nav-title').textContent = dayLabel(k);
  const macro = (key, label, c) => {
    const p = T[key] ? tot[key] / T[key] : 0;
    return `<div class="macro" style="--c:var(--${c}-ink)"><span class="macro-l">${label}</span>
      <div class="ring-wrap">${rings(64, [{ r: 27, w: 8, color: `var(--${c})`, p }], true)}<div class="ring-center"><b>${fmt(Math.round(p * 100))}%</b></div></div>
      <span class="macro-v"><b>${fmt(tot[key])}</b> / ${fmt(T[key])} g</span></div>`;
  };
  $('#today').innerHTML = `
    <div class="lt">
      <div><p class="eyebrow">${esc(longDate(k))}</p><h1 class="large-title">${esc(dayLabel(k))}</h1></div>
      <div class="lt-tools">
        <button class="icon-btn plain" data-action="day-prev" aria-label="Jour précédent">${ic('chev-l')}</button>
        <button class="icon-btn plain" data-action="day-next" aria-label="Jour suivant">${ic('chev-r')}</button>
      </div>
    </div>
    ${k !== todayKey() ? `<button class="back-today" data-action="day-today">Revenir à aujourd’hui</button>` : ''}
    ${!S.setup ? `<div class="card setup" style="margin-bottom:12px"><span class="ri" style="--c:var(--accent)">${ic('target')}</span><div>
      <h3>Calculez vos objectifs</h3><p>Renseignez votre profil pour obtenir vos besoins en calories et en macros.</p>
      <button class="btn primary" data-tab="profile">Remplir mon profil</button></div></div>` : ''}
    <div class="card sum">
      <div class="sum-top">
        <div class="ring-wrap" id="kcal-ring">${rings(124, [{ r: 55, w: 15, color: 'var(--kcal)', p: T.kcal ? tot.kcal / T.kcal : 0 }], true)}
          <div class="ring-center${rem < 0 ? ' over' : ''}"><b>${fmt(energy(Math.abs(rem)))}</b><span>${rem < 0 ? `${eUnit()} en trop` : `${eUnit()} restantes`}</span></div></div>
        <ul class="sum-legend">
          <li><span class="l">Consommé</span><span class="v kcal">${fmt(energy(tot.kcal))}<small> ${eUnit()}</small></span></li>
          <li><span class="l">Objectif</span><span class="v">${fmt(energy(T.kcal))}<small> ${eUnit()}</small></span></li>
          <li><span class="l">Fibres · Sel</span><span class="v">${fmtG(tot.fibres)}<small> g</small> · ${fmt(tot.sel, 1)}<small> g</small></span></li>
        </ul>
      </div>
      <div class="macros">${macro('prot', 'Protéines', 'prot')}${macro('gluc', 'Glucides', 'gluc')}${macro('lip', 'Lipides', 'lip')}</div>
    </div>
    <h2 class="section-title">Repas</h2>
    ${visibleMeals().map(m => mealCard(k, m)).join('')}
    ${hiddenSportMeals(k)}
    <p class="list-footer">Touchez un aliment pour modifier sa quantité ou le changer de repas.</p>`;
  playRings($('#today'));
}

function mealCard(k, m) {
  const list = dayLog(k)[m.id] || [], t = mealTotals(list);
  return `<div class="meal">
    <div class="meal-head">
      <span class="ri" style="--c:${m.c}">${ic(m.icon)}</span>
      <span class="rt"><span>${m.nom}</span><small>${list.length ? `<b class="meal-kcal">${fmt(energy(t.kcal))} ${eUnit()}</b> · ${macLine(t)}` : 'Aucun aliment'}</small></span>
      <div class="meal-btns">
        <button class="icon-btn plain" data-action="meal-menu" data-meal="${m.id}" aria-label="Options du repas">${ic('more')}</button>
        <button class="icon-btn" data-action="add" data-meal="${m.id}" aria-label="Ajouter un aliment">${ic('plus')}</button>
      </div>
    </div>
    ${list.map(e => `<button class="row" data-action="edit-entry" data-meal="${m.id}" data-id="${e.id}"><span class="rt"><span>${esc(e.nom)}</span><small>${esc(qtyLabel(e))}</small></span>${kcalCell(scale(e.n, e.g).kcal)}</button>`).join('')}
  </div>`;
}

// Si les repas sportifs sont masqués mais contiennent des aliments, on les montre quand même
function hiddenSportMeals(k) {
  if (S.sport) return '';
  return MEALS.filter(m => m.sport && (dayLog(k)[m.id] || []).length).map(m => mealCard(k, m)).join('');
}

/* ---------- Options d'un repas ---------- */
actions['meal-menu'] = el => {
  const meal = el.dataset.meal, m = mealById(meal), list = dayLog(viewDay)[meal] || [];
  const y = dayLog(addDays(viewDay, -1))[meal] || [];
  openSheet({
    title: m.nom,
    body: `<div class="list icons" style="margin-top:4px">
      <button class="row action" data-action="copy-yesterday" data-meal="${meal}" ${y.length ? '' : 'disabled'}><span class="ri">${ic('copy')}</span><span class="rt"><span>Copier le repas de la veille</span><small>${y.length ? `${plural(y.length, 'aliment', 'aliments')} · ${fmtE(mealTotals(y).kcal)}` : 'Rien la veille pour ce repas'}</small></span></button>
      ${list.length ? `<button class="row action" data-action="meal-to-recipe" data-meal="${meal}"><span class="ri" style="--c:var(--orange)">${ic('pot')}</span><span class="rt"><span>Enregistrer comme recette</span><small>Pour le rajouter en un geste</small></span></button>` : ''}
    </div>
    ${list.length ? `<div class="list icons" style="margin-top:24px"><button class="row destructive" data-action="meal-clear" data-meal="${meal}"><span class="ri" style="--c:var(--red)">${ic('trash')}</span><span class="rt"><span>Vider ce repas</span></span></button></div>` : ''}`
  });
};

function copyYesterday(meal) {
  const y = dayLog(addDays(viewDay, -1))[meal] || [];
  if (!y.length) return toast('Rien à copier');
  const list = mealList(viewDay, meal);
  for (const e of y) list.push({ ...structuredClone(e), id: uid() });
  save(); closeSheet(); refresh();
  toast(`${plural(y.length, 'aliment copié', 'aliments copiés')} depuis la veille`);
}
actions['copy-yesterday'] = el => copyYesterday(el.dataset.meal);

actions['meal-clear'] = el => {
  const meal = el.dataset.meal;
  confirmSheet({
    title: 'Vider le repas', ok: 'Vider le repas',
    text: `Tous les aliments du repas « ${esc(mealById(meal).nom)} » de ce jour seront retirés.`,
    onOk: () => { delete state.journal[viewDay]?.[meal]; tidyDay(viewDay); save(); refresh(); toast('Repas vidé'); }
  });
};

actions['meal-to-recipe'] = el => {
  const meal = el.dataset.meal, list = dayLog(viewDay)[meal] || [];
  closeSheet(true);
  recipeFromItems(`${mealById(meal).nom} du ${longDate(viewDay)}`, list);
};

/* ---------- Feuille d'ajout : recherche ---------- */
// Aliments proposés tant qu'aucun aliment n'a été utilisé
const SUGGESTIONS = ['viandes/blanc-de-poulet-cuit', 'feculents/riz-basmati-cuit', 'laitiers/oeuf-entier-cru', 'feculents/flocons-d-avoine',
  'fruits/banane', 'laitiers/skyr-nature', 'poissons/thon-au-naturel-egoutte', 'feculents/pates-cuites', 'legumes/brocoli-cuit',
  'complements/whey-proteine-concentree', 'graisses/huile-d-olive', 'feculents/pain-complet'];
// mode « meal » : on ajoute au journal ; mode « ingredient » : on ajoute à une recette
let add = null;
export function openAdd(opts) {
  add = { mode: 'meal', q: '', tab: 'recent', ...opts };
  renderAdd();
}
actions.add = el => openAdd({ mode: 'meal', day: viewDay, meal: el.dataset.meal || defaultMeal() });
segHandlers.addTab = v => { add.tab = v; renderAddResults(); };

function renderAdd() {
  const title = add.mode === 'meal' ? mealById(add.meal).nom : 'Ajouter un ingrédient';
  openSheet({
    title, tall: true, right: { label: 'OK', close: true, strong: true },
    body: `<label class="search">${ic('search')}<input id="add-q" type="search" placeholder="Rechercher un aliment" value="${esc(add.q)}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
        <button class="search-clear" data-action="add-clear" ${add.q ? '' : 'hidden'} aria-label="Effacer">${ic('x-circle')}</button></label>
      <div id="add-tabs" class="sheet-seg" ${add.q ? 'hidden' : ''}>${seg('addTab', [['recent', 'Récents'], ['fav', 'Favoris'], ['perso', 'Mes aliments'], ['recette', 'Recettes']], add.tab)}</div>
      <div id="add-results"></div>`,
    onClose: () => { add = null; }
  });
  renderAddResults();
}

export function onAddInput(v) {
  if (!add) return;
  add.q = v;
  $('#add-tabs').hidden = !!v.trim();
  $('[data-action="add-clear"]').hidden = !v;
  renderAddResults();
}
actions['add-clear'] = () => { const i = $('#add-q'); i.value = ''; onAddInput(''); i.focus(); };

function renderAddResults() {
  const box = $('#add-results');
  if (!box || !add) return;
  const q = add.q.trim();
  const list = rows => `<div class="list icons">${rows.map(f => foodRow(f)).join('')}</div>`;
  let html = '';
  if (q) {
    const res = search(q);
    html = res.length
      ? `<p class="list-header">${plural(res.length, 'résultat', 'résultats')}</p>${list(res)}`
      : `<div class="empty small">${ic('search')}<h3>Aucun résultat</h3><p>Vérifiez l’orthographe, ou créez cet aliment avec ses valeurs nutritionnelles.</p></div>
         <div class="sheet-actions"><button class="btn tinted" data-action="new-food" data-name="${esc(q)}">Créer « ${esc(q)} »</button></div>`;
  } else {
    if (add.mode === 'meal') {
      const y = dayLog(addDays(add.day, -1))[add.meal] || [];
      if (y.length) html += `<div class="list icons" style="margin-top:12px"><button class="row action" data-action="copy-yesterday" data-meal="${add.meal}"><span class="ri">${ic('copy')}</span><span class="rt"><span>Copier le repas de la veille</span><small>${plural(y.length, 'aliment', 'aliments')} · ${fmtE(mealTotals(y).kcal)}</small></span></button></div>`;
    }
    const sets = {
      recent: [state.recents.map(foodByRef).filter(Boolean), 'clock', 'Aucun aliment récent', 'Recherchez un aliment ci-dessus : les derniers utilisés apparaîtront ici.'],
      fav: [state.favs.map(foodByRef).filter(Boolean), 'star', 'Aucun favori', 'Touchez l’étoile d’un aliment pour le retrouver ici.'],
      perso: [persoFoods(), 'pencil', 'Aucun aliment perso', 'Créez un aliment à partir de son étiquette nutritionnelle.'],
      recette: [recipeFoods(), 'pot', 'Aucune recette', 'Créez vos recettes dans l’onglet Aliments.']
    };
    const [items, icon, h, p] = sets[add.tab];
    if (items.length) html += `<p class="list-header">${{ recent: 'Récents', fav: 'Favoris', perso: 'Mes aliments', recette: 'Mes recettes' }[add.tab]}</p>${list(items)}`;
    else if (add.tab === 'recent') html += `<p class="list-header">Suggestions</p>${list(SUGGESTIONS.map(foodByRef).filter(Boolean))}<p class="list-footer">Recherchez n’importe quel aliment ci-dessus : les derniers utilisés remplaceront ces suggestions.</p>`;
    else html += `<div class="empty small">${ic(icon)}<h3>${h}</h3><p>${p}</p></div>`;
    if (add.tab === 'perso') html += `<div class="sheet-actions"><button class="btn tinted" data-action="new-food">Créer un aliment</button></div>`;
  }
  box.innerHTML = html;
}

actions['new-food'] = el => {
  const back = add ? { ...add } : null;
  openFoodForm({
    name: el.dataset.name || '',
    onSaved: ref => { if (back) { add = back; add.q = ''; openQtyFor(ref, true); } }
  });
};

actions.pick = el => openQtyFor(el.dataset.ref, true);

// Ouvre la quantité pour un aliment choisi dans la recherche
function openQtyFor(ref, fromAdd) {
  const food = foodByRef(ref);
  if (!food || !add) return;
  const a = add;
  if (a.mode === 'ingredient') {
    openQty({ food, mode: 'ingredient', back: fromAdd, onSave: it => { a.onPick(it); add = a; add.q = ''; renderAdd(); toast(`${food.nom} ajouté à la recette`); } });
  } else {
    openQty({ food, mode: 'add', day: a.day, meal: a.meal, back: fromAdd });
  }
}

/* ---------- Feuille de quantité ---------- */
// Aliment reconstitué à partir d'une ligne enregistrée (journal ou recette) : on garde ses valeurs
export function foodFromItem(it, live) {
  const food = { ref: it.ref, nom: it.nom, n: it.n, kind: live?.kind || 'base', cat: live?.cat || '', portions: live?.portions || [], ml: live?.ml || null };
  if (it.u === 'ml' && !food.ml) food.ml = it.g / (it.q || 1);
  if (!isMeasure(it.u) && !food.portions.some(p => p.nom === it.u)) food.portions = [...food.portions, { nom: it.u, g: it.g / (it.q || 1) }];
  return food;
}
let qty = null;
// Unités : grammes, millilitres (pour les liquides) et portions de l'aliment
const isMeasure = u => u === 'g' || u === 'ml';
const unitsOf = f => [{ nom: 'g', label: 'Grammes', g: 1 }, ...(f.ml ? [{ nom: 'ml', label: 'Millilitres', g: f.ml }] : []),
  ...f.portions.map(p => ({ nom: p.nom, label: p.nom, g: p.g }))];
// Poids en grammes d'une unité (1 ml de lait pèse 1,03 g, 1 ml d'huile 0,92 g…)
const unitG = (f, u) => u === 'g' ? 1 : u === 'ml' ? (f.ml || 1) : (f.portions.find(p => p.nom === u)?.g || 0);
const gramsOf = (f, q, u) => q * unitG(f, u);

// opts : { food, mode, q, u, day, meal, entryId, back, onSave, onDelete }
export function openQty(opts) {
  const f = opts.food;
  let { q, u } = opts;
  if (q == null) {
    const last = state.lastQ[f.ref];
    if (last && (last.u === 'g' || (last.u === 'ml' && f.ml) || f.portions.some(p => p.nom === last.u))) ({ q, u } = last);
    else if (f.portions.length) { q = 1; u = f.portions[0].nom; }
    else { q = 100; u = 'g'; }
  }
  qty = { ...opts, q, u, meal: opts.meal || defaultMeal(), day: opts.day || viewDay };
  renderQty();
}

function renderQty() {
  const { food: f, mode } = qty;
  const fav = isFav(f.ref);
  const look = foodLook(f), cat = f.kind === 'base' ? catById(f.cat)?.nom : f.kind === 'perso' ? 'Mon aliment' : 'Recette';
  const title = { add: 'Ajouter', edit: 'Modifier', view: 'Aliment', ingredient: 'Ingrédient', 'ingredient-edit': 'Ingrédient' }[mode];
  const inJournal = mode === 'add' || mode === 'edit' || mode === 'view';
  const nrow = (k, sub) => `<div class="row${sub ? ' sub' : ''}"><span class="rt"><span>${k === 'kcal' ? `Énergie (${eUnit()})` : LABELS[k] + ' (g)'}</span></span><span class="v" id="nt-${k}"></span><span class="v w">${k === 'kcal' ? fmt(energy(f.n.kcal)) : fmt(f.n[k], 1)}</span></div>`;
  let buttons = '';
  if (mode === 'add') buttons = `<button class="btn primary" data-action="qty-save" id="qty-save">Ajouter</button>`;
  if (mode === 'view') buttons = `<button class="btn primary" data-action="qty-save" id="qty-save">Ajouter au journal</button>
      ${f.kind === 'perso' ? `<button class="btn tinted" data-action="food-edit" data-ref="${esc(f.ref)}">Modifier l’aliment</button>` : ''}
      ${f.kind === 'recette' ? `<button class="btn tinted" data-action="recipe-open" data-ref="${esc(f.ref)}">Modifier la recette</button>` : ''}`;
  if (mode === 'edit') buttons = `<button class="btn primary" data-action="qty-save">Enregistrer</button><button class="btn danger" data-action="qty-delete">Supprimer de ce repas</button>`;
  if (mode === 'ingredient') buttons = `<button class="btn primary" data-action="qty-save">Ajouter à la recette</button>`;
  if (mode === 'ingredient-edit') buttons = `<button class="btn primary" data-action="qty-save">Enregistrer</button><button class="btn danger" data-action="qty-delete">Retirer de la recette</button>`;

  openSheet({
    title, tall: true,
    left: qty.back ? { label: 'Retour', action: 'qty-back' } : { label: 'Annuler', close: true },
    right: { label: fav ? 'Retirer des favoris' : 'Ajouter aux favoris', icon: 'star', action: 'qty-fav', cls: 'fav' + (fav ? ' on' : '') },
    onClose: () => { qty = null; add = null; },
    body: `<div class="card qty-top">
        <p class="qty-name">${esc(f.nom)}</p>
        <p class="qty-sub"><span style="color:${look.c}">●</span> ${esc(cat || '')}</p>
        <div class="qty-nums">
          <div style="--c:var(--kcal-ink)"><b id="qn-kcal">0</b><span>${eUnit()}</span></div>
          <div style="--c:var(--prot-ink)"><b id="qn-prot">0</b><span>Protéines</span></div>
          <div style="--c:var(--gluc-ink)"><b id="qn-gluc">0</b><span>Glucides</span></div>
          <div style="--c:var(--lip-ink)"><b id="qn-lip">0</b><span>Lipides</span></div>
        </div>
      </div>
      <p class="list-header">Quantité</p>
      <div class="list"><div class="qty-input">
        <input id="qty-q" type="text" inputmode="decimal" value="${fmt(qty.q, 2)}" autocomplete="off" aria-label="Quantité">
        <span class="u" id="qty-u"></span>
        <div class="stepper"><button data-action="qty-step" data-d="-1" aria-label="Moins">${ic('minus')}</button><button data-action="qty-step" data-d="1" aria-label="Plus">${ic('plus')}</button></div>
      </div></div>
      <div class="chips" style="margin-top:12px">${unitsOf(f).map(u => `<button class="uchip${u.nom === qty.u ? ' on' : ''}" data-action="qty-unit" data-u="${esc(u.nom)}">${esc(u.label)}${isMeasure(u.nom) ? '' : ` <small>${fmt(u.g)} g</small>`}</button>`).join('')}</div>
      ${inJournal ? `<p class="list-header" style="margin-top:8px">Repas <span class="nc">· ${esc(dayLabel(qty.day))}</span></p>
      <div class="list"><div class="row"><span class="rt"><span>Repas</span></span><span class="pick"><span id="qty-meal-l">${esc(mealById(qty.meal).nom)}</span>${ic('updown')}
        <select id="qty-meal" aria-label="Repas">${MEALS.map(m => `<option value="${m.id}" ${m.id === qty.meal ? 'selected' : ''}>${m.nom}</option>`).join('')}</select></span></div></div>` : ''}
      <div class="sheet-actions">${buttons}</div>
      <p class="list-header">Valeurs nutritionnelles</p>
      <div class="list ntable">
        <div class="row head"><span class="rt"><span></span></span><span class="v" id="nt-q"></span><span class="v w">100 g</span></div>
        ${nrow('kcal')}${nrow('prot')}${nrow('gluc')}${nrow('sucres', true)}${nrow('lip')}${nrow('ags', true)}${nrow('fibres')}${nrow('sel')}
      </div>
      <p class="list-footer">${f.kind === 'base' ? 'Valeurs moyennes d’après la table Ciqual (ANSES). ' : ''}Pour les boissons, 1 g ≈ 1 ml.</p>`
  });
  updateQty();
}

function updateQty() {
  if (!qty) return;
  const f = qty.food, q = parseNum($('#qty-q')?.value);
  qty.q = Number.isFinite(q) ? q : 0;
  const g = gramsOf(f, qty.q, qty.u), n = scale(f.n, g);
  $('#qn-kcal').textContent = fmt(energy(n.kcal));
  for (const k of ['prot', 'gluc', 'lip']) $(`#qn-${k}`).textContent = fmtG(n[k]);
  $('#qty-u').textContent = qty.u === 'g' ? 'g'
    : qty.u === 'ml' ? (f.ml === 1 ? 'ml' : `ml · ${fmt(g)} g`)
    : `× ${qty.u.replace(/^1 /, '')} · ${fmt(g)} g`;
  $('#nt-q').textContent = qty.u === 'ml' ? `${fmt(qty.q)} ml` : `${fmt(g)} g`;
  for (const k of NUTR) $(`#nt-${k}`).textContent = k === 'kcal' ? fmt(energy(n.kcal)) : fmt(n[k], 1);
  const save = $('#qty-save');
  if (save && qty.mode === 'add') save.textContent = `Ajouter · ${fmtE(n.kcal)}`;
}
export const onQtyInput = () => updateQty();
export function onQtyMeal(v) { if (!qty) return; qty.meal = v; $('#qty-meal-l').textContent = mealById(v).nom; }

actions['qty-unit'] = el => {
  const f = qty.food, u = el.dataset.u;
  if (u === qty.u) return;
  // On garde la même quantité en grammes quand c'est possible
  const g = gramsOf(f, qty.q, qty.u);
  qty.u = u;
  const per = unitG(f, u);
  qty.q = isMeasure(u) ? Math.round(g / per || 100) : 1;
  if (!isMeasure(u) && g > 0 && Math.abs(g / per - Math.round(g / per)) < 0.01 && Math.round(g / per) >= 1) qty.q = Math.round(g / per);
  $('#qty-q').value = fmt(qty.q, 2);
  document.querySelectorAll('.uchip').forEach(b => b.classList.toggle('on', b.dataset.u === u));
  updateQty();
};
actions['qty-step'] = el => {
  const d = Number(el.dataset.d), step = isMeasure(qty.u) ? (qty.q >= 100 ? 10 : 5) : (qty.q < 1 || (qty.q === 1 && d < 0) ? 0.25 : 1);
  qty.q = Math.max(0, Math.round((qty.q + d * step) * 100) / 100);
  $('#qty-q').value = fmt(qty.q, 2);
  updateQty();
};
actions['qty-fav'] = el => {
  const on = toggleFav(qty.food.ref);
  el.classList.toggle('on', on);
  el.setAttribute('aria-label', on ? 'Retirer des favoris' : 'Ajouter aux favoris');
  toast(on ? 'Ajouté aux favoris' : 'Retiré des favoris');
  refresh();
};
actions['qty-back'] = () => { if (add) renderAdd(); else closeSheet(); };

const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const snapshot = n => Object.fromEntries(NUTR.map(k => [k, round(n[k], 3)]));

actions['qty-save'] = () => {
  updateQty();
  const f = qty.food, g = round(gramsOf(f, qty.q, qty.u), 1);
  if (!(g > 0)) { toast('Indiquez une quantité'); $('#qty-q').focus(); return; }
  const item = { ref: f.ref, nom: f.nom, g, q: qty.q, u: qty.u, n: snapshot(f.n) };
  state.lastQ[f.ref] = { q: qty.q, u: qty.u };
  touchRecent(f.ref);
  const { mode } = qty;
  if (mode === 'ingredient' || mode === 'ingredient-edit') { save(); qty.onSave(item); return; }
  if (mode === 'edit') {
    const from = mealList(qty.day, qty.fromMeal), i = from.findIndex(e => e.id === qty.entryId);
    if (i >= 0) {
      const e = { ...from[i], ...item };
      if (qty.meal === qty.fromMeal) from[i] = e;
      else { from.splice(i, 1); mealList(qty.day, qty.meal).push(e); }
    }
    tidyDay(qty.day); save(); closeSheet(); refresh();
    toast('Modification enregistrée');
    return;
  }
  mealList(qty.day, qty.meal).push({ id: uid(), ...item });
  save(); refresh();
  const msg = `${f.nom} ajouté · ${fmtE(scale(f.n, g).kcal)}`;
  // Depuis la recherche : on y retourne pour enchaîner les aliments
  if (mode === 'add' && add) { add.q = ''; add.meal = qty.meal; add.tab = 'recent'; renderAdd(); }
  else closeSheet();
  toast(msg);
};

actions['qty-delete'] = () => {
  if (qty.mode === 'ingredient-edit') { qty.onDelete(); return; }
  const list = mealList(qty.day, qty.fromMeal), i = list.findIndex(e => e.id === qty.entryId);
  if (i >= 0) list.splice(i, 1);
  tidyDay(qty.day); save(); closeSheet(); refresh();
  toast('Aliment retiré');
};

// Modifier une ligne du journal
actions['edit-entry'] = el => {
  const meal = el.dataset.meal, e = (dayLog(viewDay)[meal] || []).find(x => x.id === el.dataset.id);
  if (!e) return;
  // On garde les valeurs enregistrées : l'aliment d'origine a pu être modifié ou supprimé depuis
  const live = foodByRef(e.ref);
  const food = foodFromItem(e, live);
  add = null;
  openQty({ food, mode: 'edit', q: e.q, u: e.u, day: viewDay, meal, fromMeal: meal, entryId: e.id });
};

// Fiche d'un aliment ouverte depuis l'onglet Aliments
actions['food-view'] = el => {
  const food = foodByRef(el.dataset.ref);
  if (!food) return;
  add = null;
  openQty({ food, mode: 'view', day: viewDay, meal: viewDay === todayKey() ? defaultMeal() : 'dej' });
};
