/* entities/composer — public API. Consumers import ONLY here
   (@entities/composer), never deep entity paths.
   setComposerStatus/resetComposerStatus are deliberately NOT re-exported:
   the shared store is written by refreshComposerStatus (production) and by
   tests importing @shared/config/composerStatus directly. */

export type { ComposerStatus } from "./types";
export {
  COMPOSER_HEALTH_ENDPOINT,
  COMPOSER_HEALTH_INTERVAL_MS,
  COMPOSER_HEALTH_TIMEOUT_MS,
  checkComposerHealth,
  refreshComposerStatus,
} from "./api";
export {
  getComposerStatus,
  isComposerAvailable,
  useComposerStatus,
} from "@shared/config/composerStatus";
