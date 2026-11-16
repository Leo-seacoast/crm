import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AppSettings = {
  businessName: string | null;
  timeZone: string;
  dailySummaryEnabled: boolean;
  dailySummaryHour: number;
};

const DEFAULTS: AppSettings = {
  businessName: null,
  timeZone: "America/New_York",
  dailySummaryEnabled: true,
  dailySummaryHour: 7,
};

/** Business-wide settings (time zone, daily summary). Loaded once per page. */
export const getSettings = cache(async (): Promise<AppSettings> => {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("*").maybeSingle();
  if (!data) return DEFAULTS;
  return {
    businessName: data.business_name,
    timeZone: data.time_zone,
    dailySummaryEnabled: data.daily_summary_enabled,
    dailySummaryHour: data.daily_summary_hour,
  };
});
