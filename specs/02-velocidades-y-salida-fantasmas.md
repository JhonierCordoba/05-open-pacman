# SPEC 02 — Velocidades de Pac-Man y salida escalonada de fantasmas

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-09-21
> **Objective:** Ralentizar un poco el movimiento del juego, garantizar que ningún fantasma sea más rápido que Pac-Man y arreglar la salida escalonada de los fantasmas para que ninguno se quede trabado dentro del pen.

## Scope

**In:**

- Nueva tabla de velocidades: `PACMAN_SPEED = 1/9`; chaser `1/10`, ambusher `1/12`, flanker `1/12`, shy `1/15`. Fracciones unitarias que conservan la alineación limpia a celdas (cada actor alinea en un número entero de frames).
- Regla verificable: la velocidad de cada fantasma es `≤ PACMAN_SPEED` (igualdad permitida; en la práctica resultan todas estrictamente menores que Pac-Man).
- Rutina de salida del pen: mientras un fantasma esté dentro de los límites del pen, ignora scatter/chase y se dirige a la celda de salida situada justo encima de la puerta. Al salir de las filas del pen, retoma `decideGhost`/`ghostTarget` normal.
- Escalado con los `releaseAt` actuales (`0 / 0 / 2 / 4` s), que pasa a funcionar de verdad gracias a la rutina de salida (los fantasmas salen por la puerta uno a uno en lugar de deambular por el interior).
- `resetPositions` re-escalona la salida: todos los fantasmas vuelven a `released: false` y se recalcula su `releaseAt` sobre el tiempo actual de la partida.

**Out of scope (specs futuras):**

- Power pellets ni modo frightened (fantasmas azules comibles) y ojos volviendo al pen: requiere su propia spec.
- Nuevos niveles, frutas ni bonus.
- Cambiar los timers de scatter/chase (`SCATTER_SECONDS`/`CHASE_SECONDS`) ni el laberinto (`MAZE_STR`).
- Modificar `render.js` (solo cambia la velocidad a la que se mueven los actores dibujados).

## Data model

La geometría del pen vive en `maze.js` (fuente de verdad del grid). Se añaden tres constantes y se exportan por `window.*`:

```js
// maze.js — interior del pen (filas 13-15, cols 11-15), puerta en fila 12 cols 13-14
const PEN_BOUNDS = { minX: 11, minY: 13, maxX: 15, maxY: 15 };
const DOOR_COLS = [ 13, 14 ];
const PEN_EXIT = { x: 14, y: 11 }; // celda abierta justo encima de la puerta
```

Cambios de velocidad en `game.js` (el resto de `GHOST_CONFIG` no cambia):

```js
const PACMAN_SPEED = 1 / 9; // 0.111... -> alinea cada 9 frames
const GHOST_CONFIG = {
  chaser:   { speed: 1 / 10, releaseAt: 0, corner: { x: 26, y: 0  } },
  ambusher: { speed: 1 / 12, releaseAt: 0, corner: { x: 0,  y: 0  } },
  flanker:  { speed: 1 / 12, releaseAt: 2, corner: { x: 26, y: 30 } },
  shy:      { speed: 1 / 15, releaseAt: 4, corner: { x: 0,  y: 30 } },
};
```

No se introduce ninguna estructura nueva por partida. "Dentro del pen" se deduce con `PEN_BOUNDS` (no hace falta flag nuevo); `released` y `releaseAt` (segundos absolutos sobre `game.time`) ya existen.

## Implementation plan

1. **`maze.js`**: añadir y exportar `PEN_BOUNDS`, `DOOR_COLS`, `PEN_EXIT`. El juego sigue funcionando igual (constantes aún sin usar).
2. **`game.js` — velocidades**: `PACMAN_SPEED = 1/9` y las 4 speeds de `GHOST_CONFIG`. Verificación: el juego carga y Pac-Man se mueve más lento (alinea cada 9 frames).
3. **`game.js` — rutina de salida del pen**: en `moveGhost`, tras liberarse, si el fantasma está dentro de `PEN_BOUNDS`, `decideGhost` debe usar `PEN_EXIT` como objetivo en lugar de `ghostTarget`. Al salir de las filas del pen usa la lógica normal. Verificación: los 4 fantasmas salen por la puerta en orden, sin orbitar dentro.
4. **`game.js` — re-escalonado tras perder vida**: en `resetPositions`, poner `released = false` en todos los fantasmas y `releaseAt = game.time + cfg.releaseAt`. Verificación: al perder una vida, los fantasmas vuelven al pen y salen de nuevo uno a uno.

## Acceptance criteria

- [ ] `PACMAN_SPEED` vale `1/9` y todas las speeds de `GHOST_CONFIG` son `≤ PACMAN_SPEED`.
- [ ] Al iniciar partida, los 4 fantasmas salen del pen por la puerta; ninguno se queda orbitando dentro durante 60 s de observación.
- [ ] El orden de salida es chaser y ambusher (juntos, ~seg 0), flanker (~seg 2) y shy (~seg 4).
- [ ] Fuera del pen, los fantasmas persiguen con scatter/chase igual que en SPEC 01 (misma `decideGhost`/`ghostTarget`).
- [ ] Al perder una vida, los fantasmas reaparecen en el pen y vuelven a salir escalonados con el mismo desfase relativo.
- [ ] `MAZE`, `SCATTER_SECONDS`/`CHASE_SECONDS` y la jugada Pac-Man/dots/lives quedan intactos.
- [ ] Colisionar con un fantasma sigue restando una vida y reiniciando posiciones.

## Decisions

- **Sí:** tabla `1/9 · 1/10 · 1/12 · 1/12 · 1/15`. Fracciones unitarias → cada actor alinea en un número entero de frames y no acumula deslizamiento entre celdas.
- **No:** dejar a Pac-Man en `0.125` y bajar solo a los fantasmas. El pedido dice "el juego más lento", que afecta a ambos.
- **Regla:** se permite la igualdad (`≤`), pero la tabla elegida resulta estrictamente inferior de todos modos (`0.111 > 0.1`).
- **Sí:** rutina de salida con objetivo `PEN_EXIT` mientras el fantasma esté en `PEN_BOUNDS`. Reutiliza `decideGhost` y no toca los muros.
- **No:** teletransportar el fantasma a la salida. Más simple, pero menos fiel e introduce un salto visual.
- **No:** permitir giros de 180° dentro del pen. Parche local que no garantiza la salida.
- **Sí:** mantener `releaseAt` en `0/0/2/4` (pedido del usuario: "corregir releaseAt actual"); la escalada la garantiza la rutina de salida.
- **Sí:** re-escalonar tras perder vida recalculando `releaseAt` sobre `game.time`.

## Risks

| Riesgo                                  | Mitigación                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------- |
| chaser y ambusher (`releaseAt: 0`) se empujan en la puerta de 2 celdas | Ambos comparten objetivo y la puerta tiene 2 celdas de ancho; si se observa bloqueo, subir ambusher a `releaseAt: 1` (decisión ya prevista de implementación). |
| Recalcular `releaseAt` sobre `game.time` en partidas largas | Los desfases relativos (0/2/4) se conservan; la hora absoluta solo fija los incrementos. |

## What is **not** in this spec

- Power pellets ni modo frightened / fantasmas comidos (spec propia).
- Niveles, frutas ni nuevos laberintos.
- Cambios de timers de scatter/chase o de `render.js`.

Cada una de esas, si llega, va en su propia spec.