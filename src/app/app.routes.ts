import { inject } from '@angular/core';
import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guard';
import { AuthService } from './core/auth/auth.service';
import { premiereRouteAutorisee } from './core/navigation/premiere-route-autorisee';

export const routes: Routes = [
  {
    // Pas `dashboard` en dur : cet écran demande `reporting.dashboard`, que
    // tout le monde n'a pas. On envoie chacun sur le premier écran qu'il peut
    // réellement ouvrir.
    path: '',
    pathMatch: 'full',
    redirectTo: () => premiereRouteAutorisee(inject(AuthService)),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage),
    title: 'Connexion',
  },
  {
    // Page publique : consommation du lien de réinitialisation reçu par email.
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.page').then((m) => m.ResetPasswordPage),
    title: 'Réinitialisation du mot de passe',
  },
  {
    // Page publique : menu consulté par un client depuis le QR de sa table.
    // Aucun guard — le client n'a pas de compte ; le jeton de l'URL est la clé.
    // Déclarée hors du shell : ni barre latérale, ni sélecteur de site.
    path: 'menu/:token',
    loadComponent: () =>
      import('./features/public/menu/menu-public.page').then((m) => m.MenuPublicPage),
    title: 'Menu',
  },
  {
    // Écran de production cuisine : un afficheur vissé au mur, que personne ne
    // pilote. Déclaré hors du shell — pas de barre latérale ni d'onglets frères
    // à côté desquels un coup de coude enverrait la cuisine sur les fonds de
    // caisse. Authentifié malgré tout : il expose les commandes du service.
    path: 'kds',
    canActivate: [authGuard],
    loadComponent: () => import('./features/vente/caisse/kds.page').then((m) => m.KdsPage),
    title: 'Écran cuisine',
  },
  {
    // Pendant salle du KDS : ce qui est prêt et attend d'être porté. Hors du
    // shell pour les mêmes raisons — c'est une tablette posée au pass, pas un
    // écran de navigation.
    path: 'pass',
    canActivate: [authGuard],
    loadComponent: () => import('./features/vente/caisse/pass.page').then((m) => m.PassPage),
    title: 'Pass',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell.layout').then((m) => m.ShellLayout),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
        title: 'Tableau de bord',
      },
      {
        path: 'cuisine',
        children: [
          {
            path: 'fournisseurs',
            loadComponent: () =>
              import('./features/cuisine/fournisseurs/fournisseurs.page').then(
                (m) => m.FournisseursPage,
              ),
            title: 'Fournisseurs',
          },
          {
            path: 'fournisseurs/:id',
            loadComponent: () =>
              import('./features/cuisine/fournisseurs/fournisseur-detail.page').then(
                (m) => m.FournisseurDetailPage,
              ),
            title: 'Fiche fournisseur',
          },
          {
            path: 'matieres-premieres',
            loadComponent: () =>
              import('./features/cuisine/matieres-premieres/matieres-premieres.page').then(
                (m) => m.MatieresPremieresPage,
              ),
            title: 'Matières premières',
          },
          {
            path: 'commandes',
            loadComponent: () =>
              import('./features/cuisine/commandes/commandes.layout').then(
                (m) => m.CommandesLayout,
              ),
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'liste' },
              {
                path: 'liste',
                loadComponent: () =>
                  import('./features/cuisine/commandes/commandes.page').then(
                    (m) => m.CommandesPage,
                  ),
                title: 'Commandes fournisseur',
              },
              {
                path: 'receptions',
                loadComponent: () =>
                  import('./features/cuisine/commandes/receptions.page').then(
                    (m) => m.ReceptionsPage,
                  ),
                title: 'Réceptions',
              },
            ],
          },
          {
            // Hors du layout à onglets : la fiche détail occupe toute la page.
            path: 'commandes/:id',
            loadComponent: () =>
              import('./features/cuisine/commandes/commande-detail.page').then(
                (m) => m.CommandeDetailPage,
              ),
            title: 'Commande fournisseur',
          },
          {
            path: 'fiches-techniques',
            loadComponent: () =>
              import('./features/cuisine/fiches-techniques/fiches-techniques.layout').then(
                (m) => m.FichesTechniquesLayout,
              ),
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'produits' },
              {
                path: 'produits',
                loadComponent: () =>
                  import('./features/vente/cartes/produits.page').then((m) => m.ProduitsPage),
                title: 'Produits',
              },
              {
                path: 'fiches',
                loadComponent: () =>
                  import('./features/cuisine/fiches-techniques/fiches-techniques.page').then(
                    (m) => m.FichesTechniquesPage,
                  ),
                title: 'Fiches techniques',
              },
              {
                path: 'sous-recettes',
                loadComponent: () =>
                  import('./features/cuisine/fiches-techniques/sous-recettes.page').then(
                    (m) => m.SousRecettesPage,
                  ),
                title: 'Sous-recettes',
              },
            ],
          },
          {
            path: 'produits/:id',
            loadComponent: () =>
              import('./features/cuisine/produits/produit-detail.page').then(
                (m) => m.ProduitDetailPage,
              ),
            title: 'Fiche produit',
          },
          {
            path: 'stock',
            loadComponent: () =>
              import('./features/cuisine/stock/stock.layout').then((m) => m.StockLayout),
            children: [
              // Premier onglet de `stock.layout`. Le maintenir aligné : viser un
              // onglet plus loin dans la barre fait atterrir l'utilisateur
              // ailleurs que là où le menu le laisse attendre.
              { path: '', pathMatch: 'full', redirectTo: 'etat' },
              {
                path: 'etat',
                loadComponent: () =>
                  import('./features/cuisine/stock/etat-stock.page').then((m) => m.EtatStockPage),
                title: 'État du stock',
              },
              {
                path: 'mouvements',
                loadComponent: () =>
                  import('./features/cuisine/stock/mouvements-stock.page').then(
                    (m) => m.MouvementsStockPage,
                  ),
                title: 'Mouvements de stock',
              },
              {
                path: 'inventaires',
                loadComponent: () =>
                  import('./features/cuisine/stock/inventaires.page').then(
                    (m) => m.InventairesPage,
                  ),
                title: 'Inventaires',
              },
            ],
          },
          {
            path: 'budget',
            loadComponent: () =>
              import('./features/cuisine/budget/budget.page').then((m) => m.BudgetPage),
            title: 'Budget',
          },
          {
            // Le service de la brigade. Sous `/cuisine` et non sous la caisse :
            // ouvrir un service de cuisine et ouvrir un tiroir-caisse sont deux
            // responsabilités, tenues par deux personnes différentes.
            path: 'services',
            loadComponent: () =>
              import('./features/vente/caisse/sessions-cuisine.page').then(
                (m) => m.SessionsCuisinePage,
              ),
            title: 'Services de cuisine',
          },
        ],
      },
      {
        path: 'vente',
        children: [
          {
            path: 'cartes',
            loadComponent: () =>
              import('./features/vente/cartes/cartes.layout').then((m) => m.CartesLayout),
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'liste' },
              {
                path: 'liste',
                loadComponent: () =>
                  import('./features/vente/cartes/cartes.page').then((m) => m.CartesPage),
                title: 'Cartes',
              },
              {
                path: 'produits',
                loadComponent: () =>
                  import('./features/vente/cartes/produits.page').then((m) => m.ProduitsPage),
                title: 'Produits',
              },
            ],
          },
          {
            path: 'carte/:id',
            loadComponent: () =>
              import('./features/vente/cartes/carte-composition.page').then(
                (m) => m.CarteCompositionPage,
              ),
            title: 'Composition de carte',
          },
          {
            path: 'mes-pourboires',
            loadComponent: () =>
              import('./features/vente/pourboires/mes-pourboires.page').then(
                (m) => m.MesPourboiresPage,
              ),
            title: 'Mes pourboires',
          },
          {
            path: 'tables',
            loadComponent: () =>
              import('./features/vente/tables/tables.page').then((m) => m.TablesPage),
            title: 'Plan de tables',
          },
          {
            path: 'caisse',
            loadComponent: () =>
              import('./features/vente/caisse/caisse.layout').then((m) => m.CaisseLayout),
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'sessions' },
              {
                path: 'sessions',
                loadComponent: () =>
                  import('./features/vente/caisse/sessions.page').then((m) => m.SessionsPage),
                title: 'Sessions de caisse',
              },
              {
                path: 'commandes',
                loadComponent: () =>
                  import('./features/vente/caisse/commandes.page').then(
                    (m) => m.CommandesVentePage,
                  ),
                title: 'Prise de commande',
              },
              {
                path: 'encaissement',
                loadComponent: () =>
                  import('./features/vente/caisse/encaissement.page').then(
                    (m) => m.EncaissementPage,
                  ),
                title: 'À encaisser',
              },
              {
                path: 'ventes',
                loadComponent: () =>
                  import('./features/vente/caisse/ventes.page').then((m) => m.VentesPage),
                title: 'Ventes du service',
              },
              {
                path: 'pourboires',
                loadComponent: () =>
                  import('./features/vente/caisse/pourboires.page').then((m) => m.PourboiresPage),
                title: 'Pourboires',
              },
              {
                path: 'commandes/:id',
                loadComponent: () =>
                  import('./features/vente/caisse/commande-detail.page').then(
                    (m) => m.CommandeVenteDetailPage,
                  ),
                title: 'Commande',
              },
            ],
          },
        ],
      },
      {
        path: 'pilotage',
        loadComponent: () =>
          import('./features/pilotage/pilotage.layout').then((m) => m.PilotageLayout),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'ventes' },
          {
            path: 'food-cost',
            loadComponent: () =>
              import('./features/pilotage/food-cost/food-cost.page').then((m) => m.FoodCostPage),
            title: 'Food cost',
          },
          {
            path: 'ventes',
            loadComponent: () =>
              import('./features/pilotage/ventes/ventes.page').then((m) => m.VentesPage),
            title: 'Ventes',
          },
          {
            path: 'stock',
            loadComponent: () =>
              import('./features/pilotage/stock/stock.page').then((m) => m.StockReportingPage),
            title: 'Stock (pilotage)',
          },
          {
            path: 'budget',
            loadComponent: () =>
              import('./features/pilotage/budget/budget-reporting.page').then(
                (m) => m.BudgetReportingPage,
              ),
            title: 'Budget (pilotage)',
          },
        ],
      },
      {
        path: 'parametres',
        loadComponent: () =>
          import('./features/parametres/parametres.layout').then((m) => m.ParametresLayout),
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'sites',
          },
          {
            path: 'sites',
            loadComponent: () =>
              import('./features/parametres/sites/sites.page').then((m) => m.SitesPage),
            title: 'Sites',
          },
          {
            path: 'sites/:id',
            loadComponent: () =>
              import('./features/parametres/sites/site-detail.page').then((m) => m.SiteDetailPage),
            title: 'Détail de site',
          },
          {
            path: 'points-de-vente/:id',
            loadComponent: () =>
              import('./features/parametres/points-de-vente/point-de-vente-detail.page').then(
                (m) => m.PointDeVenteDetailPage,
              ),
            title: 'Détail point de vente',
          },
          {
            path: 'categories-produit',
            loadComponent: () =>
              import('./features/parametres/categories-produit/categories-produit.page').then(
                (m) => m.CategoriesProduitPage,
              ),
            title: 'Catégories produit',
          },
          {
            path: 'categories-matiere-premiere',
            loadComponent: () =>
              import('./features/parametres/categories-matiere-premiere/categories-matiere-premiere.page').then(
                (m) => m.CategoriesMatierePremierePage,
              ),
            title: 'Catégories matière première',
          },
          {
            path: 'unites-de-mesure',
            loadComponent: () =>
              import('./features/parametres/unites-de-mesure/unites-de-mesure.page').then(
                (m) => m.UnitesDeMesurePage,
              ),
            title: 'Unités de mesure',
          },
          {
            path: 'modes-de-paiement',
            loadComponent: () =>
              import('./features/parametres/modes-de-paiement/modes-de-paiement.page').then(
                (m) => m.ModesDePaiementPage,
              ),
            title: 'Modes de paiement',
          },
          {
            // Organisation de la brigade : qui cuit quoi. Distinct des
            // catégories produit, qui rangent la carte pour le client.
            path: 'postes-cuisine',
            loadComponent: () =>
              import('./features/parametres/postes-cuisine/postes-cuisine.page').then(
                (m) => m.PostesCuisinePage,
              ),
            title: 'Postes de production',
          },
          {
            path: 'utilisateurs',
            loadComponent: () =>
              import('./features/parametres/utilisateurs/utilisateurs.page').then(
                (m) => m.UtilisateursPage,
              ),
            title: 'Utilisateurs',
          },
          {
            path: 'roles',
            loadComponent: () =>
              import('./features/parametres/roles/roles.page').then((m) => m.RolesPage),
            title: 'Rôles',
          },
          {
            path: 'journal',
            loadComponent: () =>
              import('./features/parametres/journal/journal.page').then((m) => m.JournalPage),
            title: "Journal d'activité",
          },
          {
            path: 'remises',
            loadComponent: () =>
              import('./features/parametres/audit/remises.page').then((m) => m.RemisesPage),
            title: 'Remises accordées',
          },
          {
            path: 'annulations',
            loadComponent: () =>
              import('./features/parametres/audit/annulations.page').then((m) => m.AnnulationsPage),
            title: 'Annulations',
          },
        ],
      },
      {
        // Même raison qu'à la racine : une URL inconnue ne doit pas déposer
        // l'utilisateur sur un écran qu'il n'a pas le droit d'ouvrir.
        path: '**',
        redirectTo: () => premiereRouteAutorisee(inject(AuthService)),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
