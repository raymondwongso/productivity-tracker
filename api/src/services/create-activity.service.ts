import type { Activity, ActivityFields, CategoryFieldsInput, CreateActivityRequest } from "@productivitytracker/shared";
import { badRequest } from "../errors.js";
import { assertFieldsFor, checkReferences, labelsFor, mergeDetails, parseFields, type ReferenceLookups } from "../lib/activities.js";
import type { ActivityRepository } from "../repositories/postgres/activity.repository.js";
import type { CategoryRepository } from "../repositories/postgres/category.repository.js";
import type { SettingsRepository } from "../repositories/postgres/settings.repository.js";

export class CreateActivityService {
  constructor(
    private readonly categories: Pick<CategoryRepository, "findBySlug">,
    private readonly settings: Pick<SettingsRepository, "getGracePeriods">,
    private readonly refs: ReferenceLookups,
    private readonly activities: Pick<ActivityRepository, "create">,
  ) {}

  async execute(userId: number, req: CreateActivityRequest): Promise<Activity> {
    const category = await this.categories.findBySlug(req.category);
    if (!category) throw badRequest("Unknown category");
    // Every variant is a set of shared fields plus some category fields; read it that way.
    const input: ActivityFields & CategoryFieldsInput = req;
    assertFieldsFor(category.slug, input);
    const fields = parseFields(input);
    const details = mergeDetails(category.slug, input, null);
    await checkReferences(userId, details, null, this.refs);
    // Labels are frozen with the grace periods in force now.
    const grace = await this.settings.getGracePeriods();
    return this.activities.create({
      ...fields,
      userId,
      categoryId: category.id,
      seriesId: null,
      cancelledAt: null,
      labels: labelsFor({ ...fields, cancelledAt: null }, grace),
      details,
    });
  }
}
