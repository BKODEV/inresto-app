export interface Role {
  id: number;
  name: string;
  description: string | null;
  niveau: number;
  is_system: boolean;
  /** Présent au détail / après création-édition. */
  permissions?: string[];
  /** Nombre d'utilisateurs portant le rôle (liste). */
  users_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateRolePayload {
  name: string;
  description?: string | null;
  niveau: number;
  permissions: string[];
}

export interface UpdateRolePayload extends Partial<CreateRolePayload> {}
