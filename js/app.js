// Point de départ de l'application.
import { $ } from './util.js';
import { S, save } from './store.js';
import { loadData } from './data.js';
import { actions, applyTheme, pop, showTab, closeSheet, sheetOpen, current, refresh, onRefresh, segHandlers, stepHandlers, initScrollBars, initSheetDrag } from './ui.js';
import { renderToday, onAddInput, onQtyInput, onQtyMeal } from './journal.js';
import { initFoods, refreshFoods, onRecipeInput } from './foods.js';
import { renderProgress } from './progress.js';
import { renderProfile, onProfileChange, onProfileSwitch, initImport } from './profile.js';

applyTheme();

// Un seul écouteur de clics pour toute l'application
function onClick(e) {
  const t = e.target;
  let el;
  if ((el = t.closest('.seg button'))) {
    const s = el.parentElement, btns = [...s.querySelectorAll('button')];
    if (el.classList.contains('on')) return;
    s.style.setProperty('--i', btns.indexOf(el));
    btns.forEach(b => b.classList.toggle('on', b === el));
    return onSeg(s.dataset.seg, el.dataset.v);
  }
  if ((el = t.closest('[data-step]'))) return stepHandlers[el.dataset.step]?.(Number(el.dataset.d), el);
  if (t.closest('[data-close]')) return closeSheet();
  if (t.closest('[data-pop]')) return pop();
  if ((el = t.closest('[data-tab]'))) return showTab(el.dataset.tab);
  if ((el = t.closest('[data-action]'))) {
    if (el.disabled) return;
    return actions[el.dataset.action]?.(el);
  }
}

// Le curseur du contrôle segmenté glisse d'abord, puis l'écran se met à jour
function onSeg(name, v) {
  if (segHandlers[name]) return setTimeout(() => segHandlers[name](v), name === 'addTab' ? 0 : 280);
  S[name] = v;
  save();
}

function onInput(e) {
  const t = e.target;
  if (t.id === 'add-q') return onAddInput(t.value);
  if (t.id === 'qty-q') return onQtyInput();
  if (t.id === 'rec-name' || t.id === 'rec-weight') return onRecipeInput(t);
}

function onChange(e) {
  const t = e.target;
  if (t.id === 'qty-meal') return onQtyMeal(t.value);
  if (t.dataset.prof) return onProfileChange(t);
  if (t.dataset.switch) return onProfileSwitch(t.dataset.switch, t.checked);
}

function onKey(e) {
  if (sheetOpen()) {
    if (e.key === 'Escape') closeSheet();
    // Entrée dans la quantité ou un formulaire = bouton principal
    if (e.key === 'Enter' && e.target.matches?.('#qty-q, #w-val, #food-form input')) {
      e.preventDefault();
      actions[e.target.id === 'qty-q' ? 'qty-save' : e.target.id === 'w-val' ? 'weight-save' : 'food-save']();
    }
    return;
  }
  if (e.key === 'Enter' && e.target.matches?.('.num, .field-text')) { e.target.blur(); return; }
  if (e.target.closest?.('input, textarea, select')) return;
  if (e.key === 'Escape' && current() !== 'recipe') pop();
}

async function boot() {
  const app = $('#app');
  app.addEventListener('click', onClick);
  app.addEventListener('input', onInput);
  app.addEventListener('change', onChange);
  document.addEventListener('keydown', onKey);
  initScrollBars();
  initSheetDrag();
  initFoods();
  initImport();
  try {
    await loadData();
  } catch (err) {
    console.error(err);
    $('#boot').textContent = 'Impossible de charger les aliments. Rechargez la page.';
    return;
  }
  onRefresh(() => { renderToday(); refreshFoods(); renderProgress(); renderProfile(); });
  refresh();
  const boot = $('#boot');
  boot.style.opacity = '0';
  setTimeout(() => boot.remove(), 300);
  // Au retour dans l'app (par exemple le lendemain), on remet les écrans à jour
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !sheetOpen()) refresh(); });
}
boot();

// Mode hors ligne : le « service worker » garde une copie de l'application
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', async () => {
    const sw = navigator.serviceWorker;
    // Une nouvelle version vient de s'installer : on recharge dès que l'utilisateur n'est pas en pleine saisie
    if (sw.controller) sw.addEventListener('controllerchange', reloadWhenIdle, { once: true });
    try {
      const reg = await sw.register('sw.js');
      // Au retour dans l'app (iPhone), on regarde s'il existe une mise à jour
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    } catch (err) { console.warn('Hors ligne indisponible', err); }
  });
}
function reloadWhenIdle() {
  const busy = () => sheetOpen() || current() === 'recipe';
  if (!busy()) return location.reload();
  const t = setInterval(() => { if (!busy()) { clearInterval(t); location.reload(); } }, 1000);
}
