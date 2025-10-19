// Generated service interface for Stuffs
import { PaginationList, ResponseObject } from 'papak/_modulesTypes';
import {
  Stuff,
  StuffsCreateRequest,
  StuffsListParams,
  StuffsRetrieveParams,
} from './models/Stuffs';

// Service interface
export interface IStuffsService {
  stuffsList(
    params: StuffsListParams,
  ): Promise<ResponseObject<PaginationList<Stuff>>>;
  stuffsCreate(body: StuffsCreateRequest): Promise<ResponseObject<Stuff>>;
  stuffsRetrieve(params: StuffsRetrieveParams): Promise<ResponseObject<Stuff>>;
  stuffsDestroy(id: number): Promise<ResponseObject<null>>;
  stuffsDeleteAllDestroy(body: number[]): Promise<ResponseObject<null>>;
}
