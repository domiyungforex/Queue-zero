import { attendanceLocationLabel, attendanceMapUrl } from "@/lib/school/location";

type LocationRecord = {
  location_status?: string | null;
  location_verified?: boolean | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_distance_meters?: number | null;
  location_accuracy_meters?: number | null;
  location_captured_at?: string | null;
};

export function AttendanceLocation({ record }: { record: LocationRecord }) {
  const label = attendanceLocationLabel(record);
  const hasPoint = typeof record.location_lat === "number" && typeof record.location_lng === "number";
  return (
    <div>
      <span>{label}</span>
      {hasPoint ? (
        <a href={attendanceMapUrl(record.location_lat as number, record.location_lng as number)} target="_blank" rel="noreferrer">
          {" "}Map
        </a>
      ) : null}
    </div>
  );
}
