import { useEntryLanding } from "@/shell/useEntryLanding";

/**
 * Mount point for rift-gate's entry landing. It lives inside `HashRouter` (it uses
 * `useNavigate`/`useLocation`), and renders nothing — it is an effect, not chrome.
 */
export function EntryLandingHost() {
  useEntryLanding();
  return null;
}
