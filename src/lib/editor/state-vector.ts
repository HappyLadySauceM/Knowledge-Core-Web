// Encode Yjs/Gateway payloads with Go `base64.RawURLEncoding` (URL alphabet, no padding).
// 使用 Go `base64.RawURLEncoding` 编码 Yjs/Gateway 载荷（URL 字母表、无填充）。
export function encodeRawUrlBase64(value: Uint8Array): string {
  let binary = "";
  value.forEach((item) => {
    binary += String.fromCharCode(item);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
