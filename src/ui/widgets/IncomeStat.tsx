import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { animate, motion } from "motion/react";
import { useStore } from "@/store";
import { incomeInMonth, fmtMoney } from "@/core/finance";
import { todayISO } from "@/core/date";
import { feedbackTiming, type FeedbackPoint } from "@/core/lesson-feedback";
import "./income-stat.css";

interface Flight { id: number; amount: number; from: FeedbackPoint; to: FeedbackPoint }
export function IncomeStat() {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(() => incomeInMonth(useStore.getState().s, todayISO().slice(0, 7)));
  const displayed = useRef(value);
  const [flights, setFlights] = useState<Flight[]>([]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let animation: ReturnType<typeof animate> | undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (n: number) => { displayed.current = n; setValue(n); };
    const reset = () => {
      clearTimeout(timer); animation?.stop(); setFlights([]);
      update(incomeInMonth(useStore.getState().s, todayISO().slice(0, 7)));
    };
    const unsubscribe = useStore.subscribe((next, prev) => {
      if (next.s === prev.s) return;
      const target = incomeInMonth(next.s, todayISO().slice(0, 7));
      if (next.jarFeedback.seq === prev.jarFeedback.seq) { if (target !== incomeInMonth(prev.s, todayISO().slice(0, 7))) reset(); return; }
      clearTimeout(timer); animation?.stop();
      const f = next.jarFeedback;
      const timing = feedbackTiming(f.monthDelta ?? 0, !!f.origin, reduce.matches);
      if (!timing.flight || !f.origin || !ref.current) { reset(); return; }
      const r = ref.current.getBoundingClientRect();
      setFlights((old) => [...old, { id: f.seq, amount: f.monthDelta ?? 0, from: f.origin!, to: { x: r.x + r.width / 2, y: r.y + r.height / 2 } }]);
      timer = setTimeout(() => { animation = animate(displayed.current, target, { duration: timing.number / 1000, ease: "easeOut", onUpdate: update }); }, timing.flight);
    });
    reduce.addEventListener("change", reset);
    return () => { unsubscribe(); clearTimeout(timer); animation?.stop(); reduce.removeEventListener("change", reset); };
  }, []);
  return <><div className="stat" ref={ref}>本月确认收入 <b>{fmtMoney(value)}</b></div>
    {createPortal(flights.map((f) => <motion.div key={f.id} className="income-flight" aria-hidden="true"
      initial={{ x: f.from.x, y: f.from.y, opacity: 1, scale: 1 }}
      animate={{ x: f.to.x, y: f.to.y, opacity: 0, scale: 0.55 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      onAnimationComplete={() => setFlights((old) => old.filter((x) => x.id !== f.id))}>+{fmtMoney(f.amount)}</motion.div>), document.body)}
  </>;
}
