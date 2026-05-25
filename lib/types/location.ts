export interface TargetLocation {
  city: string;
  region?: string;
  country: string; // ISO 3166-1 alpha-2, e.g. "SE"
  address?: string;
  postal_code?: string;
  phone?: string;
  is_primary?: boolean;
}
