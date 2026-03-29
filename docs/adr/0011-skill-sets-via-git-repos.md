# 11. Skill sets via git repos

Date: 2026-03-29

## Status

Accepted

## Context

Tomo's skills system (`~/.tomo/skills/` and `.tomo/skills/`) works well for personal and project-specific skills, but there's no mechanism for sharing curated collections of skills across users or teams. We needed a delivery model for distributable, versioned skill collections.

Key requirements:

- Low friction to publish — no registry infrastructure, no package manager
- Low friction to consume — connect a source, pick what you want
- Familiar tooling — git is already part of every developer's workflow
- Granular opt-in — users should control which skills are active
- No conflicts — shared skills shouldn't silently shadow personal/local skills

## Decision

### Git repos as skill set sources

Skill sets are distributed via git repos. Users add a source URL in `/settings` → Skill Sets → Manage Sources, and Tomo clones the repo to `~/.tomo/skill-set-sources/`. This follows the Homebrew tap model — git repos as registries, no custom infrastructure needed.

Alternatives considered:

- **npm packages** — heavyweight for what are essentially markdown files. Adds publishing friction and a dependency on the npm ecosystem.
- **Convention-only (file drop)** — copying files manually has no versioning, no update story, and no way to share curated collections.
- **Central registry/marketplace** — requires infrastructure to host and maintain. Can be layered on top of the git model later if needed.

### tomo-skills.json as a skill set marker

A directory containing a `tomo-skills.json` file is a skill set. The file contains `name` (required) and `description` (optional). This explicit marker was chosen over pure convention (any directory with SKILL.md files) because repos may contain non-skill-set directories, and the marker makes discovery unambiguous.

### Opt-in activation with set-level toggles

Skill sets are toggled off by default when a source is first connected — users explicitly opt in per set. Toggling is at the skill set level, not per-skill, to keep the UX simple. Per-skill toggles can be added later if the need arises.

### Namespace skill set skills as setName:skillName

Skills from skill sets are namespaced (e.g. `dev:commit`) rather than sharing a flat namespace with global/local skills. This means a skill set's `commit` skill and a user's global `commit` skill coexist without conflict. The namespace also makes the source visible in `/skills` output and autocomplete.

Alternatives considered:

- **Flat namespace with precedence** (skill sets → global → local) — simpler naming but conflicts are silent. A user adding a global `commit` skill would unknowingly shadow the set's version with no indication.
- **Prefix only when conflicting** — context-dependent naming is confusing. Consistent namespacing is predictable.

### Shallow clone and git pull for updates

Sources are cloned with `--depth 1` to minimise disk usage. Updates are `git pull origin main` via an "Update Sources" action in settings. There is no version pinning — sources always track the main branch. Users who need stability can fork the source repo.

Version pinning (tags, lock files) was deferred as unnecessary complexity for the initial implementation. The git model makes it easy to add later if needed.

## Consequences

- Publishing a skill set is as simple as pushing a git repo with the right structure
- Users manage everything through `/settings` → Skill Sets (sources, toggles, updates)
- Skill set skills appear as `setName:skillName` everywhere — autocomplete, `/skills`, tool descriptions
- Failed source clones show warnings but don't block the settings UI
- Source repos are cached locally; disk usage grows with the number of sources
- No dependency resolution between skill sets — each set is independent
- The update model is simple (`git pull`) but offers no rollback beyond `git reflog` in the cache directory
