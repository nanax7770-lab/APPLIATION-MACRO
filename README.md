# MACRO

Application web de suivi nutritionnel pour le sport : on note ce qu'on mange à partir des aliments
bruts (poulet, riz, farine, œufs, légumes…) et l'app calcule les calories, protéines, glucides et
lipides. Objectifs calculés selon le profil, recettes, suivi du poids et statistiques. Installable
sur iPhone et utilisable hors ligne. Aucune inscription, aucun serveur : les données restent sur
l'appareil.

## Lancer l'application sur l'ordinateur

L'application doit être ouverte via un petit serveur local (un simple double-clic sur
`index.html` ne suffit pas, le navigateur bloque le chargement des aliments).

1. Ouvrez l'app **Terminal** (Cmd + Espace, tapez « Terminal »).
2. Collez cette commande puis appuyez sur Entrée :

   ```
   cd ~/Desktop/"APPLIATION MACRO" && python3 -m http.server 8081
   ```

3. Ouvrez **http://localhost:8081** dans votre navigateur.
4. Pour arrêter : revenez dans le Terminal et appuyez sur Ctrl + C.

## Les écrans

| Onglet | Contenu |
|---|---|
| **Aujourd’hui** | Anneaux calories / protéines / glucides / lipides, repas du jour, navigation entre les jours |
| **Aliments** | Recherche, 12 catégories (335 aliments), favoris, mes aliments, mes recettes |
| **Progrès** | Poids, calories par jour, macros moyennes, jours dans l’objectif, séries (7 jours, 30 jours, 3 mois) |
| **Profil** | Profil, besoins (Mifflin-St Jeor), objectifs de macros, réglages, sauvegarde |

## Organisation des fichiers

| Dossier / fichier | Rôle |
|---|---|
| `index.html` | La page de l'application |
| `css/style.css` | Le design (mode clair et sombre automatiques) |
| `js/` | Le fonctionnement (un fichier par partie) |
| `js/nutrition.js` | Les calculs : macros, besoins, objectifs, repas |
| `js/journal.js` | L'écran du jour et l'ajout d'un aliment |
| `js/foods.js` | L'onglet Aliments, les aliments perso et les recettes |
| `js/progress.js` | L'onglet Progrès |
| `js/profile.js` | L'onglet Profil et les réglages |
| `js/charts.js` | Les graphiques |
| `js/store.js` | L'enregistrement des données sur l'appareil |
| `data/aliments/` | **Tous les aliments**, un fichier JSON par catégorie |
| `data/COMMENT-AJOUTER-DES-ALIMENTS.md` | Le guide pour ajouter des aliments |
| `sw.js` | Le mode hors ligne |
| `manifest.json`, `icons/` | L'installation sur téléphone |

## Les valeurs nutritionnelles

Les valeurs sont des moyennes pour 100 g, arrondies, d'après la table Ciqual de l'ANSES. Un même
aliment existe souvent en version **crue** et **cuite** : 100 g de riz cru et 100 g de riz cuit
n'ont pas du tout les mêmes macros, car le riz absorbe de l'eau à la cuisson. Choisissez la version
qui correspond à ce que vous pesez.

Les besoins sont calculés avec la formule de Mifflin-St Jeor multipliée par le niveau d'activité,
puis ajustés selon l'objectif (sèche −15 %, prise de masse +10 %). Ce sont des repères, pas un
avis médical.

## Mettre à jour la version en ligne

Après une modification, augmentez le numéro `VERSION` en haut de `sw.js`
(par exemple `macro-v2`), puis publiez avec GitHub Desktop (« Commit » puis « Push origin »).
Sur le téléphone, la nouvelle version s'affiche à la deuxième ouverture de l'app.

## Installer sur iPhone

Une fois l'app publiée (par exemple avec GitHub Pages), ouvrez son adresse dans Safari, touchez
le bouton Partager puis **« Sur l'écran d'accueil »**.
