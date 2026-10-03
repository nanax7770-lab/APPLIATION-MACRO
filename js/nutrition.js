// Calculs nutritionnels : macros d'une quantité, d'un repas, d'une journée, besoins et objectifs.
import { state, S, P, dayLog, currentWeight } from './store.js';
import { fmt, todayKey } from './util.js';

// Valeurs suivies pour chaque aliment (toujours pour 100 g)
export const NUTR = ['kcal', 'prot', 'gluc', 'sucres', 'lip', 'ags', 'fibres', 'sel'];
export const LABELS = {
  kcal: 'Énergie', prot: 'Protéines', gluc: 'Glucides', sucres: 'dont sucres',
  lip: 'Lipides', ags: 'dont acides gras saturés', fibres: 'Fibres', sel: 'Sel'
};

export const MEALS = [
  { id: 'pdj', nom: 'Petit-déjeuner', icon: 'coffee', c: 'var(--orange)' },
  { id: 'dej', nom: 'Déjeuner', icon: 'sun', c: 'var(--yellow)' },
  { id: 'col', nom: 'Collations', icon: 'apple', c: 'var(--green)' },
  { id: 'din', nom: 'Dîner', icon: 'moon', c: 'var(--indigo)' },
  { id: 'pre', nom: 'Pré-entraînement', icon: 'zap', c: 'var(--pink)', sport: true },
  { id: 'post', nom: 'Post-entraînement', icon: 'dumbbell', c: 'var(--purple)', sport: true }
];
export const mealById = id => MEALS.find(m => m.id === id);
export const visibleMeals = () => MEALS.filter(m => !m.sport || S.sport);
// Repas proposé par défaut selon l'heure
export function defaultMeal() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h < 10.5) return 'pdj';
  if (h < 15) return 'dej';
  if (h < 18.5) return 'col';
  return 'din';
}

export const zero = () => Object.fromEntries(NUTR.map(k => [k, 0]));
// Valeurs pour g grammes d'un aliment donné pour 100 g
export function scale(n, g) {
  const o = {};
  for (const k of NUTR) o[k] = (Number(n[k]) || 0) * g / 100;
  return o;
}
export function addTo(acc, o) { for (const k of NUTR) acc[k] += o[k] || 0; return acc; }

export const entryNutr = e => scale(e.n, e.g);
export function mealTotals(list = []) { const t = zero(); for (const e of list) addTo(t, entryNutr(e)); return t; }
export function dayTotals(k) {
  const t = zero(), d = dayLog(k);
  for (const m in d) addTo(t, mealTotals(d[m]));
  return t;
}
export const dayCount = k => Object.values(dayLog(k)).reduce((a, l) => a + l.length, 0);
export const isLogged = k => dayCount(k) > 0;

// Valeurs pour 100 g d'une recette, à partir de ses ingrédients
export function recipeInfo(r) {
  const t = zero();
  let raw = 0;
  for (const i of r.ingredients || []) { addTo(t, scale(i.n, i.g)); raw += i.g; }
  const weight = r.poidsCuit > 0 ? r.poidsCuit : raw;
  const per100 = zero();
  if (weight > 0) for (const k of NUTR) per100[k] = t[k] * 100 / weight;
  const portions = Math.max(1, r.portions || 1);
  return { total: t, raw, weight, per100, portions, portionG: weight / portions };
}

/* ---------- Besoins (Mifflin-St Jeor) ---------- */
export const ACTIVITIES = [
  [1.2, 'Sédentaire', 'Peu ou pas de sport'],
  [1.375, 'Légèrement actif', '1 à 3 séances par semaine'],
  [1.55, 'Actif', '3 à 5 séances par semaine'],
  [1.725, 'Très actif', '6 à 7 séances par semaine'],
  [1.9, 'Extrêmement actif', 'Sport intense et métier physique']
];
export const GOALS = [['seche', 'Sèche'], ['maintien', 'Maintien'], ['masse', 'Prise de masse']];
const GOAL_FACTOR = { seche: 0.85, maintien: 1, masse: 1.1 };

export function needs() {
  const w = currentWeight();
  const bmr = 10 * w + 6.25 * P.taille - 5 * P.age + (P.sexe === 'f' ? -161 : 5);
  const tdee = bmr * P.activite;
  const goal = Math.round(tdee * (GOAL_FACTOR[P.objectif] || 1) / 10) * 10;
  return { w, bmr: Math.round(bmr), tdee: Math.round(tdee), goal };
}

// Objectifs du jour : calories et grammes de chaque macro
export function targets() {
  if (!P.auto) {
    const { prot, gluc, lip } = P.manual;
    return { kcal: Math.round(prot * 4 + gluc * 4 + lip * 9), prot, gluc, lip };
  }
  const { w, goal } = needs();
  const prot = Math.round(P.protKg * w);
  const lip = Math.round(P.lipKg * w);
  const gluc = Math.max(0, Math.round((goal - prot * 4 - lip * 9) / 4));
  return { kcal: goal, prot, gluc, lip };
}

// Une journée est « dans l'objectif » si les calories sont à ±10 % de la cible
export function onTarget(k, T = targets()) {
  if (!isLogged(k)) return false;
  const kcal = dayTotals(k).kcal;
  return Math.abs(kcal - T.kcal) <= T.kcal * 0.1;
}

/* ---------- Affichage ---------- */
export const energy = kcal => S.energy === 'kJ' ? Math.round(kcal * 4.184) : Math.round(kcal);
export const eUnit = () => S.energy === 'kJ' ? 'kJ' : 'kcal';
export const fmtE = kcal => `${fmt(energy(kcal))} ${eUnit()}`;
export const toUserW = kg => S.weightUnit === 'lb' ? kg * 2.20462 : kg;
export const fromUserW = v => S.weightUnit === 'lb' ? v / 2.20462 : v;
export const wUnit = () => S.weightUnit;
export const fmtW = kg => `${fmt(toUserW(kg), 1)} ${wUnit()}`;

// Les journées qui ont au moins un aliment, triées
export const loggedDays = () => Object.keys(state.journal).filter(isLogged).sort();
export const isFuture = k => k > todayKey();
