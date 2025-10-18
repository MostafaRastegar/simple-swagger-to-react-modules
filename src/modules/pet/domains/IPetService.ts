import {
  Pet,
  PetCreateParams,
  PetUpdateParams,
  PetUploadImageParams,
} from "./models/Pet";

export interface IPetService {
  addPet(pet: PetCreateParams): Promise<Pet>;
  updatePet(pet: PetUpdateParams): Promise<Pet>;
  findPetsByStatus(status: string[]): Promise<Pet[]>;
  findPetsByTags(tags: string[]): Promise<Pet[]>;
  getPetById(petId: number): Promise<Pet>;
  updatePetWithForm(
    petId: number,
    name?: string,
    status?: string
  ): Promise<void>;
  deletePet(petId: number): Promise<void>;
  uploadImage(
    petId: number,
    additionalMetadata?: string,
    file?: File
  ): Promise<any>; // Using any for ApiResponse for now
}
