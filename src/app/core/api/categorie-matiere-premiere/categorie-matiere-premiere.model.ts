export interface CategorieMatierePremiere {
  id: number;
  libelle: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCategorieMatierePremiere {
  libelle: string;
  description?: string | null;
}

export interface UpdateCategorieMatierePremiere extends Partial<CreateCategorieMatierePremiere> {}
