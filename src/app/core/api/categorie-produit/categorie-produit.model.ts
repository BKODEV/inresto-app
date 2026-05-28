export interface CategorieProduit {
  id: number;
  libelle: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCategorieProduitPayload {
  libelle: string;
  description?: string | null;
}

export interface UpdateCategorieProduitPayload extends Partial<CreateCategorieProduitPayload> {}
