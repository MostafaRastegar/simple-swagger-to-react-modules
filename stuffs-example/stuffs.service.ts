import { serviceHandler } from 'papak/helpers/serviceHandler';
import request from 'papak/utils/request';
import { endpoints } from '@/constants/endpoints';
import { IStuffsService } from './domains/IStuffsService';

// SERVICE IMPLEMENTATION
function StuffsService(): IStuffsService {
  return {
    stuffsList: (params) =>
      serviceHandler(() =>
        request().get(endpoints.STUFFS.GET_STUFFS(), { params }),
      ),
    stuffsCreate: (body) =>
      serviceHandler(() =>
        request().post(endpoints.STUFFS.POST_STUFFS(), body),
      ),
    stuffsRetrieve: (params) =>
      serviceHandler(() =>
        request().get(endpoints.STUFFS.GET_STUFFS_ID(params.id), { params }),
      ),
    stuffsDestroy: (id) =>
      serviceHandler(() =>
        request().delete(endpoints.STUFFS.DELETE_STUFFS_ID(id)),
      ),
    stuffsDeleteAllDestroy: () =>
      serviceHandler(() =>
        request().delete(endpoints.STUFFS.DELETE_STUFFS_DELETE_ALL()),
      ),
  };
}

export { StuffsService, endpoints };
