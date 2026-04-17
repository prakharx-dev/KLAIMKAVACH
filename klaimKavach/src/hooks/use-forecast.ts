/**
 * ─── Forecast Hook ──────────────────────────────────────────────────────────────
 *
 * Uses Open-Meteo API (free, no key required) for predictive risk:
 * - Hourly precipitation probability for next 24 hours
 * - Temperature and wind forecasts
 * - Predictive risk warnings ("Rain expected in 3 hours")
 */

import { useEffect, useState, useCallback, useRef } from "react";

const REFRESH_INTERVAL = 10 * 60_000; // 10 minutes

const DEFAULT_LAT = 28.6139;
const DEFAULT_LON = 77.209;

export interface HourlyForecast {
  time: string;
  hour: number;
  precipitationProbability: number;
  precipitation: number;
  temperature: number;
  windSpeed: number;
  weatherCode: number;
  isRisky: boolean;
}

export interface ForecastState {
  hourly: HourlyForecast[];
  nextRiskHour: number | null; // Hours from now until next risky period
  nextRiskDescription: string;
  peakRainProbability: number;
  averageRisk: number; // 0-100
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

function getWeatherDescription(code: number): string {
  if (code <= 3) return "Clear";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain Showers";
  if (code <= 86) return "Snow Showers";
  if (code >= 95) return "Thunderstorm";
  return "Unknown";
}

export function useForecast(lat?: number, lon?: number) {
  const [state, setState] = useState<ForecastState>({
    hourly: [],
    nextRiskHour: null,
    nextRiskDescription: "No risk detected in next 24h",
    peakRainProbability: 0,
    averageRisk: 0,
    isLoading: true,
    error: null,
    lastUpdated: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const fetchForecast = useCallback(async () => {
    const useLat = lat ?? DEFAULT_LAT;
    const useLon = lon ?? DEFAULT_LON;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${useLat}&longitude=${useLon}&hourly=temperature_2m,precipitation_probability,precipitation,windspeed_10m,weathercode&timezone=auto&forecast_hours=24`,
        { signal: abortRef.current.signal },
      );

      if (!res.ok) throw new Error(`Forecast: ${res.status}`);

      const data = await res.json();
      const hourly = data.hourly;

      if (!hourly?.time) throw new Error("No forecast data");

      const currentHour = new Date().getHours();
      const forecasts: HourlyForecast[] = [];

      for (let i = 0; i < hourly.time.length; i++) {
        const precipProb = hourly.precipitation_probability?.[i] ?? 0;
        const precip = hourly.precipitation?.[i] ?? 0;
        const wind = hourly.windspeed_10m?.[i] ?? 0;
        const code = hourly.weathercode?.[i] ?? 0;
        const temp = hourly.temperature_2m?.[i] ?? 0;

        const isRisky =
          precipProb > 60 || precip > 5 || wind > 40 || code >= 80;

        forecasts.push({
          time: hourly.time[i],
          hour: new Date(hourly.time[i]).getHours(),
          precipitationProbability: precipProb,
          precipitation: precip,
          temperature: Math.round(temp),
          windSpeed: Math.round(wind),
          weatherCode: code,
          isRisky,
        });
      }

      // Find next risky hour
      const now = Date.now();
      let nextRiskHour: number | null = null;
      let nextRiskDesc = "No risk detected in next 24h";

      for (const f of forecasts) {
        if (f.isRisky) {
          const forecastTime = new Date(f.time).getTime();
          const hoursFromNow = Math.max(
            0,
            Math.round((forecastTime - now) / 3_600_000),
          );

          if (hoursFromNow === 0) {
            nextRiskHour = 0;
            nextRiskDesc = `Active: ${getWeatherDescription(f.weatherCode)} — ${f.precipitationProbability}% rain probability`;
          } else if (nextRiskHour === null) {
            nextRiskHour = hoursFromNow;
            nextRiskDesc = `${getWeatherDescription(f.weatherCode)} expected in ${hoursFromNow}h — ${f.precipitationProbability}% probability`;
          }
          break;
        }
      }

      const peakRainProb = Math.max(
        ...forecasts.map((f) => f.precipitationProbability),
        0,
      );

      const avgRisk =
        forecasts.length > 0
          ? Math.round(
              forecasts.reduce(
                (sum, f) =>
                  sum +
                  (f.precipitationProbability * 0.4 +
                    Math.min(100, f.precipitation * 5) * 0.3 +
                    Math.min(100, f.windSpeed * 1.5) * 0.2 +
                    (f.weatherCode >= 80 ? 50 : 0) * 0.1),
                0,
              ) / forecasts.length,
            )
          : 0;

      setState({
        hourly: forecasts,
        nextRiskHour,
        nextRiskDescription: nextRiskDesc,
        peakRainProbability: peakRainProb,
        averageRisk: Math.min(100, avgRisk),
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch forecast",
      }));
    }
  }, [lat, lon]);

  useEffect(() => {
    fetchForecast();
    const id = setInterval(fetchForecast, REFRESH_INTERVAL);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [fetchForecast]);

  return state;
}
