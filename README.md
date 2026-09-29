# Saltcorn ListShowListEnhanced Plugin

Plugin pour Saltcorn proposant une vue **liste-détail améliorée** avec split pane redimensionnable, orientation configurable, et styles par panneau.

## Fonctionnalités

- **Split pane redimensionnable** : poignée de glissement entre les panneaux liste et détail (souris et tactile)
- **Persistance du ratio** : la position du split est sauvegardée dans un cookie et restaurée au rechargement de la vue
- **Orientation** : disposition horizontale (côte à côte) ou verticale
- **Hauteur auto-adaptative** : en mode split vertical, la vue s'ajuste automatiquement à l'espace restant du viewport
- **Couleur de fond par panneau** : couleur optionnelle pour le panneau liste et/ou le panneau détail
- **Padding directionnel** : gauche/droite en mode horizontal, haut/bas en mode vertical
- **Sous-tables** : affichage des tables liées (enfants et parents) sous la vue détail
- **Modes d'affichage des sous-tables** : onglets, pilules, accordéon, ou liste empilée
- **Titres personnalisés** : titre configurable pour chaque sous-table (par défaut : description de la table ou son nom)
- **Responsive** : bascule automatique en mode vertical sur les écrans < 768px (tablettes et mobiles)

## Installation

### Depuis GitHub (recommandé)

Dans l'interface admin Saltcorn : **Settings** → **Plugins** → **Add another plugin** :
- **Source** : `github`
- **Location** : `enojaroff/xt-listshowlist`

### Plugin local

1. Cloner le dépôt : `git clone https://github.com/enojaroff/xt-listshowlist.git`
2. Installer en ligne de commande : `saltcorn install-plugin -d /chemin/vers/xt-listshowlist`
   ou via l'interface admin : **Plugins** → **Add another plugin** → source **Local** → chemin vers le dossier
3. Redémarrer Saltcorn

### Via la base de données

```sql
INSERT INTO _sc_plugins (name, source, location)
VALUES ('@enojaroff/xt-listshowlist', 'local', '/chemin/vers/xt-listshowlist');
```

Puis redémarrer Saltcorn.

## Utilisation

### Créer une vue ListShowListEnhanced

1. Aller dans **Views** → **Create view**
2. Sélectionner une table
3. Choisir le viewtemplate **ListShowListEnhanced**
4. Configurer les deux étapes du workflow

### Étape 1 : Views & Layout

| Paramètre | Type | Description |
| :--- | :--- | :--- |
| **List View** | Select | Vue de type liste (affichage "Many") utilisée dans le panneau gauche/haut |
| **Show View** | Select | Vue de détail affichée quand une ligne est sélectionnée |
| **List width** | Integer (1-12) | Largeur Bootstrap du panneau liste (mode grille uniquement) |
| **Orientation** | Select | `horizontal` (côte à côte) ou `vertical` (empilé) |
| **Responsive** | Bool | Si activé, bascule automatiquement en vertical sur les écrans < 768px |
| **Show on select** | Bool | Si activé, la vue détail se met à jour au clic sur une ligne |
| **Split view** | Bool | Active le mode split pane redimensionnable |
| **Split height** | String | Hauteur CSS du conteneur split en mode vertical (ex: `600px`, `80vh`). Visible uniquement si split_view=true et orientation=vertical |
| **List background color** | Bool + Color | Active et définit la couleur de fond du panneau liste |
| **List padding** | Integer | Padding en pixels (gauche/droite en horizontal, haut/bas en vertical) |
| **Detail background color** | Bool + Color | Active et définit la couleur de fond du panneau détail |
| **Detail padding** | Integer | Padding en pixels (gauche/droite en horizontal, haut/bas en vertical) |

### Étape 2 : Subtables

| Paramètre | Type | Description |
| :--- | :--- | :--- |
| **Subtables display** | Select | Mode d'affichage quand il y a plusieurs sous-tables : `tabs`, `pills`, `accordion`, ou `list` |
| **\<Table\> → \<View\>** | Bool | Activer/désactiver chaque sous-table disponible |
| **Custom title** | String | Titre personnalisé (visible si la sous-table est activée). Vide = description ou nom de la table |

## Orientation

Le paramètre orientation détermine comment sont positionnés les vues.

```
                 HORIZONTAL                                        VERTICAL
---------------------||----------------------    ---------------------------------------------
|                    ||                     |    |                                           |
|                    ||                     |    |                List View                  |
|     List View      ||      Show view      |    |                                           |
|                    ||                     |    |                                           |
|                    ||                     |    =============================================
|                    ||                     |    |                                           |
|                    ||  -----------------  |    |                 Show view                 |
|                    ||                     |    |                                           |
|                    ||                     |    |                                           |
|                    ||      Sub tables     |    |  ---------------------------------------  |
|                    ||                     |    |                                           |
|                    ||                     |    |                 Sub tables                |
|                    ||                     |    |                                           |
---------------------||----------------------    ---------------------------------------------
```

