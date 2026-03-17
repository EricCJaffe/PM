"use client";

import { useState } from "react";
import { Field, Input, Select } from "./Modal";
import { describeRecurrence } from "@/lib/recurrence";
import type { RecurrenceFreq, RecurrenceMode } from "@/types/pm";

const FREQ_OPTIONS: { value: RecurrenceFreq; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const ORDINALS = [
  { value: 1, label: "First" },
  { value: 2, label: "Second" },
  { value: 3, label: "Third" },
  { value: 4, label: "Fourth" },
  { value: -1, label: "Last" },
];

export interface RecurrenceConfig {
  recurrence_mode: RecurrenceMode;
  freq: RecurrenceFreq;
  interval: number;
  by_weekday: number[];
  by_monthday: number[];
  by_setpos: number | null;
  dtstart: string;
  until_date: string | null;
  max_count: number | null;
  time_of_day: string | null;
  timezone: string;
  completion_delay_days: number | null;
  end_type: "never" | "date" | "count";
}

const DEFAULT_CONFIG: RecurrenceConfig = {
  recurrence_mode: "fixed",
  freq: "weekly",
  interval: 1,
  by_weekday: [],
  by_monthday: [],
  by_setpos: null,
  dtstart: new Date().toISOString().slice(0, 10),
  until_date: null,
  max_count: null,
  time_of_day: null,
  timezone: "America/New_York",
  completion_delay_days: 1,
  end_type: "never",
};

export function RecurrencePicker({
  value,
  onChange,
}: {
  value: RecurrenceConfig | null;
  onChange: (config: RecurrenceConfig | null) => void;
}) {
  const [enabled, setEnabled] = useState(value !== null);
  const config = value ?? DEFAULT_CONFIG;

  function update(patch: Partial<RecurrenceConfig>) {
    onChange({ ...config, ...patch });
  }

  function toggleEnabled() {
    if (enabled) {
      setEnabled(false);
      onChange(null);
    } else {
      setEnabled(true);
      onChange(config);
    }
  }

  function toggleWeekday(day: number) {
    const wd = config.by_weekday.includes(day)
      ? config.by_weekday.filter((d) => d !== day)
      : [...config.by_weekday, day].sort();
    update({ by_weekday: wd });
  }

  function setMonthlyMode(mode: "day" | "ordinal") {
    if (mode === "day") {
      update({ by_setpos: null, by_weekday: [], by_monthday: config.by_monthday.length ? config.by_monthday : [1] });
    } else {
      update({ by_monthday: [], by_setpos: 1, by_weekday: config.by_weekday.length ? config.by_weekday : [1] });
    }
  }

  function setEndType(type: "never" | "date" | "count") {
    if (type === "never") update({ end_type: type, until_date: null, max_count: null });
    else if (type === "date") update({ end_type: type, max_count: null, until_date: config.until_date || "" });
    else update({ end_type: type, until_date: null, max_count: config.max_count || 10 });
  }

  // Quick presets
  function applyPreset(preset: string) {
    switch (preset) {
      case "weekdays":
        update({ freq: "daily", interval: 1, by_weekday: [1, 2, 3, 4, 5], by_monthday: [], by_setpos: null });
        break;
      case "weekly":
        update({ freq: "weekly", interval: 1, by_weekday: [], by_monthday: [], by_setpos: null });
        break;
      case "biweekly":
        update({ freq: "weekly", interval: 2, by_weekday: [], by_monthday: [], by_setpos: null });
        break;
      case "monthly":
        update({ freq: "monthly", interval: 1, by_weekday: [], by_monthday: [], by_setpos: null });
        break;
      case "first-monday":
        update({ freq: "monthly", interval: 1, by_weekday: [1], by_monthday: [], by_setpos: 1 });
        break;
      case "last-friday":
        update({ freq: "monthly", interval: 1, by_weekday: [5], by_monthday: [], by_setpos: -1 });
        break;
    }
  }

  const description = enabled ? describeRecurrence(config) : "";

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={toggleEnabled}
          className="rounded border-pm-border"
        />
        <span className="text-xs text-pm-text font-medium">Make this a recurring task</span>
      </label>

      {enabled && (
        <div className="space-y-3 pl-1 border-l-2 border-pm-accent/30 ml-1.5">
          <div className="pl-3 space-y-3">
            {/* Quick presets */}
            <div className="flex flex-wrap gap-1">
              {[
                { key: "weekdays", label: "Weekdays" },
                { key: "weekly", label: "Weekly" },
                { key: "biweekly", label: "Bi-weekly" },
                { key: "monthly", label: "Monthly" },
                { key: "first-monday", label: "1st Monday" },
                { key: "last-friday", label: "Last Friday" },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  className="px-2 py-0.5 text-[10px] rounded bg-pm-bg border border-pm-border text-pm-muted hover:text-pm-text hover:border-pm-accent transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Recurrence mode */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mode">
                <Select
                  value={config.recurrence_mode}
                  onChange={(e) => update({ recurrence_mode: e.target.value as RecurrenceMode })}
                >
                  <option value="fixed">Fixed schedule</option>
                  <option value="completion">After completion</option>
                </Select>
              </Field>
              {config.recurrence_mode === "fixed" ? (
                <Field label="Frequency">
                  <Select
                    value={config.freq}
                    onChange={(e) => update({ freq: e.target.value as RecurrenceFreq })}
                  >
                    {FREQ_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Field label="Days after completion">
                  <Input
                    type="number"
                    min={1}
                    value={String(config.completion_delay_days ?? 1)}
                    onChange={(e) => update({ completion_delay_days: parseInt(e.target.value) || 1 })}
                  />
                </Field>
              )}
            </div>

            {/* Fixed schedule options */}
            {config.recurrence_mode === "fixed" && (
              <>
                {/* Interval */}
                <Field label={`Every N ${config.freq === "daily" ? "days" : config.freq === "weekly" ? "weeks" : config.freq === "monthly" ? "months" : "years"}`}>
                  <Input
                    type="number"
                    min={1}
                    value={String(config.interval)}
                    onChange={(e) => update({ interval: parseInt(e.target.value) || 1 })}
                  />
                </Field>

                {/* Weekday picker for daily/weekly */}
                {(config.freq === "daily" || config.freq === "weekly") && (
                  <div>
                    <label className="text-xs text-pm-muted block mb-1">On days</label>
                    <div className="flex gap-1">
                      {WEEKDAYS.map((wd) => (
                        <button
                          key={wd.value}
                          type="button"
                          onClick={() => toggleWeekday(wd.value)}
                          className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                            config.by_weekday.includes(wd.value)
                              ? "bg-pm-accent text-white"
                              : "bg-pm-bg border border-pm-border text-pm-muted hover:text-pm-text"
                          }`}
                        >
                          {wd.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Monthly options */}
                {config.freq === "monthly" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <label className="flex items-center gap-1 text-xs text-pm-muted cursor-pointer">
                        <input
                          type="radio"
                          name="monthly_mode"
                          checked={config.by_setpos == null}
                          onChange={() => setMonthlyMode("day")}
                          className="border-pm-border"
                        />
                        Day of month
                      </label>
                      <label className="flex items-center gap-1 text-xs text-pm-muted cursor-pointer">
                        <input
                          type="radio"
                          name="monthly_mode"
                          checked={config.by_setpos != null}
                          onChange={() => setMonthlyMode("ordinal")}
                          className="border-pm-border"
                        />
                        Weekday pattern
                      </label>
                    </div>

                    {config.by_setpos == null ? (
                      <Field label="Day(s) of month">
                        <Input
                          value={config.by_monthday.join(", ")}
                          onChange={(e) => {
                            const days = e.target.value.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n) && n >= -31 && n <= 31 && n !== 0);
                            update({ by_monthday: days });
                          }}
                          placeholder="e.g. 1, 15 or -1 for last day"
                        />
                      </Field>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Which">
                          <Select
                            value={String(config.by_setpos ?? 1)}
                            onChange={(e) => update({ by_setpos: parseInt(e.target.value) })}
                          >
                            {ORDINALS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Weekday">
                          <Select
                            value={String(config.by_weekday[0] ?? 1)}
                            onChange={(e) => update({ by_weekday: [parseInt(e.target.value)] })}
                          >
                            {WEEKDAYS.map((wd) => (
                              <option key={wd.value} value={wd.value}>{wd.label}</option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Start date */}
            <Field label="Start date">
              <Input
                type="date"
                value={config.dtstart}
                onChange={(e) => update({ dtstart: e.target.value })}
              />
            </Field>

            {/* End condition */}
            <div>
              <label className="text-xs text-pm-muted block mb-1">Ends</label>
              <div className="flex gap-3 mb-2">
                {(["never", "date", "count"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-1 text-xs text-pm-muted cursor-pointer">
                    <input
                      type="radio"
                      name="end_type"
                      checked={config.end_type === t}
                      onChange={() => setEndType(t)}
                      className="border-pm-border"
                    />
                    {t === "never" ? "Never" : t === "date" ? "On date" : "After count"}
                  </label>
                ))}
              </div>
              {config.end_type === "date" && (
                <Input
                  type="date"
                  value={config.until_date ?? ""}
                  onChange={(e) => update({ until_date: e.target.value || null })}
                />
              )}
              {config.end_type === "count" && (
                <Input
                  type="number"
                  min={1}
                  value={String(config.max_count ?? 10)}
                  onChange={(e) => update({ max_count: parseInt(e.target.value) || null })}
                  placeholder="Number of occurrences"
                />
              )}
            </div>

            {/* Summary */}
            {description && (
              <div className="text-xs text-pm-accent bg-pm-accent/5 rounded px-2 py-1.5">
                {description}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
