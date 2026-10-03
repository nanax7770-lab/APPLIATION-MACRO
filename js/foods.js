// Onglet « Aliments » : recherche, catégories, aliments perso et recettes.
import { $, esc, ic, chev, fmt, fmtG, parseNum, uid, toast, plural } from './util.js';
import { state, save } from './store.js';
import { cats, foods, catById, foodByRef, persoFoods, recipeFoods, search, refreshUser, PERSO, RECETTE } from './data.js';
import { NUTR, LABELS, recipeInfo, energy, eUnit, fmtE } from './nutrition.js';
import { actions, enter, push, pop, openSheet, closeSheet, confirmSheet, stepperRow, stepHandlers, refresh, current } from './ui.js';
import { foodRow, qtyLabel, openAdd, openQty, foodFromItem } from './journal.js';

const list = (rows, cls = 'icons') => `<div class="list ${cls}">${rows.join('')}</div>`;
const actionRow = (action, label, icon = 'plus') =>
  `<button class="row action" data-action="${action}"><span class="ri">${ic(icon)}</span><span class="rt"><span>${label}</span></span></button>`;

/* ---------- Onglet Aliments ---------- */
function renderFoods() {
  const favs = state.favs.map(foodByRef).filter(Boolean);
  const perso = persoFoods(), recs = recipeFoods();
  const base = [...foods.values()].filter(f => f.kind === 'base').length;
  $('#foods').innerHTML = `
    ${favs.length ? `<p class="list-header">Favoris</p>${list(favs.map(f => foodRow(f, 'food-view')))}` : ''}
    <p class="list-header">Catégories</p>
    ${list(cats.map(c => `<button class="row" data-action="open-cat" data-cat="${c.id}"><span class="ri" style="--c:var(--${c.couleur})">${ic(c.icone)}</span><span class="rt"><span>${esc(c.nom)}</span></span><span class="rd">${c.foods.length}</span>${chev()}</button>`))}
    <p class="list-header">Mes recettes</p>
    ${list([...recs.map(f => foodRow(f, 'food-view')), actionRow('recipe-new', 'Créer une recette')])}
    <p class="list-footer">Une recette regroupe plusieurs ingrédients (par exemple : pâte à crêpes = farine + œufs + lait). L’app calcule les macros par portion.</p>
    <p class="list-header">Mes aliments</p>
    ${list([...perso.map(f => foodRow(f, 'food-view')), actionRow('food-new', 'Créer un aliment')])}
    <p class="list-footer">Pour un produit du commerce, recopiez les valeurs pour 100 g de son étiquette.</p>
    <p class="list-footer" style="margin-top:18px">${plural(base, 'aliment', 'aliments')} intégrés. Valeurs moyennes pour 100 g d’après la table Ciqual de l’ANSES.</p>`;
}

function renderFoodSearch() {
  const input = $('#food-search'), q = input.value, box = $('#food-results');
  $('[data-action="clear-food-search"]').hidden = !q;
  if (!q.trim()) { box.hidden = true; $('#foods').hidden = false; return; }
  const res = search(q);
  box.hidden = false;
  $('#foods').hidden = true;
  box.innerHTML = res.length
    ? `<p class="list-header">${plural(res.length, 'résultat', 'résultats')}</p>${list(res.map(f => foodRow(f, 'food-view')))}`
    : `<div class="empty">${ic('search')}<h3>Aucun résultat</h3><p>Essayez un autre mot, ou créez cet aliment.</p></div>
       <div class="sheet-actions"><button class="btn tinted" data-action="food-new" data-name="${esc(q)}">Créer « ${esc(q)} »</button></div>`;
}
actions['clear-food-search'] = () => { const i = $('#food-search'); i.value = ''; renderFoodSearch(); i.focus(); };

/* ---------- Page d'une catégorie ---------- */
let catId = null;
actions['open-cat'] = el => push('cat', el.dataset.cat);
enter.cat = id => { catId = id; renderCat(); $('.scroll', $('.page[data-page="cat"]')).scrollTop = 0; };
function renderCat() {
  const c = catById(catId);
  if (!c) return;
  $('.page[data-page="cat"]').dataset.title = c.nom;
  $('#cat-nav-title').textContent = c.nom;
  $('#cat').innerHTML = `
    <div class="lt"><h1 class="large-title">${esc(c.nom)}</h1></div>
    <p class="page-desc">${plural(c.foods.length, 'aliment', 'aliments')} · valeurs pour 100 g. Touchez un aliment pour choisir une quantité et l’ajouter au journal.</p>
    ${list(c.foods.map(f => foodRow(f, 'food-view')))}`;
}

