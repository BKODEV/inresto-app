/**
 * Vue CLIENT du menu, telle que servie par `GET /api/public/menu/{token}`.
 *
 * Volontairement pauvre : ni ids, ni statuts, ni données de gestion. Ces
 * interfaces reflètent la PublicMenuResource du backend et ne doivent pas être
 * étendues avec des champs administratifs.
 */
export interface MenuPublicEtablissement {
  nom: string | null;
  slogan: string | null;
  logo_url: string | null;
  devise: string;
}

export interface MenuPublicPointDeVente {
  nom: string;
  type: string;
}

export interface MenuPublicProduit {
  libelle: string;
  description: string | null;
  allergenes: string | null;
  photo_url: string | null;
  prix: number;
}

export interface MenuPublicCategorie {
  libelle: string;
  produits: MenuPublicProduit[];
}

export interface MenuPublic {
  /** Vrai quand le point de vente n'a aucune carte active : afficher un message neutre. */
  menu_indisponible: boolean;
  etablissement: MenuPublicEtablissement;
  point_de_vente: MenuPublicPointDeVente;
  categories: MenuPublicCategorie[];
}
