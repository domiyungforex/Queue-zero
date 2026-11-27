export const LOCATION_STATUSES = [
  "WITHIN_RADIUS",
  "OUTSIDE_RADIUS",
  "UNAVAILABLE",
  "INACCURATE",
  "INVALID",
  "CAPTURED",
  "NOT_REQUIRED",
] as const;

export type LocationStatus = (typeof LOCATION_STATUSES)[number];

export type LocationAssessment = {
  status: LocationStatus;
  verified: boolean;
  distanceMeters: number | null;
  message: string;
};

const EARTH_METERS = 6_371_000;

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function finiteCoordinate(value: number | null | undefined, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function assessAttendanceLocation(input: {
  sessionLatitude?: number | null;
  sessionLongitude?: number | null;
  radiusMeters?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
}): LocationAssessment {
  const required = finiteCoordinate(input.sessionLatitude, -90, 90) && finiteCoordinate(input.sessionLongitude, -180, 180);
  const hasLatitude = input.latitude != null;
  const hasLongitude = input.longitude != null;
  if (!hasLatitude && !hasLongitude) {
    return required
      ? { status: "UNAVAILABLE", verified: false, distanceMeters: null, message: "Location was not captured. Allow location access and try again." }
      : { status: "NOT_REQUIRED", verified: false, distanceMeters: null, message: "Location was not required for this session." };
  }
  if (input.latitude == null || input.longitude == null || !finiteCoordinate(input.latitude, -90, 90) || !finiteCoordinate(input.longitude, -180, 180)) {
    return { status: "INVALID", verified: false, distanceMeters: null, message: "The location coordinates were not valid. Try again." };
  }
  if (input.accuracyMeters != null && (!Number.isFinite(input.accuracyMeters) || input.accuracyMeters < 0 || input.accuracyMeters > 100_000)) {
    return { status: "INVALID", verified: false, distanceMeters: null, message: "The location accuracy reading was not valid. Try again." };
  }
  if (!required || input.sessionLatitude == null || input.sessionLongitude == null) {
    return { status: "CAPTURED", verified: false, distanceMeters: null, message: "Location captured. This session has no attendance zone to compare against." };
  }
  const radius = Math.min(5000, Math.max(10, input.radiusMeters ?? 100));
  const distance = Math.round(haversineMeters(input.latitude, input.longitude, input.sessionLatitude, input.sessionLongitude));
  if (input.accuracyMeters != null && input.accuracyMeters > Math.max(radius, 300)) {
    return {
      status: "INACCURATE",
      verified: false,
      distanceMeters: distance,
      message: `GPS accuracy is too low (±${Math.round(input.accuracyMeters)} m) to confirm the attendance zone. Move outdoors and try again.`,
    };
  }
  if (distance <= radius) {
    const accuracy = input.accuracyMeters == null ? "" : `, ±${Math.round(input.accuracyMeters)} m`;
    return { status: "WITHIN_RADIUS", verified: true, distanceMeters: distance, message: `Inside the attendance zone (${distance} m from the class location${accuracy}). This is a GPS reading, not proof of presence by itself.` };
  }
  return {
    status: "OUTSIDE_RADIUS",
    verified: false,
    distanceMeters: distance,
    message: `Outside the attendance zone (${distance} m away; allowed within ${radius} m). Move into the class area and try again.`,
  };
}

export function geolocationFailureMessage(code: number | undefined) {
  if (code === 1) {
    return "Location permission was denied. On iPhone Safari, tap 'aA' in the address bar → Website Settings → Location → Allow (and ensure Settings → Privacy & Security → Location Services is On), then tap Retry Location.";
  }
  if (code === 2) {
    return "Location services are unavailable or disabled on this device. Turn on Location Services in your device settings and tap Retry Location.";
  }
  if (code === 3) {
    return "The GPS request timed out. Move near a window or outdoors for a stronger signal, then tap Retry Location.";
  }
  return "This browser could not read a GPS location. Tap Retry Location to try again.";
}

export function attendanceMapUrl(latitude: number, longitude: number) {
  const lat = latitude.toFixed(6);
  const lng = longitude.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}

export function attendanceLocationLabel(record: {
  location_status?: string | null;
  location_verified?: boolean | null;
  location_lat?: number | null;
  location_distance_meters?: number | null;
  location_accuracy_meters?: number | null;
}) {
  const distance = record.location_distance_meters == null ? "" : ` · ${Math.round(record.location_distance_meters)} m`;
  const accuracy = record.location_accuracy_meters == null ? "" : ` · ±${Math.round(record.location_accuracy_meters)} m`;
  switch (record.location_status) {
    case "WITHIN_RADIUS":
      return `Inside zone${distance}${accuracy}`;
    case "OUTSIDE_RADIUS":
      return `Outside zone${distance}${accuracy}`;
    case "INACCURATE":
      return `Low GPS accuracy${accuracy}`;
    case "CAPTURED":
      return `Captured${accuracy}`;
    case "INVALID":
      return "Invalid reading";
    case "NOT_REQUIRED":
      return "Not required";
    case "UNAVAILABLE":
      return "Not captured";
    default:
      if (record.location_verified) return `Inside zone${distance}${accuracy}`;
      if (record.location_lat != null) return `Captured${accuracy}`;
      return "Not captured";
  }
}
