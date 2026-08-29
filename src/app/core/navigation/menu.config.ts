export interface MenuItem {
  label: string;
  icon: string;
  route: string;
  /** Une liste signifie « au moins une de ces permissions ». */
  permission?: string | string[];
  enabled?: boolean;
  /**
   * Écran servi HORS du shell : un afficheur mural ou une tablette posée au
   * pass, sans barre latérale. L'entrée sert à l'ouvrir la première fois, mais
   * ce n'est pas une destination de navigation — on n'y dépose personne au
   * démarrage (cf. `premiereRouteAutorisee`).
   */
  horsShell?: boolean;
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
    // Gardé par `reporting.dashboard`, la permission qu'exige l'API : sans
    // elle l'entrée menait à un écran qui ne pouvait que refuser de se charger.
    items: [
      {
        label: 'Tableau de bord',
        icon: 'layout-dashboard',
        route: '/dashboard',
        permission: 'reporting.dashboard',
      },
    ],
  },
  {
    // Ce qui ENTRE dans la maison : on achète, on réceptionne, on stocke, on
    // budgète. Séparé de CUISINE, qui est ce qu'on en fait pendant le service.
    title: 'ACHATS & STOCK',
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
        label: 'Stock & inventaire',
        icon: 'boxes',
        route: '/cuisine/stock',
        // Deux écrans gardés séparément : l'un ou l'autre suffit à ouvrir la section.
        permission: ['stock.view', 'inventaire.view'],
      },
      { label: 'Budget', icon: 'wallet', route: '/cuisine/budget', permission: 'budget.view' },
    ],
  },
  {
    // La PRODUCTION, tenue par le chef et sa brigade. Le service de cuisine
    // était sous « Sessions de caisse » : ouvrir un tiroir-caisse et ouvrir un
    // service de brigade sont deux responsabilités, tenues par deux personnes
    // différentes, et les mélanger montrait au chef des écrans d'argent.
    title: 'CUISINE',
    items: [
      {
        label: 'Services de cuisine',
        icon: 'chef-hat',
        route: '/cuisine/services',
        permission: 'session_cuisine.view',
      },
      {
        // Les recettes sont le métier du chef, pas un réglage d'achat : elles
        // rejoignent la production plutôt que le stock dont elles consomment.
        label: 'Produits & recettes',
        icon: 'chef-hat',
        route: '/cuisine/fiches-techniques',
        permission: 'fichetechnique.view',
      },
      {
        // Afficheur mural, servi hors du shell : pas de barre latérale à côté
        // de laquelle un coup de coude renverrait la cuisine sur les fonds de
        // caisse. L'entrée reste ici pour l'ouvrir la première fois.
        label: 'Écran cuisine (KDS)',
        icon: 'chef-hat',
        route: '/kds',
        permission: 'commande_client.view',
        horsShell: true,
      },
      {
        // Le pendant salle : ce que la cuisine a annoncé et qu'il faut porter.
        // Gouverné par `update`, la permission du service — c'est ici que le
        // stock se décharge.
        label: 'Pass (à emporter)',
        icon: 'chef-hat',
        route: '/pass',
        permission: 'commande_client.update',
        horsShell: true,
      },
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
        // L'écran le plus utilisé du service : une entrée à part entière plutôt
        // qu'un onglet enfoui sous « Caisse », que le serveur ouvrirait
        // cinquante fois par service en deux clics au lieu d'un.
        label: 'Prise de commande',
        icon: 'clipboard-list',
        route: '/vente/caisse/commandes',
        permission: 'commande_client.view',
      },
      {
        // Le poste de caisse : la file des notes à régler. Gardé par
        // `paiement.create` — sans le droit de saisir un paiement, cette file
        // n'est qu'une liste inerte.
        label: 'Encaissement',
        icon: 'receipt',
        route: '/vente/caisse/encaissement',
        permission: 'paiement.create',
      },
      {
        // Nommée sans ambiguïté : cette entrée ne contient QUE l'ouverture et la
        // fermeture de caisse. « Caisse » laissait croire qu'on y encaissait.
        //
        // `session_caisse.create` et non `.view` : le serveur détient `.view`
        // pour rattacher sa commande à une session ouverte, ce qui ne fait pas
        // de lui un responsable de caisse — le garder ici lui montrerait les
        // fonds initiaux et les écarts.
        label: 'Sessions de caisse',
        icon: 'wallet',
        route: '/vente/caisse/sessions',
        permission: 'session_caisse.create',
      },
      {
        // N'apparaît que si la direction a attribué la permission, absente de
        // tous les rôles par défaut : que l'équipe suive ses cumuls est une
        // décision d'organisation, pas un réglage technique.
        label: 'Mes pourboires',
        icon: 'wallet',
        route: '/vente/mes-pourboires',
        permission: 'pourboire.suivre_les_siens',
      },
    ],
  },
  {
    title: 'PILOTAGE',
    items: [
      {
        label: 'Ventes',
        icon: 'bar-chart-3',
        route: '/pilotage/ventes',
        permission: 'reporting.ventes',
      },
      {
        label: 'Food cost',
        icon: 'chef-hat',
        route: '/pilotage/food-cost',
        permission: 'reporting.food_cost',
      },
      {
        label: 'Stock',
        icon: 'boxes',
        route: '/pilotage/stock',
        permission: 'reporting.stock',
      },
      {
        label: 'Budget',
        icon: 'wallet',
        route: '/pilotage/budget',
        permission: 'reporting.budget',
      },
    ],
  },
  {
    title: 'PARAMÈTRES',
    items: [
      { label: 'Paramètres', icon: 'settings', route: '/parametres', permission: 'parametre.view' },
    ],
  },
];
