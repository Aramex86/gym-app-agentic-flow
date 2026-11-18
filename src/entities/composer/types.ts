/* entities/composer/types — domain types. Re-exports ComposerStatus so
   consumers import it from @entities/composer (the domain import) while the
   store itself stays in shared/config (plan §5.3). */

export type { ComposerStatus } from "@shared/config/composerStatus";
