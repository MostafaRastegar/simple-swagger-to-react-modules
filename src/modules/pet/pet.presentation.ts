export interface PetuploadFileFormData {
  additionalMetadata?: string;
  file?: any;
}

export interface PetupdateWithFormFormData {
  name?: string;
  status?: string;
}

import { PetService } from './pet.service';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { PetCreateParams } from './domains/models/Pet';

const petQueryKeys = {
  FINDS_BY_STATUS: 'pet_findsByStatus',
  FINDS_BY_TAGS: 'pet_findsByTags',
  GET_BY_ID: 'pet_getById',
};

// PRESENTATION LAYER
// React Query hooks for pet
export function PetPresentation() {
  const Service = PetService();
  const queryClient = useQueryClient();
  return {
    usePetUploadfile: (variables: {
      petId: number;
      body: PetuploadFileFormData;
    }) => {
      return useMutation({
        mutationFn: () => Service.uploadFile(variables.petId, variables.body),
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [petQueryKeys.FINDS_BY_STATUS],
          });
          queryClient.invalidateQueries({
            queryKey: [petQueryKeys.FINDS_BY_TAGS],
          });
        },
      });
    },
    usePetAdd: (variables: { body: PetCreateParams }) => {
      return useMutation({
        mutationFn: () => Service.add(variables.body),
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [petQueryKeys.FINDS_BY_STATUS],
          });
          queryClient.invalidateQueries({
            queryKey: [petQueryKeys.FINDS_BY_TAGS],
          });
        },
      });
    },
    usePetUpdate: (variables: { body: PetCreateParams }) => {
      return useMutation({
        mutationFn: () => Service.update(variables.body),
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [petQueryKeys.FINDS_BY_STATUS],
          });
          queryClient.invalidateQueries({
            queryKey: [petQueryKeys.FINDS_BY_TAGS],
          });
        },
      });
    },
    usePetFindsbystatus: (variables: {
      status: Array<'available' | 'pending' | 'sold'>;
    }) => {
      return useQuery({
        queryKey: [
          petQueryKeys.FINDS_BY_STATUS,
          JSON.stringify(variables.status),
        ],
        queryFn: () => Service.findsByStatus(variables.status),
        enabled: variables.status,
      });
    },
    usePetFindsbytags: (variables: { tags: Array<string> }) => {
      return useQuery({
        queryKey: [petQueryKeys.FINDS_BY_TAGS, JSON.stringify(variables.tags)],
        queryFn: () => Service.findsByTags(variables.tags),
        enabled: variables.tags,
      });
    },
    usePetGetbyid: () => {
      const { id } = useParams();
      return useQuery({
        queryKey: [petQueryKeys.GET_BY_ID, id],
        queryFn: () => Service.getById(id),
        enabled: !!id,
      });
    },
    usePetUpdatewithform: (variables: {
      petId: number;
      body: PetupdateWithFormFormData;
    }) => {
      return useMutation({
        mutationFn: () =>
          Service.updateWithForm(variables.petId, variables.body),
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [petQueryKeys.FINDS_BY_STATUS],
          });
          queryClient.invalidateQueries({
            queryKey: [petQueryKeys.FINDS_BY_TAGS],
          });
        },
      });
    },
    usePetDelete: (variables: { petId: number }) => {
      return useMutation({
        mutationFn: () => Service.delete(variables.petId),
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [petQueryKeys.FINDS_BY_STATUS],
          });
          queryClient.invalidateQueries({
            queryKey: [petQueryKeys.FINDS_BY_TAGS],
          });
        },
      });
    },
  };
}
