/**
 * ─── Hyper-Local Risk Zone Database ─────────────────────────────────────────────
 *
 * Ward/pincode-level risk profiles for 6 Indian metro cities.
 * Each zone has:
 * - GPS bounds (lat/lng rectangle)
 * - Historical risk multipliers
 * - Known hazard types
 * - Microclimate factors
 *
 * This replaces the binary "metro/urban" classification with
 * neighborhood-specific granularity.
 */

export type HazardType =
  | "waterlogging"
  | "traffic_bottleneck"
  | "industrial_pollution"
  | "construction"
  | "flood_prone"
  | "heat_island"
  | "coastal_surge"
  | "landslide_risk"
  | "poor_drainage"
  | "dust_pollution";

export interface RiskZone {
  id: string;
  city: string;
  locality: string;
  ward: string;
  pincode: string;
  bounds: {
    latMin: number;
    latMax: number;
    lngMin: number;
    lngMax: number;
  };
  /** Base risk multiplier: 1.0 = average, >1.0 = high risk */
  riskMultiplier: number;
  /** Historical claim density (claims per 1000 users per month) */
  historicalClaimDensity: number;
  /** Known hazard types in this zone */
  hazards: HazardType[];
  /** Microclimate factors */
  microclimate: {
    heatIsland: boolean;
    windCorridor: boolean;
    nearWaterBody: boolean;
    elevatedArea: boolean;
  };
  /** Rain sensitivity multiplier (flood-prone areas react more to rain) */
  rainSensitivity: number;
  /** AQI sensitivity multiplier (industrial areas react more to AQI) */
  aqiSensitivity: number;
  /** Traffic sensitivity multiplier */
  trafficSensitivity: number;
}

