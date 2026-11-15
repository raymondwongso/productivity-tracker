import type {
  ActivityFields,
  CategoryFieldsInput,
  CreateActivitySeriesRequest,
  CreateActivitySeriesResponse,
  RepeatRule,
} from "@productivitytracker/shared";
import { checkRepeatRule, occurrenceDates } from "@productivitytracker/shared";
import { badRequest } from "../errors.js";
import { assertFieldsFor, checkReferences, checkTimes, labelsFor, mergeDetails, parseFields, type ReferenceLookups, type Times } from "../lib/activities.js";
import { assertTimeZone, placeSlot, slotOf } from "../lib/recurrence.js";
import type { ActivitySeriesRepository } from "../repositories/postgres/activity-series.repository.js";
import type { ActivityRepository, NewActivity } from "../repositories/postgres/activity.repository.js";
import type { CategoryRepository } from "../repositories/postgres/category.repository.js";
import type { SettingsRepository } from "../repositories/postgres/settings.repository.js";

/**
 * Creates a series and every occurrence up front, as real activities. The request is the first
 * occurrence; later ones get the same local start and end time on their own date, in the
 * series' time zone, so 07:00 stays 07:00 across a DST change.
 */
export class CreateActivitySeriesService {
  constructor(
    private readonly categories: Pick<CategoryRepository, "findBySlug">,
    private readonly settings: Pick<SettingsRepository, "getGracePeriods">,
    private readonly refs: ReferenceLookups,
    private readonly series: Pick<ActivitySeriesRepository, "create">,
    private readonly activities: Pick<ActivityRepository, "listFollowing">,
  ) {}

  async execute(userId: number, req: CreateActivitySeriesRequest): Promise<CreateActivitySeriesResponse> {
    const category = await this.categories.findBySlug(req.category);
    if (!category) throw badRequest("Unknown category");
    const input: ActivityFields & CategoryFieldsInput = req;
    assertFieldsFor(category.slug, input);
    const fields = parseFields(input);
    const details = mergeDetails(category.slug, input, null);
    await checkReferences(userId, details, null, this.refs);

    const { timeZone, frequency, every, weekdays, until } = req.repeat;
    assertTimeZone(timeZone);
    const rule: RepeatRule = { frequency, every, weekdays: weekdays ? [...weekdays].sort((a, b) => a - b) : null, until };
    const { date: startsOn, slot } = slotOf(fields.plannedStart, fields.plannedEnd, timeZone);
    const problem = checkRepeatRule(startsOn, rule);
    if (problem) throw badRequest(problem);

    // Labels are frozen with the grace periods in force now, as for a single activity.
    const grace = await this.settings.getGracePeriods();
    const occurrences: Omit<NewActivity, "seriesId">[] = occurrenceDates(startsOn, rule).map((date, i) => {
      // Actual times belong to the occurrence they were logged on: the first one.
      const times: Times =
        i === 0
          ? { plannedStart: fields.plannedStart, plannedEnd: fields.plannedEnd, actualStart: fields.actualStart, actualEnd: fields.actualEnd }
          : { ...placeSlot(date, slot, timeZone), actualStart: null, actualEnd: null };
      checkTimes(times);
      return {
        ...fields,
        ...times,
        userId,
        categoryId: category.id,
        cancelledAt: null,
        labels: labelsFor({ ...times, cancelledAt: null }, grace),
        details,
      };
    });

    const series = await this.series.create(
      { userId, categoryId: category.id, ...rule, startsOn, timeZone },
      occurrences,
    );
    const activities = await this.activities.listFollowing(series.id, userId, fields.plannedStart);
    return { series, activities };
  }
}
