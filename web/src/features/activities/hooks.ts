"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Activity,
  ActivitySeries,
  Category,
  CategorySlug,
  CreateActivityRequest,
  CreateActivitySeriesRequest,
  CreateActivitySeriesResponse,
  CreateProjectRequest,
  CreateGameRequest,
  CreateTitleRequest,
  EditScope,
  Game,
  GracePeriods,
  Project,
  Title,
  UpdateActivityRequest,
} from "@productivitytracker/shared";
import { apiDelete, apiGet, apiPatch, apiPost, withQuery } from "@/lib/api-client";

export const ACTIVITIES_KEY = ["activities"] as const;
const PROJECTS_KEY = ["projects", "ongoing"] as const;
const TITLES_KEY = ["titles"] as const;
const GAMES_KEY = ["games"] as const;
const SERIES_KEY = ["activity-series"] as const;

/** Activities overlapping [from, to); optionally one category only (the Work board). */
export function useActivities(from: Date, to: Date, category?: CategorySlug) {
  const range = { from: from.toISOString(), to: to.toISOString(), category };
  return useQuery({
    queryKey: [...ACTIVITIES_KEY, range.from, range.to, category ?? "all"],
    queryFn: () => apiGet<Activity[]>(withQuery("/activities", range)),
  });
}

/** The rule of the series an activity belongs to; idle for a one-off (null). */
export function useActivitySeries(id: number | null) {
  return useQuery({
    queryKey: [...SERIES_KEY, id],
    queryFn: () => apiGet<ActivitySeries>(`/activity-series/${id}`),
    enabled: id !== null,
  });
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: () => apiGet<Category[]>("/categories"), staleTime: Infinity });
}

export function useGracePeriods() {
  return useQuery({ queryKey: ["grace-periods"], queryFn: () => apiGet<GracePeriods>("/settings/grace-periods"), staleTime: 5 * 60_000 });
}

export function useOngoingProjects() {
  return useQuery({ queryKey: PROJECTS_KEY, queryFn: () => apiGet<Project[]>("/projects?status=ongoing") });
}

export function useTitles() {
  return useQuery({ queryKey: TITLES_KEY, queryFn: () => apiGet<Title[]>("/titles") });
}

export function useGames() {
  return useQuery({ queryKey: GAMES_KEY, queryFn: () => apiGet<Game[]>("/games") });
}

/**
 * Every write invalidates all cached calendar ranges (an edit can move an activity between them),
 * every tracker's stats, which are computed from the same rows, and the series rules (a delete
 * of "this and following" ends a series earlier).
 */
function useActivityMutation<A, R>(fn: (arg: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ACTIVITIES_KEY }),
        qc.invalidateQueries({ queryKey: ["stats"] }),
        qc.invalidateQueries({ queryKey: SERIES_KEY }),
      ]),
  });
}

/** `/activities/5`, or `/activities/5?scope=following`; "this" is the API's default. */
const activityPath = (id: number, scope: EditScope = "this") =>
  withQuery(`/activities/${id}`, { scope: scope === "following" ? scope : undefined });

export const useCreateActivity = () => useActivityMutation((req: CreateActivityRequest) => apiPost<Activity>("/activities", req));
export const useCreateActivitySeries = () =>
  useActivityMutation((req: CreateActivitySeriesRequest) => apiPost<CreateActivitySeriesResponse>("/activity-series", req));
export const useUpdateActivity = () =>
  useActivityMutation(({ id, req, scope }: { id: number; req: UpdateActivityRequest; scope?: EditScope }) =>
    apiPatch<Activity>(activityPath(id, scope), req),
  );
export const useDeleteActivity = () =>
  useActivityMutation(({ id, scope }: { id: number; scope?: EditScope }) => apiDelete(activityPath(id, scope)));
export const useCancelActivity = () => useActivityMutation((id: number) => apiPost<Activity>(`/activities/${id}/cancel`));
export const useRestoreActivity = () => useActivityMutation((id: number) => apiPost<Activity>(`/activities/${id}/restore`));

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateProjectRequest) => apiPost<Project>("/projects", req),
    // Show the new project in the dropdown at once, before the refetch lands.
    onSuccess: (p) => {
      qc.setQueryData<Project[]>(PROJECTS_KEY, (old) => (old && !old.some((x) => x.id === p.id) ? [...old, p] : old));
      return qc.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

export function useCreateTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateTitleRequest) => apiPost<Title>("/titles", req),
    onSuccess: (t) => {
      qc.setQueryData<Title[]>(TITLES_KEY, (old) => (old && !old.some((x) => x.id === t.id) ? [...old, t] : old));
      return qc.invalidateQueries({ queryKey: TITLES_KEY });
    },
  });
}

export function useCreateGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateGameRequest) => apiPost<Game>("/games", req),
    onSuccess: (g) => {
      qc.setQueryData<Game[]>(GAMES_KEY, (old) => (old && !old.some((x) => x.id === g.id) ? [...old, g] : old));
      return qc.invalidateQueries({ queryKey: GAMES_KEY });
    },
  });
}