/* ---------- Créer ou modifier un aliment perso ---------- */
let formCtx = null;
// opts : { name, ref (pour modifier), onSaved(ref) }
export function openFoodForm(opts = {}) {
  const old = opts.ref ? state.perso.find(a => `${PERSO}/${a.id}` === opts.ref) : null;
  formCtx = { ...opts, old };
  const v = k => old ? (old[k] ?? '') : '';
  const num = (k, unit, ph = '0') => `<label class="row field-num"><span class="rt"><span>${k === 'kcal' ? 'Énergie' : LABELS[k].replace(/^dont /, '· dont ')}</span></span>
    <input class="num" name="${k}" type="text" inputmode="decimal" placeholder="${ph}" value="${old ? fmt(v(k), 2) : ''}" autocomplete="off"><span class="unit">${unit}</span></label>`;
  const p = old?.portions?.[0];
  openSheet({
    title: old ? 'Modifier l’aliment' : 'Nouvel aliment', tall: true,
    left: { label: 'Annuler', close: true }, right: { label: 'OK', action: 'food-save', strong: true },
    onClose: () => { formCtx = null; },
    body: `<form id="food-form" autocomplete="off" onsubmit="return false">
      <div class="list" style="margin-top:4px"><label class="row"><input class="field-text" name="nom" placeholder="Nom (ex. : Pain de mie complet marque X)" value="${esc(old ? old.nom : opts.name || '')}"></label></div>
      <p class="list-header">Pour 100 g</p>
      <div class="list">${num('kcal', 'kcal', 'auto')}${num('prot', 'g')}${num('gluc', 'g')}${num('sucres', 'g')}${num('lip', 'g')}${num('ags', 'g')}${num('fibres', 'g')}${num('sel', 'g')}</div>
      <p class="list-footer">Laissez « Énergie » vide pour la calculer à partir des macros (4 kcal par gramme de protéines ou de glucides, 9 pour les lipides, 2 pour les fibres).</p>
      <p class="list-header">Portion (facultatif)</p>
      <div class="list"><label class="row"><input class="field-text" name="pnom" placeholder="Nom (ex. : 1 tranche)" value="${esc(p?.nom || '')}"></label>
        <label class="row field-num"><span class="rt"><span>Poids de la portion</span></span><input class="num" name="pg" type="text" inputmode="decimal" placeholder="0" value="${p ? fmt(p.g, 1) : ''}"><span class="unit">g</span></label></div>
      <p class="list-header">Liquide</p>
      <div class="list"><div class="row"><span class="rt"><span>Mesurer aussi en ml</span></span><label class="switch"><input type="checkbox" name="liquide" ${old?.ml ? 'checked' : ''}><span></span></label></div></div>
      <p class="list-footer">Pour une boisson ou une sauce : vous pourrez saisir la quantité en millilitres (1 ml compté comme 1 g).</p>
      <p class="form-error" id="form-error" hidden></p>
      ${old ? `<div class="sheet-actions"><button class="btn danger" type="button" data-action="food-delete">Supprimer l’aliment</button></div>` : ''}
    </form>`
  });
  if (!old) setTimeout(() => $('#food-form [name=nom]')?.focus(), 450);
}
actions['food-new'] = el => openFoodForm({ name: el.dataset.name || '' });
actions['food-edit'] = el => openFoodForm({ ref: el.dataset.ref });

actions['food-save'] = () => {
  const form = $('#food-form'), val = n => form.elements[n].value.trim();
  const err = t => { const e = $('#form-error'); e.hidden = false; e.textContent = t; };
  const nom = val('nom');
  if (!nom) return err('Donnez un nom à cet aliment.');
  const a = { id: formCtx.old?.id || uid(), nom };
  for (const k of NUTR) {
    const raw = val(k), x = raw === '' ? 0 : parseNum(raw);
    if (!Number.isFinite(x) || x < 0) return err(`Valeur incorrecte pour « ${k === 'kcal' ? 'Énergie' : LABELS[k]} ».`);
    a[k] = x;
  }
  if (val('kcal') === '') a.kcal = Math.round(a.prot * 4 + a.gluc * 4 + a.lip * 9 + a.fibres * 2);
  if (a.sucres > a.gluc) return err('Les sucres ne peuvent pas dépasser les glucides.');
  if (a.ags > a.lip) return err('Les acides gras saturés ne peuvent pas dépasser les lipides.');
  if (a.prot + a.gluc + a.lip + a.fibres + a.sel > 100.5) return err('Le total dépasse 100 g : vérifiez que les valeurs sont bien pour 100 g.');
  const pg = parseNum(val('pg'));
  a.portions = val('pnom') && pg > 0 ? [{ nom: val('pnom'), g: pg }] : [];
  if (form.elements.liquide.checked) a.ml = formCtx.old?.ml || 1;
  const i = state.perso.findIndex(x => x.id === a.id);
  if (i >= 0) state.perso[i] = a; else state.perso.push(a);
  const ref = `${PERSO}/${a.id}`, cb = formCtx.onSaved;
  save(); refreshUser(); refresh();
  if (cb) cb(ref);
  else { closeSheet(true); toast(i >= 0 ? 'Aliment modifié' : `« ${nom} » ajouté à vos aliments`); }
};

