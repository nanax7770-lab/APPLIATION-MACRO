// Sauvegarde des données dans le navigateur (localStorage).
// Rien n'est envoyé sur internet.
import { todayKey } from './util.js';

const KEY = 'macro';

export const DEFAULTS = {
  theme: 'auto',      // auto | light | dark
  energy: 'kcal',     // kcal | kJ
  weightUnit: 'kg',   // kg | lb
  sport: true,        // afficher les repas pré / post-entraînement
  period: '7',        // période affichée dans Progrès : 7 | 30 | 90 jours
  setup: false        // le profil a-t-il été rempli au moins une fois ?
};

export const PROFILE = {
  sexe: 'h',            // h | f
  age: 25,
  taille: 178,          // cm
  poids: 75,            // kg (utilisé tant qu'aucune pesée n'est enregistrée)
  activite: 1.55,       // coefficient d'activité
  objectif: 'maintien', // seche | maintien | masse
  auto: true,           // macros calculées automatiquement
  protKg: 2,            // g de protéines par kg de poids
  lipKg: 1,             // g de lipides par kg de poids
  manual: { prot: 150, gluc: 280, lip: 75 } // objectifs choisis à la main (g)
};

const blank = () => ({
  v: 1,
  settings: { ...DEFAULTS },
  profile: structuredClone(PROFILE),
  journal: {},   // { 'AAAA-MM-JJ': { pdj: [lignes], dej: [...], ... } }
  poids: {},     // { 'AAAA-MM-JJ': kg }
  perso: [],     // aliments créés par l'utilisateur
  recettes: [],  // plats composés
  favs: [],      // références des aliments favoris
  recents: [],   // références des derniers aliments utilisés
  lastQ: {},     // dernière quantité utilisée pour chaque aliment
  created: Date.now()
});

function merge(s) {
  const b = blank();
  return {
    ...b, ...s,
    settings: { ...b.settings, ...(s.settings || {}) },
    profile: { ...b.profile, ...(s.profile || {}), manual: { ...b.profile.manual, ...(s.profile?.manual || {}) } }
  };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) return merge(s);
  } catch (e) { /* stockage indisponible */ }
  return blank();
}

export const state = load();
export const S = state.settings;
export const P = state.profile;

let timer, locked = false; // locked : on ne sauvegarde plus (avant un rechargement)
export function save() { clearTimeout(timer); timer = setTimeout(saveNow, 200); }
export function saveNow() {
  clearTimeout(timer);
  if (locked) return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.warn('Sauvegarde impossible', e); }
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
addEventListener('pagehide', saveNow);

/* ---------- Journal ---------- */
export const dayLog = k => state.journal[k] || {};
export function mealList(k, meal) {
  const d = (state.journal[k] ||= {});
  return (d[meal] ||= []);
}
// Supprime les repas et journées vides pour garder une sauvegarde légère
export function tidyDay(k) {
  const d = state.journal[k];
  if (!d) return;
  for (const m in d) if (!d[m].length) delete d[m];
  if (!Object.keys(d).length) delete state.journal[k];
}

/* ---------- Poids ---------- */
// Dernier poids connu (pesée la plus récente, sinon celui du profil)
export function currentWeight(upTo = todayKey()) {
  const keys = Object.keys(state.poids).filter(k => k <= upTo).sort();
  return keys.length ? state.poids[keys.at(-1)] : P.poids;
}

/* ---------- Favoris et récents ---------- */
export const isFav = ref => state.favs.includes(ref);
export function toggleFav(ref) {
  const i = state.favs.indexOf(ref);
  if (i >= 0) state.favs.splice(i, 1); else state.favs.unshift(ref);
  save();
  return i < 0;
}
export function touchRecent(ref) {
  state.recents = [ref, ...state.recents.filter(r => r !== ref)].slice(0, 40);
}

/* ---------- Sauvegarde dans un fichier ---------- */
export function exportData() {
  return JSON.stringify({ app: 'MACRO', exported: new Date().toISOString(), ...state });
}

export function importData(text) {
  const d = JSON.parse(text);
  if (!d || d.v !== 1 || typeof d.journal !== 'object') throw new Error('Fichier non reconnu');
  const clean = merge({
    v: 1,
    settings: d.settings, profile: d.profile,
    journal: d.journal || {}, poids: d.poids || {},
    perso: Array.isArray(d.perso) ? d.perso : [],
    recettes: Array.isArray(d.recettes) ? d.recettes : [],
    favs: Array.isArray(d.favs) ? d.favs : [],
    recents: Array.isArray(d.recents) ? d.recents : [],
    lastQ: d.lastQ || {},
    created: d.created || Date.now()
  });
  locked = true;
  localStorage.setItem(KEY, JSON.stringify(clean));
}

export function resetAll() {
  clearTimeout(timer);
  locked = true;
  localStorage.removeItem(KEY);
}
