# SPEC 03 — Power pellets y modo frightened

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-09-21
> **Objective:** Añadir 4 power pellets en las esquinas del laberinto que, al comerlos, dan a Pac-Man invencibilidad total temporal, más velocidad y la capacidad de comerse a los fantasmas (modo frightened).

## Scope

**In:**

- Nuevo valor de grid `4` (power pellet) en `maze.js`, en las 4 posiciones clásicas `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)`, reemplazando un dot en cada una.
- Comer un pellet: +50 puntos, descuenta un punto de `dotsRemaining` (cuenta para la condición de victoria) y deja la celda a `0`.
- Efecto de **6 s** al comer un pellet: Pac-Man **invencible** (no puede morir bajo ninguna circunstancia), velocidad de Pac-Man a `1/6`, fantasmas en modo **frightened**: azules, a `1/15`, eligen dirección al azar en cada cruce (sin retroceder).
- Comer otro pellet durante el efecto **reinicia** el contador a 6 s (no se acumulan).
- Comer un fantasma frightened: puntos en cadena **200 / 400 / 800 / 1600**; el fantasma se convierte en **ojos** a `1/7` que vuelven a su celda del pen y quedan encerrados hasta el final del efecto; al acabar, reaparecen como fantasma normal saliendo escalonado `0/0/2/4 s`. La cadena de puntos se reinicia con cada nuevo efecto.
- Parpadeo clásico de aviso: los **2 últimos segundos** del efecto, los fantasmas frightened parpadean azul/blanco.
- Render: pellets como punto grande pulsante; fantasmas frightened azules con cara blanca; ojos como solo-ojos blancos sin cuerpo.

**Out of scope (specs futuras):**

- Atravesar muros: la invencibilidad es solo frente a fantasmas; paredes y puertas (`1`/`3`) siguen bloqueando a Pac-Man.
- Niveles, frutas ni bonus; HUD con el tiempo restante del efecto (se puede ver el color/parpadeo).
- Guardar récords ni persistencia.
- Cambiar `MAZE_STR` más allá de los 4 pellets ni los timers de scatter/chase.

## Data model

El valor `4` vive en el ASCII (fuente de verdad). Se editan las filas 3 y 23 de `MAZE_STR` (las filas con los 4 pellets), col 1 y col 26:

```js
// maze.js — legend actualizado: '#'=1, 'o'=4 power pellet
function parseTile( ch ) {
  if ( ch === '#' ) return 1;
  if ( ch === '.' ) return 2;
  if ( ch === 'o' ) return 4;
  if ( ch === '-' ) return 3;
  return 0;
}
```

```js
// game.js — constantes nuevas
const POWER_PELLET_SECONDS = 6;
const POWER_PELLET_SCORE = 50;
const FRIGHT_SPEED = 1 / 6;        // pacman durante el efecto (alinea cada 6 frames)
const FRIGHT_GHOST_SPEED = 1 / 15; // fantasmas frightened
const EYES_SPEED = 1 / 7;          // ojos volviendo al pen
const BLINK_SECONDS = 2;
const FEAR_CHAIN = [ 200, 400, 800, 1600 ];
```

Estado por partida (en `createGame`):

```js
// game
powerOn: false,      // efecto activo
powerLeft: 0,        // segundos restantes
fearChain: 0,        // indice en FEAR_CHAIN (0..3)
// cada fantasma: state y home nuevos
{ ..., state: 'normal', home: GHOST_STARTS[ i ] } // 'normal' | 'frightened' | 'eyes'
```

- `createGame` cuenta dots y pellets: `if ( v === 2 || v === 4 ) dots++`.
- `pacman.speed` cambia a `FRIGHT_SPEED` al activar el efecto y vuelve a `PACMAN_SPEED` al terminarlo. Idem fantasmas: `FRIGHT_GHOST_SPEED` / `EYES_SPEED` mientras estén, y a su speed de `GHOST_CONFIG` al volver a `normal`.

## Implementation plan

1. **`maze.js`** — el valor `4`: añadir `'o'` al legend y a `parseTile`, y cambiar en `MAZE_STR` los 4 dots de filas 3 y 23 por `'o'`. `createGame` cuenta `2 || 4`. `movePacman`: comer un pellet provisionalmente como dot (10 ptos, `grid=0`, `dotsRemaining--`). Verificación: los 4 pellets son comestibles y siguen contando para ganar (aún sin poder ni render).
2. **`render.js` — pellets**: en `drawDots`, `v === 4` se dibuja como punto grande con pulso (radio 5–6 oscilando con `frame`). `draw` ya pasa `frame`. Verificación: 4 puntos grandes pulsantes en las esquinas.
3. **`game.js` — estado del efecto**: añadir las constantes y el estado nuevo; `movePacman` con `v === 4` → `score += POWER_PELLET_SCORE` y activar el efecto. `update()` descuenta `powerLeft` por `DT`. Verificación por consola: comer pellet pone `powerOn` y lo quita a los 6 s.
4. **`game.js` — frightened e invencibilidad**: `startPower` (se activa en `movePacman`): `powerLeft = POWER_PELLET_SECONDS`, `pacman.speed = FRIGHT_SPEED`, `fearChain = 0`, y todos los fantasmas `state='frightened'`, `speed = FRIGHT_GHOST_SPEED`. `endPower` (cuando `powerLeft` llega a 0): `pacman.speed = PACMAN_SPEED`, cada fantasma vuelve a `'normal'` y a su speed config y los ojos pendientes salen escalonados. En `decideGhost`, prioridad: `eyes → home`; dentro del pen (`PEN_BOUNDS`) → `PEN_EXIT`; `frightened →` dirección aleatoria entre válidas sin retroceso; resto → IA normal. En la colisión de `update`, con `powerOn` **nunca** se resta vida. Verificación: durante 6 s no se puede morir y los fantasmas azules van al azar a `1/15`.
5. **`game.js` — comer fantasma y ojos**: al colisionar con un fantasma `'frightened'`: `score += FEAR_CHAIN[ fearChain ]`, `fearChain = Math.min( fearChain + 1, 3 )`, fantasma `→ state='eyes'`, `speed = EYES_SPEED`. Ojos: `decideGhost` apunta a su `home`; al alinear en su `home` con efecto activo se detienen. `endPower` convierte cada ojo en `'normal'`, `released=false`, `releaseAt = game.time + GHOST_CONFIG[ kind ].releaseAt`. Verificación: encadenar fantasmas suma 200/400/800/1600, los ojos vuelven al pen y salen escalonados al acabar el efecto.
6. **`render.js` — frightened/ojos/parpadeo**: `drawGhost` según `state`: `frightened` → cuerpo azul (`#2121ff`) y cara blanca con pupilas pequeñas; si `powerLeft <= BLINK_SECONDS` y el frame es impar → cuerpo blanco (parpadeo); `eyes` → solo ojos blancos sin cuerpo. `GHOST_COLORS` queda solo para `normal`. Verificación visual: azul → parpadeo → ojos volviendo.
7. **`game.js` — limpieza defensiva**: en `resetPositions`, limpiar `powerOn/powerLeft` y volver cada fantasma a `state='normal'` (con la invencibilidad no debería dispararse durante el efecto; se limpia igual). Verificación: partida completa a mano.

