/** 导入 JSON 的确认：先说清楚文件里有什么、会覆盖掉什么。菜单和设置页的导入都走这里。 */
import { useStore } from "@/store";
import { isApp } from "@/platform";
import { ConfirmSheet } from "./ConfirmSheet";

export function ImportConfirmSheet() {
  const preview = useStore((x) => x.pendingImport);
  const confirmImport = useStore((x) => x.confirmImport);
  const cancelImport = useStore((x) => x.cancelImport);
  return (
    <ConfirmSheet open={!!preview} onClose={cancelImport} onConfirm={confirmImport} title="导入会覆盖当前全部数据" confirmLabel="覆盖导入">
      {preview && <>
        <p>文件里有 <b>{preview.students}</b> 名学员、<b>{preview.payments}</b> 条缴费、<b>{preview.doneLessons}</b> 节上过的课{preview.scheduledLessons > 0 && <>、<b>{preview.scheduledLessons}</b> 节待上的课</>}。</p>
        {preview.students > 0 && preview.doneLessons === 0 && <p className="banner-error" style={{ marginTop: 10 }}>文件里没有找到上过的课。如果之前划过课，请确认选的是最新导出的文件。</p>}
        <p className="muted" style={{ marginTop: 10 }}>当前的学员、缴费、打卡会被整体替换，不会叠加。{isApp && "导入前已自动存了一份快照，放在数据文件夹里。"}</p>
      </>}
    </ConfirmSheet>
  );
}
