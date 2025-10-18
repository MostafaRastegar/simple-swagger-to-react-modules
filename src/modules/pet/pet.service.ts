import { endpoints } from "../../constants/endpoints";
import {
  serviceHandler,
  request,
  requestWithoutAuth,
} from "../../utils/request"; // Assuming a similar request utility exists
import { IPetService } from "./domains/IPetService";
import {
  PetCreateParams,
  PetUpdateParams,
  PetUploadImageParams,
  ApiResponse,
} from "./domains/models/Pet";

function PetService(): IPetService {
  return {
    addPet: (pet: PetCreateParams) =>
      serviceHandler<ApiResponse>(() =>
        requestWithoutAuth.post(endpoints.PET.ADD_PET(), pet)
      ),

    updatePet: (pet: PetUpdateParams) =>
      serviceHandler<ApiResponse>(() =>
        request.put(endpoints.PET.UPDATE_PET(), pet)
      ),

    findPetsByStatus: (status: string[]) =>
      serviceHandler<ApiResponse>(() =>
        request.get(endpoints.PET.FIND_PETS_BY_STATUS({ status }))
      ),

    findPetsByTags: (tags: string[]) =>
      serviceHandler<ApiResponse>(() =>
        request.get(endpoints.PET.FIND_PETS_BY_TAGS({ tags }))
      ),

    getPetById: (petId: number) =>
      serviceHandler<ApiResponse>(() =>
        request.get(endpoints.PET.GET_PET_BY_ID({ petId }))
      ),

    updatePetWithForm: (petId: number, name?: string, status?: string) =>
      serviceHandler<ApiResponse>(() => {
        const formData = new FormData();
        if (name) formData.append("name", name);
        if (status) formData.append("status", status);
        return requestWithoutAuth.post(
          endpoints.PET.UPDATE_PET_WITH_FORM({ petId }),
          formData,
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );
      }),

    deletePet: (petId: number) =>
      serviceHandler<ApiResponse>(() =>
        request.delete(endpoints.PET.DELETE_PET({ petId }))
      ),

    uploadImage: (petId: number, additionalMetadata?: string, file?: File) =>
      serviceHandler<ApiResponse>(() => {
        const formData = new FormData();
        formData.append("file", file as File); // Ensure file is provided
        if (additionalMetadata) {
          formData.append("additionalMetadata", additionalMetadata);
        }
        return requestWithoutAuth.post(
          endpoints.PET.UPLOAD_IMAGE({ petId }),
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
      }),
  };
}

export { PetService };
