import uniqueActorFixture from "../../e2e/fixtures/unique-actor.json";
import type { UniqueActorDto } from "@/lib/bus/types";

/**
 * Shared fixtures (T5): `gk-core/tests/FusionRpg.E2E.Tests/ContractFixtureTests.cs` serialises each response
 * DTO from a real server call into `e2e/fixtures/*.json`. This file is the one place both Vitest
 * mocks and Playwright e2e read them from, so a server-side shape change and a stale FE mock can't
 * silently drift apart — whichever project didn't get the memo goes red first.
 */
export const mockUniqueActor: UniqueActorDto = uniqueActorFixture as UniqueActorDto;
