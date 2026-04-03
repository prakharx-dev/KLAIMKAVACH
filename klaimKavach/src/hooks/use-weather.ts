import { useEffect, useState, useRef, useCallback } from "react";

const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY as string;
const AQICN_API_KEY = import.meta.env.VITE_AQICN_API_KEY as string;
const REFRESH_INTERVAL = 60_000;

export interface WeatherData {
  city: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
  rain1h: number;
  aqi: number;
  aqiLabel: string;
  pm25: number;
  pm10: number;
  lat: number;
  lon: number;
  updatedAt: Date;
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_LAT = 28.6139;
const DEFAULT_LON = 77.209;

function getAQILabel(aqi: number): string {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Satisfactory";
  if (aqi <= 200) return "Moderate";
  if (aqi <= 300) return "Poor";
  if (aqi <= 400) return "Very Poor";
  return "Severe";
}

// Fallback: get approximate location from IP (no key needed)
async function getLocationFromIP(): Promise<{ lat: number; lon: number; city: string } | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      lat: data.latitude ?? DEFAULT_LAT,
      lon: data.longitude ?? DEFAULT_LON,
      city: data.city ?? "Unknown",
    };
  } catch {
    return null;
  }
}

export function useWeather() {
  const [data, setData] = useState<WeatherData>({
    city: "—",
    temp: 0,
    feelsLike: 0,
    humidity: 0,
    windSpeed: 0,
    description: "",
    icon: "01d",
    rain1h: 0,
    aqi: 0,
    aqiLabel: "—",
    pm25: 0,
    pm10: 0,
    lat: DEFAULT_LAT,
    lon: DEFAULT_LON,
    updatedAt: new Date(),
    isLoading: true,
    error: null,
  });

  const coordsRef = useRef({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
  const retryCountRef = useRef(0);

  const fetchWeather = useCallback(async (lat: number, lon: number, cityHint?: string) => {
    try {
      const [weatherRes, aqiRes] = await Promise.all([
        fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
        ),
        fetch(
          `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${AQICN_API_KEY}`
        ),
      ]);

      if (weatherRes.status === 401) {
        // API key not yet activated — show error with city from IP
        setData((prev) => ({
          ...prev,
          city: cityHint || prev.city || "—",
          lat,
          lon,
          isLoading: false,
          error: "API key activating — weather data will appear within 1-2 hours",
        }));
        return;
      }

      if (!weatherRes.ok) throw new Error(`Weather: ${weatherRes.status}`);
      if (!aqiRes.ok) throw new Error(`AQI: ${aqiRes.status}`);

      const weather = await weatherRes.json();
      const aqiData = await aqiRes.json();

      let aqi = 0;
      let pm25 = 0;
      let pm10 = 0;

      if (aqiData.status === "ok") {
        const val = aqiData.data.aqi;
        aqi = typeof val === "number" ? val : parseInt(val, 10) || 0;
        pm25 = aqiData.data.iaqi?.pm25?.v ?? 0;
        pm10 = aqiData.data.iaqi?.pm10?.v ?? 0;
      }
      const label = getAQILabel(aqi);

      retryCountRef.current = 0; // Reset on success

      setData({
        city: weather.name || cityHint || "Unknown",
        temp: Math.round(weather.main?.temp ?? 0),
        feelsLike: Math.round(weather.main?.feels_like ?? 0),
        humidity: weather.main?.humidity ?? 0,
        windSpeed: Math.round((weather.wind?.speed ?? 0) * 3.6),
        description: weather.weather?.[0]?.description ?? "",
        icon: weather.weather?.[0]?.icon ?? "01d",
        rain1h: weather.rain?.["1h"] ?? 0,
        aqi,
        aqiLabel: label,
        pm25: Math.round(pm25),
        pm10: Math.round(pm10),
        lat,
        lon,
        updatedAt: new Date(),
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setData((prev) => ({
        ...prev,
        city: cityHint || prev.city || "—",
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch weather",
      }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 1) Try IP geolocation first (fast, no permissions needed)
      const ipLoc = await getLocationFromIP();
      if (cancelled) return;

      if (ipLoc) {
        coordsRef.current = { lat: ipLoc.lat, lon: ipLoc.lon };
        fetchWeather(ipLoc.lat, ipLoc.lon, ipLoc.city);
      } else {
        // Fallback to Delhi
        fetchWeather(DEFAULT_LAT, DEFAULT_LON, "New Delhi");
      }

      // 2) Also try browser geolocation in background for better accuracy
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            const { latitude, longitude } = pos.coords;
            coordsRef.current = { lat: latitude, lon: longitude };
            fetchWeather(latitude, longitude);
          },
          () => { /* Already have IP-based data, do nothing */ },
          { timeout: 8000, maximumAge: 300_000 }
        );
      }
    }

    init();

    // 3) Refresh on interval
    const id = setInterval(() => {
      fetchWeather(coordsRef.current.lat, coordsRef.current.lon);
    }, REFRESH_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fetchWeather]);

  return data;
}
