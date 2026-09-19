export type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  fields?: Record<string, string>;
};

export type OrgOption = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  readAt: Date | null;
  createdAt: Date;
};