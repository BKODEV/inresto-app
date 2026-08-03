import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';

/**
 * Récupère les documents PDF de l'API (flux binaire authentifié via
 * l'intercepteur). Les méthodes renvoient le `Blob` ; l'ouverture est déléguée à
 * `ouvrirPdfDansOnglet` pour que chaque écran pilote son propre état (busy/erreur).
 */
@Injectable({ providedIn: 'root' })
export class PdfService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  /**
   * Bon de commande fournisseur. Le site d'en-tête n'est pas porté par la
   * commande : on transmet le site courant si disponible (sinon le backend
   * retombe sur le site principal).
   */
  bonCommandeFournisseur(commandeId: number, siteId?: number | null): Observable<Blob> {
    let params = new HttpParams();
    if (siteId != null) {
      params = params.set('site_id', siteId);
    }
    return this.http.get(`${this.base}/commandes-fournisseur/${commandeId}/pdf`, {
      params,
      responseType: 'blob',
    });
  }

  factureClient(commandeId: number): Observable<Blob> {
    return this.http.get(`${this.base}/commandes-client/${commandeId}/pdf`, {
      responseType: 'blob',
    });
  }

  recuClient(commandeId: number): Observable<Blob> {
    return this.http.get(`${this.base}/commandes-client/${commandeId}/recu`, {
      responseType: 'blob',
    });
  }

  /**
   * Une fiche technique ne porte aucun site : `siteId` désigne l'établissement
   * dont l'identité figure en en-tête (à défaut, le site PRINCIPAL côté back).
   */
  ficheTechnique(ficheId: number, siteId?: number | null): Observable<Blob> {
    let params = new HttpParams();
    if (siteId != null) {
      params = params.set('site_id', siteId);
    }
    return this.http.get(`${this.base}/fiches-techniques/${ficheId}/pdf`, {
      params,
      responseType: 'blob',
    });
  }

  /** Chevalet QR d'une table (A6), à poser sur la table. */
  qrTable(tableId: number): Observable<Blob> {
    return this.http.get(`${this.base}/tables/${tableId}/qr-pdf`, { responseType: 'blob' });
  }

  /** Planche A4 des QR de toutes les tables d'un point de vente (impression en lot). */
  qrPlanchePointDeVente(pointDeVenteId: number): Observable<Blob> {
    return this.http.get(`${this.base}/points-de-vente/${pointDeVenteId}/qr-planche-pdf`, {
      responseType: 'blob',
    });
  }
}

/**
 * Ouvre un PDF (flux inline) dans un nouvel onglet. Si le navigateur bloque la
 * popup, retombe sur un téléchargement. Sans effet hors navigateur (SSR).
 */
export function ouvrirPdfDansOnglet(blob: Blob, nomFichier = 'document.pdf'): void {
  if (typeof window === 'undefined') {
    return;
  }
  const url = URL.createObjectURL(blob);
  const onglet = window.open(url, '_blank');
  if (!onglet) {
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nomFichier;
    lien.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
