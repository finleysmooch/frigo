# Frigo Project Documentation

## For Claude Code

Read these at the start of every session:

| File | Purpose | You Should |
|------|---------|------------|
| `FRIGO_ARCHITECTURE.md` | Codebase map, data model, patterns, services | **Read** for context |
| `SESSION_LOG.md` | Execution reports from Claude Code sessions | **Write** after every session |

Read these if referenced in prompt:

| File | Purpose | You Should |
|------|---------|------------|
| `DEFERRED_WORK.md` | Master backlog of bugs, tech debt, deferred items | **Read** for awareness |


## For Tom

| File | Purpose |
|------|---------|
| `doc-ecosystem.html` | Visual map of how all docs relate — open in browser |
| `README.md` | This file |

## File Index

| File | Purpose | Who writes |
|------|---------|-----------|
| `FRIGO_ARCHITECTURE.md` | Codebase map and patterns | Claude.ai produces → Tom pushes |
| `DEFERRED_WORK.md` | Master backlog of bugs, tech debt, ideas | Claude.ai produces at phase completion → Tom pushes |
| `SESSION_LOG.md` | Execution reports after every Claude Code session | Claude Code |
| `README.md` | This file | Updated when docs/ changes |
| `doc-ecosystem.html` | Visual doc map (for Tom, not Claude) | Claude.ai produces → Tom pushes |

## How It Works

Claude.ai (planning) owns the active phase doc and all living docs in project knowledge. Claude Code (execution) reports back via SESSION_LOG. Claude.ai reads the log and reconciles.

**Claude Code's one writing responsibility:** Write a detailed SESSION_LOG entry after every session. Include files changed, decisions made, things deferred, and recommended updates to ARCHITECTURE or other docs. See the entry format template in SESSION_LOG.md.

**Do not edit** FRIGO_ARCHITECTURE.md, DEFERRED_WORK.md, or other living docs directly. Flag recommended changes in your SESSION_LOG entry.

Full process details: see DOC_MAINTENANCE_PROCESS.md in Claude.ai project knowledge.

## What Does NOT Live Here

These live in Claude.ai project knowledge only — Claude Code doesn't need them:

- **Active phase doc** (e.g. PHASE_4_COOKING_STATS.md) — current goals, decisions, progress
- **PROJECT_CONTEXT** — high-level project overview and onboarding
- **Historical phase docs** (PHASE_1, PHASE_2, PHASE_3) — archived reference
- **Feature specs** (MEALS_*, SHARED_PANTRIES_*, etc.)
- **DOC_MAINTENANCE_PROCESS** — the full documentation workflow