// Platform seam for auth-token persistence.
//
// Web implementation, backed by localStorage. The React Native app will
// supply its own implementation (expo-secure-store / AsyncStorage) exposing
// this same async-shaped API, so the shared service layer (api.js,
// portalApi.js, invoiceV2Service.js) never touches localStorage directly.
//
// The methods are async on purpose: on web localStorage is synchronous and
// these resolve immediately, but native secure storage is async — keeping the
// contract async means the exact same service code runs on both platforms.
const TOKEN_KEY = 'micro-crm-token';

export const tokenStorage = {
  get: async () => localStorage.getItem(TOKEN_KEY),
  set: async (token) => localStorage.setItem(TOKEN_KEY, token),
  remove: async () => localStorage.removeItem(TOKEN_KEY),
};
