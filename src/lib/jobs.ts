export const JOB_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "remote",
  "internship",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export type JobPosting = {
  id: string;
  poster_id: string;
  store_id: string | null;
  title: string;
  company_name: string;
  description: string;
  region: string | null;
  job_type: string | null;
  salary_note: string | null;
  how_to_apply: string | null;
  status: string;
  created_at: string;
};
