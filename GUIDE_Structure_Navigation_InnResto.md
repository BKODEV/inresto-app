# Structure de navigation (sidebar) — InnResto

> Référence d'architecture de la navigation de l'application Angular. Décrit **la cible** : l'organisation complète des menus pour l'ensemble des fonctionnalités, présentes et à venir. Document agnostique de l'état d'avancement.

---

## 1. Principes de structuration

Une **entrée de menu = un espace de travail récurrent**. Tout le reste s'imbrique. Règles de décision à appliquer à toute fonctionnalité, actuelle ou future :

| Cas | Décision |
|---|---|
| Utilisé plusieurs fois par jour / semaine | **Entrée de menu de premier niveau** |
| Détail d'une entité parente (catalogue → fournisseur, lignes → commande) | **Imbriqué dans la page parente** (pas d'entrée de menu) |
| Référentiel configuré une fois puis rarement touché | **Onglet dans la page « Paramètres » unique** |
| Deux entités liées par un même flux (commande → réception, stock → inventaire) | **Une seule page à onglets** |

La navigation est **pilotée par une configuration** (tableau d'objets typés), jamais codée en dur dans le template, et **filtrée par permissions**.

## 2. Arborescence cible

```
Tableau de bord                      → /dashboard

CUISINE & STOCK
  ├ Fournisseurs                     → /cuisine/fournisseurs
  ├ Matières premières               → /cuisine/matieres-premieres
  ├ Commandes & réceptions           → /cuisine/commandes
  ├ Fiches techniques                → /cuisine/fiches-techniques
  ├ Stock & inventaire               → /cuisine/stock
  └ Budget                           → /cuisine/budget

SALLE & VENTE
  ├ Cartes & produits                → /vente/cartes
  ├ Plan de tables                   → /vente/tables
  ├ Réservations                     → /vente/reservations
  └ Caisse                           → /vente/caisse

PILOTAGE
  ├ Tableaux de bord                 → /pilotage/tableaux-de-bord
  └ Rapports                         → /pilotage/rapports

PARAMÈTRES
  └ Paramètres                       → /parametres   (sous-navigation par onglets)

ADMINISTRATION
  ├ Utilisateurs                     → /admin/utilisateurs
  ├ Rôles & permissions              → /admin/roles
  └ Journal d'activité               → /admin/journal
```

## 3. Détail des regroupements

### Paramètres — une seule entrée, sous-navigation par onglets

La page `/parametres` porte une barre d'onglets internes (routes enfants) :

```
Points de vente | Catégories produit | Catégories MP | Unités de mesure |
Modes de paiement | Caisses | TVA | Imprimantes
```

Tous les référentiels rarement modifiés vivent ici, y compris **Points de vente**. Une seule entrée de menu, pas une par référentiel.

### Cuisine & Stock — 6 entrées

| Entrée de menu | Imbriqué dedans |
|---|---|
| **Fournisseurs** | Le **catalogue fournisseur** (prix négociés) est dans la fiche d'un fournisseur, pas une entrée séparée |
| **Matières premières** | — |
| **Commandes & réceptions** | La **réception** se déclenche depuis une commande → même espace, pas deux menus |
| **Fiches techniques** | Les **sous-recettes** se gèrent depuis cet espace |
| **Stock & inventaire** | Page à onglets : `État du stock` \| `Mouvements de stock` \| `Inventaires` |
| **Budget** | Page à onglets : `Budget mensuel` \| `Dépenses` |

### Salle & Vente — 4 entrées

| Entrée de menu | Imbriqué dedans |
|---|---|
| **Cartes & produits** | Référentiel produits + composition des cartes + menus/formules |
| **Plan de tables** | Affectation serveur, transfert, fusion/scission de tables |
| **Réservations** | Vues jour / liste |
| **Caisse** | Ouverture/fermeture de session, encaissement, paiements fractionnés, remises, pourboires, tickets |

### Pilotage — 2 entrées

`Tableaux de bord` (CA, taux clientèle Innov, top produits, marge, fréquentation) et `Rapports` (ventes, stock, budget vs réalisé, annulations/remises, exports).

### Administration — 3 entrées

`Utilisateurs`, `Rôles & permissions`, `Journal d'activité`. Réservé aux profils admin.

## 4. Configuration de menu (typée, pilotée par données)

Structure unique consommée par le composant sidebar (ex. `core/navigation/menu.config.ts`) :

```ts
export interface MenuItem {
  label: string;
  icon: string;        // nom d'icône (jeu d'icônes du projet, ex. lucide)
  route?: string;
  permission?: string; // clé de permission ; absent => visible par tout utilisateur connecté
  enabled?: boolean;   // défaut true ; false => masqué (fonctionnalité non encore livrée)
}

export interface MenuSection {
  title?: string;      // titre de section ; absent pour le premier bloc
  items: MenuItem[];
}

export const MENU: MenuSection[] = [
  { items: [
    { label: 'Tableau de bord', icon: 'layout-dashboard', route: '/dashboard' },
  ]},
  { title: 'CUISINE & STOCK', items: [
    { label: 'Fournisseurs',           icon: 'truck',          route: '/cuisine/fournisseurs',       permission: 'fournisseur.view' },
    { label: 'Matières premières',     icon: 'package',        route: '/cuisine/matieres-premieres', permission: 'matiere.view' },
    { label: 'Commandes & réceptions', icon: 'clipboard-list', route: '/cuisine/commandes',          permission: 'commande_fournisseur.view' },
    { label: 'Fiches techniques',      icon: 'chef-hat',       route: '/cuisine/fiches-techniques',  permission: 'fiche_technique.view' },
    { label: 'Stock & inventaire',     icon: 'boxes',          route: '/cuisine/stock',              permission: 'stock.view' },
    { label: 'Budget',                 icon: 'wallet',         route: '/cuisine/budget',             permission: 'budget.view' },
  ]},
  { title: 'SALLE & VENTE', items: [
    { label: 'Cartes & produits', icon: 'book-open',      route: '/vente/cartes',       permission: 'carte.view' },
    { label: 'Plan de tables',    icon: 'grid-3x3',       route: '/vente/tables',       permission: 'table.view' },
    { label: 'Réservations',      icon: 'calendar-check', route: '/vente/reservations', permission: 'reservation.view' },
    { label: 'Caisse',            icon: 'receipt',        route: '/vente/caisse',       permission: 'caisse.use' },
  ]},
  { title: 'PILOTAGE', items: [
    { label: 'Tableaux de bord', icon: 'bar-chart-3', route: '/pilotage/tableaux-de-bord', permission: 'rapport.view' },
    { label: 'Rapports',         icon: 'file-text',   route: '/pilotage/rapports',         permission: 'rapport.view' },
  ]},
  { title: 'PARAMÈTRES', items: [
    { label: 'Paramètres', icon: 'settings', route: '/parametres', permission: 'parametre.view' },
  ]},
  { title: 'ADMINISTRATION', items: [
    { label: 'Utilisateurs',        icon: 'users',   route: '/admin/utilisateurs', permission: 'utilisateur.view' },
    { label: 'Rôles & permissions', icon: 'shield',  route: '/admin/roles',        permission: 'role.view' },
    { label: 'Journal d\'activité', icon: 'history', route: '/admin/journal',      permission: 'journal.view' },
  ]},
];
```

## 5. Routing (lazy loading)

Les routes suivent l'arborescence ; les feature areas sont chargées à la demande. Les onglets internes (Paramètres, Stock & inventaire, Budget) sont des **routes enfants**, pas des entrées de sidebar.

```ts
export const routes: Routes = [
  { path: 'dashboard',  loadComponent: () => import('./features/dashboard/...') },
  { path: 'cuisine', children: [
    { path: 'fournisseurs',       loadChildren: () => import('./features/cuisine/fournisseurs/...') },
    { path: 'matieres-premieres', loadChildren: () => import('./features/cuisine/matieres/...') },
    { path: 'commandes',          loadChildren: () => import('./features/cuisine/commandes/...') },
    { path: 'fiches-techniques',  loadChildren: () => import('./features/cuisine/fiches/...') },
    { path: 'stock',              loadChildren: () => import('./features/cuisine/stock/...') },   // onglets internes
    { path: 'budget',             loadChildren: () => import('./features/cuisine/budget/...') },  // onglets internes
  ]},
  { path: 'vente', children: [
    { path: 'cartes',       loadChildren: () => import('./features/vente/cartes/...') },
    { path: 'tables',       loadChildren: () => import('./features/vente/tables/...') },
    { path: 'reservations', loadChildren: () => import('./features/vente/reservations/...') },
    { path: 'caisse',       loadChildren: () => import('./features/vente/caisse/...') },
  ]},
  { path: 'pilotage', children: [
    { path: 'tableaux-de-bord', loadChildren: () => import('./features/pilotage/dashboards/...') },
    { path: 'rapports',         loadChildren: () => import('./features/pilotage/rapports/...') },
  ]},
  { path: 'parametres', loadChildren: () => import('./features/parametres/...') }, // page à onglets
  { path: 'admin', children: [
    { path: 'utilisateurs', loadChildren: () => import('./features/admin/utilisateurs/...') },
    { path: 'roles',        loadChildren: () => import('./features/admin/roles/...') },
    { path: 'journal',      loadChildren: () => import('./features/admin/journal/...') },
  ]},
];
```

## 6. Règles d'affichage

Le composant sidebar doit :
1. Masquer toute entrée dont `enabled === false` (fonctionnalité non encore livrée → pas de lien mort).
2. Masquer toute entrée dont la `permission` n'est pas détenue par l'utilisateur connecté (permissions issues de `auth/me` au login).
3. Masquer un **titre de section** si aucune de ses entrées n'est visible.

## 7. Conventions

- **Libellés** en français, orientés métier (« Commandes & réceptions », pas « commandes_fournisseur »).
- **Icônes** : une par entrée, cohérentes avec le jeu d'icônes du projet.
- **Permissions** : convention `entite.action` (`fournisseur.view`, `caisse.use`…), à aligner sur le référentiel de permissions de l'API.
- **Sections** : titres en capitales, ordre = parcours métier (cuisine → vente → pilotage → paramètres → admin).

## 8. À ne pas faire

- ❌ Une entrée de menu par table de la base de données.
- ❌ Des entrées séparées « Commandes » et « Réceptions » (même flux → une seule).
- ❌ Une entrée « Catalogue fournisseur » (vit dans la fiche fournisseur).
- ❌ Une entrée par référentiel sous Paramètres (tout en onglets d'une page unique).
- ❌ Des liens vers des routes inexistantes.
- ❌ La liste des entrées codée en dur dans le template HTML (passer par la config `MENU`).