actions['food-delete'] = () => {
  const old = formCtx.old;
  confirmSheet({
    title: 'Supprimer', ok: 'Supprimer l’aliment',
    text: 'Il disparaîtra de vos aliments. Les repas déjà enregistrés gardent leurs valeurs.',
    onOk: () => {
      const ref = `${PERSO}/${old.id}`;
      state.perso = state.perso.filter(a => a.id !== old.id);
      state.favs = state.favs.filter(r => r !== ref);
      state.recents = state.recents.filter(r => r !== ref);
      save(); refreshUser(); refresh();
      toast('Aliment supprimé');
    }
  });
};

/* ---------- Recettes ---------- */
let draft = null, original = '';
const sameDraft = () => JSON.stringify(draft) === original;

function openRecipe(r) {
  draft = structuredClone(r);
  original = JSON.stringify(draft);
  if (current() === 'recipe') renderRecipe(); else push('recipe');
}
enter.recipe = () => { renderRecipe(); $('.scroll', $('.page[data-page="recipe"]')).scrollTop = 0; };

actions['recipe-new'] = () => { closeSheet(true); openRecipe({ id: null, nom: '', portions: 1, poidsCuit: 0, ingredients: [] }); };
actions['recipe-open'] = el => {
  const r = state.recettes.find(x => `${RECETTE}/${x.id}` === el.dataset.ref);
  if (!r) return;
  closeSheet(true);
  openRecipe(r);
};
// Depuis un repas du journal : « Enregistrer comme recette »
export function recipeFromItems(nom, items) {
  openRecipe({ id: null, nom, portions: 1, poidsCuit: 0, ingredients: items.map(({ ref, nom, g, q, u, n }) => ({ ref, nom, g, q, u, n })) });
}

const sumCard = (n, id) => `<div class="card rec-sum"${id ? ` id="${id}"` : ''}>
  <div style="--c:var(--kcal-ink)"><b>${fmt(energy(n.kcal))}</b><span>${eUnit()}</span></div>
  <div style="--c:var(--prot-ink)"><b>${fmtG(n.prot)}</b><span>Protéines</span></div>
  <div style="--c:var(--gluc-ink)"><b>${fmtG(n.gluc)}</b><span>Glucides</span></div>
  <div style="--c:var(--lip-ink)"><b>${fmtG(n.lip)}</b><span>Lipides</span></div></div>`;

function renderRecipe() {
  if (!draft) return;
  const title = draft.nom || 'Nouvelle recette';
  $('#recipe-nav-title').textContent = title;
  $('#recipe').innerHTML = `
    <p class="list-header" style="margin-top:12px">Nom</p>
    <div class="list"><label class="row"><input class="field-text" id="rec-name" placeholder="Nom de la recette" value="${esc(draft.nom)}" autocomplete="off"></label></div>
    <p class="list-header">Ingrédients</p>
    ${list([...draft.ingredients.map((it, i) => `<button class="row" data-action="ing-edit" data-i="${i}"><span class="rt"><span>${esc(it.nom)}</span><small>${esc(qtyLabel(it))}</small></span><span class="kc"><b>${fmt(energy(scaleItem(it).kcal))}</b> ${eUnit()}</span></button>`),
      actionRow('ing-add', 'Ajouter un ingrédient')], '')}
    <p class="list-footer">Indiquez les ingrédients tels que vous les pesez, en général crus.</p>
    <p class="list-header">Rendement</p>
    <div class="list">
      ${stepperRow('recPortions', 'Nombre de portions', plural(draft.portions, 'portion', 'portions'))}
      <label class="row field-num"><span class="rt"><span>Poids du plat cuit</span><small>Facultatif</small></span>
        <input class="num" id="rec-weight" type="text" inputmode="decimal" placeholder="—" value="${draft.poidsCuit > 0 ? fmt(draft.poidsCuit) : ''}" autocomplete="off"><span class="unit">g</span></label>
    </div>
    <p class="list-footer">En pesant le plat une fois cuit, les valeurs pour 100 g tiennent compte de l’eau évaporée ou absorbée à la cuisson.</p>
    <div id="rec-sums"></div>
    ${draft.id ? `<div class="sheet-actions" style="padding-top:28px"><button class="btn danger" data-action="recipe-delete">Supprimer la recette</button></div>` : ''}`;
  renderRecipeSums();
}
const scaleItem = it => Object.fromEntries(NUTR.map(k => [k, (it.n[k] || 0) * it.g / 100]));