## Acceptance criteria

- [ ] El juego carga sin errores en la consola.
- [ ] Hay 4 pellets visibles como puntos grandes pulsantes en `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)`.
- [ ] Comer un pellet suma exactamente 50 puntos y descuenta 1 de `dotsRemaining` (afecta a la victoria).
- [ ] Comer un pellet activa el efecto y este dura exactamente 6 s.
- [ ] Comer otro pellet durante el efecto reinicia el contador a 6 s.
- [ ] Durante el efecto, Pac-Man no pierde vidas en ningún caso (invencible) y se mueve a `1/6`.
- [ ] Durante el efecto, los fantasmas son azules, van a `1/15` y eligen dirección al azar en cada cruce sin retroceder.
- [ ] Comer fantasmas encadenados suma 200, 400, 800 y 1600 en ese orden; la cadena reinicia en 200 con cada efecto nuevo.
- [ ] Un fantasma comido se convierte en ojos a `1/7` que vuelven a su celda del pen y esperan ahí hasta el final del efecto.
- [ ] Al terminar el efecto, los ojos reaparecen como fantasma normal saliendo escalonado `0/0/2/4 s` y Pac-Man vuelve a `1/9`.
- [ ] Los 2 últimos segundos del efecto, los fantasmas frightened parpadean entre azul y blanco.
- [ ] Fuera del efecto, todo el comportamiento de SPEC 01/02 queda intacto (scatter/chase, salida del pen, velocidades) y chocar con un fantasma resta una vida y reinicia posiciones.

## Decisions

- **Sí (usuario):** frightened clásico: azules, más lentos y elección **aleatoria** en cada cruce. No huyen de forma calculada; fiel al arcade.
- **Sí (usuario):** invencibilidad **total** durante el efecto: con `powerOn` no se pierde vida jamás.
- **Sí (usuario):** ojos con puntos en cadena 200/400/800/1600, vuelven al pen y **reaparecen al acabar el efecto** (no en mitad). La cadena se resetea con cada nuevo efecto.
- **Sí (usuario):** duración 6 s con **reinicio** (comer otro pellet resetea el contador). No se acumulan efectos.
- **Sí (usuario):** velocidades `1/6` (Pac-Man), `1/15` (frightened), `1/7` (ojos). Fracciones unitarias que conservan la alineación a celdas.
- **Sí (usuario):** posiciones clásicas `(1,3)/(26,3)/(1,23)/(26,23)` reemplazando un dot.
- **Sí (usuario):** parpadeo de aviso los 2 últimos segundos.
- **Sí:** pellet vale 50 y cuenta para la condición de victoria (como un dot).
- **Sí:** `4` en el ASCII (`'o'`). La fuente de verdad sigue siendo `MAZE_STR`.
- **No:** invencible no significa atravesar muros: `1`/`3` bloquean como siempre.
- **No:** HUD con tiempo restante ni niveles/frutas/récords (specs propias).
- **No:** reaparición de ojos en mitad del efecto (contradice la invencibilidad pedida).

## Risks

| Riesgo | Mitigación |
| ------ | ---------- |
| Fantasmas frightened dentro del pen que no quieran salir (elección aleatoria) | La prioridad del pen (`PEN_EXIT`) se aplica antes que la aleatoria, así que los del pen salen igual. |
| Varios ojos entrando a la vez por la puerta de 2 celdas | `decideGhost` de ojos reutiliza la codiciosa y los fantasmas ignoran la celda puerta (3); el riesgo de bloqueo es bajo; si se observa, escalonar los ojos con un `releaseAt` relativo. |
| `powerLeft` ligado al framerate | `DT` fijo (1/60) ya sincroniza el reloj con el movimiento (misma base que SPEC 01/02). |
| Comer un fantasma "por el borde" de la tolerancia de `collides` (0.5 celdas) | El cambio de estado a `eyes` ocurre en el instante de la colisión; un ojo nunca daña aunque quede superpuesto. |

## What is **not** in this spec

- Atravesar muros / cualquier invencibilidad que no sea frente a fantasmas.
- HUD del temporizador del efecto.
- Niveles, frutas, bonus ni récords.
- Cambios de timers de scatter/chase o del resto del laberinto.

Cada una de esas, si llega, va en su propia spec.