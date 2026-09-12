declare module "qrcode" {
  interface Options { width?: number; margin?: number; errorCorrectionLevel?: "L" | "M" | "Q" | "H"; color?: { dark: string; light: string } }
  const QRCode: { toDataURL(text: string, options?: Options): Promise<string> };
  export default QRCode;
}
