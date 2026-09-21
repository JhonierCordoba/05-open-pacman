// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 1 / 9; // 0.111... -> alinea cada 9 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

const SCATTER_SECONDS = 7;
const CHASE_SECONDS = 20;
const DT = 1 / 60;

// Por tipo de fantasma: velocidad, retardo de salida (s) y esquina de scatter.
const GHOST_CONFIG = {
  chaser:   { speed: 1 / 10, releaseAt: 0, corner: { x: 26, y: 0  } },
  ambusher: { speed: 1 / 12, releaseAt: 0, corner: { x: 0,  y: 0  } },
  flanker:  { speed: 1 / 12, releaseAt: 2, corner: { x: 26, y: 30 } },
  shy:      { speed: 1 / 15, releaseAt: 4, corner: { x: 0,  y: 30 } },
};

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    time: 0,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => {
      const cfg = GHOST_CONFIG[ g.kind ];
      return {
        x: g.x,
        y: g.y,
        dir: 'up',
        speed: cfg.speed,
        releaseAt: cfg.releaseAt,
        released: false,
        kind: g.kind,
      };
    } ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o pellet (provisional: el pellet cuenta como dot por ahora).
    const cell = grid[ p.y ][ p.x ];
    if ( cell === 2 || cell === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Objetivo del fantasma segun fase (scatter/chase) y su patron.
function ghostTarget( game, g ) {
  const cfg = GHOST_CONFIG[ g.kind ];
  if ( game.phase === 'scatter' ) return cfg.corner;

  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );

  if ( g.kind === 'chaser' ) {
    // Persigue la posicion redondeada de Pac-Man.
    return { x: px, y: py };
  }

  if ( g.kind === 'ambusher' ) {
    // 4 celdas hacia delante de Pac-Man segun su direccion.
    const d = DIRS[ p.dir ] || { x: 0, y: 0 };
    return { x: px + d.x * 4, y: py + d.y * 4 };
  }

  if ( g.kind === 'flanker' ) {
    // cazador + 2 x (puntoAhead(2) - cazador).
    const chaser = game.ghosts.find( ( h ) => h.kind === 'chaser' );
    const d = DIRS[ p.dir ] || { x: 0, y: 0 };
    const ahead = { x: px + d.x * 2, y: py + d.y * 2 };
    const cx = Math.round( chaser.x );
    const cy = Math.round( chaser.y );
    return { x: cx + 2 * ( ahead.x - cx ), y: cy + 2 * ( ahead.y - cy ) };
  }

  // shy: se acerca a Pac-Man solo si esta lejos (< 8 celdas).
  const dist = Math.abs( g.x - px ) + Math.abs( g.y - py );
  if ( dist > 8 ) return { x: px, y: py };
  return cfg.corner;
}

function decideGhost( game, g, target ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Seleccion codiciosa: minimizar la distancia Manhattan al objetivo.
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Liberacion escalonada: esperar hasta alcanzar el retardo de salida.
  if ( !g.released ) {
    if ( game.time < g.releaseAt ) return;
    g.released = true;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );

    // Dentro del pen (incluida la puerta): objetivo fijo de salida, la celda
    // abierta justo encima de la puerta. Al salir de esas filas, decideGhost
    // retoma el objetivo normal (scatter/chase).
    const insidePen =
      g.x >= PEN_BOUNDS.minX && g.x <= PEN_BOUNDS.maxX &&
      g.y >= PEN_BOUNDS.minY && g.y <= PEN_BOUNDS.maxY;
    const target = insidePen ? PEN_EXIT : ghostTarget( game, g );

    decideGhost( game, g, target );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    // Re-escalonar la salida sobre el tiempo actual de la partida.
    g.released = false;
    g.releaseAt = game.time + GHOST_CONFIG[ g.kind ].releaseAt;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.time += DT;
  const cycle = SCATTER_SECONDS + CHASE_SECONDS;
  game.phase = game.time % cycle < SCATTER_SECONDS ? 'scatter' : 'chase';

  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
