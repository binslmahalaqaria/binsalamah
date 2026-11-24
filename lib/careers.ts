/** Fields shown on /careers (message keys under Site) and how the CRM names them. */
/** A job application is a lead whose message starts «طلب توظيف» (see CareerForm). Shown only in «طلبات التوظيف». */
export const isJobApp = (l: { message?: string | null }) => String(l.message || "").startsWith("طلب توظيف");

export const JOBS =["jobSales", "jobMarketing", "jobAdmin", "jobMedia", "jobOther"] as const;
export type Job = (typeof JOBS)[number];
export const JOB_AR: Record<Job, string> = { jobSales: "مستشار مبيعات عقارية", jobMarketing: "أخصائي تسويق رقمي", jobAdmin: "منسق إداري", jobMedia: "مصور ومحرر فيديو", jobOther: "مجال آخر" };
