import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import type { Config } from "./config.js";
import { activitiesController } from "./controllers/activities.controller.js";
import { authController } from "./controllers/auth.controller.js";
import { categoriesController } from "./controllers/categories.controller.js";
import { gamesController } from "./controllers/games.controller.js";
import { healthController } from "./controllers/health.controller.js";
import { projectsController } from "./controllers/projects.controller.js";
import { settingsController } from "./controllers/settings.controller.js";
import { statsController } from "./controllers/stats.controller.js";
import { titlesController } from "./controllers/titles.controller.js";
import { AppError } from "./errors.js";
import { COOKIE_NAME } from "./lib/auth.js";
import { ActivityRepository } from "./repositories/postgres/activity.repository.js";
import { CategoryRepository } from "./repositories/postgres/category.repository.js";
import { GameRepository } from "./repositories/postgres/game.repository.js";
import { createPool } from "./repositories/postgres/pool.js";
import { ProjectRepository } from "./repositories/postgres/project.repository.js";
import { SettingsRepository } from "./repositories/postgres/settings.repository.js";
import { StatsRepository } from "./repositories/postgres/stats.repository.js";
import { TitleRepository } from "./repositories/postgres/title.repository.js";
import { UserRepository } from "./repositories/postgres/user.repository.js";
import { CancelActivityService } from "./services/cancel-activity.service.js";
import { CreateActivityService } from "./services/create-activity.service.js";
import { CreateGameService } from "./services/create-game.service.js";
import { CreateProjectService } from "./services/create-project.service.js";
import { CreateTitleService } from "./services/create-title.service.js";
import { DeleteActivityService } from "./services/delete-activity.service.js";
import { GetActivityService } from "./services/get-activity.service.js";
import { GetCinemaStatsService } from "./services/get-cinema-stats.service.js";
import { GetCurrentUserService } from "./services/get-current-user.service.js";
import { GetFitnessStatsService } from "./services/get-fitness-stats.service.js";
import { GetGamingStatsService } from "./services/get-gaming-stats.service.js";
import { GetGracePeriodsService } from "./services/get-grace-periods.service.js";
import { GetSleepStatsService } from "./services/get-sleep-stats.service.js";
import { GetWorkStatsService } from "./services/get-work-stats.service.js";
import { ListActivitiesService } from "./services/list-activities.service.js";
import { ListCategoriesService } from "./services/list-categories.service.js";
import { ListGamesService } from "./services/list-games.service.js";
import { ListProjectsService } from "./services/list-projects.service.js";
import { ListTitlesService } from "./services/list-titles.service.js";
import { LoginUserService } from "./services/login-user.service.js";
import { RegisterUserService } from "./services/register-user.service.js";
import { RestoreActivityService } from "./services/restore-activity.service.js";
import { UpdateActivityService } from "./services/update-activity.service.js";

export function buildApp(config: Config) {
  const app = Fastify({
    logger: { level: config.logLevel },
    trustProxy: config.trustProxy,
  });

  app.register(cors, { origin: config.corsOrigin, credentials: true, methods: ["GET", "POST", "PATCH", "DELETE"] });
  app.register(helmet);
  app.register(rateLimit, { global: false });
  app.register(cookie);
  app.register(jwt, { secret: config.jwtSecret, cookie: { cookieName: COOKIE_NAME, signed: false } });

  // CSRF defense in depth. The session cookie is SameSite=Lax, which still lets pages on the same
  // site (another localhost port, a sibling subdomain) send it with a body-less or text/plain POST.
  // Browsers send Origin on those, so a write from any origin but the web app's is refused.
  app.addHook("onRequest", async (request) => {
    if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return;
    const origin = request.headers.origin;
    if (origin !== undefined && origin !== config.corsOrigin) throw new AppError(403, "Origin not allowed");
  });

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, request, reply) => {
    if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
    if (err.validation) return reply.code(400).send({ error: err.message });
    if (err.statusCode && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: err.message });
    }
    request.log.error(err);
    return reply.code(500).send({ error: "Internal server error" });
  });

  // database
  const pool = createPool(config);
  app.addHook("onClose", async () => {
    await pool.end();
  });

  // repositories
  const users = new UserRepository(pool);
  const categories = new CategoryRepository(pool);
  const settings = new SettingsRepository(pool);
  const projects = new ProjectRepository(pool);
  const titles = new TitleRepository(pool);
  const games = new GameRepository(pool);
  const activities = new ActivityRepository(pool);
  const stats = new StatsRepository(pool);
  const refs = { projects, titles, games };

  // controllers / routes
  app.register(healthController(config), { prefix: "/api" });
  app.register(
    authController({
      registerUser: new RegisterUserService(users),
      loginUser: new LoginUserService(users),
      getCurrentUser: new GetCurrentUserService(users),
      cookieSecure: config.cookieSecure,
    }),
    { prefix: "/api" },
  );
  app.register(categoriesController({ listCategories: new ListCategoriesService(categories) }), { prefix: "/api" });
  app.register(settingsController({ getGracePeriods: new GetGracePeriodsService(settings) }), { prefix: "/api" });
  app.register(
    projectsController({ listProjects: new ListProjectsService(projects), createProject: new CreateProjectService(projects) }),
    { prefix: "/api" },
  );
  app.register(
    titlesController({ listTitles: new ListTitlesService(titles), createTitle: new CreateTitleService(titles) }),
    { prefix: "/api" },
  );
  app.register(gamesController({ listGames: new ListGamesService(games), createGame: new CreateGameService(games) }), {
    prefix: "/api",
  });
  app.register(
    statsController({
      sleep: new GetSleepStatsService(stats),
      fitness: new GetFitnessStatsService(stats),
      work: new GetWorkStatsService(stats),
      cinema: new GetCinemaStatsService(stats),
      gaming: new GetGamingStatsService(stats),
    }),
    { prefix: "/api" },
  );
  app.register(
    activitiesController({
      listActivities: new ListActivitiesService(activities),
      getActivity: new GetActivityService(activities),
      createActivity: new CreateActivityService(categories, settings, refs, activities),
      updateActivity: new UpdateActivityService(settings, refs, activities),
      deleteActivity: new DeleteActivityService(activities),
      cancelActivity: new CancelActivityService(activities),
      restoreActivity: new RestoreActivityService(settings, activities),
    }),
    { prefix: "/api" },
  );

  return app;
}
