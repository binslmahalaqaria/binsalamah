"use client";

/**
 * Safety net for the CRM: if a screen throws while rendering, the person sees a clear message with the technical cause
 * (so it can be sent to support) and a retry button, instead of a blank «Application error» page.
 */
import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[CRM crash]", error); }, [error]);
  return (
    <div dir="rtl" className="mx-auto mt-16 max-w-xl rounded-2xl border border-[#e3e3e3] bg-white p-6 text-center shadow-sm">
      <div className="text-3xl">⚠️</div>
      <h2 className="mt-2 text-xl font-bold">حدث خطأ في هذه الصفحة</h2>
      <p className="mt-2 text-sm text-[#555]">بياناتك محفوظة ولم يضع شيء. اضغط «إعادة المحاولة»، وإن تكرر الخطأ أرسل لنا النص التالي:</p>
      <pre dir="ltr" className="mt-3 max-h-40 overflow-auto rounded-lg bg-[#f4f4f4] p-3 text-left text-xs text-[#333]">{String(error?.message || error)}{error?.digest ? "\n#" + error.digest : ""}</pre>
      <div className="mt-4 flex justify-center gap-2">
        <button type="button" className="rounded-lg bg-[#333] px-4 py-2 text-sm font-semibold text-white" onClick={() => reset()}>إعادة المحاولة</button>
        <button type="button" className="rounded-lg border border-[#ccc] px-4 py-2 text-sm" onClick={() => { window.location.href = "/ar/admin"; }}>الرئيسية</button>
      </div>
    </div>
  );
}
