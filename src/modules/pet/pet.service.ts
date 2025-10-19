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
    uploadFile: (body) =>
      serviceHandler(() => request().post(endpoints.PET.UPLOAD_FILE(petId))),
    add: (body) =>
      serviceHandler(() => request().post(endpoints.PET.ADD(), body)),
    update: (body) =>
      serviceHandler(() => request().put(endpoints.PET.UPDATE(), body)),
    findsByStatus: (body) =>
      serviceHandler(() =>
        request().get(endpoints.PET.FINDS_BY_STATUS(status), {
          params: { status: status },
        }),
      ),
    findsByTags: (body) =>
      serviceHandler(() =>
        request().get(endpoints.PET.FINDS_BY_TAGS(tags), {
          params: { tags: tags },
        }),
      ),
    getById: (body) =>
      serviceHandler(() => request().get(endpoints.PET.GET_BY_ID(petId), {})),
    updateWithForm: (body) =>
      serviceHandler(() =>
        request().post(endpoints.PET.UPDATE_WITH_FORM(petId)),
      ),
    delete: (body) =>
      serviceHandler(() => request().delete(endpoints.PET.DELETE(petId), {})),
  };
}

export { PetService };
