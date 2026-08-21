import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import {
  AjouterLignePayload,
  AnnulerCommandePayload,
  AnnulerLignePayload,
  CommandeClient,
  CreateCommandePayload,
  LigneAEnvoyer,
  LigneCommandeClient,
  Paiement,
  Remise,
  StatutCommandeClient,
  TourKds,
  StorePaiementPayload,
  StoreRemisePayload,
} from './commande-client.model';

interface CommandeIndex {
  commandes: CommandeClient[];
  pagination: Pagination;
}

export interface Pagination {
  total: number;
  par_page: number;
  page_courante: number;
  derniere_page: number;
}

export interface CommandePage {
  commandes: CommandeClient[];
  pagination: Pagination;
}

export interface CommandeFiltres {
  point_de_vente_id?: number;
  table_id?: number;
  session_caisse_id?: number;
  statut?: StatutCommandeClient[];
  /** Charge les paiements et leur mode. Réservé à `paiement.view` côté API. */
  avec_paiements?: boolean;
  per_page?: number;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class CommandeClientService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/commandes-client`;

  /**
   * Index paginé et filtré EN BASE.
   *
   * Filtrer côté client reviendrait à retélécharger tout l'historique du
   * restaurant — lignes et produits compris — à chaque rafraîchissement, pour
   * n'en garder que les quelques commandes vivantes.
   *
   * `session_caisse_id` borne au service en cours : la journée d'un restaurant
   * n'est pas une journée calendaire, un service qui dépasse minuit doit rester
   * groupé.
   */
  list(filters?: CommandeFiltres): Observable<CommandeClient[]> {
    return this.listPagine(filters).pipe(map((page) => page.commandes));
  }

  /**
   * Même index, en conservant le compte total. Les écrans qui listent un
   * historique — les ventes d'une session — doivent pouvoir dire « 43 notes »
   * sans confondre ce total avec la page affichée.
   */
  listPagine(filters?: CommandeFiltres): Observable<CommandePage> {
    let params = new HttpParams();
    if (filters?.point_de_vente_id) {
      params = params.set('point_de_vente_id', filters.point_de_vente_id);
    }
    if (filters?.table_id) {
      params = params.set('table_id', filters.table_id);
    }
    if (filters?.session_caisse_id) {
      params = params.set('session_caisse_id', filters.session_caisse_id);
    }
    for (const statut of filters?.statut ?? []) {
      params = params.append('statut[]', statut);
    }
    if (filters?.avec_paiements) {
      params = params.set('avec_paiements', 1);
    }
    if (filters?.per_page) {
      params = params.set('per_page', filters.per_page);
    }
    if (filters?.page) {
      params = params.set('page', filters.page);
    }
    return this.http
      .get<ApiResponse<CommandeIndex>>(this.base, { params })
      .pipe(map((r) => r.data));
  }

  /**
   * Abandonne une commande que rien n'a jamais garnie et rend sa table.
   * Sans motif : il ne s'est rien passé. L'API refuse en 409 dès que la
   * commande a porté une ligne ou un paiement — c'est alors une annulation.
   */
  liberer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  get(id: number): Observable<CommandeClient> {
    return this.http
      .get<ApiResponse<CommandeClient>>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreateCommandePayload): Observable<CommandeClient> {
    return this.http.post<ApiResponse<CommandeClient>>(this.base, payload).pipe(map((r) => r.data));
  }

  ajouterLigne(id: number, payload: AjouterLignePayload): Observable<LigneCommandeClient> {
    return this.http
      .post<ApiResponse<LigneCommandeClient>>(`${this.base}/${id}/lignes`, payload)
      .pipe(map((r) => r.data));
  }

  annulerLigne(
    commandeId: number,
    ligneId: number,
    payload: AnnulerLignePayload,
  ): Observable<unknown> {
    return this.http
      .request('DELETE', `${this.base}/${commandeId}/lignes/${ligneId}`, { body: payload })
      .pipe(map(() => undefined));
  }

  /**
   * Marque servi. `ligneIds` cible un tour précis — la cuisine valide le ticket
   * qu'elle vient de produire, et une note peut porter deux tours à la fois.
   * Sans lui, toute la production en attente est servie.
   */
  servir(id: number, ligneIds: number[] = []): Observable<CommandeClient> {
    const corps = ligneIds.length > 0 ? { lignes: ligneIds } : {};
    return this.http
      .post<ApiResponse<CommandeClient>>(`${this.base}/${id}/servir`, corps)
      .pipe(map((r) => r.data));
  }

  encaisser(id: number): Observable<CommandeClient> {
    return this.http
      .post<ApiResponse<CommandeClient>>(`${this.base}/${id}/encaisser`, {})
      .pipe(map((r) => r.data));
  }

  annuler(id: number, payload: AnnulerCommandePayload): Observable<CommandeClient> {
    return this.http
      .post<ApiResponse<CommandeClient>>(`${this.base}/${id}/annuler`, payload)
      .pipe(map((r) => r.data));
  }

  ajouterPaiement(id: number, payload: StorePaiementPayload): Observable<Paiement> {
    return this.http
      .post<ApiResponse<Paiement>>(`${this.base}/${id}/paiements`, payload)
      .pipe(map((r) => r.data));
  }

  ajouterRemise(id: number, payload: StoreRemisePayload): Observable<Remise> {
    return this.http
      .post<ApiResponse<Remise>>(`${this.base}/${id}/remises`, payload)
      .pipe(map((r) => r.data));
  }

  /** File de production d'un point de vente, en tickets (tours). */
  kds(pointDeVenteId: number): Observable<TourKds[]> {
    return this.http
      .get<ApiResponse<{ tours: TourKds[] }>>(`${environment.apiUrl}/kds/${pointDeVenteId}`)
      .pipe(map((r) => r.data.tours));
  }

  /**
   * Envoie un tour en cuisine, panier compris : les lignes sont créées ET
   * expédiées en un seul appel, au lieu d'un aller-retour réseau par plat.
   */
  envoyerEnCuisine(id: number, lignes: LigneAEnvoyer[] = []): Observable<CommandeClient> {
    const corps = lignes.length > 0 ? { lignes } : {};
    return this.http
      .post<ApiResponse<CommandeClient>>(`${this.base}/${id}/envoyer-en-cuisine`, corps)
      .pipe(map((r) => r.data));
  }
}
