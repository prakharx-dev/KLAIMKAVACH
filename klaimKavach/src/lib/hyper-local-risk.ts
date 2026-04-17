/**
 * ─── Hyper-Local Risk Engine ────────────────────────────────────────────────────
 *
 * Replaces the binary "metro/urban" classification with pincode/ward-level
 * granularity. Uses distance-weighted nearest zone matching to provide
 * neighborhood-specific risk profiles.
 *
 * Features:
 * - Nearest zone detection via GPS coordinate matching
 * - Distance-weighted risk interpolation
 * - Per-trigger sensitivity multipliers (rain, AQI, traffic)
 * - Historical claim density awareness
 * - Hazard-specific warnings
 */

import { RISK_ZONES, type RiskZone, type HazardType } from "./risk-zone-data";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface HyperLocalRiskProfile {
  /** Whether a matching zone was found */
  matched: boolean;
  /** The nearest risk zone (null if no zones within range) */
  zone: RiskZone | null;
  /** Distance to nearest zone center in km */
  distanceKm: number;
  /** Effective risk multiplier (distance-weighted) */
  effectiveMultiplier: number;
  /** Per-trigger sensitivity */
  rainSensitivity: number;
  aqiSensitivity: number;
  trafficSensitivity: number;
  /** Human-readable location label */
  localityLabel: string;
  /** Active hazards for this location */
  activeHazards: HazardType[];
  /** Historical claim density (claims per 1000 users/month) */
  historicalClaimDensity: number;
  /** Microclimate flags */
  microclimate: {
    heatIsland: boolean;
    windCorridor: boolean;
    nearWaterBody: boolean;
    elevatedArea: boolean;
  };
}

// ─── Haversine Distance ─────────────────────────────────────────────────────────

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getZoneCenter(zone: RiskZone): { lat: number; lng: number } {
  return {
    lat: (zone.bounds.latMin + zone.bounds.latMax) / 2,
    lng: (zone.bounds.lngMin + zone.bounds.lngMax) / 2,
  };
}

function isInsideZone(lat: number, lng: number, zone: RiskZone): boolean {
  return (
    lat >= zone.bounds.latMin &&
    lat <= zone.bounds.latMax &&
    lng >= zone.bounds.lngMin &&
    lng <= zone.bounds.lngMax
  );
}

// ─── Main API ───────────────────────────────────────────────────────────────────

const MAX_RANGE_KM = 15; // Maximum range to consider a zone relevant

/**
 * Get hyper-local risk profile for a given GPS coordinate.
 * Uses nearest-zone matching with distance-weighted interpolation.
 */
