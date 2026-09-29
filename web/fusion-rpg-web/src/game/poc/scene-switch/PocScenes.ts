import { PocModeScene } from "./PocModeScene";
import { POC_SCENE_KEYS, POC_VISUALS } from "./pocKeys";

export class PocWorldScene extends PocModeScene {
  constructor() {
    super(POC_SCENE_KEYS.world);
  }
  protected readonly pocMode = "world" as const;
  protected readonly visual = POC_VISUALS.world;
}

export class PocSiegeScene extends PocModeScene {
  constructor() {
    super(POC_SCENE_KEYS.siege);
  }
  protected readonly pocMode = "siege" as const;
  protected readonly visual = POC_VISUALS.siege;
}

export class PocLawnScene extends PocModeScene {
  constructor() {
    super(POC_SCENE_KEYS.lawn);
  }
  protected readonly pocMode = "lawn" as const;
  protected readonly visual = POC_VISUALS.lawn;
}
