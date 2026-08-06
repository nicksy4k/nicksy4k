import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, ChevronLeft, ChevronRight, X, Wand2, Check } from "lucide-react";
import { useTutorialStatus } from "@/lib/tutorial";
import type { TourStep, TourAction } from "@/lib/dashboardTourSteps";
import { useSidebar } from "@/components/ui/sidebar";
import { useDemoMode } from "@/lib/demoMode";
import { DEMO_ALERT_TXN_ID, DEMO_EXPAND_TXN_ID, DEMO_FILTER_CATEGORY } from "@/lib/demoData";

interface TutorialCtx {
  start: (steps: TourStep[]) => void;
  openWelcome: (steps: TourStep[]) => void;
}

const Ctx = createContext<TutorialCtx | null>(null);

export function useTutorial() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTutorial must be used within TutorialProvider");
  return c;
}

type Phase = "idle" | "welcome" | "running";

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const { markComplete } = useTutorialStatus();
  const demo = useDemoMode();

  const openWelcome = useCallback((s: TourStep[]) => {
    setSteps(s);
    setIndex(0);
    setPhase("welcome");
  }, []);

  const start = useCallback(
    (s: TourStep[]) => {
      setSteps(s);
      setIndex(0);
      demo.start();
      setPhase("running");
    },
    [demo],
  );

  const finish = useCallback(async () => {
    setPhase("idle");
    demo.stop();
    await markComplete();
  }, [markComplete, demo]);

  // Reset per-step demo interaction state when advancing so previous
  // "Try it" tweaks don't leak into later cards.
  const clearStepState = useCallback(() => {
    demo.resetExtraSpend();
    demo.setFilterCategory(null);
    demo.setExpandedTxnId(null);
    demo.setOpenAlertId(null);
  }, [demo]);

  const goNext = useCallback(() => {
    if (index >= steps.length - 1) {
      void finish();
      return;
    }
    clearStepState();
    setIndex((i) => i + 1);
  }, [index, steps.length, finish, clearStepState]);

  const goBack = useCallback(() => {
    clearStepState();
    setIndex((i) => Math.max(0, i - 1));
  }, [clearStepState]);

  const value = useMemo(() => ({ start, openWelcome }), [start, openWelcome]);

  return (
    <Ctx.Provider value={value}>
      {children}

      {/* Welcome modal */}
      <Dialog
        open={phase === "welcome"}
        onOpenChange={(o) => {
          if (!o) void finish();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="h-11 w-11 rounded-xl bg-primary/15 grid place-items-center mb-2">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Welcome to Ledgerly</DialogTitle>
            <DialogDescription className="space-y-3 pt-2 text-sm leading-relaxed">
              <span className="block">
                Your workspace is ready. Ledgerly runs on <strong>cycles</strong> — every dashboard
                number, chart, and bill window is scoped to the current one, so you always know
                exactly what's left to spend.
              </span>
              <span className="block">
                Take a hands-on tour of the dashboard — we'll swap in some example data so you can
                try filtering, expanding, and logging a spend without touching your real ledger. You
                can re-run this any time from Settings → Data.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => void finish()}>
              Skip
            </Button>
            <Button
              onClick={() => {
                demo.start();
                setPhase("running");
              }}
            >
              Start tour <ChevronRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spotlight coach-marks */}
      {phase === "running" && steps.length > 0 && (
        <SpotlightHost
          step={steps[index]}
          currentIndex={index}
          total={steps.length}
          onBack={goBack}
          onNext={goNext}
          onSkip={() => void finish()}
        />
      )}
    </Ctx.Provider>
  );
}

// ---------- spotlight ----------

