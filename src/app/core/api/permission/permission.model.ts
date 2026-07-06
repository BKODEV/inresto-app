export interface PermissionEntry {
  name: string;
  libelle: string;
}

export interface PermissionModule {
  module: string;
  permissions: PermissionEntry[];
}
