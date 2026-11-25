// Singleton Google Maps JavaScript API Loader
// Shared by LiveFleetMap and GoogleMapPicker so the SDK loads once cleanly with consistent options.

declare global {
  interface Window {
    google?: any;
  }
}

let googleMapsPromise: Promise<any> | null = null;

export const JICA_MAP_STYLES = [
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }]
  }
];

export const BASE_GOOGLE_MAP_OPTIONS = {
  mapTypeControl: true,
  streetViewControl: false,
  fullscreenControl: true,
  zoomControl: true,
  clickableIcons: false,
  gestureHandling: "greedy" as const,
  styles: JICA_MAP_STYLES
};

export function loadGoogleMaps(apiKey: string): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window unavailable"));
  }
  if (!apiKey || apiKey === "your_google_maps_api_key_here") {
    return Promise.reject(new Error("Missing Google Maps API key"));
  }
  if (window.google?.maps?.places) {
    return Promise.resolve(window.google);
  }
  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById("google-maps-script") as HTMLScriptElement | null;
    if (existingScript) {
      if (window.google?.maps?.places) {
        resolve(window.google);
        return;
      }
      const onLoad = () => {
        existingScript.removeEventListener("load", onLoad);
        if (window.google?.maps) resolve(window.google);
        else reject(new Error("Google Maps loaded without window.google.maps"));
      };
      const onError = (err: any) => {
        existingScript.removeEventListener("error", onError);
        googleMapsPromise = null;
        reject(err);
      };
      existingScript.addEventListener("load", onLoad);
      existingScript.addEventListener("error", onError);
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google);
      } else {
        googleMapsPromise = null;
        reject(new Error("Google Maps loaded without window.google.maps"));
      }
    };
    script.onerror = (err) => {
      googleMapsPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
