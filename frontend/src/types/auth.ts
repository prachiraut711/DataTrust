export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at?: string;
  workspaces: Workspace[];
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}
