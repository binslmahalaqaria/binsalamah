import { Logo } from "@/components/Logo";

/**
 * Opening screen (client request 2026-10-20): the logo fills the screen for a moment, then the site shows.
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
        .bs-splash{position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:#333333;
          animation:bs-out .6s ease 1.5s forwards}
        .bs-splash>div{animation:bs-in .7s ease both}
        @keyframes bs-in{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
        @keyframes bs-out{to{opacity:0;visibility:hidden}}
        @media (prefers-reduced-motion:reduce){.bs-splash{animation-delay:.8s}.bs-splash>div{animation:none}}
      `}</style>
      <div className="bs-splash" aria-hidden>
        <div>
          <Logo variant="light" layout="stack" height={110} link={false} />
        </div>
      </div>
    </>
  );
}