export const RISK_ZONES: RiskZone[] = [
  // ─── Delhi NCR ────────────────────────────────────────────────────────────────
  {
    id: "del_cp",
    city: "Delhi",
    locality: "Connaught Place",
    ward: "Ward 25",
    pincode: "110001",
    bounds: { latMin: 28.625, latMax: 28.640, lngMin: 77.210, lngMax: 77.225 },
    riskMultiplier: 1.3,
    historicalClaimDensity: 47,
    hazards: ["traffic_bottleneck", "heat_island", "poor_drainage"],
    microclimate: { heatIsland: true, windCorridor: false, nearWaterBody: false, elevatedArea: false },
    rainSensitivity: 1.4,
    aqiSensitivity: 1.2,
    trafficSensitivity: 1.5,
  },
  {
    id: "del_dwarka",
    city: "Delhi",
    locality: "Dwarka",
    ward: "Ward 47",
    pincode: "110075",
    bounds: { latMin: 28.570, latMax: 28.605, lngMin: 77.030, lngMax: 77.065 },
    riskMultiplier: 1.1,
    historicalClaimDensity: 32,
    hazards: ["waterlogging", "construction"],
    microclimate: { heatIsland: false, windCorridor: true, nearWaterBody: false, elevatedArea: false },
    rainSensitivity: 1.5,
    aqiSensitivity: 0.9,
    trafficSensitivity: 1.0,
  },
  {
    id: "del_rohini",
    city: "Delhi",
    locality: "Rohini",
    ward: "Ward 6",
    pincode: "110085",
    bounds: { latMin: 28.715, latMax: 28.745, lngMin: 77.095, lngMax: 77.130 },
    riskMultiplier: 1.2,
    historicalClaimDensity: 38,
    hazards: ["waterlogging", "dust_pollution", "poor_drainage"],
    microclimate: { heatIsland: true, windCorridor: false, nearWaterBody: false, elevatedArea: false },
    rainSensitivity: 1.6,
    aqiSensitivity: 1.3,
    trafficSensitivity: 1.1,
  },
  {
    id: "del_chandni",
    city: "Delhi",
    locality: "Chandni Chowk",
    ward: "Ward 82",
    pincode: "110006",
    bounds: { latMin: 28.648, latMax: 28.663, lngMin: 77.220, lngMax: 77.240 },
    riskMultiplier: 1.5,
    historicalClaimDensity: 62,
    hazards: ["traffic_bottleneck", "waterlogging", "poor_drainage", "heat_island"],
    microclimate: { heatIsland: true, windCorridor: false, nearWaterBody: true, elevatedArea: false },
    rainSensitivity: 1.8,
    aqiSensitivity: 1.4,
    trafficSensitivity: 1.7,
  },
  {
    id: "del_itogate",
    city: "Delhi",
    locality: "ITO / Ring Road",
    ward: "Ward 72",
    pincode: "110002",
    bounds: { latMin: 28.620, latMax: 28.640, lngMin: 77.235, lngMax: 77.255 },
    riskMultiplier: 1.3,
    historicalClaimDensity: 44,
    hazards: ["traffic_bottleneck", "waterlogging"],
    microclimate: { heatIsland: true, windCorridor: false, nearWaterBody: true, elevatedArea: false },
    rainSensitivity: 1.4,
    aqiSensitivity: 1.1,
    trafficSensitivity: 1.6,
  },
  {
    id: "del_anand_vihar",
    city: "Delhi",
    locality: "Anand Vihar",
    ward: "Ward 18",
    pincode: "110092",
    bounds: { latMin: 28.640, latMax: 28.660, lngMin: 77.300, lngMax: 77.325 },
    riskMultiplier: 1.4,
    historicalClaimDensity: 55,
    hazards: ["industrial_pollution", "dust_pollution", "traffic_bottleneck"],
    microclimate: { heatIsland: true, windCorridor: false, nearWaterBody: false, elevatedArea: false },
    rainSensitivity: 1.1,
    aqiSensitivity: 1.8,
    trafficSensitivity: 1.3,
  },
  {
    id: "del_mayur_vihar",
    city: "Delhi",
    locality: "Mayur Vihar",
    ward: "Ward 60",
    pincode: "110091",
    bounds: { latMin: 28.590, latMax: 28.620, lngMin: 77.290, lngMax: 77.315 },
    riskMultiplier: 1.2,
    historicalClaimDensity: 35,
    hazards: ["waterlogging", "poor_drainage"],
    microclimate: { heatIsland: false, windCorridor: false, nearWaterBody: true, elevatedArea: false },
    rainSensitivity: 1.5,
    aqiSensitivity: 1.1,
    trafficSensitivity: 1.0,
  },
  {
    id: "del_nehru_place",
    city: "Delhi",
    locality: "Nehru Place",
    ward: "Ward 65",
    pincode: "110019",
    bounds: { latMin: 28.545, latMax: 28.560, lngMin: 77.245, lngMax: 77.260 },
    riskMultiplier: 1.1,
    historicalClaimDensity: 29,
    hazards: ["traffic_bottleneck"],
    microclimate: { heatIsland: false, windCorridor: false, nearWaterBody: false, elevatedArea: false },
    rainSensitivity: 1.0,
    aqiSensitivity: 1.0,
    trafficSensitivity: 1.4,
  },

  // ─── Mumbai ───────────────────────────────────────────────────────────────────
  {
    id: "mum_bandra",
    city: "Mumbai",
    locality: "Bandra",
    ward: "H/W",
    pincode: "400050",
    bounds: { latMin: 19.050, latMax: 19.070, lngMin: 72.825, lngMax: 72.850 },
    riskMultiplier: 1.4,
    historicalClaimDensity: 58,
    hazards: ["flood_prone", "waterlogging", "coastal_surge"],
    microclimate: { heatIsland: false, windCorridor: true, nearWaterBody: true, elevatedArea: false },
    rainSensitivity: 2.0,
    aqiSensitivity: 0.8,
    trafficSensitivity: 1.3,
  },
  {
    id: "mum_dadar",
    city: "Mumbai",
    locality: "Dadar",
    ward: "G/N",
    pincode: "400014",
    bounds: { latMin: 19.015, latMax: 19.030, lngMin: 72.840, lngMax: 72.855 },
    riskMultiplier: 1.5,
    historicalClaimDensity: 64,
    hazards: ["flood_prone", "traffic_bottleneck", "waterlogging", "poor_drainage"],
    microclimate: { heatIsland: true, windCorridor: false, nearWaterBody: true, elevatedArea: false },
    rainSensitivity: 1.9,
    aqiSensitivity: 1.0,
    trafficSensitivity: 1.5,
  },
  {
    id: "mum_andheri",
    city: "Mumbai",
    locality: "Andheri",
    ward: "K/W",
    pincode: "400053",
    bounds: { latMin: 19.110, latMax: 19.135, lngMin: 72.825, lngMax: 72.865 },
    riskMultiplier: 1.3,
    historicalClaimDensity: 45,
    hazards: ["waterlogging", "traffic_bottleneck"],
    microclimate: { heatIsland: false, windCorridor: true, nearWaterBody: false, elevatedArea: false },
    rainSensitivity: 1.7,
    aqiSensitivity: 0.9,
    trafficSensitivity: 1.4,
  },
  {
    id: "mum_sion",
    city: "Mumbai",
    locality: "Sion / Matunga",
    ward: "F/N",
    pincode: "400022",
    bounds: { latMin: 19.035, latMax: 19.050, lngMin: 72.855, lngMax: 72.875 },
    riskMultiplier: 1.6,
    historicalClaimDensity: 71,
    hazards: ["flood_prone", "waterlogging", "poor_drainage"],
    microclimate: { heatIsland: false, windCorridor: false, nearWaterBody: true, elevatedArea: false },
    rainSensitivity: 2.2,
    aqiSensitivity: 0.9,
    trafficSensitivity: 1.2,
  },

  // ─── Bangalore ────────────────────────────────────────────────────────────────
  {
    id: "blr_koramangala",
    city: "Bangalore",
    locality: "Koramangala",
    ward: "Ward 150",
    pincode: "560034",
    bounds: { latMin: 12.925, latMax: 12.945, lngMin: 77.610, lngMax: 77.635 },
    riskMultiplier: 1.2,
    historicalClaimDensity: 33,
    hazards: ["traffic_bottleneck", "waterlogging"],
    microclimate: { heatIsland: false, windCorridor: false, nearWaterBody: true, elevatedArea: true },
    rainSensitivity: 1.4,
    aqiSensitivity: 0.8,
    trafficSensitivity: 1.5,
  },
  {
    id: "blr_whitefield",
    city: "Bangalore",
    locality: "Whitefield",
    ward: "Ward 82",
    pincode: "560066",
    bounds: { latMin: 12.950, latMax: 12.985, lngMin: 77.725, lngMax: 77.760 },
    riskMultiplier: 1.3,
    historicalClaimDensity: 40,
    hazards: ["traffic_bottleneck", "waterlogging", "construction"],
    microclimate: { heatIsland: false, windCorridor: false, nearWaterBody: false, elevatedArea: true },
    rainSensitivity: 1.5,
    aqiSensitivity: 0.7,
    trafficSensitivity: 1.6,
  },
  {
    id: "blr_majestic",
    city: "Bangalore",
    locality: "Majestic / KR Market",
    ward: "Ward 108",
    pincode: "560009",
    bounds: { latMin: 12.970, latMax: 12.985, lngMin: 77.565, lngMax: 77.580 },
    riskMultiplier: 1.4,
    historicalClaimDensity: 52,
    hazards: ["traffic_bottleneck", "waterlogging", "poor_drainage"],
    microclimate: { heatIsland: true, windCorridor: false, nearWaterBody: false, elevatedArea: false },
    rainSensitivity: 1.6,
    aqiSensitivity: 1.1,
    trafficSensitivity: 1.7,
  },
  {
    id: "blr_silk_board",
    city: "Bangalore",
    locality: "Silk Board Junction",
    ward: "Ward 191",
    pincode: "560068",
    bounds: { latMin: 12.910, latMax: 12.925, lngMin: 77.615, lngMax: 77.630 },
    riskMultiplier: 1.5,
    historicalClaimDensity: 68,
    hazards: ["traffic_bottleneck", "waterlogging"],
    microclimate: { heatIsland: true, windCorridor: false, nearWaterBody: false, elevatedArea: false },
    rainSensitivity: 1.3,
    aqiSensitivity: 1.0,
    trafficSensitivity: 2.0,
  },

  // ─── Chennai ──────────────────────────────────────────────────────────────────
  {
    id: "che_tnagar",
    city: "Chennai",
    locality: "T. Nagar",
    ward: "Ward 134",
    pincode: "600017",
    bounds: { latMin: 13.035, latMax: 13.050, lngMin: 80.225, lngMax: 80.245 },
    riskMultiplier: 1.4,
    historicalClaimDensity: 48,
    hazards: ["flood_prone", "waterlogging", "traffic_bottleneck"],
    microclimate: { heatIsland: true, windCorridor: false, nearWaterBody: false, elevatedArea: false },
    rainSensitivity: 1.8,
    aqiSensitivity: 0.8,
    trafficSensitivity: 1.4,
  },
  {
    id: "che_velachery",
    city: "Chennai",
    locality: "Velachery",
    ward: "Ward 173",
    pincode: "600042",
    bounds: { latMin: 12.970, latMax: 12.990, lngMin: 80.215, lngMax: 80.235 },
    riskMultiplier: 1.7,
    historicalClaimDensity: 82,
    hazards: ["flood_prone", "waterlogging", "poor_drainage"],
    microclimate: { heatIsland: false, windCorridor: false, nearWaterBody: true, elevatedArea: false },
    rainSensitivity: 2.5,
    aqiSensitivity: 0.7,
    trafficSensitivity: 1.2,
  },
  {
    id: "che_adyar",
    city: "Chennai",
    locality: "Adyar",
    ward: "Ward 171",
    pincode: "600020",
    bounds: { latMin: 13.000, latMax: 13.015, lngMin: 80.245, lngMax: 80.265 },
    riskMultiplier: 1.3,
    historicalClaimDensity: 41,
    hazards: ["flood_prone", "coastal_surge"],
    microclimate: { heatIsland: false, windCorridor: true, nearWaterBody: true, elevatedArea: false },
    rainSensitivity: 1.7,
    aqiSensitivity: 0.7,
    trafficSensitivity: 1.0,
  },

  // ─── Hyderabad ────────────────────────────────────────────────────────────────
  {
    id: "hyd_hitec",
    city: "Hyderabad",
    locality: "HITEC City",
    ward: "Ward 1 (Serilingampally)",
    pincode: "500081",
    bounds: { latMin: 17.435, latMax: 17.455, lngMin: 78.370, lngMax: 78.395 },
    riskMultiplier: 1.2,
    historicalClaimDensity: 31,
    hazards: ["traffic_bottleneck", "construction"],
    microclimate: { heatIsland: false, windCorridor: false, nearWaterBody: false, elevatedArea: true },
    rainSensitivity: 1.1,
    aqiSensitivity: 0.8,
    trafficSensitivity: 1.5,
  },
  {
    id: "hyd_ameerpet",
    city: "Hyderabad",
    locality: "Ameerpet",
    ward: "Ward 78",
    pincode: "500016",
    bounds: { latMin: 17.430, latMax: 17.445, lngMin: 78.440, lngMax: 78.460 },
    riskMultiplier: 1.3,
    historicalClaimDensity: 39,
    hazards: ["traffic_bottleneck", "waterlogging"],
    microclimate: { heatIsland: true, windCorridor: false, nearWaterBody: false, elevatedArea: false },
    rainSensitivity: 1.4,
    aqiSensitivity: 1.0,
    trafficSensitivity: 1.5,
  },

  // ─── Pune ─────────────────────────────────────────────────────────────────────
  {
    id: "pne_hinjewadi",
    city: "Pune",
    locality: "Hinjewadi",
    ward: "Mulshi Range",
    pincode: "411057",
    bounds: { latMin: 18.585, latMax: 18.605, lngMin: 73.710, lngMax: 73.740 },
    riskMultiplier: 1.3,
    historicalClaimDensity: 37,
    hazards: ["traffic_bottleneck", "construction", "waterlogging"],
    microclimate: { heatIsland: false, windCorridor: true, nearWaterBody: false, elevatedArea: true },
    rainSensitivity: 1.3,
    aqiSensitivity: 0.8,
    trafficSensitivity: 1.6,
  },
  {
    id: "pne_swargate",
    city: "Pune",
    locality: "Swargate",
    ward: "Ward 42",
    pincode: "411042",
    bounds: { latMin: 18.495, latMax: 18.510, lngMin: 73.855, lngMax: 73.875 },
    riskMultiplier: 1.4,
    historicalClaimDensity: 46,
    hazards: ["traffic_bottleneck", "waterlogging", "poor_drainage"],
    microclimate: { heatIsland: true, windCorridor: false, nearWaterBody: true, elevatedArea: false },
    rainSensitivity: 1.5,
    aqiSensitivity: 1.0,
    trafficSensitivity: 1.5,
  },
];
