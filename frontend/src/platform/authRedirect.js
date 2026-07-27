// Platform seam for "session ended — send the user to a screen" navigation.
//
// Web implementation, backed by window.location. React Native will supply an
// implementation backed by a navigation ref exposing these same methods, so
// the shared service layer never touches window.location directly.
//
// Each method is idempotent about the current location: it only navigates if
// the user isn't already on the target screen (avoids redirect loops).
export const authRedirect = {
  toLogin: () => {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  },
  toPasswordChange: () => {
    if (window.location.pathname !== '/force-password-change') {
      window.location.href = '/force-password-change';
    }
  },
};
