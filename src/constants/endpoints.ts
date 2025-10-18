// Base URL for the Petstore API
const BASE_URL = "https://petstore.swagger.io/v2";

export const endpoints = {
  PET: {
    ADD_PET: () => `${BASE_URL}/pet`,
    UPDATE_PET: () => `${BASE_URL}/pet`,
    FIND_PETS_BY_STATUS: (params: { status: string[] }) =>
      `${BASE_URL}/pet/findByStatus?status=${params.status.join(",")}`,
    FIND_PETS_BY_TAGS: (params: { tags: string[] }) =>
      `${BASE_URL}/pet/findByTags?tags=${params.tags.join(",")}`,
    GET_PET_BY_ID: (params: { petId: number }) =>
      `${BASE_URL}/pet/${params.petId}`,
    UPDATE_PET_WITH_FORM: (params: { petId: number }) =>
      `${BASE_URL}/pet/${params.petId}`,
    DELETE_PET: (params: { petId: number }) =>
      `${BASE_URL}/pet/${params.petId}`,
    UPLOAD_IMAGE: (params: { petId: number }) =>
      `${BASE_URL}/pet/${params.petId}/uploadImage`,
  },
  // Add other endpoint groups (e.g., STORE, USER) as needed
  USER: {
    // Example: GET_USER: () => `${BASE_URL}/user`,
  },
  STORE: {
    // Example: GET_INVENTORY: () => `${BASE_URL}/store/inventory`,
  },
};
