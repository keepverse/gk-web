// Type surface for gkRoots.mjs, so TypeScript test and app code can import the one resolver
// rather than re-deriving the workspace. The implementation is the .mjs file next to this one;
// this file declares it and nothing else, so there is exactly one walk-up and one pack default.
export declare const DEFAULT_PACK: string;
export declare function coreRoot(): string;
export declare function dataRoot(): string;
export declare function workflowRoot(): string;
export declare function allRoots(): { core: string; data: string; workflow: string };
