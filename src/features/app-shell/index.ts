/* features/app-shell — navigation + telemetry header scenario (composition
   of shared atoms). Imports ONLY @shared/*, @entities/composer, react and
   react-router-dom — never another feature, never raw fetch (AGENTS.md
   data rule: the healthcheck lives in the composer entity). */

export { AppChrome } from "./ui/AppChrome";
export type { AppChromeProps } from "./ui/AppChrome";
