/** Fields shown on /careers (message keys under Site) and how the CRM names them. */
export const JOBS = ["jobSales", "jobMarketing", "jobAdmin", "jobMedia", "jobOther"] as const;
export type Job = (typeof JOBS)[number];
export const JOB_AR: Record<Job, string> = { jobSales: "مستشار مبيعات عقارية", jobMarketing: "أخصائي تسويق رقمي", jobAdmin: "منسق إداري", jobMedia: "مصور ومحرر فيديو", jobOther: "مجال آخر" };
