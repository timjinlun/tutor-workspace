/** 壳：侧栏 + 当前页。外观（深浅、强调色）也在这里落到 <html> 上。 */
import { useEffect, type ReactElement } from "react";
import { Sun, Users, CalendarDays, BookOpen, Wallet, LayoutGrid } from "lucide-react";
import { useStore, type Page } from "@/store";
import { lowBalanceStudents } from "@/core/finance";
import { Avatar } from "@/ui/primitives";
import { platform, isApp } from "@/platform";
import { TodayPage } from "@/ui/features/today/TodayPage";
import { StudentsPage } from "@/ui/features/students/StudentsPage";
import { SchedulePage } from "@/ui/features/schedule/SchedulePage";
import { CoursesPage } from "@/ui/features/courses/CoursesPage";
import { FinancePage } from "@/ui/features/finance/FinancePage";
import { MorePage } from "@/ui/features/more/MorePage";
import { SettingsPage } from "@/ui/features/settings/SettingsPage";
import { LeadsPage } from "@/ui/features/leads/LeadsPage";
import { MaterialsPage } from "@/ui/features/materials/MaterialsPage";
import { ReferralPage } from "@/ui/features/referral/ReferralPage";

const NAV: { page: Page; label: string; icon: ReactElement }[] = [
  { page: "today", label: "今天", icon: <Sun /> },
  { page: "students", label: "学员", icon: <Users /> },
  { page: "schedule", label: "课表", icon: <CalendarDays /> },
  { page: "courses", label: "课程", icon: <BookOpen /> },
  { page: "finance", label: "收支", icon: <Wallet /> },
  { page: "more", label: "更多", icon: <LayoutGrid /> },
];

const PAGES: Record<Page, () => ReactElement> = {
  today: TodayPage,
  students: StudentsPage,
  schedule: SchedulePage,
  courses: CoursesPage,
  finance: FinancePage,
  more: MorePage,
  settings: SettingsPage,
  leads: LeadsPage,
  materials: MaterialsPage,
  referral: ReferralPage,
};

export function App() {
  const route = useStore((x) => x.route);
  const go = useStore((x) => x.go);
  const ready = useStore((x) => x.ready);
  const saveError = useStore((x) => x.saveError);
  const settings = useStore((x) => x.s.settings);
  const wallpaper = useStore((x) => x.wallpaper);
  const lowCount = useStore((x) => lowBalanceStudents(x.s).filter((l) => l.level === "danger").length);
  useAppearance(settings.appearance, settings.accent);
  const bg = settings.background === "custom" && !wallpaper ? "aurora" : settings.background;
  useEffect(() => {
    document.documentElement.dataset.bg = bg;
    try { localStorage.setItem("tw.bg", bg); } catch { /* 隐私模式下写不了，无所谓 */ }
  }, [bg]);

  /* 数据还在读的那几十毫秒：把壳先画出来，别让窗口空着 */
  if (!ready) return <Shell />;
  const Page = PAGES[route.page];
  return (
    <div className="layout">
      <div className="bg-layer" aria-hidden="true" style={bg === "custom" && wallpaper ? { backgroundImage: `url(${wallpaper})` } : undefined}>
        {bg === "aurora" && <><i className="blob b1" /><i className="blob b2" /><i className="blob b3" /></>}
      </div>
      <aside className="sidebar">
        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.page} className={`nav-item ${route.page === n.page || (n.page === "more" && ["leads", "materials", "referral"].includes(route.page)) ? "on" : ""}`} onClick={() => go({ page: n.page })}>
              {n.icon}
              {n.label}
              {n.page === "students" && lowCount > 0 && <span className="nav-badge">{lowCount}</span>}
            </button>
          ))}
        </nav>
        <button className={`sidebar-foot ${route.page === "settings" ? "on" : ""}`} onClick={() => go({ page: "settings" })}>
          <Avatar name={settings.teacherName || "师"} size="sm" />
          <div>
            <div className="name">{settings.teacherName || "老师"}</div>
            <div className="sub">设置</div>
          </div>
        </button>
      </aside>
      <main className="main">
        {saveError && <div className="banner-error" style={{ margin: "16px 40px 0" }}>没能保存：{saveError}。建议先在设置里导出一份 JSON。</div>}
        <Page />
      </main>
    </div>
  );
}

/** 数据就绪前的骨架：背景和侧栏跟正式界面一致，所以看不出"加载中" */
function Shell() {
  return (
    <div className="layout">
      <div className="bg-layer" aria-hidden="true"><i className="blob b1" /><i className="blob b2" /><i className="blob b3" /></div>
      <aside className="sidebar">
        <nav className="nav">
          {NAV.map((n) => (
            <span key={n.page} className="nav-item" aria-hidden="true">{n.icon}{n.label}</span>
          ))}
        </nav>
      </aside>
      <main className="main" />
    </div>
  );
}

/** 深浅色与强调色落到 <html data-appearance data-accent>，并告诉壳层同步毛玻璃 */
function useAppearance(appearance: string, accent: string) {
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = appearance === "dark" || (appearance === "system" && mq.matches);
      root.dataset.appearance = dark ? "dark" : "light";
    };
    try { localStorage.setItem("tw.appearance", appearance); } catch { /* 同上 */ }
    apply();
    mq.addEventListener("change", apply);
    platform.setAppearance(appearance as "system" | "light" | "dark");
    return () => mq.removeEventListener("change", apply);
  }, [appearance]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = accent;
    try { localStorage.setItem("tw.accent", accent); } catch { /* 同上 */ }
    if (accent !== "system") return;
    void platform.systemAccent().then((hex) => hex && root.style.setProperty("--accent-system", hex));
    return platform.onSystemAccentChange((hex) => root.style.setProperty("--accent-system", hex));
  }, [accent]);

  useEffect(() => {
    if (isApp) document.body.classList.add("app");
  }, []);
}
