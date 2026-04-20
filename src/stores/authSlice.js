import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const AUTH_STORAGE_KEY = "evosecure_auth_state";

const defaultState = {
  isAuthenticated: false,
  auth: null,
  runtimeRtspPassword: null,
  challenge: null,
  nc: 0,
  loginAt: null,
};

export const useAuthStore = create(
  persist(
    (set) => ({
      ...defaultState,
      setSession: ({ username, digestSecret, challenge, rtspPassword }) =>
        set((state) => ({
          ...state,
          isAuthenticated: true,
          auth: {
            username,
            digestSecret,
          },
          runtimeRtspPassword: typeof rtspPassword === "string" ? rtspPassword : null,
          challenge: challenge || state.challenge,
          nc: 0,
          loginAt: Date.now(),
        })),
      updateChallenge: (challenge) =>
        set((state) => ({
          ...state,
          challenge,
          nc: 0,
        })),
      updateNc: (nc) =>
        set((state) => ({
          ...state,
          nc,
        })),
      clearSession: () =>
        set(() => ({
          ...defaultState,
        })),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        auth: state.auth,
        challenge: state.challenge,
        nc: state.nc,
        loginAt: state.loginAt,
      }),
    },
  ),
);

export const authStore = {
  getState: useAuthStore.getState,
  subscribe: useAuthStore.subscribe,
  actions: {
    setSession(payload) {
      useAuthStore.getState().setSession(payload);
    },
    updateChallenge(challenge) {
      useAuthStore.getState().updateChallenge(challenge);
    },
    updateNc(nc) {
      useAuthStore.getState().updateNc(nc);
    },
    clearSession() {
      useAuthStore.getState().clearSession();
    },
  },
};
