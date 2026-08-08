import type { NetworkProtocolEvent } from "../events.js";

export interface TracerConfig {
  captureBodies: boolean;
  maxBodyBytes: number;
  redactHeaderNames: readonly string[];
  emit: (event: NetworkProtocolEvent) => void;
}
