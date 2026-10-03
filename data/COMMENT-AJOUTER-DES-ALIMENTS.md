# Comment ajouter des aliments

Tous les aliments se trouvent dans le dossier `data/aliments/`, avec **un fichier par catégorie**
(`viandes.json`, `feculents.json`, `legumes.json`…). Vous pouvez les ouvrir avec n'importe quel
éditeur de texte (TextEdit en mode « texte brut », ou mieux : Visual Studio Code, gratuit).

## Ajouter un aliment dans une catégorie existante

Chaque aliment tient sur une ligne et ressemble à ceci :

```json
{"id": "blanc-de-poulet-cuit", "nom": "Blanc de poulet, cuit", "kcal": 151, "prot": 30.5, "gluc": 0, "sucres": 0, "lip": 3, "ags": 0.9, "fibres": 0, "sel": 0.2, "portions": [{"nom": "1 filet cuit", "g": 100}]}
```

Toutes les valeurs sont **pour 100 g** :

| Champ | Signification |
|---|---|
| `id` | Identifiant unique dans le fichier : minuscules, sans accent ni espace (des tirets à la place) |
| `nom` | Le nom affiché. Précisez « cru » ou « cuit » quand ça change les valeurs |
| `kcal` | Énergie en kilocalories |
| `prot` | Protéines (g) |
| `gluc` | Glucides (g) |
| `sucres` | dont sucres (g), jamais plus que `gluc` |
| `lip` | Lipides (g) |
| `ags` | dont acides gras saturés (g), jamais plus que `lip` |
| `fibres` | Fibres (g) |
| `sel` | Sel (g) |
| `portions` | Facultatif : les portions proposées, avec leur poids en grammes |

Pour ajouter un aliment : copiez une ligne complète, collez-la juste après une autre, modifiez-la,
et **n'oubliez pas la virgule** entre deux lignes. Pas de virgule après le dernier aliment de la liste.

Les décimales s'écrivent avec un **point** (`30.5`), pas une virgule.

## Où trouver les valeurs ?

- **Table Ciqual** (gratuite, officielle) : ciqual.anses.fr — cherchez l'aliment, puis recopiez
  « Énergie, Règlement UE N° 1169/2011 (kcal/100 g) », « Protéines », « Glucides », etc.
- **Produit du commerce** : le tableau nutritionnel de l'emballage, colonne « pour 100 g ».

## Créer une nouvelle catégorie

1. Copiez un fichier existant (par exemple `fruits.json`) et renommez-le (`epicerie.json`).
2. En haut du fichier, changez `id` (un mot sans espace ni accent), `nom`, `icone` et `couleur`.
   - Icônes disponibles : `drumstick`, `fish`, `egg`, `wheat`, `bean`, `carrot`, `apple`, `droplet`,
     `candy`, `cup`, `dumbbell`, `utensils`.
   - Couleurs : `red`, `orange`, `yellow`, `green`, `teal`, `cyan`, `blue`, `indigo`, `purple`,
     `pink`, `brown`, `gray`.
3. Remplacez les aliments par les vôtres.
4. Ajoutez le nom du fichier dans `data/aliments/index.json`, dans la liste `categories`.

## Vérifier qu'il n'y a pas d'erreur

Une virgule oubliée suffit à empêcher le chargement d'une catégorie. Pour vérifier un fichier,
collez son contenu sur un site comme jsonlint.com : il vous indiquera la ligne fautive.

## Votre journal ne sera pas perdu

Chaque repas enregistré garde une copie des valeurs de l'aliment au moment de l'ajout. Vous
pouvez corriger une valeur, renommer ou même supprimer un aliment sans modifier vos journées
passées. Seuls les ajouts suivants utiliseront les nouvelles valeurs.

Si vous changez l'`id` d'un aliment, il disparaîtra simplement de vos favoris et récents.

## Plus simple encore

Dans l'application, l'onglet **Aliments → Créer un aliment** permet d'ajouter vos propres aliments
sans toucher aux fichiers. Ils sont enregistrés sur votre appareil (pensez à exporter vos données
de temps en temps dans Profil → Exporter mes données).
