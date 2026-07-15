/**
 * Cat Run — an endless-runner easter egg behind the mascot. Same rules as the
 * classic browser dinosaur game (jump the obstacles, duck the flyers, speed
 * creeps up, one hit ends it) plus power-ups, all drawn in DayScore's own
 * language: the runner is the CatAvatar, ground obstacles are heatmap
 * day-squares, flyers are bobbing circle-cells, and pickups are little chips.
 *
 * Power-ups: shield (absorbs one hit — the obstacle pops instead of you),
 * ×2 (doubles points for a stretch), +50 (instant bonus).
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
const FLYER_AFTER = 8; // seconds before flyers join the rotation
// Flyer heights. 24 sits between the ducked hitbox top (≈18px) and the
// standing one (≈33px): duck or jump. 46 clears a standing cat — a fake-out
// you can simply run under.
const FLYER_YS = [24, 24, 46];
const BOOST_SECS = 8; // ×2 duration
const INVULN_SECS = 0.9; // grace period after a shielded hit
const TREAT_POINTS = 50;
const PICKUP_YS = [10, 55, 95]; // ground grab, low jump, high jump
const HI_KEY = "dayscore:runner:hi";

interface Sprite {
  el: HTMLDivElement;
  x: number;
  y: number; // bottom offset from ground
  w: number;
  h: number;
}

type PickupKind = "shield" | "boost" | "treat";
interface Pickup extends Sprite {
  kind: PickupKind;
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
  const ringRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const boostRef = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState<"ready" | "running" | "over">("ready");
  const [finalScore, setFinalScore] = useState(0);
  const [hi, setHi] = useState(loadHi);

  // The engine lives in one effect for the component's lifetime; phase
  // transitions are pushed out through setPhase.
  useEffect(() => {
    const stage = stageRef.current!;
    const cat = catRef.current!;
    const pose = catPoseRef.current!;
    const ring = ringRef.current!;
    const field = fieldRef.current!;
    const scoreEl = scoreRef.current!;
    const boostEl = boostRef.current!;
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
    let points = 0;
    let shield = false;
    let boostUntil = 0;
    let invulnUntil = 0;
    let nextSpawnAt = 0; // distance at which the next obstacle appears
    let nextPickupAt = 0; // elapsed seconds for the next power-up
    let obstacles: Sprite[] = [];
    let pickups: Pickup[] = [];

    const setPose = () => {
      pose.classList.toggle("runner-duck", ducking && y === 0);
      pose.classList.toggle("runner-air", y > 0);
      pose.classList.toggle("runner-run", running && y === 0 && !ducking);
    };

    const setShield = (on: boolean) => {
      shield = on;
      ring.classList.toggle("opacity-100", on);
      ring.classList.toggle("opacity-0", !on);
    };

    const setBoostHud = (on: boolean) => {
      boostEl.classList.toggle("hidden", !on);
    };

    const reset = () => {
      for (const o of obstacles) o.el.remove();
      for (const p of pickups) p.el.remove();
      obstacles = [];
      pickups = [];
      y = 0;
      vy = 0;
      ducking = false;
      speed = SPEED_0;
      distance = 0;
      elapsed = 0;
      points = 0;
      boostUntil = 0;
      invulnUntil = 0;
      over = false;
      setShield(false);
      setBoostHud(false);
      cat.classList.remove("runner-hit");
      cat.style.transform = "translateY(0)";
      scoreEl.textContent = pad5(0);
      setPose();
    };

    const spawnObstacle = (forceFlyer = false) => {
      const flyer = forceFlyer || (elapsed > FLYER_AFTER && Math.random() < 0.3);
      const cols = flyer ? (Math.random() < 0.5 ? 1 : 2) : Math.random() < 0.6 ? 1 : 2;
      const rows = flyer ? 1 : 1 + Math.floor(Math.random() * 3);
      const w = cols * CELL + (cols - 1) * CELL_GAP;
      const h = rows * CELL + (rows - 1) * CELL_GAP;
      const el = document.createElement("div");
      el.className = "runner-obstacle";
      el.style.width = `${w}px`;
      const inner = document.createElement("div");
      inner.className = flyer ? "runner-cells runner-hover" : "runner-cells";
      inner.style.gridTemplateColumns = `repeat(${cols}, ${CELL}px)`;
      for (let i = 0; i < cols * rows; i++) {
        const cell = document.createElement("div");
        // Ground stacks use the deep end of the ramp; flyers the light end.
        cell.style.background = flyer
          ? `var(--score-${2 + Math.floor(Math.random() * 3)})`
          : `var(--score-${6 + Math.floor(Math.random() * 5)})`;
        inner.appendChild(cell);
      }
      el.appendChild(inner);
      const o: Sprite = {
        el,
        x: stageW() + w,
        y: flyer ? FLYER_YS[Math.floor(Math.random() * FLYER_YS.length)] : 0,
        w,
        h,
      };
      el.style.bottom = `${GROUND_PAD + o.y}px`;
      field.appendChild(el);
      obstacles.push(o);
    };

    const spawnPickup = (forced?: PickupKind) => {
      const roll = Math.random();
      const kind: PickupKind = forced ?? (roll < 0.35 ? "shield" : roll < 0.7 ? "boost" : "treat");
      const el = document.createElement("div");
      el.className = "runner-pickup";
      const inner = document.createElement("span");
      inner.className = "runner-hover inline-flex items-center justify-center";
      if (kind === "shield") {
        inner.innerHTML = `<span class="block w-[22px] h-[22px] rounded-full border-[3px] border-accent bg-accent-soft"></span>`;
      } else {
        inner.innerHTML = `<span class="inline-flex items-center rounded-md px-1.5 h-[20px] text-[11px] font-bold ${
          kind === "boost" ? "bg-accent text-accent-ink" : "runner-treat"
        }">${kind === "boost" ? "×2" : `+${TREAT_POINTS}`}</span>`;
      }
      el.appendChild(inner);
      const w = kind === "shield" ? 22 : 34;
      const p: Pickup = {
        el,
        kind,
        x: stageW() + w,
        y: PICKUP_YS[Math.floor(Math.random() * PICKUP_YS.length)],
        w,
        h: 22,
      };
      el.style.bottom = `${GROUND_PAD + p.y}px`;
      field.appendChild(el);
      pickups.push(p);
    };

    const floatText = (text: string, x: number, yBottom: number) => {
      const el = document.createElement("span");
      el.className = "runner-float text-accent";
      el.textContent = text;
      el.style.left = `${x}px`;
      el.style.bottom = `${GROUND_PAD + yBottom}px`;
      field.appendChild(el);
      window.setTimeout(() => el.remove(), 800);
    };

    const gapUntilNext = () => 190 + Math.random() * 320 + speed * 0.35;

    const catBox = () => {
      const catH = ducking && y === 0 ? CAT_BOX.duckH : CAT_BOX.h;
      return {
        x: CAT_X + (CAT_SIZE - CAT_BOX.w) / 2 + CAT_BOX.inset,
        w: CAT_BOX.w - CAT_BOX.inset * 2,
        y: y + CAT_BOX.inset, // bottom
        h: catH - CAT_BOX.inset * 2,
      };
    };

    const hits = (s: Sprite) => {
      const c = catBox();
      return c.x < s.x + s.w && c.x + c.w > s.x && c.y < s.y + s.h && c.y + c.h > s.y;
    };

    const applyPickup = (p: Pickup) => {
      if (p.kind === "shield") {
        setShield(true);
      } else if (p.kind === "boost") {
        boostUntil = elapsed + BOOST_SECS;
        setBoostHud(true);
        floatText("×2", p.x, p.y + p.h);
      } else {
        points += TREAT_POINTS;
        floatText(`+${TREAT_POINTS}`, p.x, p.y + p.h);
      }
      if (p.kind === "shield") floatText("shield", p.x, p.y + p.h);
    };

    const gameOver = () => {
      running = false;
      over = true;
      const score = Math.floor(points);
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
      advance(dt);
    };

    // One simulation step. Shared by the rAF tick and the dev-only warp hook.
    const advance = (dt: number) => {
      elapsed += dt;
      speed = Math.min(SPEED_MAX, speed + SPEED_RAMP * dt);
      distance += speed * dt;
      points += ((speed * dt) / 12) * (elapsed < boostUntil ? 2 : 1);
      if (boostUntil !== 0 && elapsed >= boostUntil) {
        boostUntil = 0;
        setBoostHud(false);
      }

      // Cat physics.
      if (y > 0 || vy > 0) {
        vy -= GRAVITY * dt + (ducking ? FAST_FALL * dt : 0);
        y = Math.max(0, y + vy * dt);
        if (y === 0) vy = 0;
        cat.style.transform = `translateY(${-y}px)`;
      }
      setPose();

      // Spawns.
      if (distance >= nextSpawnAt) {
        spawnObstacle();
        nextSpawnAt = distance + gapUntilNext();
      }
      if (elapsed >= nextPickupAt) {
        spawnPickup();
        nextPickupAt = elapsed + 7 + Math.random() * 6;
      }

      // Pickups drift with the world and pop on grab.
      for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        p.x -= speed * dt;
        if (p.x + p.w < 0) {
          p.el.remove();
          pickups.splice(i, 1);
          continue;
        }
        p.el.style.transform = `translateX(${p.x}px)`;
        if (hits(p)) {
          applyPickup(p);
          p.el.remove();
          pickups.splice(i, 1);
        }
      }

      // Obstacles.
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x -= speed * dt;
        if (o.x + o.w < 0) {
          o.el.remove();
          obstacles.splice(i, 1);
          continue;
        }
        o.el.style.transform = `translateX(${o.x}px)`;
        if (hits(o) && elapsed >= invulnUntil) {
          if (shield) {
            // The shield takes the hit: obstacle pops, brief grace period.
            setShield(false);
            invulnUntil = elapsed + INVULN_SECS;
            const inner = o.el.firstElementChild;
            if (inner) inner.classList.add("runner-pop");
            const doomed = o.el;
            window.setTimeout(() => doomed.remove(), 200);
            obstacles.splice(i, 1);
            cat.classList.remove("runner-hit");
            void cat.offsetWidth; // restart the blink animation
            cat.classList.add("runner-hit");
            continue;
          }
          gameOver();
          return;
        }
      }

      scoreEl.textContent = pad5(Math.floor(points));
    };

    const start = () => {
      reset();
      nextSpawnAt = 260; // a beat of runway before the first obstacle
      nextPickupAt = 4 + Math.random() * 4;
      running = true;
      setPose();
      setPhase("running");
    };

    const jump = () => {
      if (over || !running) {
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

    // Dev-only hooks so the pieces can be exercised deterministically.
    const w = window as unknown as { __catrun?: unknown };
    if (import.meta.env.DEV) {
      w.__catrun = {
        pickup: spawnPickup,
        flyer: () => spawnObstacle(true),
        start,
        // Advance the simulation without waiting on rAF (headless testing).
        warp: (secs: number) => {
          const step = 1 / 60;
          for (let s = 0; s < secs && running; s += step) advance(step);
        },
      };
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      stage.removeEventListener("pointerdown", onPointer);
      if (import.meta.env.DEV) delete w.__catrun;
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
          <div className="absolute top-3 right-4 flex items-center gap-2" aria-hidden="true">
            <span
              ref={boostRef}
              className="hidden rounded-md bg-accent text-accent-ink px-1.5 py-0.5 text-[11px] font-bold"
            >
              ×2
            </span>
            <span ref={scoreRef} className="text-[13px] font-medium tabular-nums text-ink-3">
              00000
            </span>
          </div>
          <span className="absolute top-3 left-4 text-[13px] font-medium tabular-nums text-ink-3" aria-hidden="true">
            HI {pad5(hi)}
          </span>

          {/* Ground */}
          <div className="absolute left-0 right-0 border-t border-line" style={{ bottom: GROUND_PAD }} />

          {/* Obstacle + pickup layer */}
          <div ref={fieldRef} className="absolute inset-0" aria-hidden="true" />

          {/* The runner */}
          <div
            ref={catRef}
            className="absolute will-change-transform"
            style={{ left: CAT_X, bottom: GROUND_PAD - 6, width: CAT_SIZE, height: CAT_SIZE }}
          >
            <div
              ref={ringRef}
              aria-hidden="true"
              className="absolute -inset-1.5 rounded-full border-2 border-accent bg-accent-soft/40 opacity-0 transition-opacity duration-200"
            />
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
              <p className="text-[12px] text-ink-3">↑ jump · ↓ duck · grab the power-ups</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
