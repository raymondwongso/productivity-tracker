import type { Activity, UpdateActivityRequest } from "@productivitytracker/shared";
import { badRequest, notFound } from "../errors.js";
import {
  applyPatch,
  assertFieldsFor,
  checkReferences,
  labelsFor,
  mergeDetails,
  stateOf,
  timesChanged,
  type ReferenceLookups,
} from "../lib/activities.js";
import type { ActivityRepository } from "../repositories/postgres/activity.repository.js";
import type { SettingsRepository } from "../repositories/postgres/settings.repository.js";

export class UpdateActivityService {
  constructor(
    private readonly settings: Pick<SettingsRepository, "getGracePeriods">,
    private readonly refs: ReferenceLookups,
    private readonly activities: Pick<ActivityRepository, "findByIdForUser" | "update">,
  ) {}

  /** `req` may carry a stray `category` from the client; changing it is refused. */
  async execute(userId: number, id: number, req: UpdateActivityRequest & { category?: unknown }): Promise<Activity> {
    const current = await this.activities.findByIdForUser(id, userId);
    if (!current) throw notFound("Activity not found");
    if (req.category !== undefined && req.category !== current.category) {
      throw badRequest("An activity's category can't be changed");
    }
    assertFieldsFor(current.category, req);

    const prev = stateOf(current);
    const next = applyPatch(prev, req);
    const details = mergeDetails(current.category, req, prev.details);
    await checkReferences(userId, details, prev.details, this.refs);

    // Labels only move when a time changes; other edits keep what was stored, even if the
    // grace periods have changed since.
    const labels = timesChanged(prev, next) ? labelsFor(next, await this.settings.getGracePeriods()) : prev.labels;
    const saved = await this.activities.update(id, userId, { ...next, labels, details });
    if (!saved) throw notFound("Activity not found");
    return saved;
  }
}
