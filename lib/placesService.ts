// Places API (New) Client Integration
// Uses https://places.googleapis.com/v1/ endpoints (replaces deprecated legacy AutocompleteService & PlacesService)

export interface PlaceSuggestionItem {
  placeId: string;
  name: string;
  address: string;
}

export interface PlaceLocationDetails {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

// Generate standard UUID v4 for Places API (New) session billing optimization
export function generatePlacesSessionToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Places API (New) Autocomplete
 * POST https://places.googleapis.com/v1/places:autocomplete
 */
export async function searchPlacesNew(
  input: string,
  apiKey: string,
  sessionToken?: string
): Promise<PlaceSuggestionItem[]> {
  const cleanInput = input?.trim();
  if (!cleanInput || !apiKey) return [];

  const url = "https://places.googleapis.com/v1/places:autocomplete";
  const body: any = {
    input: cleanInput,
    locationBias: {
      circle: {
        center: { latitude: 8.4772, longitude: 124.6459 }, // Cagayan de Oro City Hall / Plaza Divisoria
        radius: 25000.0 // 25km radius covering CDO, Lapasan, Gusa, Uptown, Bulua
      }
    },
    includedRegionCodes: ["ph"]
  };

  if (sessionToken) {
    body.sessionToken = sessionToken;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      console.warn("Places API (New) autocomplete HTTP", res.status);
      return [];
    }

    const data = await res.json();
    const suggestions: PlaceSuggestionItem[] = [];

    if (Array.isArray(data.suggestions)) {
      for (const item of data.suggestions) {
        const pred = item.placePrediction;
        if (pred && pred.placeId) {
          suggestions.push({
            placeId: pred.placeId,
            name: pred.structuredFormat?.mainText?.text || pred.text?.text || "Location",
            address: pred.structuredFormat?.secondaryText?.text || pred.text?.text || ""
          });
        }
      }
    }

    return suggestions;
  } catch (err) {
    console.warn("Places API (New) network warning:", err);
    return [];
  }
}

/**
 * Places API (New) Place Details
 * GET https://places.googleapis.com/v1/places/{placeId}
 */
export async function getPlaceNewDetails(
  placeId: string,
  apiKey: string,
  sessionToken?: string
): Promise<PlaceLocationDetails | null> {
  if (!placeId || !apiKey) return null;

  let url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=id,displayName,formattedAddress,location&key=${encodeURIComponent(apiKey)}`;
  if (sessionToken) {
    url += `&sessionToken=${encodeURIComponent(sessionToken)}`;
  }

  try {
    const res = await fetch(url, {
      headers: {
        "X-Goog-FieldMask": "id,displayName,formattedAddress,location"
      }
    });

    if (!res.ok) {
      console.warn("Places API (New) details HTTP", res.status);
      return null;
    }

    const data = await res.json();
    if (data && data.location) {
      return {
        placeId: data.id || placeId,
        name: data.displayName?.text || "",
        address: data.formattedAddress || "",
        latitude: data.location.latitude,
        longitude: data.location.longitude
      };
    }
    return null;
  } catch (err) {
    console.warn("Places API (New) details warning:", err);
    return null;
  }
}
