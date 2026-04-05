# Reporting and Executive Summary Spec

## Purpose

This document defines the reporting layer for `FSA Project Management` and future client projects that follow the same documentation-first operating model.

The goal is to make Paperclip useful not only for execution, but also for:

- daily board updates
- project health visibility
- blocker and risk escalation
- plain-English executive reporting

## Principles

- Reports must be understandable by a non-technical operator in under 2 minutes.
- Reports should summarize real board state, not generic narration.
- Project documentation remains the source of truth.
- Paperclip should surface progress, risk, and decisions needed.
- Reporting should work for both internal projects and client-facing engagements.

## Core Outputs

### 1. Daily Executive Summary

Generated once per business day by a Paperclip routine.

Required sections:

- completed today
- newly started work
- currently blocked items
- active work in progress
- risks and watch items
- decisions needed from the board
- likely next focus

Tone:

- concise
- plain English
- executive-ready
- no unnecessary technical detail unless it materially affects scope, risk, timeline, or cost

### 2. Live Reports View

A UI page in the Paperclip board should provide a fast rollup of:

- completed work in a selected time window
- newly started work in a selected time window
- active work
- blocked work
- live runs
- project-level snapshot metrics
- a generated executive summary block

Initial filter set:

- today
- last 7 days
- last 30 days
- optional project filter

### 3. Weekly / Client-Facing Summary

Future extension:

- weekly rollup by client or project
- export-friendly summary
- optional email/slack handoff via automation

## Data Sources

The reporting layer should derive from Paperclip entities in this order:

1. issues
2. issue comments / completion notes
3. project grouping
4. live run state
5. approvals / blockers when relevant

Project docs remain the strategic source of truth, but reporting should primarily summarize actual execution state from the board.

## Routine Design

The first recurring routine should be:

- title: `Daily executive board summary`
- owner: `PM`
- project: `FSA Project Management`
- cadence: weekdays near end of business day

Routine instructions should tell the assignee to:

- review recent issue activity across the company or scoped project
- summarize what changed
- call out blockers and risks
- avoid inventing progress that does not exist
- write for a board/executive audience

## UX Goals

The reports experience should answer:

- What got done?
- What is moving?
- What is stuck?
- What needs me?
- What should happen next?

The operator should not have to inspect multiple issues manually to get a same-day understanding of progress.

## Future Enhancements

- decision register integration
- export to markdown / PDF
- per-client reporting templates
- scheduled email or Slack delivery
- weekly / monthly finance rollups
- richer “board packet” summaries combining project, cost, and risk views

## Operational Rule

For new projects using the standard FSA doc structure, reporting should be treated as part of the operating system:

- docs define the plan
- issues define the execution queue
- reports define the current board understanding
