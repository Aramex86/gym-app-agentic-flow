/* features/onboarding/config — onboarding hardware map.
   Layer reason: feature-local, read-only hardware metadata for display + payload ids. */

/** One hardware source shown in onboarding and sent by id in the payload. */
export interface HardwareSource {
  /** Stable hardware source id sent in the generate payload. */
  id: string;
  /** Device name displayed in the hardware map card. */
  device: string;
  /** Description of how data is collected from this source. */
  method: string;
  /** Metrics tracked by this source. */
  tracks: readonly string[];
}

/** Read-only hardware map displayed in onboarding. */
export const HARDWARE_MAP: readonly HardwareSource[] = [
  {
    id: "heart-rate-strap",
    device: "Heart-rate strap",
    method: "Bluetooth LE, live during sets",
    tracks: ["Heart rate", "Recovery"],
  },
  {
    id: "smart-watch",
    device: "Smart watch",
    method: "Health sync after each session",
    tracks: ["Steps", "Sleep", "Resting HR"],
  },
  {
    id: "phone-logger",
    device: "Phone logger",
    method: "Manual entry in Logger",
    tracks: ["Sets", "Reps", "RPE", "Load"],
  },
];

/** Ordered hardware ids copied into generate payloads. */
export const HARDWARE_IDS: readonly string[] = HARDWARE_MAP.map((hardware) => hardware.id);
