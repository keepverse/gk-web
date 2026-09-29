/**
 * Derived tab host — fold → bindSurface → RecipeMount.
 * Visual SSOT: docs/design/gui-lego/surfaces/derived-console.html
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { isKnown } from "@/contract/pending";
import type { ActorView } from "@/contract/types";
import { bindSurface } from "@/features/gui-lego/bindSurface";
import {
  COOK_PRIMARY_TAB_IDS,
  FORBIDDEN_PRIMARY_TAB_IDS,
  SHOW_UNCHANGED_KEY,
  bucketContributions,
  expandDerivedFamily,
  isUnchangedState,
  joinDerivedChannelId,
  resolveDerivedRenderState,
  type DerivedRenderState,
  type ExpandedDerivedChannel,
  type LiveChannelView
} from "@/features/gui-lego/cook";
import { asSurfaceBusLike } from "@/features/gui-lego/createSurfaceBus";
import { createDerivedSurfaceBus } from "@/features/gui-lego/derivedSurfaceBus";
import { foldDerivedSurfaceVm } from "@/features/gui-lego/foldDerivedSurfaceVm";
import { getRecipe } from "@/features/gui-lego/recipeRegistry";
import {
  derivedSurfaceFromFixture,
  type ActorSurfaceCatalog,
  useDerivedSurface
} from "@/lib/bus/actorSurface";
import { useActorDerived, useActorSheet } from "@/lib/bus/aura";
import { RecipeMount } from "@/ui/gui-lego/RecipeMount";
import { ensureDerivedGuiLegoRegistered } from "@/ui/gui-lego/registerDerived";

export {
  COOK_PRIMARY_TAB_IDS,
  FORBIDDEN_PRIMARY_TAB_IDS,
  bucketContributions,
  expandDerivedFamily,
  isUnchangedState,
  joinDerivedChannelId,
  resolveDerivedRenderState,
  type DerivedRenderState,
  type ExpandedDerivedChannel,
  type LiveChannelView
};

ensureDerivedGuiLegoRegistered();

export function DerivedTab({
  data,
  surface
}: {
  data: ActorView;
  surface: ActorSurfaceCatalog;
}) {
  const cook = useDerivedSurface("en", data.side);
  const sheet = useActorSheet(data.instanceId);
  const derived = useActorDerived(data.instanceId);

  const [showUnchanged, setShowUnchanged] = useState(() => {
    try {
      return localStorage.getItem(SHOW_UNCHANGED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tabId, setTabId] = useState("elements");
  const [variantId, setVariantId] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const revisionRef = useRef(0);
  const searchFocused = useRef(false);

  const typedBus = useMemo(() => createDerivedSurfaceBus(), []);
  const bus = useMemo(() => asSurfaceBusLike(typedBus), [typedBus]);

  useEffect(() => {
    const offs = [
      typedBus.on("derived.search.set", (p) => {
        const q = (p as { query?: string })?.query;
        if (typeof q === "string") setQuery(q);
      }),
      typedBus.on("derived.showUnchanged.set", (p) => {
        const v = (p as { value?: boolean })?.value;
        if (typeof v === "boolean") setShowUnchanged(v);
      }),
      typedBus.on("derived.tab.set", (p) => {
        const id = (p as { tabId?: string })?.tabId;
        if (typeof id === "string") {
          setTabId(id);
          setVariantId(null);
        }
      }),
      typedBus.on("derived.variant.set", (p) => {
        const id = (p as { variantId?: string })?.variantId;
        if (typeof id === "string") setVariantId(id);
      }),
      typedBus.on("derived.channel.select", (p) => {
        const id = (p as { channelId?: string })?.channelId;
        if (typeof id === "string") setSelectedId(id);
      }),
      typedBus.on("derived.retry", () => {
        void sheet.refetch();
        void derived.refetch();
        setRetryTick((t) => t + 1);
      })
    ];
    return () => offs.forEach((off) => off());
  }, [typedBus, sheet, derived]);

  const tabs = useMemo(() => {
    const cooked = cook.data?.tabs?.length
      ? cook.data.tabs
      : derivedSurfaceFromFixture(surface, data.side).tabs;
    return [...cooked].sort((a, b) => a.order - b.order);
  }, [cook.data, surface, data.side]);

  const loading = sheet.isLoading;
  const hasSheet = (sheet.data?.derived?.length ?? 0) > 0;
  // DC-9: sheet-only when projection ready — lean only for UniqueCreature Pending honesty.
  const sheetProjectionReady =
    hasSheet &&
    (sheet.data?.derived?.some(
      (ch) => ch.renderState != null || ch.unitClass != null || ch.cap !== undefined
    ) ??
      false);
  const leanOnly =
    !hasSheet &&
    !sheet.isLoading &&
    (derived.data?.channels?.length ?? 0) > 0 &&
    !derived.isError;
  const errored =
    (sheet.isError || (!sheetProjectionReady && derived.isError)) && !loading && !leanOnly;
  const availability = loading
    ? "loading"
    : errored
      ? "error"
      : leanOnly
        ? "pending"
        : "ready";

  const displayName = isKnown(data.displayName) ? data.displayName.value : data.instanceId;

  const revision = useMemo(() => {
    revisionRef.current += 1;
    return revisionRef.current;
  }, [
    displayName,
    data.level,
    data.side,
    tabs,
    sheet.data,
    sheetProjectionReady ? undefined : derived.data,
    surface.elements,
    tabId,
    variantId,
    query,
    showUnchanged,
    selectedId,
    availability,
    retryTick
  ]);

  const vm = useMemo(
    () =>
      foldDerivedSurfaceVm({
        identity: {
          displayName,
          level: data.level,
          side: data.side
        },
        cookTabs: tabs,
        sheetChannels: sheet.data?.derived,
        leanChannels: sheetProjectionReady ? undefined : derived.data?.channels,
        elements: surface.elements,
        statuses: surface.statuses,
        ui: {
          tabId,
          variantId,
          query,
          showUnchanged,
          selectedChannelId: selectedId
        },
        availability,
        revision
      }),
    [
      displayName,
      data.level,
      data.side,
      tabs,
      sheet.data,
      sheetProjectionReady,
      derived.data,
      surface.elements,
      surface.statuses,
      tabId,
      variantId,
      query,
      showUnchanged,
      selectedId,
      availability,
      revision
    ]
  );

  // Keep host selection in sync with fold fallback
  useEffect(() => {
    if (vm.selectedChannelId !== selectedId) {
      setSelectedId(vm.selectedChannelId);
    }
  }, [vm.selectedChannelId, selectedId]);

  const recipe = getRecipe("derived-console");
  const plan = useMemo(
    () => (recipe ? bindSurface(recipe, vm) : null),
    [recipe, vm]
  );

  // GG-19 — focus search when surface becomes ready (or empty chrome with search)
  useEffect(() => {
    if ((vm.phase !== "ready" && vm.phase !== "empty") || searchFocused.current) return;
    const el = document.querySelector<HTMLInputElement>(
      '[data-testid="derived-combat-console"] [data-testid="derived-search"]'
    );
    if (el) {
      el.focus();
      searchFocused.current = true;
    }
  }, [vm.phase, plan]);

  if (!plan) {
    return <p className="rd">Derived recipe not registered.</p>;
  }

  // Loading/error full overlay — still wrap so ActorPanel has a root testid if needed
  if (!plan.root && plan.overlay) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col" data-testid="derived-tab-host">
        <div
          className="derived-combat-console console"
          data-testid="derived-combat-console"
          data-derived-root="1"
        >
          <RecipeMount plan={plan} bus={bus} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col" data-testid="derived-tab-host">
      <RecipeMount plan={plan} bus={bus} />
    </div>
  );
}
