import { Logo } from "@/components/Logo";

/**
 * Opening screen (client request 2026-10-20; white background 2026-10-21): the dark logo on white with a thin
 * gold rule, for a moment, then the site shows.
 * Pure CSS so it never blocks the page or waits for JavaScript; shown once per browser session
 * (on later pages the inline script adds a style rule that hides it at once).
 */
export function Splash() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(sessionStorage.getItem("bsSplash")){var s=document.createElement("style");s.textContent=".bs-splash{display:none!important}";document.head.appendChild(s)}else sessionStorage.setItem("bsSplash","1")}catch(e){}`,
        }}
      />
      <style>{`
        .bs-splash{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;overflow:hidden;
          background:#ffffff;animation:bs-out .7s ease 1.7s forwards}
        .bs-splash .bs-rule{display:block;height:1px;margin:22px auto 0;background:linear-gradient(90deg,transparent,#b79579,transparent);animation:bs-rule 1s ease .35s both}
        @keyframes bs-rule{from{width:0;opacity:0}to{width:220px;opacity:1}}
        .bs-splash .bs-logo{position:relative;animation:bs-in .8s ease both}
        @keyframes bs-in{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
        @keyframes bs-out{to{opacity:0;visibility:hidden}}
        @media (prefers-reduced-motion:reduce){.bs-splash{animation-delay:.8s}.bs-splash .bs-logo,.bs-splash .bs-rule{animation:none}}
      `}</style>
      <div className="bs-splash" aria-hidden>
        <div className="bs-logo">
          <Logo variant="dark" layout="stack" height={110} link={false} />
          <span className="bs-rule" />
        </div>
      </div>
    </>
  );
}
