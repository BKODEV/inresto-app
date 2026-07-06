import { Statut } from '../api.types';

/** Rôle tel qu'embarqué dans la fiche utilisateur (avec son niveau de sécurité). */
export interface UserRoleBrief {
  id: number;
  name: string;
  description: string | null;
  niveau: number;
  is_system: boolean;
}

/** Site de rattachement (périmètre) embarqué dans la fiche utilisateur. */
export interface UserSiteBrief {
  id: number;
  nom: string;
  code: string;
  statut: Statut;
}

export interface User {
  id: string;
  nom: string;
  prenom: string;
  identifiant: string;
  email: string | null;
  telephone: string | null;
  photo: string | null;
  statut: Statut;
  a_pin: boolean;
  last_login_at: string | null;
  /** Niveau de sécurité le plus élevé de l'utilisateur (hiérarchie). */
  niveau_max: number;
  roles: UserRoleBrief[];
  sites: UserSiteBrief[];
  created_at?: string;
  updated_at?: string;
}

export interface UserFilters {
  site_id?: number | null;
  role?: string | null;
  statut?: Statut | null;
  q?: string | null;
}

export interface CreateUserPayload {
  nom: string;
  prenom: string;
  identifiant: string;
  email?: string | null;
  telephone?: string | null;
  pin_code?: string | null;
  /** Si absent, l'email devient requis (mot de passe provisoire envoyé par email). */
  password?: string | null;
  statut?: Statut;
  roles: string[];
  sites: number[];
}

export interface UpdateUserPayload extends Partial<Omit<CreateUserPayload, 'password'>> {}
