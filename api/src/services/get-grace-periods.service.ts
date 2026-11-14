import type { GracePeriods } from "@productivitytracker/shared";
import type { SettingsRepository } from "../repositories/postgres/settings.repository.js";

export class GetGracePeriodsService {
  constructor(private readonly settings: Pick<SettingsRepository, "getGracePeriods">) {}

  execute(): Promise<GracePeriods> {
    return this.settings.getGracePeriods();
  }
}
