import { PetService } from './pet.service';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
// import { useRouter } from 'next/navigation';

const petQueryKeys = {
  FINDS_BY_STATUS: 'pet_findsByStatus',
  FINDS_BY_TAGS: 'pet_findsByTags',
  GET_BY_ID: 'pet_getById',
};

// PRESENTATION LAYER
// React Query hooks for pet
function PetPresentation() {
  const Service = PetService();
  // const queryParams = useParams(); // Assuming this might be used for store_id like in stuffs-example
  return {
    usePetUploadfile: (
      variables: any,
      onSuccess?: (data: any) => void,
      onError?: (error: any) => void,
    ) =>
      useMutation({
        mutationFn: () => Service.uploadFile(variables.petId),
        onSuccess,
        onError,
      }),
    usePetAdd: (
      variables: any,
      onSuccess?: (data: any) => void,
      onError?: (error: any) => void,
    ) =>
      useMutation({
        mutationFn: () => Service.add(variables.body),
        onSuccess,
        onError,
      }),
    usePetUpdate: (
      variables: any,
      onSuccess?: (data: any) => void,
      onError?: (error: any) => void,
    ) =>
      useMutation({
        mutationFn: () => Service.update(variables.body),
        onSuccess,
        onError,
      }),
    usePetFindsbystatus: (variables: any) =>
      useQuery({
        queryKey: [
          petQueryKeys.FINDS_BY_STATUS,
          JSON.stringify(variables.status),
        ],
        queryFn: () => Service.findsByStatus(variables.status),
        enabled: variables.status,
      }),
    usePetFindsbytags: (variables: any) =>
      useQuery({
        queryKey: [petQueryKeys.FINDS_BY_TAGS, JSON.stringify(variables.tags)],
        queryFn: () => Service.findsByTags(variables.tags),
        enabled: variables.tags,
      }),
    usePetGetbyid: (variables: any) =>
      useQuery({
        queryKey: [petQueryKeys.GET_BY_ID, JSON.stringify(variables.petId)],
        queryFn: () => Service.getById(variables.petId),
        enabled: variables.petId,
      }),
    usePetUpdatewithform: (
      variables: any,
      onSuccess?: (data: any) => void,
      onError?: (error: any) => void,
    ) =>
      useMutation({
        mutationFn: () => Service.updateWithForm(variables.petId),
        onSuccess,
        onError,
      }),
    usePetDelete: (
      variables: any,
      onSuccess?: (data: any) => void,
      onError?: (error: any) => void,
    ) =>
      useMutation({
        mutationFn: () => Service.delete(variables.petId),
        onSuccess,
        onError,
      }),
  };
}

export { PetPresentation };
