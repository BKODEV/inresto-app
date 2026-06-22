import { Site } from '../api/site/site.model';

export interface AuthUser {
  id: string;
  nom: string;
  prenom: string;
  identifiant: string;
  email: string | null;
  telephone: string | null;
  photo: string | null;
  statut: 'actif' | 'inactif';
  last_login_at: string | null;
  roles: string[];
  permissions: string[];
  /** Périmètre métier : sites de rattachement de l'utilisateur. */
  sites: Site[];
}

export interface LoginRequest {
  identifiant: string;
  password: string;
  device_name?: string;
}

export interface LoginResponse {
  message: string;
  data: {
    token: string;
    token_type: 'Bearer';
    user: AuthUser;
  };
}

export interface MeResponse {
  message: string;
  data: AuthUser;
}

export interface ApiMessage {
  message: string;
}
