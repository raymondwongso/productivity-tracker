"use client";

import type { TitleKind } from "@productivitytracker/shared";
import { useState } from "react";
import { Dropdown } from "@/components/ui/dropdown";
import type { Draft } from "../../draft";
import { useCreateGame, useCreateProject, useCreateTitle, useGames, useOngoingProjects, useTitles } from "../../hooks";
import { CreateNewFooter } from "./create-new-footer";

type Set = (patch: Partial<Draft>) => void;

/** Project dropdown: only ongoing projects, with "+ Create new". */
export function WorkTopFields({ draft, set, current }: { draft: Draft; set: Set; current: { id: number; name: string } | null }) {
  const { data: projects = [] } = useOngoingProjects();
  const create = useCreateProject();
  const options = projects.map((p) => ({ value: p.id, label: p.name, hint: "Ongoing" }));
  // A project completed after this activity was saved still shows as the current choice.
  if (current && !options.some((o) => o.value === current.id)) options.unshift({ value: current.id, label: current.name, hint: "Not ongoing" });
  return (
    <div className="flex flex-col gap-1.5">
      <span id="project-label" className="text-[13px] font-semibold">Project</span>
      <Dropdown
        id="f-project"
        aria-labelledby="project-label"
        value={draft.projectId}
        options={options}
        placeholder="Choose an ongoing project"
        onChange={(projectId) => set({ projectId })}
        footer={(close) => (
          <CreateNewFooter
            placeholder="Project name"
            pending={create.isPending}
            onCreate={async (name) => {
              const p = await create.mutateAsync({ name });
              set({ projectId: p.id });
              close();
            }}
          />
        )}
      />
      <p className="text-xs text-muted">Only ongoing projects are listed.</p>
    </div>
  );
}

/** Movie / series dropdown with "+ Create new". */
export function WatchTopFields({ draft, set }: { draft: Draft; set: Set }) {
  const { data: titles = [] } = useTitles();
  const create = useCreateTitle();
  const [kind, setKind] = useState<TitleKind>("series");
  return (
    <div className="flex flex-col gap-1.5">
      <span id="title-label" className="text-[13px] font-semibold">Movie / Series</span>
      <Dropdown
        id="f-title"
        aria-labelledby="title-label"
        value={draft.titleId}
        options={titles.map((t) => ({ value: t.id, label: t.name, hint: t.kind === "movie" ? "Movie" : "Series" }))}
        placeholder="Choose a movie or series"
        onChange={(titleId) => set({ titleId })}
        footer={(close) => (
          <CreateNewFooter
            placeholder="Title"
            pending={create.isPending}
            extra={
              <select aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value as TitleKind)} className="border-2 border-ink bg-bg px-2 text-sm">
                <option value="series">Series</option>
                <option value="movie">Movie</option>
              </select>
            }
            onCreate={async (name) => {
              const t = await create.mutateAsync({ name, kind });
              set({ titleId: t.id });
              close();
            }}
          />
        )}
      />
    </div>
  );
}

/** Game dropdown with "+ Create new". */
export function GamingTopFields({ draft, set }: { draft: Draft; set: Set }) {
  const { data: games = [] } = useGames();
  const create = useCreateGame();
  return (
    <div className="flex flex-col gap-1.5">
      <span id="game-label" className="text-[13px] font-semibold">Game</span>
      <Dropdown
        id="f-game"
        aria-labelledby="game-label"
        value={draft.gameId}
        options={games.map((g) => ({ value: g.id, label: g.name }))}
        placeholder="Choose a game"
        onChange={(gameId) => set({ gameId })}
        footer={(close) => (
          <CreateNewFooter
            placeholder="Game name"
            pending={create.isPending}
            onCreate={async (name) => {
              const g = await create.mutateAsync({ name });
              set({ gameId: g.id });
              close();
            }}
          />
        )}
      />
    </div>
  );
}
