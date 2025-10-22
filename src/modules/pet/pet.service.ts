import { IPetService } from './domains/IPetService';
import { Pet, PetCreateParams } from './domains/models/Pet';
import { endpoints } from '../constants/endpoints';
import {
  serviceHandler,
  request,
  requestWithoutAuth,
} from 'papak/helpers/serviceHandler';

function PetService(): IPetService {
  return {
    uploadFile: (petId, body) =>
      serviceHandler(() =>
        request().postForm(endpoints.PET.UPLOAD_FILE(petId), body),
      ),
    add: (body) =>
      serviceHandler(() => request().post(endpoints.PET.ADD(), body)),
    update: (body) =>
      serviceHandler(() => request().put(endpoints.PET.UPDATE(), body)),
    findsByStatus: (queryParams) =>
      serviceHandler(() =>
        request().get(endpoints.PET.FINDS_BY_STATUS(), { params: queryParams }),
      ),
    findsByTags: (queryParams) =>
      serviceHandler(() =>
        request().get(endpoints.PET.FINDS_BY_TAGS(), { params: queryParams }),
      ),
    getById: (petId) =>
      serviceHandler(() => request().get(endpoints.PET.GET_BY_ID(petId), {})),
    updateWithForm: (petId, body) =>
      serviceHandler(() =>
        request().postForm(endpoints.PET.UPDATE_WITH_FORM(petId), body),
      ),
    delete: (petId) =>
      serviceHandler(() => request().delete(endpoints.PET.DELETE(petId), {})),
  };
}

export { PetService };
