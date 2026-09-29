// notify-format spec §4 - the ONE place shared code imports a domain module: the list, and it holds
// no logic. world-notify-source (NS5.4) and cache-notify-source (NS6.3) each add one
// `import "..."; registerTranslator(...)` line here when their catalog rows land, in the same
// change as the row (notify-format's coverage guard needs both together).
import { registerTranslator } from "./registry";
import { worldTranslator } from "@/stages/world/notify/worldTranslator";
import { cacheNotifyTranslator } from "@/stages/world/cacheClaim/cacheNotifyTranslator";

registerTranslator(worldTranslator);
registerTranslator(cacheNotifyTranslator);
