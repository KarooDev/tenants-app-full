// src/api/files.js
import { getBase } from "./core";

/** Convert an ArrayBuffer → base64 (safe for large files) */
function abToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000; // 32KB chunks to avoid call stack limits
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, sub);
  }
  return btoa(binary);
}

export const files = {
  /**
   * Upload an invoice image/PDF to Apps Script Drive handler.
   * @param {{ idToken: string, file: File, building_id?: string }} params
   * @returns {Promise<{file_id:string, file_url:string, web_view_link:string, web_content_link:string}>}
   */
  async uploadInvoice({ idToken, file, building_id }) {
    if (!idToken) throw new Error("missing_id_token");
    if (!file) throw new Error("missing_file");

    // (Optional) light client-side validation to mirror UI
    const isOkType =
      /^image\//.test(file.type || "") || file.type === "application/pdf";
    if (!isOkType) throw new Error("unsupported_file_type");
    if (file.size > 8 * 1024 * 1024) throw new Error("file_too_large"); // 8MB

    const buf = await file.arrayBuffer();
    const data_base64 = abToBase64(buf);

    const payload = {
      idToken,
      file_name: file.name || "invoice",
      mime_type: file.type || "application/octet-stream",
      data_base64,
      // Server ignores building_id today, but you’re passing it—keep it for future auditing
      building_id: building_id || "",
    };

    const res = await fetch(getBase() + "?path=files/upload-invoice", {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids preflight; Apps Script reads e.postData.contents
      body: JSON.stringify(payload),
    });

    // Network-level error
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`upload_http_${res.status}: ${text || "failed"}`);
    }

    const j = await res.json().catch(() => ({}));
    if (!j || j.ok === false) {
      throw new Error(j?.error || "upload_failed");
    }
    return j;
  },
};
