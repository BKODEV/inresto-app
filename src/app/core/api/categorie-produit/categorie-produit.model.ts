export interface CategorieProduit {
  id: number;
  libelle: string;
  description: string | null;
  /** Ordre d'affichage des sections sur une carte. */
  ordre: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCategorieProduitPayload {
  libelle: string;
  description?: string | null;
  ordre?: number;
}

export interface UpdateCategorieProduitPayload extends Partial<CreateCategorieProduitPayload> {}
