import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../api.types';
import { Budget } from '../budget/budget.model';
import {
  AlerteStock,
  ConsommationMatiere,
  DepensesReport,
  EcartInventaire,
  EvolutionPoint,
  FoodCostPointsDeVente,
  FoodCostProduits,
  FoodCostSynthese,
  OrdreTri,
  ReportingFilter,
  StockValorisation,
  TriProduit,
  VenteModePaiement,
  VenteParPdv,
  VenteProduit,
  VenteServeur,
} from './reporting.model';

/**
 * Client du module Reporting (lecture seule). Tous les endpoints partagent le
 * filtre temporel + périmètre (`ReportingFilter`) sérialisé en query string.
 */
@Injectable({ providedIn: 'root' })
export class ReportingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reporting`;

  // ── Food cost ───────────────────────────────────────────────────────────

  foodCostProduits(filter: ReportingFilter): Observable<FoodCostProduits> {
    return this.get<FoodCostProduits>('/food-cost/produits', filter);
  }

  foodCostPointsDeVente(filter: ReportingFilter): Observable<FoodCostPointsDeVente> {
    return this.get<FoodCostPointsDeVente>('/food-cost/points-de-vente', filter);
  }

  foodCostSynthese(filter: ReportingFilter): Observable<FoodCostSynthese> {
    return this.get<FoodCostSynthese>('/food-cost/synthese', filter);
  }

  // ── Ventes ──────────────────────────────────────────────────────────────

  ventesParPointDeVente(filter: ReportingFilter): Observable<VenteParPdv[]> {
    return this.get<{ points_de_vente: VenteParPdv[] }>('/ventes/points-de-vente', filter).pipe(
      map((d) => d.points_de_vente),
    );
  }

  ventesProduits(
    filter: ReportingFilter,
    options: { tri?: TriProduit; ordre?: OrdreTri; limit?: number } = {},
  ): Observable<VenteProduit[]> {
    return this.get<{ produits: VenteProduit[] }>('/ventes/produits', filter, options).pipe(
      map((d) => d.produits),
    );
  }

  ventesModesPaiement(filter: ReportingFilter): Observable<VenteModePaiement[]> {
    return this.get<{ modes_paiement: VenteModePaiement[] }>('/ventes/modes-paiement', filter).pipe(
      map((d) => d.modes_paiement),
    );
  }

  ventesServeurs(filter: ReportingFilter): Observable<VenteServeur[]> {
    return this.get<{ serveurs: VenteServeur[] }>('/ventes/serveurs', filter).pipe(
      map((d) => d.serveurs),
    );
  }

  ventesEvolution(filter: ReportingFilter): Observable<EvolutionPoint[]> {
    return this.get<{ serie: EvolutionPoint[] }>('/ventes/evolution', filter).pipe(
      map((d) => d.serie),
    );
  }

  // ── Stock ─────────────────────────────────────────────────────────────────

  stockValorisation(filter: ReportingFilter): Observable<StockValorisation> {
    return this.get<StockValorisation>('/stock/valorisation', filter);
  }

  stockConsommation(filter: ReportingFilter): Observable<ConsommationMatiere[]> {
    return this.get<{ matieres: ConsommationMatiere[] }>('/stock/consommation', filter).pipe(
      map((d) => d.matieres),
    );
  }

  stockEcartsInventaire(
    filter: ReportingFilter,
    detail = false,
  ): Observable<EcartInventaire[]> {
    return this.get<{ inventaires: EcartInventaire[] }>('/stock/ecarts-inventaire', filter, {
      detail: detail ? 1 : undefined,
    }).pipe(map((d) => d.inventaires));
  }

  stockAlertes(filter: ReportingFilter): Observable<AlerteStock[]> {
    return this.get<{ alertes: AlerteStock[] }>('/stock/alertes', filter).pipe(
      map((d) => d.alertes),
    );
  }

  // ── Budget ────────────────────────────────────────────────────────────────

  budgetConsommation(filter: ReportingFilter): Observable<Budget[]> {
    return this.get<{ budgets: Budget[] }>('/budget/consommation', filter).pipe(
      map((d) => d.budgets),
    );
  }

  budgetDepenses(filter: ReportingFilter): Observable<DepensesReport> {
    return this.get<DepensesReport>('/budget/depenses', filter);
  }

  // ── Privé ─────────────────────────────────────────────────────────────────

  private get<T>(
    path: string,
    filter: ReportingFilter,
    extra: Record<string, string | number | undefined> = {},
  ): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(`${this.base}${path}`, { params: this.toParams(filter, extra) })
      .pipe(map((r) => r.data));
  }

  private toParams(
    filter: ReportingFilter,
    extra: Record<string, string | number | undefined>,
  ): HttpParams {
    let params = new HttpParams();
    const merged: Record<string, string | number | undefined> = { ...filter, ...extra };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }
}
