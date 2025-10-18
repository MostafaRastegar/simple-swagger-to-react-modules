import { IPetService } from './domains/Ipet.service';
import { Pet, PetCreateParams } from './domains/models/pet';
import { endpoints } from '../constants/endpoints';
import {
  serviceHandler,
  request,
  requestWithoutAuth,
} from '../../utils/request';

function PetService(): IPetService {
  return {
    uploadFile: (petId: number) =>
      serviceHandler<Pet>(() =>
        request.post(endpoints.PET.uploadFile(petId), body),
      ),
    add: (body: Record<string, any>) =>
      serviceHandler<Pet>(() => request.post(endpoints.PET.add(), body)),
    update: (body: Record<string, any>) =>
      serviceHandler<Pet>(() => request.put(endpoints.PET.update(), body)),
    findsByStatus: (status: Array<'available' | 'pending' | 'sold'>) =>
      serviceHandler<Pet>(() =>
        request.get(endpoints.PET.findsByStatus(status)),
      ),
    findsByTags: (tags: Array<string>) =>
      serviceHandler<Pet>(() => request.get(endpoints.PET.findsByTags(tags))),
    getById: (petId: number) =>
      serviceHandler<Pet>(() => request.get(endpoints.PET.getById(petId))),
    updateWithForm: (petId: number) =>
      serviceHandler<Pet>(() =>
        request.post(endpoints.PET.updateWithForm(petId), body),
      ),
    delete: (petId: number) =>
      serviceHandler<Pet>(() => request.delete(endpoints.PET.delete(petId))),
  };
}

export { PetService };
