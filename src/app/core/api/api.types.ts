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
