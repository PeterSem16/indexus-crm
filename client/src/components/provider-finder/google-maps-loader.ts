type GoogleMapsApi = {
  importLibrary: (name: "maps" | "marker" | "core") => Promise<any>;
  event?: { clearInstanceListeners?: (instance: object) => void };
};
type LoaderState = {
  promise: Promise<GoogleMapsApi>;
  timer: number;
};

declare global {
  interface Window {
    google?: { maps?: GoogleMapsApi };
    gm_authFailure?: () => void;
    __indexusProviderMapsReady?: () => void;
  }
}

let loader: LoaderState | undefined;
const authFailureListeners = new Set<() => void>();
let previousAuthFailure: (() => void) | undefined;

function dispatchAuthFailure() {
  for (const listener of [...authFailureListeners]) listener();
}

function subscribeAuthFailure(listener: () => void) {
  let active = true;
  if (!authFailureListeners.size) {
    previousAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      try { previousAuthFailure?.(); } catch { /* Keep third-party callback details out of the UI. */ }
      dispatchAuthFailure();
    };
  }
  authFailureListeners.add(listener);
  return () => {
    if (!active) return;
    active = false;
    authFailureListeners.delete(listener);
    if (!authFailureListeners.size && window.gm_authFailure) {
      window.gm_authFailure = previousAuthFailure;
      previousAuthFailure = undefined;
    }
  };
}

export function onGoogleMapsAuthorizationFailure(listener: () => void) {
  return subscribeAuthFailure(listener);
}

export function loadGoogleMaps(browserKey: string): Promise<GoogleMapsApi> {
  const existingMaps = window.google?.maps;
  if (existingMaps?.importLibrary) return Promise.resolve(existingMaps);
  if (loader) return loader.promise;

  let resolveLoader!: (maps: GoogleMapsApi) => void;
  let rejectLoader!: (error: Error) => void;
  const promise = new Promise<GoogleMapsApi>((resolve, reject) => {
    resolveLoader = resolve;
    rejectLoader = reject;
  });
  const script = document.createElement("script");
  const state = { promise, timer: 0 };
  loader = state;
  let unsubscribeAuth = () => {};
  let readyCallback = () => {};
  const previousReady = window.__indexusProviderMapsReady;
  const removeReadyCallback = () => {
    if (window.__indexusProviderMapsReady === readyCallback) {
      if (previousReady) window.__indexusProviderMapsReady = previousReady;
      else delete window.__indexusProviderMapsReady;
    }
  };
  const fail = (code: "maps_auth" | "maps_unavailable") => {
    if (loader !== state) return;
    window.clearTimeout(state.timer);
    unsubscribeAuth();
    removeReadyCallback();
    script.onerror = null;
    script.onload = null;
    script.remove();
    loader = undefined;
    rejectLoader(new Error(code));
  };
  readyCallback = () => {
    if (loader !== state) return;
    const maps = window.google?.maps;
    if (!maps?.importLibrary) {
      fail("maps_unavailable");
      return;
    }
    window.clearTimeout(state.timer);
    removeReadyCallback();
    script.onerror = null;
    loader = undefined;
    unsubscribeAuth();
    resolveLoader(maps);
  };

  state.timer = window.setTimeout(() => fail("maps_unavailable"), 18000);
  unsubscribeAuth = subscribeAuthFailure(() => {
    if (loader === state) {
      unsubscribeAuth();
      fail("maps_auth");
    }
  });
  script.async = true;
  window.__indexusProviderMapsReady = readyCallback;
  script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({
    key: browserKey,
    v: "weekly",
    loading: "async",
    callback: "__indexusProviderMapsReady",
  }).toString()}`;
  script.onerror = () => {
    fail("maps_unavailable");
  };
  document.head.appendChild(script);
  return promise;
}

export async function importGoogleMapsLibraries(google: GoogleMapsApi) {
  let timeout = 0;
  let unsubscribeAuth = () => {};
  const authFailure = new Promise<never>((_, reject) => {
    unsubscribeAuth = subscribeAuthFailure(() => {
      unsubscribeAuth();
      reject(new Error("maps_auth"));
    });
  });
  const timeoutFailure = new Promise<never>((_, reject) => {
    timeout = window.setTimeout(() => reject(new Error("maps_unavailable")), 18000);
  });
  try {
    const libraries = await Promise.race([
      Promise.all([
        google.importLibrary("maps"),
        google.importLibrary("marker"),
        google.importLibrary("core"),
      ]),
      authFailure,
      timeoutFailure,
    ]);
    return libraries;
  } finally {
    window.clearTimeout(timeout);
    unsubscribeAuth();
  }
}
