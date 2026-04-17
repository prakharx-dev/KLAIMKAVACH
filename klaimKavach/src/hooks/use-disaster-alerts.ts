/**
 * ─── Disaster Alerts Hook ───────────────────────────────────────────────────────
 *
 * Fetches real-time disaster and severe weather alerts from multiple sources:
 * 1. Open-Meteo Weather Alerts (free, no API key)
 * 2. ReliefWeb API (UN OCHA disaster monitoring for India)
 *
 * Provides government-level alert data that the trigger engine can use
 * to auto-activate coverage during natural disasters.
 */

import { useEffect, useState, useCallback, useRef } from "react";

const REFRESH_INTERVAL = 5 * 60_000; // 5 minutes

export type AlertSeverity = "extreme" | "severe" | "moderate" | "minor";
export type AlertCategory = "weather" | "flood" | "cyclone" | "earthquake" | "heatwave" | "other";

export interface DisasterAlert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  category: AlertCategory;
  source: string;
  region: string;
  isActive: boolean;
  startDate: string;
  url?: string;
}

export interface DisasterAlertState {
  alerts: DisasterAlert[];
  activeCount: number;
  highestSeverity: AlertSeverity | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

function categorizeAlert(title: string, description: string): AlertCategory {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes("cyclone") || text.includes("hurricane")) return "cyclone";
  if (text.includes("flood") || text.includes("deluge")) return "flood";
  if (text.includes("earthquake") || text.includes("seismic")) return "earthquake";
  if (text.includes("heatwave") || text.includes("heat wave")) return "heatwave";
  if (
    text.includes("rain") ||
    text.includes("storm") ||
    text.includes("thunder") ||
    text.includes("weather")
  )
    return "weather";
  return "other";
}

function parseSeverity(text: string): AlertSeverity {
  const lower = text.toLowerCase();
  if (lower.includes("extreme") || lower.includes("red")) return "extreme";
  if (lower.includes("severe") || lower.includes("orange")) return "severe";
  if (lower.includes("moderate") || lower.includes("yellow")) return "moderate";
  return "minor";
}

export function useDisasterAlerts(lat?: number, lon?: number) {
  const [state, setState] = useState<DisasterAlertState>({
    alerts: [],
    activeCount: 0,
    highestSeverity: null,
    isLoading: true,
    error: null,
    lastUpdated: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const fetchAlerts = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const alerts: DisasterAlert[] = [];

      // 1. Open-Meteo Weather Alerts (free, no key)
      if (lat && lon) {
        try {
          const meteoRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,precipitation_sum,windspeed_10m_max&timezone=auto&forecast_days=3`,
            { signal: abortRef.current.signal },
          );

          if (meteoRes.ok) {
            const meteoData = await meteoRes.json();
            const daily = meteoData.daily;

            if (daily) {
              for (let i = 0; i < (daily.time?.length ?? 0); i++) {
                const code = daily.weathercode?.[i] ?? 0;
                const precip = daily.precipitation_sum?.[i] ?? 0;
                const wind = daily.windspeed_10m_max?.[i] ?? 0;
                const maxTemp = daily.temperature_2m_max?.[i] ?? 0;

                // Severe weather codes: 95-99 = thunderstorm, 71-77 = snow, 80-82 = rain showers
                if (code >= 95 || precip > 50 || wind > 60) {
                  alerts.push({
                    id: `meteo_${daily.time[i]}`,
                    title:
                      code >= 95
                        ? "Severe Thunderstorm Warning"
                        : precip > 50
                          ? "Heavy Precipitation Alert"
                          : "High Wind Warning",
                    description: `Forecast for ${daily.time[i]}: ${precip.toFixed(0)}mm precipitation, ${wind.toFixed(0)} km/h winds`,
                    severity:
                      code >= 99 || precip > 100 || wind > 90
                        ? "extreme"
                        : code >= 95 || precip > 50 || wind > 60
                          ? "severe"
                          : "moderate",
                    category: "weather",
                    source: "Open-Meteo Forecast",
                    region: "Local Area",
                    isActive: i === 0, // Today's forecast is active
                    startDate: daily.time[i],
                  });
                }

                // Heatwave detection
                if (maxTemp > 42) {
                  alerts.push({
                    id: `heat_${daily.time[i]}`,
                    title: "Heatwave Alert",
                    description: `Maximum temperature forecast: ${maxTemp.toFixed(1)}°C — extreme heat risk`,
                    severity: maxTemp > 45 ? "extreme" : "severe",
                    category: "heatwave",
                    source: "Open-Meteo Forecast",
                    region: "Local Area",
                    isActive: i === 0,
                    startDate: daily.time[i],
                  });
                }
              }
            }
          }
        } catch {
          // Non-critical — continue with other sources
        }
      }

      // 2. ReliefWeb India Disasters (UN OCHA)
      try {
        const reliefRes = await fetch(
          "https://api.reliefweb.int/v1/disasters?appname=klaimkavach&filter[field]=country&filter[value][]=India&limit=5&sort[]=date:desc",
          { signal: abortRef.current.signal },
        );

        if (reliefRes.ok) {
          const reliefData = await reliefRes.json();
          const disasters = reliefData.data ?? [];

          for (const disaster of disasters) {
            const fields = disaster.fields ?? {};
            const title = fields.name ?? "Unknown Disaster";
            const date = fields.date?.created ?? new Date().toISOString();
            const status = fields.status ?? "current";
            const description = fields.description ?? "";

            // Only include recent/active disasters
            const disasterDate = new Date(date);
            const daysSince =
              (Date.now() - disasterDate.getTime()) / (1000 * 60 * 60 * 24);

            if (daysSince <= 30) {
              alerts.push({
                id: `relief_${disaster.id}`,
                title,
                description: typeof description === "string"
                  ? description.slice(0, 200)
                  : title,
                severity: parseSeverity(title),
                category: categorizeAlert(title, typeof description === "string" ? description : ""),
                source: "ReliefWeb (UN OCHA)",
                region: "India",
                isActive: status === "current",
                startDate: date,
                url: fields.url ?? undefined,
              });
            }
          }
        }
      } catch {
        // Non-critical — continue
      }

      const activeAlerts = alerts.filter((a) => a.isActive);
      const severityOrder: AlertSeverity[] = [
        "extreme",
        "severe",
        "moderate",
        "minor",
      ];
      const highest =
        severityOrder.find((s) =>
          activeAlerts.some((a) => a.severity === s),
        ) ?? null;

      setState({
        alerts,
        activeCount: activeAlerts.length,
        highestSeverity: highest,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch alerts",
      }));
    }
  }, [lat, lon]);

  useEffect(() => {
    fetchAlerts();
    const id = setInterval(fetchAlerts, REFRESH_INTERVAL);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [fetchAlerts]);

  return state;
}
