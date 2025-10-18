import { PetService } from "./pet.service";
import { useQuery, useMutation } from "@tanstack/react-query"; // Assuming TanStack Query is used
import { useRouter, useSearchParams } from "next/navigation"; // Assuming Next.js
import { Pet, PetCreateParams, PetUpdateParams } from "./domains/models/Pet";

const petService = PetService();

export function PetPresentation() {
  return {
    useAddPet: () =>
      useMutation({
        mutationFn: (petData: PetCreateParams) => petService.addPet(petData),
        onSuccess: (data: Pet) => {
          console.log("Pet added successfully:", data);
          // Optionally, redirect or show a success message
        },
        onError: (error) => {
          console.error("Error adding pet:", error);
        },
      }),

    useUpdatePet: () =>
      useMutation({
        mutationFn: (petData: PetUpdateParams) => petService.updatePet(petData),
        onSuccess: (data: Pet) => {
          console.log("Pet updated successfully:", data);
        },
        onError: (error) => {
          console.error("Error updating pet:", error);
        },
      }),

    useFindPetsByStatus: (status: string[]) =>
      useQuery<Pet[], Error>({
        queryKey: ["pets", "byStatus", status],
        queryFn: () => petService.findPetsByStatus(status),
        enabled: status.length > 0, // Only run if status is provided
      }),

    useFindPetsByTags: (tags: string[]) =>
      useQuery<Pet[], Error>({
        queryKey: ["pets", "byTags", tags],
        queryFn: () => petService.findPetsByTags(tags),
        enabled: tags.length > 0, // Only run if tags are provided
      }),

    useGetPetById: (petId: number) =>
      useQuery<Pet, Error>({
        queryKey: ["pet", petId],
        queryFn: () => petService.getPetById(petId),
        enabled: !!petId, // Only run if petId is provided
      }),

    useUpdatePetWithForm: () => {
      const router = useRouter(); // Or any other navigation logic if needed
      return useMutation({
        mutationFn: ({
          petId,
          name,
          status,
        }: {
          petId: number;
          name?: string;
          status?: string;
        }) => petService.updatePetWithForm(petId, name, status),
        onSuccess: () => {
          console.log("Pet updated with form successfully");
          // Optionally, redirect or show a success message
        },
        onError: (error) => {
          console.error("Error updating pet with form:", error);
        },
      });
    },

    useDeletePet: () => {
      const router = useRouter(); // Or any other navigation logic if needed
      return useMutation({
        mutationFn: (petId: number) => petService.deletePet(petId),
        onSuccess: () => {
          console.log("Pet deleted successfully");
          // Optionally, redirect or show a success message
        },
        onError: (error) => {
          console.error("Error deleting pet:", error);
        },
      });
    },

    useUploadImage: () =>
      useMutation({
        mutationFn: ({
          petId,
          additionalMetadata,
          file,
        }: {
          petId: number;
          additionalMetadata?: string;
          file?: File;
        }) => petService.uploadImage(petId, additionalMetadata, file),
        onSuccess: (data: any) => {
          // Using any for ApiResponse
          console.log("Image uploaded successfully:", data);
        },
        onError: (error) => {
          console.error("Error uploading image:", error);
        },
      }),
  };
}
