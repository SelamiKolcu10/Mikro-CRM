import * as SecureStore from 'expo-secure-store';

// Mobile twin of the web token seam (frontend/src/platform/tokenStorage.js).
// Same async contract — the shared service layer doesn't know or care whether
// the token lives in localStorage (web) or the device keychain (here).
const TOKEN_KEY = 'micro-crm-token';

export const tokenStorage = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token) => SecureStore.setItemAsync(TOKEN_KEY, token),
  remove: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};
