// Chargement des aliments depuis data/aliments/, plus les aliments perso et les recettes.
import { state } from './store.js';
import { fold } from './util.js';
import { NUTR, recipeInfo } from './nutrition.js';

export const cats = [];          // catégories dans l'ordre d'affichage
export const foods = new Map();  // tous les aliments, par référence (« viandes/blanc-de-poulet-cru »)

export const PERSO = 'perso', RECETTE = 'recette';

export async function loadData() {
  const index = await (await fetch('data/aliments/index.json')).json();
  const files = await Promise.all(index.categories.map(f =>
    fetch('data/aliments/' + f).then(r => r.json()).catch(err => {
      console.error('Fichier d’aliments illisible :', f, err);
      return null;
    })));
  for (const c of files) if (c) addCat(c);
  refreshUser();
}

const nutrOf = a => Object.fromEntries(NUTR.map(k => [k, Number(a[k]) || 0]));
const portionsOf = a => (Array.isArray(a.portions) ? a.portions : []).filter(p => p && p.nom && p.g > 0);

function addCat(c) {
  const cat = { id: c.id, nom: c.nom, icone: c.icone || 'utensils', couleur: c.couleur || 'gray', foods: [] };
  for (const a of c.aliments || []) {
    if (!a.id || !a.nom) continue;
    const ref = `${c.id}/${a.id}`;
    if (foods.has(ref)) continue;
    const food = { ref, cat: c.id, kind: 'base', nom: a.nom, n: nutrOf(a), portions: portionsOf(a), key: fold(a.nom) };
    foods.set(ref, food);
    cat.foods.push(food);
  }
  cats.push(cat);
}

// Aliments perso et recettes : on les recrée à chaque modification
export function refreshUser() {
  for (const [ref, f] of foods) if (f.kind !== 'base') foods.delete(ref);
  for (const a of state.perso) {
    const ref = `${PERSO}/${a.id}`;
    foods.set(ref, { ref, cat: PERSO, kind: 'perso', id: a.id, nom: a.nom, n: nutrOf(a), portions: portionsOf(a), key: fold(a.nom) });
  }
  for (const r of state.recettes) {
    const ref = `${RECETTE}/${r.id}`, info = recipeInfo(r);
    const portions = [{ nom: '1 portion', g: Math.round(info.portionG) }];
    if (info.weight > 0 && info.portions > 1) portions.push({ nom: 'Recette entière', g: Math.round(info.weight) });
    foods.set(ref, { ref, cat: RECETTE, kind: 'recette', id: r.id, nom: r.nom, n: info.per100, portions, key: fold(r.nom), info });
  }
}

export const catById = id => cats.find(c => c.id === id);
export const foodByRef = ref => foods.get(ref);
export const persoFoods = () => [...foods.values()].filter(f => f.kind === 'perso');
export const recipeFoods = () => [...foods.values()].filter(f => f.kind === 'recette');

// Couleur et icône d'un aliment (celles de sa catégorie)
export function foodLook(f) {
  if (f.kind === 'perso') return { icon: 'pencil', c: 'var(--accent)' };
  if (f.kind === 'recette') return { icon: 'pot', c: 'var(--orange)' };
  const c = catById(f.cat);
  return { icon: c?.icone || 'utensils', c: `var(--${c?.couleur || 'gray'})` };
}

// Recherche sans tenir compte des accents ni de l'ordre des mots.
// Les aliments perso et les recettes passent devant, puis ceux qui commencent par la recherche.
export function search(q, limit = 80) {
  const words = fold(q).split(/[\s,]+/).filter(Boolean);
  if (!words.length) return [];
  const out = [];
  for (const f of foods.values()) {
    if (!words.every(w => f.key.includes(w))) continue;
    let score = 0;
    if (f.kind !== 'base') score -= 100;
    if (f.key.startsWith(words[0])) score -= 50;
    else if (new RegExp(`(^|[^a-z])${words[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(f.key)) score -= 25;
    score += f.key.length / 100;
    out.push([score, f]);
  }
  return out.sort((a, b) => a[0] - b[0]).slice(0, limit).map(x => x[1]);
}