function renderRecipeSums() {
  const info = recipeInfo(draft), box = $('#rec-sums');
  if (!box) return;
  if (!draft.ingredients.length) { box.innerHTML = ''; return; }
  const portion = Object.fromEntries(NUTR.map(k => [k, info.total[k] / info.portions]));
  box.innerHTML = `
    <p class="list-header">Par portion <span class="nc">· ${fmt(info.portionG)} g</span></p>${sumCard(portion)}
    <p class="list-header">Pour 100 g</p>${sumCard(info.per100)}
    <p class="list-footer">Recette entière : ${fmtE(info.total.kcal)} · ${fmt(info.weight)} g${draft.poidsCuit > 0 ? ` cuit (${fmt(info.raw)} g d’ingrédients)` : ''}.</p>`;
}

export function onRecipeInput(el) {
  if (!draft) return;
  if (el.id === 'rec-name') {
    draft.nom = el.value;
    const t = el.value.trim() || 'Nouvelle recette';
    $('#recipe-nav-title').textContent = t;
  }
  if (el.id === 'rec-weight') {
    const w = parseNum(el.value);
    draft.poidsCuit = w > 0 ? w : 0;
    renderRecipeSums();
  }
}

stepHandlers.recPortions = d => {
  draft.portions = Math.max(1, Math.min(50, draft.portions + d));
  $('[data-stepval="recPortions"]').textContent = plural(draft.portions, 'portion', 'portions');
  renderRecipeSums();
};

actions['ing-add'] = () => openAdd({
  mode: 'ingredient',
  onPick: item => {
    if (draft.id && item.ref === `${RECETTE}/${draft.id}`) { toast('Une recette ne peut pas se contenir elle-même'); return; }
    draft.ingredients.push(item);
    renderRecipe();
  }
});

actions['ing-edit'] = el => {
  const i = Number(el.dataset.i), it = draft.ingredients[i];
  const live = foodByRef(it.ref);
  const food = foodFromItem(it, live);
  openQty({
    food, mode: 'ingredient-edit', q: it.q, u: it.u,
    onSave: item => { draft.ingredients[i] = item; closeSheet(true); renderRecipe(); },
    onDelete: () => { draft.ingredients.splice(i, 1); closeSheet(true); renderRecipe(); }
  });
};

actions['recipe-save'] = () => {
  draft.nom = draft.nom.trim();
  if (!draft.nom) { toast('Donnez un nom à la recette'); $('#rec-name').focus(); return; }
  if (!draft.ingredients.length) { toast('Ajoutez au moins un ingrédient'); return; }
  const isNew = !draft.id;
  if (isNew) { draft.id = uid(); state.recettes.push(draft); }
  else state.recettes = state.recettes.map(r => r.id === draft.id ? draft : r);
  save(); refreshUser();
  draft = null;
  pop();
  toast(isNew ? 'Recette créée' : 'Recette enregistrée');
};

actions['recipe-back'] = () => {
  if (sameDraft()) { draft = null; return pop(); }
  confirmSheet({
    title: 'Modifications', ok: 'Abandonner les modifications',
    text: 'Les changements apportés à cette recette ne seront pas enregistrés.',
    onOk: () => { draft = null; pop(); }
  });
};

actions['recipe-delete'] = () => confirmSheet({
  title: 'Supprimer', ok: 'Supprimer la recette',
  text: 'La recette disparaîtra de vos aliments. Les repas déjà enregistrés gardent leurs valeurs.',
  onOk: () => {
    const ref = `${RECETTE}/${draft.id}`;
    state.recettes = state.recettes.filter(r => r.id !== draft.id);
    state.favs = state.favs.filter(r => r !== ref);
    state.recents = state.recents.filter(r => r !== ref);
    save(); refreshUser();
    draft = null;
    pop();
    toast('Recette supprimée');
  }
});

/* ---------- Mise à jour ---------- */
export function initFoods() {
  $('#food-search').addEventListener('input', renderFoodSearch);
}
export function refreshFoods() {
  renderFoods();
  renderFoodSearch();
  if (catId && current() === 'cat') renderCat();
}
