import type { Activity } from "@productivitytracker/shared";
import { addDays, MINUTE, startOfDay } from "@/lib/dates";

/** The part of an activity that falls inside one day column. */
export interface Segment {
  activity: Activity;
  /** Minutes from local midnight. */
  start: number;
  end: number;
  /** Started the day before (e.g. sleep from 23:00). */
  continuesBefore: boolean;
  continuesAfter: boolean;
  /** Overlap column and how many columns its cluster needs. */
  col: number;
  cols: number;
}

/** Pieces of the activities that overlap `day`; an activity past midnight yields one piece per day. */
export function segmentsForDay(activities: Activity[], day: Date): Segment[] {
  const from = startOfDay(day);
  const to = addDays(from, 1);
  const out: Segment[] = [];
  for (const a of activities) {
    const s = new Date(a.plannedStart);
    const e = new Date(a.plannedEnd);
    if (s >= to || e <= from) continue;
    const start = s < from ? from : s;
    const end = e > to ? to : e;
    out.push({
      activity: a,
      start: (start.getTime() - from.getTime()) / MINUTE,
      end: (end.getTime() - from.getTime()) / MINUTE,
      continuesBefore: s < from,
      continuesAfter: e > to,
      col: 0,
      cols: 1,
    });
  }
  return layoutColumns(out);
}

/**
 * Assigns side-by-side columns to overlapping segments: segments are grouped into clusters of
 * transitive overlap, each placed in the first column that is free, and every segment in a
 * cluster shares the cluster's column count.
 */
export function layoutColumns(segments: Segment[]): Segment[] {
  const sorted = [...segments].sort((a, b) => a.start - b.start || b.end - a.end || a.activity.id - b.activity.id);
  let cluster: Segment[] = [];
  let clusterEnd = -1;
  let colEnds: number[] = [];
  const close = () => cluster.forEach((s) => (s.cols = colEnds.length));
  for (const s of sorted) {
    if (cluster.length && s.start >= clusterEnd) {
      close();
      cluster = [];
      colEnds = [];
      clusterEnd = -1;
    }
    let col = colEnds.findIndex((end) => end <= s.start);
    if (col < 0) {
      col = colEnds.length;
      colEnds.push(s.end);
    } else colEnds[col] = s.end;
    s.col = col;
    cluster.push(s);
    clusterEnd = Math.max(clusterEnd, s.end);
  }
  close();
  return sorted;
}

export interface CardBox {
  top: number;
  height: number;
  /** Percent of the column width. */
  left: number;
  width: number;
  /** Too short for rows: header only, with the start time. */
  compact: boolean;
}

const MIN_HEIGHT = 22;

export function cardBox(s: Segment, hourHeight: number): CardBox {
  const height = Math.max(((s.end - s.start) * hourHeight) / 60, MIN_HEIGHT) - 2;
  return {
    top: (s.start * hourHeight) / 60 + 1,
    height,
    left: (s.col / s.cols) * 100,
    width: 100 / s.cols,
    compact: height < 40,
  };
}

export interface FitBox {
  /** All four are percent: top and height of the day column, left and width of its width. */
  top: number;
  height: number;
  left: number;
  width: number;
}

const DAY_MINUTES = 24 * 60;

/** A segment placed as percentages, for the phone week view where the whole day fits the column. */
export function fitBox(s: Segment): FitBox {
  return {
    top: (s.start / DAY_MINUTES) * 100,
    height: ((s.end - s.start) / DAY_MINUTES) * 100,
    left: (s.col / s.cols) * 100,
    width: 100 / s.cols,
  };
}
