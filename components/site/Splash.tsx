import { getTranslations } from "next-intl/server";

// Seconds the words stay before the two panels part and show the site.
const END = 2.9;

/**
 * Opening page on the home page (client 2026-11-07): two grey panels carrying the brand pattern, with the mark and
 * «بن سلمه يدلك» in the site font; then the panels part like a door onto the site. Pure CSS so it never waits for
 * JavaScript. The inline script only shows it once per browser session, keeps it off other pages (someone opening an
 * offer link goes straight in), and lets a tap skip it.
 */
export async function Splash() {
  const t = await getTranslations("Site");
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{var h=location.pathname.split("/").filter(Boolean).length<2;if(!h||sessionStorage.getItem("bsSplash")){var s=document.createElement("style");s.textContent=".bs-splash{display:none!important}";document.head.appendChild(s)}else sessionStorage.setItem("bsSplash","1")}catch(e){}`,
        }}
      />
      <style>{`
        .bs-splash{position:fixed;inset:0;z-index:2000;overflow:hidden;cursor:pointer;animation:bs-gone 0s linear ${END + 1.1}s forwards}
        .bs-splash.bs-skip{animation:bs-fade .35s ease forwards}
        .bs-pane{position:absolute;top:0;bottom:0;width:50.5%;overflow:hidden;background:#3f3f3f}
        .bs-pane:before{content:"";position:absolute;inset:-50%;transform:rotate(-18deg);opacity:.5;background:url(/brand/pattern-footer.png) 0 0/96px 96px}
        .bs-pane.a{left:0;animation:bs-left 1.1s cubic-bezier(.76,0,.24,1) ${END}s forwards}
        .bs-pane.b{right:0;animation:bs-right 1.1s cubic-bezier(.76,0,.24,1) ${END}s forwards}
        .bs-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;padding:24px;color:#fff;text-align:center;
          animation:bs-fade .4s ease ${END - 0.25}s forwards}
        .bs-mark{width:clamp(64px,10vw,92px);height:auto;animation:bs-rise 1s cubic-bezier(.2,.7,.2,1) .15s both}
        .bs-word{font-family:var(--font-crm-body),Tahoma,sans-serif;font-weight:500;font-size:clamp(2.6rem,8vw,5rem);line-height:1.25;animation:bs-rise 1s cubic-bezier(.2,.7,.2,1) .6s both}
        @keyframes bs-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
        @keyframes bs-left{to{transform:translateX(-101%)}}
        @keyframes bs-right{to{transform:translateX(101%)}}
        @keyframes bs-fade{to{opacity:0;visibility:hidden}}
        @keyframes bs-gone{to{visibility:hidden}}
        @media (prefers-reduced-motion:reduce){
          .bs-splash{animation:bs-fade .4s ease 1.5s forwards}
          .bs-pane.a,.bs-pane.b,.bs-center,.bs-mark,.bs-word{animation:none}
        }
      `}</style>
      <div className="bs-splash" aria-hidden>
        <span className="bs-pane a" />
        <span className="bs-pane b" />
        <div className="bs-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="bs-mark" src="/brand/logo-mark-hd-white.png" alt="" />
          <div className="bs-word">{t("introLead")}</div>
        </div>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var e=document.querySelector(".bs-splash");if(e)e.addEventListener("click",function(){e.classList.add("bs-skip")})})()`,
        }}
      />
    </>
  );
}
