import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { redirigerVersOngletAutorise } from '../../../core/navigation/onglet-autorise';

interface CaisseTab {
  label: string;
  route: string;
  permission: string;
}

@Component({
  selector: 'app-caisse-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './caisse.layout.html',
  styleUrl: './caisse.layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaisseLayout {
  private readonly auth = inject(AuthService);

  /**
   * Deux métiers distincts sous une même section : le serveur qui saisit les
   * commandes n'a rien à faire dans les fonds de caisse, et le responsable de
   * caisse n'ouvre pas forcément de commande.
   *
   * L'onglet Sessions est gardé par `session_caisse.create` et NON par
   * `.view` : cet écran sert à ouvrir et fermer une caisse, pas à la consulter.
   * Le serveur détient `.view` pour une tout autre raison — rattacher sa
   * commande à une session ouverte impose de lister les sessions — et le garder
   * ici lui montrerait les fonds initiaux et les écarts.
   *
   * L'écran cuisine (KDS) n'est plus ici : c'est un afficheur mural, servi
   * hors du shell sur `/kds`.
   */
  private readonly allTabs: CaisseTab[] = [
    { label: 'Sessions', route: 'sessions', permission: 'session_caisse.create' },
    { label: 'Prise de commande', route: 'commandes', permission: 'commande_client.view' },
    // Poste de caisse. Gardé par `paiement.create` : sans le droit de saisir un
    // paiement, la file des notes à régler n'est qu'une liste inerte.
    { label: 'À encaisser', route: 'encaissement', permission: 'paiement.create' },
    // Gardé par `paiement.view` et non `.create` : consulter ce qui a été
    // encaissé n'est pas encaisser. Un responsable qui ne tient pas la caisse
    // doit pouvoir relire le service sans pouvoir saisir de paiement — et le
    // serveur, qui n'a ni l'un ni l'autre, ne voit pas l'onglet.
    // « Ventes du service » et non « Ventes » : le menu PILOTAGE porte déjà une
    // entrée « Ventes », qui agrège le chiffre d'affaires sur une période. Ici
    // c'est le détail note par note d'UNE session de caisse.
    { label: 'Ventes du service', route: 'ventes', permission: 'paiement.view' },
    // Ce qu'on doit au personnel sur les pourboires encaissés au comptoir. Même
    // permission que les sorties de tiroir : lire ce qu'on doit relève du même
    // geste que voir l'argent en sortir.
    { label: 'Pourboires', route: 'pourboires', permission: 'versement.view' },
    // Le service de la brigade. Ici et non dans un menu à part : c'est un
    // service qui s'ouvre et se ferme, comme la session de caisse à deux
    // onglets de là — même geste, même endroit.
    { label: 'Cuisine', route: 'cuisine', permission: 'session_cuisine.view' },
  ];

  readonly tabs = computed(() => this.allTabs.filter((t) => this.auth.hasPermission(t.permission)));

  constructor() {
    redirigerVersOngletAutorise(this.tabs().map((t) => t.route));
  }
}
