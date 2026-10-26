/** Small line icons for the public site (stroke = currentColor). */
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const box = "inline-block h-[1.1em] w-[1.1em] shrink-0 align-[-0.2em]";

export const IconBed = () => <svg viewBox="0 0 24 24" className={box} {...P}><path d="M3 18V7m0 7h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" /><circle cx="7" cy="11" r="1.6" /></svg>;
export const IconBath = () => <svg viewBox="0 0 24 24" className={box} {...P}><path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2zM6 12V5a2 2 0 0 1 4 0M7 19l-1 2m11-2 1 2" /></svg>;
export const IconArea = () => <svg viewBox="0 0 24 24" className={box} {...P}><path d="M4 4h16v16H4zM4 9h5V4M20 15h-5v5" /></svg>;
export const IconPin = () => <svg viewBox="0 0 24 24" className={box} {...P}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
export const IconCheck = () => <svg viewBox="0 0 24 24" className={box} {...P}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IconUser = () => <svg viewBox="0 0 24 24" className={box} {...P}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
export const IconEye = () => <svg viewBox="0 0 24 24" className={box} {...P}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
export const IconSofa = () => <svg viewBox="0 0 24 24" className={box} {...P}><path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4H3v-4zM5 17v2m14-2v2" /></svg>;
export const IconShield = () => <svg viewBox="0 0 24 24" className={box} {...P}><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>;
export const IconMap = () => <svg viewBox="0 0 24 24" className={box} {...P}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" /></svg>;
export const IconPhone = () => <svg viewBox="0 0 24 24" className={box} {...P}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>;
export const IconMail = () => <svg viewBox="0 0 24 24" className={box} {...P}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>;
export const IconInstagram = () => <svg viewBox="0 0 24 24" className={box} {...P}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" /></svg>;
export const IconX = () => <svg viewBox="0 0 24 24" className={box} fill="currentColor"><path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L2 3h6.4l4.4 5.9L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.5l11.2 14.5z" /></svg>;
export const IconYouTube = () => <svg viewBox="0 0 24 24" className={box} fill="currentColor"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10 15V9l5.2 3L10 15Z"/></svg>;
export const IconTikTok = () => <svg viewBox="0 0 24 24" className={box} fill="currentColor"><path d="M16.6 3c.3 2.2 1.7 3.8 3.9 4v3.1a7 7 0 0 1-3.9-1.2v6.3c0 3.3-2.7 5.8-5.9 5.8S4.8 18.5 4.8 15.2s2.7-5.9 5.9-5.9c.3 0 .6 0 .9.1v3.2a2.8 2.8 0 0 0-.9-.2 2.7 2.7 0 1 0 2.7 2.7V3h3.2z" /></svg>;
