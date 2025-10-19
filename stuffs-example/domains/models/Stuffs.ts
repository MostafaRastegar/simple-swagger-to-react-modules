export interface Stuff {
  id: number;
  is_customized: boolean;
  created_at: string;
  updated_at: string;
  stuffID: number;
  description: string;
  vat_rate?: string;
  edit_date_fa?: string;
  type_stuff_id?: string;
  created_by?: string;
}

export interface StuffRequest {
  stuffID: number;
  description: string;
  vat_rate?: string;
  edit_date_fa?: string;
  type_stuff_id?: string;
  created_by?: string;
}

// Parameter interfaces
export interface StuffsListParams {
  description?: string;
  edit_date_fa?: string;
  ordering?: string;
  page?: string;
  page_size?: string;
  search?: string;
  store_id?: number | string;
  stuffID?: number;
  type_stuff_id?: string;
  vat_rate?: string;
}

export interface StuffsRetrieveParams {
  id: number;
  store_id?: number;
}

// Request body interfaces
export type StuffsCreateRequest = StuffRequest;
