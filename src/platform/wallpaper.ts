/** Local image input and conversion only; no settings or persistence dependencies. */
async function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("无法读取这张图片，请重新选择。"));
    reader.onerror = () => reject(new Error("无法读取这张图片，请检查文件是否可访问。"));
    reader.onabort = () => reject(new Error("图片读取已中断，请重试。"));
    // The app permits data: images, but deliberately does not permit blob: URLs.
    reader.readAsDataURL(file);
  });
}

async function convertWallpaper(file: File): Promise<string> {
  const source = await readImage(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("无法识别这张图片，请换一张 JPG、PNG 或 WebP 图片。"));
    img.onload = () => {
      try {
        const scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("图片处理暂时不可用，请重试。");
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      } catch {
        reject(new Error("图片处理失败，请换一张较小的图片。"));
      }
    };
    img.src = source;
  });
}

/** null means user cancelled; read/decode failures reject so the UI can explain. */
export function pickWallpaper(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.hidden = true;
    const cleanup = () => { input.onchange = null; input.oncancel = null; input.remove(); };
    input.oncancel = () => { cleanup(); resolve(null); };
    input.onchange = () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) { resolve(null); return; }
      void convertWallpaper(file).then(resolve, reject);
    };
    document.body.append(input);
    try { input.click(); }
    catch { cleanup(); reject(new Error("无法打开图片选择窗口，请重试。")); }
  });
}