### Mode responsive

Quand cette option est cochée, l'orientation passe automatiquement en vertical quand la largeur de l'écran est < 768px (mode tablette / smartphone).

## Exemples

### Exemple 1 : Liste-détail simple (mode grille)

Configuration classique avec une liste à gauche et un détail à droite :

- **List View** : `Clients List` (vue List sur la table Clients)
- **Show View** : `Client Detail` (vue Show sur la table Clients)
- **List width** : `4` (la liste occupe 4/12 colonnes, le détail 8/12)
- **Orientation** : `horizontal`
- **Split view** : `false`

Résultat : grille Bootstrap classique avec la liste dans un `col-sm-4` et le détail dans un `col-sm-8`.

### Exemple 2 : Split pane redimensionnable

Configuration avec un split pane interactif :

- **List View** : `Orders List`
- **Show View** : `Order Detail`
- **Orientation** : `horizontal`
- **Split view** : `true`
- **List background color** : activé → `#f8f9fa` (gris clair)
- **Detail padding** : `10`

Résultat : les deux panneaux sont séparés par une poignée de 6px que l'utilisateur peut glisser pour ajuster la répartition. La position est mémorisée dans un cookie.

### Exemple 3 : Layout vertical avec sous-tables en accordéon

Configuration empilée avec des tables enfants :

- **List View** : `Products List`
- **Show View** : `Product Detail`
- **Orientation** : `vertical`
- **Split view** : `true`
- **Split height** : *(vide — la hauteur s'ajuste automatiquement au viewport)*
- **Subtables display** : `accordion`
- Sous-tables activées :
  - `Reviews List` sur la table `reviews` (FK `product_id`) — titre : "Avis clients"
  - `Variants List` sur la table `variants` (FK `product_id`) — titre : "Variantes"

Résultat : la liste de produits est en haut, le détail en bas, avec un split pane vertical. Sous le détail, les deux sous-tables s'affichent en accordéon Bootstrap (le premier panneau est ouvert par défaut).

### Exemple 4 : Vue détail seule avec sous-tables en pilules

Si aucune **List View** n'est configurée, seul le panneau détail est affiché :

- **List View** : *(vide)*
- **Show View** : `Employee Detail`
- **Subtables display** : `pills`
- Sous-tables activées :
  - `Contracts List` → titre : "Contrats"
  - `Absences List` → titre : "Absences"
  - `Evaluations List` → titre : "Évaluations"

Résultat : la vue détail de l'employé est affichée directement, suivie de trois sous-tables accessibles via des pilules Bootstrap.

### Exemple 5 : Split pane responsive

Configuration horizontale qui bascule automatiquement en vertical sur mobile :

- **List View** : `Tasks List`
- **Show View** : `Task Detail`
- **Orientation** : `horizontal`
- **Responsive** : `true`
- **Split view** : `true`

Résultat : sur desktop, les panneaux sont côte à côte avec un split pane horizontal. Sur tablette ou mobile (< 768px), la disposition bascule automatiquement en vertical avec la liste en haut et le détail en bas. La hauteur s'ajuste au viewport et le handle de drag s'adapte à la nouvelle orientation.

## Classes CSS

Le plugin utilise des classes CSS spécifiques pour permettre la personnalisation :

| Classe | Élément |
| :--- | :--- |
| `lsl2-list-container` | Panneau contenant la vue liste |
| `lsl2-show-container` | Panneau contenant la vue détail |
| `lsl2-handle-container` | Poignée de drag du split pane |
| `lsl2-embed-container` | Wrapper de la vue détail embarquée |
| `lsl2-subview-container` | Conteneur de chaque sous-table |
| `lsl2-split-container-{id}` | Conteneur flex du split pane (scopé par vue) |
| `lsl2-split-panel-{id}` | Panneau du split pane (scopé par vue) |
| `lsl2-split-handle-{id}` | Poignée du split pane (scopé par vue) |

### Exemple de CSS personnalisé

```css
/* Bordure sur le panneau détail */
.lsl2-show-container {
  border-left: 2px solid #dee2e6;
}

/* Style de la poignée au survol */
.lsl2-handle-container:hover {
  background: #0d6efd !important;
}

/* Espacement des sous-tables */
.lsl2-subview-container {
  margin-top: 1rem;
}
```

## Modes de rendu

Le plugin choisit automatiquement le mode de rendu selon la configuration :

| split_view | orientation | Rendu |
| :--- | :--- | :--- |
| `false` | `horizontal` | Grille Bootstrap `row` + `col-sm-*` |
| `false` | `vertical` | Divs empilés |
| `true` | `horizontal` | Flex row + poignée col-resize |
| `true` | `vertical` | Flex column + poignée row-resize |

## Licence

Apache License 2.0 — voir [LICENSE](LICENSE).
