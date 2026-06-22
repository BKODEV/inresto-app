export interface MenuItem {
  label: string;
  icon: string;
  route: string;
  permission?: string;
  enabled?: boolean;
}

export interface MenuSection {
  title?: string;
  items: MenuItem[];
}

/**
 * Navigation pilotée par données — consommée par la sidebar.
 * `enabled: false` masque une entrée non encore livrée (pas de lien mort).
 * `permission` masque l'entrée si l'utilisateur ne la détient pas ;
 * absente => visible par tout utilisateur connecté.
 */
export const MENU: MenuSection[] = [
  {
    items: [{ label: 'Tableau de bord', icon: 'layout-dashboard', route: '/dashboard' }],
  },
  {
    title: 'CUISINE & STOCK',
    items: [
      {
        label: 'Fournisseurs',
        icon: 'truck',
        route: '/cuisine/fournisseurs',
        permission: 'fournisseur.view',
      },
      {
        label: 'Matières premières',
        icon: 'package',
        route: '/cuisine/matieres-premieres',
        permission: 'matiere-premiere.view',
      },
      {
        label: 'Commandes & réceptions',
        icon: 'clipboard-list',
        route: '/cuisine/commandes',
        permission: 'commande-fournisseur.view',
      },
      {
        label: 'Produits & recettes',
        icon: 'chef-hat',
        route: '/cuisine/fiches-techniques',
        permission: 'fichetechnique.view',
      },
      {
        label: 'Stock & inventaire',
        icon: 'boxes',
        route: '/cuisine/stock',
        permission: 'inventaire.view',
      },
      { label: 'Budget', icon: 'wallet', route: '/cuisine/budget', permission: 'budget.view' },
    ],
  },
  {
    title: 'SALLE & VENTE',
    items: [
      {
        label: 'Cartes & produits',
        icon: 'book-open',
        route: '/vente/cartes',
        permission: 'carte.view',
      },
      {
        label: 'Plan de tables',
        icon: 'grid-3x3',
        route: '/vente/tables',
        permission: 'table.view',
      },
      {
        label: 'Réservations',
        icon: 'calendar-check',
        route: '/vente/reservations',
        permission: 'reservation.view',
        enabled: false,
      },
      {
        label: 'Caisse',
        icon: 'receipt',
        route: '/vente/caisse',
        permission: 'session_caisse.view',
      },
    ],
  },
  {
    title: 'PILOTAGE',
    items: [
      {
        label: 'Tableaux de bord',
        icon: 'bar-chart-3',
        route: '/pilotage/tableaux-de-bord',
        permission: 'rapport.view',
        enabled: false,
      },
      {
        label: 'Rapports',
        icon: 'file-text',
        route: '/pilotage/rapports',
        permission: 'rapport.view',
        enabled: false,
      },
    ],
  },
  {
    title: 'PARAMÈTRES',
    items: [
      { label: 'Paramètres', icon: 'settings', route: '/parametres', permission: 'parametre.view' },
    ],
  },
  {
    title: 'ADMINISTRATION',
    items: [
      {
        label: 'Utilisateurs',
        icon: 'users',
        route: '/admin/utilisateurs',
        permission: 'utilisateur.view',
        enabled: false,
      },
      {
        label: 'Rôles & permissions',
        icon: 'shield',
        route: '/admin/roles',
        permission: 'role.view',
        enabled: false,
      },
      {
        label: "Journal d'activité",
        icon: 'history',
        route: '/admin/journal',
        permission: 'journal.view',
        enabled: false,
      },
    ],
  },
];
