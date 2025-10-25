import { IPetService } from './domains/IPetService';
import { Pet, PetCreateParams } from './domains/models/Pet';
import { endpoints } from '../constants/endpoints';
import {
  serviceHandler,
  request,
  requestWithoutAuth,
} from 'papak/helpers/serviceHandler';

export function PetService(): IPetService {
  return {
    uploadFile: (petId, body) =>
      serviceHandler(() =>
        request().postForm(
          endpoints.PET.POST_PET_PETID_UPLOAD_IMAGE(petId),
          body,
        ),
      ),
    add: (body) =>
      serviceHandler(() => request().post(endpoints.PET.POST_PET(), body, {})),
    update: (body) =>
      serviceHandler(() => request().put(endpoints.PET.PUT_PET(), body, {})),
    findsByStatus: (status) =>
      serviceHandler(() =>
        request().get(endpoints.PET.GET_PET_FIND_BY_STATUS(), {
          params: { status },
        }),
      ),
    findsByTags: (tags) =>
      serviceHandler(() =>
        request().get(endpoints.PET.GET_PET_FIND_BY_TAGS(), {
          params: { tags },
        }),
      ),
    getById: (petId) =>
      serviceHandler(() =>
        request().get(endpoints.PET.GET_PET_PETID(petId), {}),
      ),
    updateWithForm: (petId, body) =>
      serviceHandler(() =>
        request().postForm(endpoints.PET.POST_PET_PETID(petId), body),
      ),
    delete: (petId) =>
      serviceHandler(() =>
        request().delete(endpoints.PET.DELETE_PET_PETID(petId), {}),
      ),
  };
}