export function getHyperLocalRisk(
  lat: number,
  lng: number,
): HyperLocalRiskProfile {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return getDefaultProfile();
  }

  // 1. Check if we're inside any zone
  const insideZone = RISK_ZONES.find((z) => isInsideZone(lat, lng, z));
  if (insideZone) {
    const center = getZoneCenter(insideZone);
    const dist = haversineKm(lat, lng, center.lat, center.lng);

    return {
      matched: true,
      zone: insideZone,
      distanceKm: Math.round(dist * 100) / 100,
      effectiveMultiplier: insideZone.riskMultiplier,
      rainSensitivity: insideZone.rainSensitivity,
      aqiSensitivity: insideZone.aqiSensitivity,
      trafficSensitivity: insideZone.trafficSensitivity,
      localityLabel: `${insideZone.locality}, ${insideZone.city}`,
      activeHazards: insideZone.hazards,
      historicalClaimDensity: insideZone.historicalClaimDensity,
      microclimate: { ...insideZone.microclimate },
    };
  }

  // 2. Find nearest zone
  let nearestZone: RiskZone | null = null;
  let nearestDistance = Infinity;

  for (const zone of RISK_ZONES) {
    const center = getZoneCenter(zone);
    const dist = haversineKm(lat, lng, center.lat, center.lng);

    if (dist < nearestDistance) {
      nearestDistance = dist;
      nearestZone = zone;
    }
  }

  if (!nearestZone || nearestDistance > MAX_RANGE_KM) {
    return getDefaultProfile();
  }

  // 3. Distance-weighted interpolation
  // The further from the zone, the less its risk profile applies
  const proximityFactor = Math.max(0, 1 - nearestDistance / MAX_RANGE_KM);
  const blendedMultiplier =
    1.0 + (nearestZone.riskMultiplier - 1.0) * proximityFactor;

  return {
    matched: true,
    zone: nearestZone,
    distanceKm: Math.round(nearestDistance * 100) / 100,
    effectiveMultiplier: Math.round(blendedMultiplier * 100) / 100,
    rainSensitivity:
      Math.round(
        (1.0 + (nearestZone.rainSensitivity - 1.0) * proximityFactor) * 100,
      ) / 100,
    aqiSensitivity:
      Math.round(
        (1.0 + (nearestZone.aqiSensitivity - 1.0) * proximityFactor) * 100,
      ) / 100,
    trafficSensitivity:
      Math.round(
        (1.0 + (nearestZone.trafficSensitivity - 1.0) * proximityFactor) * 100,
      ) / 100,
    localityLabel:
      proximityFactor > 0.5
        ? `Near ${nearestZone.locality}, ${nearestZone.city}`
        : `${nearestZone.city} (${Math.round(nearestDistance)}km from ${nearestZone.locality})`,
    activeHazards:
      proximityFactor > 0.3 ? nearestZone.hazards : [],
    historicalClaimDensity: Math.round(
      nearestZone.historicalClaimDensity * proximityFactor,
    ),
    microclimate:
      proximityFactor > 0.5
        ? { ...nearestZone.microclimate }
        : {
            heatIsland: false,
            windCorridor: false,
            nearWaterBody: false,
            elevatedArea: false,
          },
  };
}

function getDefaultProfile(): HyperLocalRiskProfile {
  return {
    matched: false,
    zone: null,
    distanceKm: 0,
    effectiveMultiplier: 1.0,
    rainSensitivity: 1.0,
    aqiSensitivity: 1.0,
    trafficSensitivity: 1.0,
    localityLabel: "Unknown Area",
    activeHazards: [],
    historicalClaimDensity: 0,
    microclimate: {
      heatIsland: false,
      windCorridor: false,
      nearWaterBody: false,
      elevatedArea: false,
    },
  };
}

/**
 * Get hazard display label
 */
export function getHazardLabel(hazard: HazardType): string {
  const labels: Record<HazardType, string> = {
    waterlogging: "Waterlogging Risk",
    traffic_bottleneck: "Traffic Bottleneck",
    industrial_pollution: "Industrial Pollution",
    construction: "Active Construction",
    flood_prone: "Flood-Prone Zone",
    heat_island: "Urban Heat Island",
    coastal_surge: "Coastal Surge Risk",
    landslide_risk: "Landslide Risk",
    poor_drainage: "Poor Drainage",
    dust_pollution: "Dust Pollution",
  };
  return labels[hazard] ?? hazard;
}

/**
 * Apply hyper-local multiplier to a risk score
 */
export function applyHyperLocalRisk(
  baseScore: number,
  profile: HyperLocalRiskProfile,
  triggerType: "rain" | "aqi" | "traffic" | "composite",
): number {
  let sensitivity = profile.effectiveMultiplier;

  switch (triggerType) {
    case "rain":
      sensitivity *= profile.rainSensitivity;
      break;
    case "aqi":
      sensitivity *= profile.aqiSensitivity;
      break;
    case "traffic":
      sensitivity *= profile.trafficSensitivity;
      break;
    case "composite":
      sensitivity *=
        (profile.rainSensitivity +
          profile.aqiSensitivity +
          profile.trafficSensitivity) /
        3;
      break;
  }

  return Math.min(100, Math.round(baseScore * sensitivity));
}
