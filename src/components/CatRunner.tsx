/**
 * Cat Run — an endless-runner easter egg behind the mascot. Same rules as the
 * classic browser dinosaur game (jump the obstacles, duck the flyers, speed
 * creeps up, one hit ends it) but drawn entirely in DayScore's own language:
 * the runner is the CatAvatar and obstacles are heatmap day-squares.
 *
 * The loop mutates DOM nodes through refs at 60fps; React state only changes
 * on phase transitions (ready → running → over), never per frame.
 */
import { useEffect, useRef, useState } from "react";
import { CatAvatar } from "./CatAvatar";
import { CloseIcon } from "./Icons";

const STAGE_H = 240; // px
const GROUND_PAD = 28; // px between stage bottom and the ground line
const CAT_X = 24;
const CAT_SIZE = 60;
// The blob doesn't fill its viewBox; trim the box so collisions feel fair.
const CAT_BOX = { w: CAT_SIZE * 0.52, h: CAT_SIZE * 0.62, duckH: CAT_SIZE * 0.36, inset: 4 };
const CELL = 20; // obstacle square, matches the heatmap feel
const CELL_GAP = 3;
const GRAVITY = 2600; // px/s²
const JUMP_V = 880; // px/s
const FAST_FALL = 1400; // extra px/s when ducking mid-air
const SPEED_0 = 340; // px/s
const SPEED_MAX = 720;
const SPEED_RAMP = 9; // px/s gained per second
const FLYER_AFTER = 22; // seconds before duck-under obstacles appear
// Bottom offset that clears a ducked cat (box top ≈ 18px) but hits a standing
// one (box top ≈ 33px) — keep between the two or ducking becomes pointless.
const FLYER_Y = 24;
const HI_KEY = "dayscore:runner:hi";

interface Obstacle {
  el: HTMLDivElement;
  x: number;
  y: number; // bottom offset from ground
  w: number;
  h: number;
}

const pad5 = (n: number) => String(Math.min(n, 99999)).padStart(5, "0");

