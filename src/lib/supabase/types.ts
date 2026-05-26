export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      admin_users: { Row: any; Insert: any; Update: any };
      merchants: { Row: any; Insert: any; Update: any };
      companies: { Row: any; Insert: any; Update: any };
      employees: { Row: any; Insert: any; Update: any };
      merchant_offers: { Row: any; Insert: any; Update: any };
      redemptions: { Row: any; Insert: any; Update: any };
      action_queue_items: { Row: any; Insert: any; Update: any };
      notification_events: { Row: any; Insert: any; Update: any };
      audit_logs: { Row: any; Insert: any; Update: any };
      merchant_branches: { Row: any; Insert: any; Update: any };
      categories: { Row: any; Insert: any; Update: any };
      redemption_analytics: { Row: any; Insert: any; Update: any };
      csv_upload_jobs: { Row: any; Insert: any; Update: any };
      csv_rejected_rows: { Row: any; Insert: any; Update: any };
      hero_banners: { Row: any; Insert: any; Update: any };
      weekly_picks: { Row: any; Insert: any; Update: any };
      most_popular_merchants: { Row: any; Insert: any; Update: any };
      platform_settings: { Row: any; Insert: any; Update: any };
      realtime_events: { Row: any; Insert: any; Update: any };
      login_sessions: { Row: any; Insert: any; Update: any };
      company_admins: { Row: any; Insert: any; Update: any };
      company_billing: { Row: any; Insert: any; Update: any };
      issue_reports: { Row: any; Insert: any; Update: any };
      offer_replacement_requests: { Row: any; Insert: any; Update: any };
      merchant_profile_edit_requests: { Row: any; Insert: any; Update: any };
      renewal_gaming_alerts: { Row: any; Insert: any; Update: any };
      merchant_status_history: { Row: any; Insert: any; Update: any };
      company_status_history: { Row: any; Insert: any; Update: any };
    };
    Views: Record<string, never>;
    Functions: {
      aggregate_daily_redemption_analytics: {
        Args: { target_date: string };
        Returns: Array<{
          merchant_id: string;
          company_id: string;
          offer_id: string;
          total_redemptions: number;
          total_discount: number;
          total_savings: number;
          unique_employees: number;
          avg_discount: number;
        }>;
      };
    };
    Enums: {
      admin_role: 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'FINANCE_ADMIN' | 'CONTENT_ADMIN';
      merchant_status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'SUSPENDED' | 'ARCHIVED' | 'REJECTED';
      offer_status: 'DRAFT' | 'PENDING_APPROVAL' | 'LIVE' | 'REJECTED' | 'EXPIRED' | 'REPLACED';
      company_status: 'PENDING' | 'APPROVED_PENDING_PAYMENT' | 'ACTIVE' | 'PAUSED' | 'SUSPENDED' | 'CANCELLED';
      employee_status: 'INVITED' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'INELIGIBLE';
    };
  };
}
