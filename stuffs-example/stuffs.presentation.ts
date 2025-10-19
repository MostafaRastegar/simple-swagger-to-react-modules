// Generated presentation layer for stuffs
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParamsToObject } from 'papak/utils/useSearchParamsToObject';
import {
  StuffsCreateRequest,
  StuffsRetrieveParams,
} from './domains/models/Stuffs';
import { StuffsService } from './stuffs.service';

export const stuffQueryKeys = {
  stuffList: 'stuffList',
  stuffRetrieve: 'stuffRetrieve',
};

// PRESENTATION LAYER
// React Query hooks for stuffs
function StuffsPresentation() {
  const Service = StuffsService();
  const queryParams = useParams();
  return {
    useStuffsList: () => {
      const params = useSearchParamsToObject();
      const mergedParams = queryParams?.store_id
        ? { ...params, store_id: queryParams?.store_id }
        : params;

      return useQuery({
        queryKey: [stuffQueryKeys.stuffList, JSON.stringify(mergedParams)],
        // @ts-ignore
        queryFn: () => Service.stuffsList(mergedParams),
      });
    },

    useStuffsCreate: () => {
      return useMutation({
        mutationFn: (body: StuffsCreateRequest) => {
          return Service.stuffsCreate(body);
        },
      });
    },

    useStuffsRetrieve: (params: StuffsRetrieveParams) => {
      return useQuery({
        queryKey: [stuffQueryKeys.stuffRetrieve, ...Object.values(params)],
        queryFn: () => Service.stuffsRetrieve(params),
      });
    },

    useStuffsDestroy: () => {
      return useMutation({
        mutationFn: (id: number) => {
          return Service.stuffsDestroy(id);
        },
      });
    },

    useStuffsDeleteAllDestroy: (params: number[]) => {
      return useMutation({
        mutationFn: () => {
          return Service.stuffsDeleteAllDestroy(params);
        },
      });
    },
  };
}

export { StuffsPresentation };
