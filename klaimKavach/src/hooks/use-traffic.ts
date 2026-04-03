import { useEffect, useState, useRef, useCallback } from "react";

const API_KEY = import.meta.env.VITE_TOMTOM_API_KEY as string;
const REFRESH_INTERVAL = 60_000;

export interface TrafficData {
  currentSpeed: number;
  freeFlowSpeed: number;
  congestionLevel: number; // 0 to 100
  status: string; // e.g., "Normal", "Moderate", "Heavy"
  isLoading: boolean;
  error: string | null;
  updatedAt: Date;
}

const DEFAULT_LAT = 28.6139;
const DEFAULT_LON = 77.209;

// Fallback logic to get coordinates if not available
async function getLocationFromIP(): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      lat: data.latitude ?? DEFAULT_LAT,
      lon: data.longitude ?? DEFAULT_LON,
    };
  } catch {
    return null;
  }
}

export function useTraffic() {
  const [data, setData] = useState<TrafficData>({
    currentSpeed: 0,
    freeFlowSpeed: 0,
    congestionLevel: 0,
    status: "—",
    isLoading: true,
    error: null,
    updatedAt: new Date(),
  });

  const coordsRef = useRef({ lat: DEFAULT_LAT, lon: DEFAULT_LON });

  const fetchTraffic = useCallback(async (lat: number, lon: number) => {
    if (!API_KEY) {
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: "TomTom API Key missing",
      }));
      return;
    }

    try {
      const res = await fetch(
        `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${API_KEY}&point=${lat},${lon}`
      );

      if (res.status === 403 || res.status === 401) {
        setData((prev) => ({
          ...prev,
          isLoading: false,
          error: "Invalid TomTom API key",
        }));
        return;
      }

      if (!res.ok) throw new Error(`Traffic: ${res.status}`);

      const json = await res.json();
      const flow = json.flowSegmentData;

      if (!flow) throw new Error("No traffic data for this area");

      const currentSpeed = flow.currentSpeed;
      const freeFlowSpeed = flow.freeFlowSpeed;
      
      let congestionLevel = 0;
      if (freeFlowSpeed > 0 && currentSpeed < freeFlowSpeed) {
        congestionLevel = Math.round(((freeFlowSpeed - currentSpeed) / freeFlowSpeed) * 100);
      }

      let status = "Normal";
      if (congestionLevel > 50) status = "Heavy";
      else if (congestionLevel > 20) status = "Moderate";

      setData({
        currentSpeed,
        freeFlowSpeed,
        congestionLevel,
        status,
        isLoading: false,
        error: null,
        updatedAt: new Date(),
      });
    } catch (err) {
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch traffic",
      }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Try IP geolocation first
      const ipLoc = await getLocationFromIP();
      if (cancelled) return;

      if (ipLoc) {
        coordsRef.current = { lat: ipLoc.lat, lon: ipLoc.lon };
        fetchTraffic(ipLoc.lat, ipLoc.lon);
      } else {
        fetchTraffic(DEFAULT_LAT, DEFAULT_LON);
      }

      // Geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            const { latitude, longitude } = pos.coords;
            coordsRef.current = { lat: latitude, lon: longitude };
            fetchTraffic(latitude, longitude);
          },
          () => {},
          { timeout: 8000, maximumAge: 300_000 }
        );
      }
    }

    init();

    const id = setInterval(() => {
      fetchTraffic(coordsRef.current.lat, coordsRef.current.lon);
    }, REFRESH_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fetchTraffic]);

  return data;
}
