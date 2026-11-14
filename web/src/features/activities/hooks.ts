"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Activity,
  Category,
  CategorySlug,
  CreateActivityRequest,
  CreateProjectRequest,
  CreateGameRequest,
  CreateTitleRequest,
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

/** Activities overlapping [from, to); optionally one category only (the Work board). */
export function useActivities(from: Date, to: Date, category?: CategorySlug) {
  const range = { from: from.toISOString(), to: to.toISOString(), category };
  return useQuery({
    queryKey: [...ACTIVITIES_KEY, range.from, range.to, category ?? "all"],
    queryFn: () => apiGet<Activity[]>(withQuery("/activities", range)),
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
 * Every write invalidates all cached calendar ranges (an edit can move an activity between them)
 * and every tracker's stats, which are computed from the same rows.
 */
function useActivityMutation<A>(fn: (arg: A) => Promise<Activity | void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ACTIVITIES_KEY }), qc.invalidateQueries({ queryKey: ["stats"] })]),
  });
}

export const useCreateActivity = () => useActivityMutation((req: CreateActivityRequest) => apiPost<Activity>("/activities", req));
export const useUpdateActivity = () =>
  useActivityMutation(({ id, req }: { id: number; req: UpdateActivityRequest }) => apiPatch<Activity>(`/activities/${id}`, req));
export const useDeleteActivity = () => useActivityMutation((id: number) => apiDelete(`/activities/${id}`));
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
