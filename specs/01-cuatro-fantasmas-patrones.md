# SPEC 01 — Cuatro fantasmas con patrones de movimiento

> **Status:** Draft
> **Depends on:** (ninguno)
> **Date:** 2026-09-21
> **Objective:** Añadir cuatro fantasmas con patrones de movimiento diferenciados, uno de ellos persigue a Pac-Man agresivamente, con fases de scatter y salida escalonada.

## Scope

**In:**

- 4 fantasmas en lugar de 2, cada uno con un patrón propio: Cazador, Emboscador, Flanqueador y Tímido.
- Fase scatter con ciclo fijo: 7 s hacia la esquina asignada / 20 s de persecución, repitiéndose toda la partida.
- Cada fantasma tiene una esquina propia para el scatter.
- Salida escalonada de la pen con retardos 0 / 0 / 2 / 4 s.
- Velocidad por patrón: el Cazador a 0.125 celdas/frame, el resto a 0.1.
- El Cazador obedece el scatter igual que los demás (no persigue siempre).
- Los 4 fantasmass se dibujan con el color clásico de su patrón.

**Out of scope (specs futuras):**

- Modo frightened (fantasmas azules comibles) y power pellets: requiere su propia spec.
- Pathfinding de ruta completa (BFS/A*): se reutiliza la elección codiciosa de celda actual.
- Evitar choques entre fantasmas (cada uno decide sin mirar a los otros).

## Data model

```js
// maze.js
const GHOST_STARTS = [
  { x: 13, y: 13, kind: 'chaser' },
  { x: 14, y: 13, kind: 'ambusher' },
  { x: 13, y: 15, kind: 'flanker' },
  { x: 14, y: 15, kind: 'shy' },
];
```

```js
// game.js — constantes nuevas
const SCATTER_SECONDS = 7;
const CHASE_SECONDS = 20;
const DT = 1 / 60;

// Por tipo de fantasma: velocidad, retardo de salida (s) y esquina de scatter.
const GHOST_CONFIG = {
  chaser:   { speed: 0.125, releaseAt: 0, corner: { x: 26, y: 0  } },
  ambusher: { speed: 0.1,   releaseAt: 0, corner: { x: 0,  y: 0  } },
  flanker:  { speed: 0.1,   releaseAt: 2, corner: { x: 26, y: 30 } },
  shy:      { speed: 0.1,   releaseAt: 4, corner: { x: 0,  y: 30 } },
};
```

- `game.time` se suma `DT` en cada `update()`. Se usa para el ciclo scatter y los retardos de salida.
- Cada fantasma copia `speed` y `releaseAt` de `GHOST_CONFIG[ g.kind ]` y guarda `released: false`.

**Objetivos de persecución (modo chase):**

- `chaser`: la posición redondeada de Pac-Man.
- `ambusher`: Pac-Man + 4 celdas hacia delante en su dirección actual.
- `flanker`: apunta a `cazador + 2 × (puntoAhead(2) − cazador)`, donde `puntoAhead(2)` = Pac-Man + 2 celdas hacia delante. Usa la posición del Cazador.
- `shy`: si la distancia Manhattan a Pac-Man (redondeado) > 8 → Pac-Man; si ≤ 8 → su esquina de scatter.

**Modo scatter:** todos apuntan a su esquina.

La selección de celda sigue siendo la codiciosa actual de `decideGhost` (elegir dirección que minimice la distancia Manhattan al objetivo, sin retroceder si hay salida).

## Implementation plan

1. **`maze.js`**: sustituir `GHOST_STARTS` por las 4 posiciones con su `kind`. La partida sigue arrancando.
2. **`game.js` — estado**: añadir `SCATTER_SECONDS`, `CHASE_SECONDS`, `DT`, `GHOST_CONFIG`; en `createGame()` montar los 4 fantasmas con `speed`, `releaseAt` y `released` desde la config (se elimina el uso de `g.kind` para decidir velocidad). Comprobar en consola que `createGame()` devuelve 4 fantasmas.
3. **`game.js` — reloj**: en `update()` acumular `game.time += DT`. Definir `phase = scatter` si `game.time % (SCATTER_SECONDS + CHASE_SECONDS) < SCATTER_SECONDS`, si no `chase`.
4. **`game.js` — liberación**: `moveGhost` no mueve a un fantasma mientras `!g.released && game.time < g.releaseAt`; al pasar el retardo, `g.released = true` y sale por la puerta como ya lo hacen.
5. **`game.js` — decisión**: en `decideGhost`, según `kind` y `phase`, calcular el objetivo con la función de su patrón y seguir la selección codiciosa. Mantener el `random` como respaldo sin salida.
6. **`render.js`**: reordenar `GHOST_COLORS` a `[ '#ff0000', '#ffb8ff', '#00ffff', '#ffb852' ]` para que coincida el orden chaser/ambusher/flanker/shy con el clásico rojo/rosa/cian/naranja. Verificación visual.
7. **Verificación final**: partida completa a mano (ver criterios).

## Acceptance criteria

- [ ] El juego carga sin errores en la consola.
- [ ] El Cazador persigue a Pac-Man de forma continua y es más rápido que el resto.
- [ ] El Emboscador tiende a colocarse por delante de Pac-Man (4 celdas en su dirección).
- [ ] El Flanqueador se comporta según la posición del Cazador y Pac-Man.
- [ ] El Tímido se acerca a Pac-Man y, al estar a ≤ 8 celdas, se dirige a su esquina.
- [ ] Durante los primeros 7 s de cada ciclo, los fantasmass liberados se dirigen a sus esquinas.
- [ ] Tras los 20 s de persecución, el ciclo vuelve a empezar (scatter cada 27 s).
- [ ] Flanqueador sale de la pen a los 2 s y Tímido a los 4 s de empezar la partida.
- [ ] Colisionar con cualquier fantasma resta una vida y reinicia posiciones (comportamiento previo intacto).

## Decisions

- **Sí:** patrones clásicos adaptados. Maximizan diferenciación y son reconocibles.
- **No:** patrones custom (ambusher fijo, waypoints). Menos clásicos y más difíciles de afinar.
- **Sí:** scatter dentro (7/20 fijo). El usuario lo pidió explícitamente.
- **No:** frightened / power pellets. Requieren otra spec (no existen power pellets).
- **Sí:** salida escalonada 0/0/2/4 s. Estilo arcade, simple.
- **No:** BFS/A*. La codiciosa ya implementada es suficiente para esta spec.
- **Sí:** velocidades por patrón (Cazador 0.125, resto 0.1). Refuerza la sensación de "agresivo".
- **Sí:** el Cazador obedece el scatter. Más predecible; su agresividad viene de velocidad + persecución directa.

## Risks

| Riesgo                                  | Mitigación                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------- |
| Temporizadores ligados al framerate     | `DT` fijo (1/60) y el movimiento ya es frame-based: ambos van sincronizados. |
| Objetivos del flanker fuera del plano   | Se usa posición calculada aunque no sea una celda del grid (igual que el chaser); los cortes se hacen en celdas reales. |

## What is **not** in this spec

- Power pellets ni fantasmas comibles (spec futura).
- Scatter progresivo por fases (early/mid/late).
- Pathfinding de ruta completa.
- Evitar colisiones fantasma-fantasma.

Cada una de esas, si llega, va en su propia spec.