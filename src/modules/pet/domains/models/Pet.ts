export interface Category {
  id?: number;
  name?: string;
}

export interface Tag {
  id?: number;
  name?: string;
}

export interface Pet {
  id?: number;
  category?: Category;
  name: string;
  photoUrls: string[];
  tags?: Tag[];
  status?: "available" | "pending" | "sold";
}

export interface PetCreateParams {
  category?: Category;
  name: string;
  photoUrls: string[];
  tags?: Tag[];
  status?: "available" | "pending" | "sold";
}

export interface PetUpdateParams extends PetCreateParams {}

export interface PetUploadImageParams {
  additionalMetadata?: string;
  file?: File;
}

export interface ApiResponse {
  code?: number;
  type?: string;
  message?: string;
}