function loadHi(): number {
  try {
    const n = Number(localStorage.getItem(HI_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function saveHi(n: number) {
  try {
    localStorage.setItem(HI_KEY, String(n));
  } catch {
    /* best effort */
  }
}

export function CatRunner({ onClose }: { onClose: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLDivElement>(null);
  const catPoseRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState<"ready" | "running" | "over">("ready");
  const [finalScore, setFinalScore] = useState(0);
  const [hi, setHi] = useState(loadHi);

  // The engine lives in one effect for the component's lifetime; phase
  // transitions are pushed out through setPhase.
  useEffect(() => {
    const stage = stageRef.current!;
    const cat = catRef.current!;
    const pose = catPoseRef.current!;
    const field = fieldRef.current!;
    const scoreEl = scoreRef.current!;
    const stageW = () => stage.clientWidth;

    let raf = 0;
    let last = 0;
    let running = false;
    let over = false;
    let y = 0; // cat bottom offset from ground (0 = grounded)
    let vy = 0;
    let ducking = false;
    let speed = SPEED_0;
    let distance = 0;
    let elapsed = 0;
    let obstacles: Obstacle[] = [];

    const setPose = () => {
      pose.classList.toggle("runner-duck", ducking && y === 0);
      pose.classList.toggle("runner-air", y > 0);
      pose.classList.toggle("runner-run", running && y === 0 && !ducking);
    };

    const reset = () => {
      for (const o of obstacles) o.el.remove();
      obstacles = [];
      y = 0;
      vy = 0;
      ducking = false;
      speed = SPEED_0;
      distance = 0;
      elapsed = 0;
      over = false;
      cat.style.transform = "translateY(0)";
      scoreEl.textContent = pad5(0);
      setPose();
    };

    const spawn = () => {
      const flyer = elapsed > FLYER_AFTER && Math.random() < 0.28;
      const cols = flyer ? (Math.random() < 0.5 ? 1 : 2) : Math.random() < 0.6 ? 1 : 2;
      const rows = flyer ? 1 : 1 + Math.floor(Math.random() * 3);
      const w = cols * CELL + (cols - 1) * CELL_GAP;
      const h = rows * CELL + (rows - 1) * CELL_GAP;
      const el = document.createElement("div");
      el.className = "runner-obstacle";
      el.style.width = `${w}px`;
      el.style.gridTemplateColumns = `repeat(${cols}, ${CELL}px)`;
      for (let i = 0; i < cols * rows; i++) {
        const cell = document.createElement("div");
        cell.style.background = `var(--score-${6 + Math.floor(Math.random() * 5)})`;
        el.appendChild(cell);
      }
      const o: Obstacle = { el, x: stageW() + w, y: flyer ? FLYER_Y : 0, w, h };
      el.style.bottom = `${GROUND_PAD + o.y}px`;
      field.appendChild(el);
      obstacles.push(o);
    };

    const gapUntilNext = () => 190 + Math.random() * 320 + speed * 0.35;
    let nextSpawnAt = 0; // distance at which the next obstacle appears

    const collide = (o: Obstacle) => {
      const catH = ducking && y === 0 ? CAT_BOX.duckH : CAT_BOX.h;
      const cx = CAT_X + (CAT_SIZE - CAT_BOX.w) / 2 + CAT_BOX.inset;
      const cw = CAT_BOX.w - CAT_BOX.inset * 2;
      const cy = y + CAT_BOX.inset; // bottom
      const ch = catH - CAT_BOX.inset * 2;
      return cx < o.x + o.w && cx + cw > o.x && cy < o.y + o.h && cy + ch > o.y;
    };

    const gameOver = () => {
      running = false;
      over = true;
      const score = Math.floor(distance / 12);
      setFinalScore(score);
      setHi((prev) => {
        const next = Math.max(prev, score);
        if (next !== prev) saveHi(next);
        return next;
      });
      setPose();
      setPhase("over");
    };

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((t - last) / 1000, 0.05); // clamp tab-switch jumps
      last = t;
      if (!running) return;

      elapsed += dt;
      speed = Math.min(SPEED_MAX, speed + SPEED_RAMP * dt);
      distance += speed * dt;

      // Cat physics.
      if (y > 0 || vy > 0) {
        vy -= GRAVITY * dt + (ducking ? FAST_FALL * dt : 0);
        y = Math.max(0, y + vy * dt);
        if (y === 0) vy = 0;
        cat.style.transform = `translateY(${-y}px)`;
      }
      setPose();

      // Obstacles.
      if (distance >= nextSpawnAt) {
        spawn();
        nextSpawnAt = distance + gapUntilNext();
      }
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x -= speed * dt;
        if (o.x + o.w < 0) {
          o.el.remove();
          obstacles.splice(i, 1);
          continue;
        }
        o.el.style.transform = `translateX(${o.x}px)`;
        if (collide(o)) {
          gameOver();
          return;
        }
      }

      scoreEl.textContent = pad5(Math.floor(distance / 12));
    };

    const start = () => {
      reset();
      nextSpawnAt = 260; // a beat of runway before the first obstacle
      running = true;
      setPose();
      setPhase("running");
    };

    const jump = () => {
      if (over) {
        start();
        return;
      }
      if (!running) {
        start();
        return;
      }
      if (y === 0) {
        vy = JUMP_V;
        y = 0.01;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (!e.repeat) jump();
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        ducking = true;
        if (running) setPose();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowDown") {
        ducking = false;
        if (running) setPose();
      }
    };
    const onPointer = (e: PointerEvent) => {
      e.preventDefault();
      jump();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    stage.addEventListener("pointerdown", onPointer);
    stage.focus({ preventScroll: true });
    raf = requestAnimationFrame((t) => {
      last = t;
      raf = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      stage.removeEventListener("pointerdown", onPointer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cat Run mini-game"
      className="fixed inset-0 z-50 bg-bg flex items-center justify-center px-5"
    >
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold tracking-tight">Cat Run</h2>
          <button
            type="button"
            aria-label="Close game"
            onClick={onClose}
            className="w-10 h-10 -mr-2 inline-flex items-center justify-center rounded-xl text-ink-3 hover:text-ink hover:bg-line/40"
          >
            <CloseIcon />
          </button>
        </div>

        <div
          ref={stageRef}
          tabIndex={-1}
          className="relative overflow-hidden rounded-2xl border border-line bg-surface outline-none select-none touch-none cursor-pointer"
          style={{ height: STAGE_H }}
        >
          <span
            ref={scoreRef}
            className="absolute top-3 right-4 text-[13px] font-medium tabular-nums text-ink-3"
            aria-hidden="true"
          >
            00000
          </span>
          <span className="absolute top-3 left-4 text-[13px] font-medium tabular-nums text-ink-3" aria-hidden="true">
            HI {pad5(hi)}
          </span>

          {/* Ground */}
          <div className="absolute left-0 right-0 border-t border-line" style={{ bottom: GROUND_PAD }} />

          {/* Obstacle layer */}
          <div ref={fieldRef} className="absolute inset-0" aria-hidden="true" />

          {/* The runner */}
          <div
            ref={catRef}
            className="absolute will-change-transform"
            style={{ left: CAT_X, bottom: GROUND_PAD - 6, width: CAT_SIZE, height: CAT_SIZE }}
          >
            <div ref={catPoseRef} className="runner-pose">
              <CatAvatar size={CAT_SIZE} />
            </div>
          </div>

          {phase !== "running" && (
            <div className="absolute inset-x-0 top-[52px] text-center space-y-1 pointer-events-none">
              {phase === "over" && (
                <p className="text-[15px] font-semibold tabular-nums">
                  {finalScore >= hi && finalScore > 0 ? "New best!" : "Game over"} · {pad5(finalScore)}
                </p>
              )}
              <p className="text-[13px] text-ink-3">
                {phase === "ready" ? "Tap or press space to run" : "Tap or press space to run it back"}
              </p>
              <p className="text-[12px] text-ink-3">↑ jump · ↓ duck</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
