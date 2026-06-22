// Enveloppes de réponse API
export interface ApiResponse<T> {
  status: 'success' | 'error';
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  status: 'error';
  message: string;
  errors?: Record<string, string[]>;
}

// Statuts partagés entre plusieurs modèles
export type Statut = 'actif' | 'inactif';

// Métadonnées de pagination renvoyées par les index paginés de l'API
export interface Pagination {
  total: number;
  par_page: number;
  page_courante: number;
  derniere_page: number;
}