function SpotlightHost(props: {
  step: TourStep;
  currentIndex: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const { setOpen, isMobile, setOpenMobile } = useSidebar();

  // Force-open sidebar for sidebar-targeting steps
  useEffect(() => {
    if (props.step.requiresSidebar) {
      if (isMobile) setOpenMobile(true);
      else setOpen(true);
    }
  }, [props.step, setOpen, setOpenMobile, isMobile]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onSkip();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        props.onNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        props.onBack();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  if (typeof document === "undefined") return null;
  return createPortal(<Spotlight {...props} />, document.body);
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function Spotlight({
  step,
  currentIndex,
  total,
  onBack,
  onNext,
  onSkip,
}: {
  step: TourStep;
  currentIndex: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState<{ w: number; h: number }>(() => ({
    w: typeof window === "undefined" ? 1024 : window.innerWidth,
    h: typeof window === "undefined" ? 768 : window.innerHeight,
  }));
  const rafRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step.selector]);

  // One-time auto-scroll when the step (target) changes. Never re-scrolls on
  // user scroll — that used to snap the viewport back and trap the user.
  useEffect(() => {
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const outOfView = r.top < 60 || r.bottom > window.innerHeight - 60;
    if (outOfView) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.selector]);

  useLayoutEffect(() => {
    measure();
    const schedule = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    // Poll briefly in case the target mounts after this step activates
    let poll = 0;
    const iv = window.setInterval(() => {
      poll += 1;
      measure();
      if (poll > 10) window.clearInterval(iv);
    }, 200);
    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      ro.disconnect();
      window.clearInterval(iv);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [measure]);

  const pad = 8;
  const hasTarget = !!rect;
  const cutout = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : { top: 0, left: 0, width: 0, height: 0 };

  // Tooltip placement
  const TT_W = 320;
  const TT_MARGIN = 12;
  let ttStyle: React.CSSProperties;
  if (!hasTarget) {
    ttStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: TT_W };
  } else {
    const placement = step.placement ?? "bottom";
    const cx = cutout.left + cutout.width / 2;
    const cy = cutout.top + cutout.height / 2;
    const below = {
      top: cutout.top + cutout.height + TT_MARGIN,
      left: Math.max(TT_MARGIN, Math.min(cx - TT_W / 2, viewport.w - TT_W - TT_MARGIN)),
    };
    const above = {
      top: cutout.top - TT_MARGIN,
      left: below.left,
      transform: "translateY(-100%)" as const,
    };
    const right = {
      top: Math.max(TT_MARGIN, cy - 60),
      left: cutout.left + cutout.width + TT_MARGIN,
    };
    const left = {
      top: right.top,
      left: cutout.left - TT_MARGIN,
      transform: "translateX(-100%)" as const,
    };
    let picked: React.CSSProperties;
    if (placement === "top" && cutout.top > 200) picked = above;
    else if (placement === "left" && cutout.left > TT_W + 40) picked = left;
    else if (placement === "right" && viewport.w - (cutout.left + cutout.width) > TT_W + 40)
      picked = right;
    else picked = below;
    // Vertical overflow fallback
    if (placement !== "top" && below.top + 200 > viewport.h && cutout.top > 220) picked = above;
    ttStyle = { ...picked, width: TT_W };
  }

  return (
    <div className="fixed inset-0 z-[100]" aria-live="polite">
      {/* Dim + cutout via SVG mask */}
      <svg
        width="100%"
        height="100%"
        className="absolute inset-0 pointer-events-auto"
        onClick={onSkip}
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {hasTarget && (
              <rect
                x={cutout.left}
                y={cutout.top}
                width={cutout.width}
                height={cutout.height}
                rx={10}
                ry={10}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(9,10,20,0.72)" mask="url(#tour-mask)" />
        {hasTarget && (
          <rect
            x={cutout.left}
            y={cutout.top}
            width={cutout.width}
            height={cutout.height}
            rx={10}
            ry={10}
            fill="none"
            stroke="oklch(0.72 0.15 268)"
            strokeWidth={2}
            className="pointer-events-none"
          />
        )}
      </svg>

      {/* Tooltip card */}
      <div
        className="absolute rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl p-4 space-y-3"
        style={ttStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
              Step {currentIndex + 1} of {total}
            </p>
            <h3 className="text-sm font-semibold">{step.title}</h3>
          </div>
          <button
            aria-label="Skip tour"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={onSkip}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
        {step.action && <TryItButton action={step.action} stepIndex={currentIndex} />}
        <div className="flex items-center gap-1 pt-1">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === currentIndex ? "w-5 bg-primary" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between pt-1">
          <Button variant="ghost" size="sm" onClick={onBack} disabled={currentIndex === 0}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <Button size="sm" onClick={onNext}>
            {currentIndex >= total - 1 ? "Finish" : "Next"} <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// A per-step "Try it" button. Tracks its own done-state (keyed by step index so
// a Back-then-forward navigation resets the button). Dispatches to the demo
// context based on the action kind — sidebar-nav steps have no action.
function TryItButton({ action, stepIndex }: { action: TourAction; stepIndex: number }) {
  const demo = useDemoMode();
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDone(false);
  }, [stepIndex]);

  const run = () => {
    switch (action.kind) {
      case "add-spend":
        demo.addExtraSpend(12);
        break;
      case "filter-category":
        demo.setFilterCategory(DEMO_FILTER_CATEGORY);
        break;
      case "open-alert":
        demo.setOpenAlertId(DEMO_ALERT_TXN_ID);
        break;
      case "expand-txn":
        demo.setExpandedTxnId(DEMO_EXPAND_TXN_ID);
        break;
    }
    setDone(true);
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={done}
      className={`w-full inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
        done
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 cursor-default"
          : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
      }`}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />}
      {done ? action.doneLabel : action.label}
    </button>
  );
}
