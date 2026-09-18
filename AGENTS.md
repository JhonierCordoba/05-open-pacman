# AGENTS.md

Pac-Man clone: vanilla JS + HTML + CSS. No build system, no package.json, no tests, no lint.
The repo's purpose is practicing spec-driven development.

## Run & verify
- Open `src/index.html` directly in a browser. Plain `<script>` tags, no bundler or server needed.
- There are no automated tests/lint/typecheck; verification is a manual playthrough.

## Architecture
- Browser globals, not ES modules. Scripts in `src/index.html` must load in dependency order:
  `maze.js` → `game.js` → `render.js` → `main.js`. New JS files go into that list at the right position.
- Cross-file state is exported explicitly via `window.*` at the bottom of each JS file.
- Maze grid values (`maze.js`): `1` wall, `2` dot, `3` door, `0` empty. Source of truth is the ASCII
  `MAZE_STR` (28x31) parsed at load.
- `MAZE` is pristine and never mutated; each game copies it into `game.grid` (dots are eaten there).
  Never mutate `MAZE` directly.
- Movement is frame-based (`requestAnimationFrame` loop in `main.js`); speeds are fractions of a cell
  per frame (`PACMAN_SPEED = 0.125`, `GHOST_SPEED = 0.1`, so alignment happens every 8/10 frames).

## Conventions
- Comments, UI text, and README are in Spanish. Write code comments and specs in Spanish.
- Code style puts spaces inside parens (e.g. `createGame( )`, `( e ) =>`). Don't reformat existing files.

## Spec-driven development workflow
- `/spec` designs a feature into `specs/NN-slug.md` (numbered sequentially, state `Draft`).
  The user marks it `Approved`/`Aprobado` manually; then `/spec-impl` implements it on branch
  `spec-NN-slug`, pausing after each plan step for diff review.
- `specs/` doesn't exist yet — `.agents/skills/spec/SKILL.md` and `spec-impl/SKILL.md` define the whole flow.