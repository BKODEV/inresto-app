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
  LigneCommandeClient,
  Paiement,
  Remise,
  StatutCommandeClient,
  StorePaiementPayload,
  StoreRemisePayload,
} from './commande-client.model';

interface CommandeIndex {
  commandes: CommandeClient[];
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
  list(filters?: {
    point_de_vente_id?: number;
    table_id?: number;
    session_caisse_id?: number;
    statut?: StatutCommandeClient[];
    per_page?: number;
  }): Observable<CommandeClient[]> {
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
    if (filters?.per_page) {
      params = params.set('per_page', filters.per_page);
    }
    return this.http
      .get<ApiResponse<CommandeIndex>>(this.base, { params })
      .pipe(map((r) => r.data.commandes));
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

  envoyerEnCuisine(id: number): Observable<CommandeClient> {
    return this.http
      .post<ApiResponse<CommandeClient>>(`${this.base}/${id}/envoyer-en-cuisine`, {})
      .pipe(map((r) => r.data));
  }

  servir(id: number): Observable<CommandeClient> {
    return this.http
      .post<ApiResponse<CommandeClient>>(`${this.base}/${id}/servir`, {})
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

  /** File KDS d'un point de vente (commandes envoyées en cuisine). */
  kds(pointDeVenteId: number): Observable<CommandeClient[]> {
    return this.http
      .get<ApiResponse<CommandeIndex>>(`${environment.apiUrl}/kds/${pointDeVenteId}`)
      .pipe(map((r) => r.data.commandes));
  }
}
