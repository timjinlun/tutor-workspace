import { useEffect, useState } from "react";
import { todayISO } from "@/core/date";
import { untilNextDay } from "@/core/local-day";

export function useLocalDay() {
  const [day, setDay] = useState(todayISO);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setDay(todayISO());
      clearTimeout(timer);
      timer = setTimeout(refresh, untilNextDay(new Date()));
    };
    timer = setTimeout(refresh, untilNextDay(new Date()));
    window.addEventListener("focus", refresh);
    return () => { clearTimeout(timer); window.removeEventListener("focus", refresh); };
  }, []);
  return day;
}
