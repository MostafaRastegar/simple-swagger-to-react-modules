import { PetService } from './pet.service';
import { useQuery, useMutation } from '@tanstack/react-query';
// import { useRouter } from 'next/navigation';

const petservice = PetService();

export function PetPresentation() {
  return {
    useUploadFile: (
      variables: any,
      onSuccess?: (data: any) => void,
      onError?: (error: any) => void,
    ) =>
      useMutation({
        mutationFn: () => petservice.uploadFile(variables.petId),
        onSuccess,
        onError,
      }),
    useAdd: (
      variables: any,
      onSuccess?: (data: any) => void,
      onError?: (error: any) => void,
    ) =>
      useMutation({
        mutationFn: () => petservice.add(variables.body),
        onSuccess,
        onError,
      }),
    useUpdate: (
      variables: any,
      onSuccess?: (data: any) => void,
      onError?: (error: any) => void,
    ) =>
      useMutation({
        mutationFn: () => petservice.update(variables.body),
        onSuccess,
        onError,
      }),
    useFindsByStatus: (variables: any) =>
      useQuery<Pet[]>({
        queryKey: ['pet', 'findsByStatus', variables.status],
        queryFn: () => petservice.findsByStatus(variables.status),
        enabled: Object.keys(variables || {}).length > 0,
      }),
    useFindsByTags: (variables: any) =>
      useQuery<Pet[]>({
        queryKey: ['pet', 'findsByTags', variables.tags],
        queryFn: () => petservice.findsByTags(variables.tags),
        enabled: Object.keys(variables || {}).length > 0,
      }),
    useGetById: (variables: any) =>
      useQuery<Pet[]>({
        queryKey: ['pet', 'getById', variables.petId],
        queryFn: () => petservice.getById(variables.petId),
        enabled: Object.keys(variables || {}).length > 0,
      }),
    useUpdateWithForm: (
      variables: any,
      onSuccess?: (data: any) => void,
      onError?: (error: any) => void,
    ) =>
      useMutation({
        mutationFn: () => petservice.updateWithForm(variables.petId),
        onSuccess,
        onError,
      }),
    useDelete: (variables: any) =>
      useQuery<Pet[]>({
        queryKey: ['pet', 'delete', variables.petId],
        queryFn: () => petservice.delete(variables.petId),
        enabled: Object.keys(variables || {}).length > 0,
      }),
  };
}
