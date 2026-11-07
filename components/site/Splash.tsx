import { Alexandria } from "next/font/google";
import { getTranslations } from "next-intl/server";

// A bold Arabic face for this page only, so the rest of the site loads nothing extra.
const display = Alexandria({ subsets: ["arabic", "latin"], weight: "800", display: "swap" });

// Seconds. Each question gets one STEP; the answer holds for ANSWER, then the page fades into the site.
const START = 0.3;
const STEP = 1.6;
const ANSWER = 1.8;

/**
 * Opening page on the home page (client request 2026-11-07, after mnzil.com's opening): big words in a soft band on a
 * plain page, one after another, then the site. Pure CSS so it never waits for JavaScript. The inline script only
 * shows it once per browser session, keeps it off other pages (someone opening an offer link goes straight in),
 * and lets a tap skip it.
 */
export async function Splash() {
  const t = await getTranslations("Site");
  const hooks = t.raw("introHooks") as string[];
  const answerAt = START + hooks.length * STEP;
  const end = answerAt + ANSWER;
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{var h=location.pathname.split("/").filter(Boolean).length<2;if(!h||sessionStorage.getItem("bsSplash")){var s=document.createElement("style");s.textContent=".bs-splash{display:none!important}";document.head.appendChild(s)}else sessionStorage.setItem("bsSplash","1")}catch(e){}`,
        }}
      />
      <style>{`
        .bs-splash{position:fixed;inset:0;z-index:2000;display:grid;grid-template-columns:minmax(0,1fr);place-items:center;overflow:hidden;cursor:pointer;
          padding:20px;background:#fff;animation:bs-out .6s ease ${end}s forwards}
        .bs-splash.bs-skip{animation:bs-out .3s ease forwards}
        .bs-word{grid-area:1/1;max-width:min(100%,900px);padding:.28em .6em .36em;border-radius:.42em;background:#f1f1f1;color:#333;text-align:center;
          font-size:clamp(1.9rem,10vw,5.6rem);line-height:1.28;white-space:pre-line;text-wrap:balance;opacity:0;animation:bs-word ${STEP}s ease both}
        .bs-word.bs-last{animation:bs-last .5s ease both}
        @keyframes bs-word{0%{opacity:0;transform:scale(.92)}12%,88%{opacity:1;transform:none}100%{opacity:0;transform:scale(1.03)}}
        @keyframes bs-last{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}
        @keyframes bs-out{to{opacity:0;visibility:hidden}}
        @media (prefers-reduced-motion:reduce){
          .bs-splash{animation-delay:1.5s}
          .bs-word{animation:none}
          .bs-word:not(.bs-last){display:none}
          .bs-word.bs-last{opacity:1;animation:none}
        }
      `}</style>
      <div className={"bs-splash " + display.className} aria-hidden>
        {hooks.map((h, i) => (
          <div key={h} className="bs-word" style={{ animationDelay: `${START + i * STEP}s` }}>{h}</div>
        ))}
        <div className="bs-word bs-last" style={{ animationDelay: `${answerAt}s` }}>{t("introLead")}</div>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var e=document.querySelector(".bs-splash");if(e)e.addEventListener("click",function(){e.classList.add("bs-skip")})})()`,
        }}
      />
    </>
  );
}
