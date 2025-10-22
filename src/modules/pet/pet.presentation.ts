export interface PetuploadFileFormData {
  additionalMetadata?: string;
  file?: any;
}

export interface PetupdateWithFormFormData {
  name?: string;
  status?: string;
}

import { PetService } from './pet.service';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

const petQueryKeys = {
  FINDS_BY_STATUS: 'pet_findsByStatus',
  FINDS_BY_TAGS: 'pet_findsByTags',
  GET_BY_ID: 'pet_getById',
};

// PRESENTATION LAYER
// React Query hooks for pet
function PetPresentation() {
  const Service = PetService();
  return {
    usePetUploadfile: (
      variables: { petId: number; body: PetuploadFileFormData },
      onSuccess?: (data: any) => void,
      onError?: (error: any) => void,
    ) =>
      useMutation({
        mutationFn: () => Service.uploadFile(variables.petId, variables.body),
        onSuccess,
        onError,
      }),
    usePetAdd: (
      variables: { body: PetCreateParams },
      onSuccess?: (data: any) => void,
      onError?: (error: any) => void,
    ) =>
      useMutation({
        mutationFn: () => Service.add(variables.body),
        onSuccess,
        onError,
      }),
    usePetUpdate: (
      variables: { body: PetCreateParams },
      onSuccess?: (data: any) => void,
      onError?: (error: any) => void,
    ) =>
      useMutation({
        mutationFn: () => Service.update(variables.body),
        onSuccess,
        onError,
      }),
    usePetFindsbystatus: (variables: {
      status: Array<'available' | 'pending' | 'sold'>;
    }) =>
      useQuery({
        queryKey: [
          petQueryKeys.FINDS_BY_STATUS,
          JSON.stringify(variables.status),
        ],
        queryFn: () => Service.findsByStatus(variables.status),
        enabled: variables.status,
      }),
    usePetFindsbytags: (variables: { tags: Array<string> }) =>
      useQuery({
        queryKey: [petQueryKeys.FINDS_BY_TAGS, JSON.stringify(variables.tags)],
        queryFn: () => Service.findsByTags(variables.tags),
        enabled: variables.tags,
      }),
    usePetGetbyid: (variables: { petId: number }) =>
      useQuery({
        queryKey: [petQueryKeys.GET_BY_ID, JSON.stringify(variables.petId)],
        queryFn: () => Service.getById(variables.petId),
        enabled: variables.petId,
      }),
    usePetUpdatewithform: (
      variables: { petId: number; body: PetupdateWithFormFormData },
      onSuccess?: (data: any) => void,
      onError?: (error: any) => void,
    ) =>
      useMutation({
        mutationFn: () =>
          Service.updateWithForm(variables.petId, variables.body),
        onSuccess,
        onError,
      }),
    usePetDelete: (
      variables: { petId: number },
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
