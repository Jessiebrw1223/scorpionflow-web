export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_subscriptions: {
        Row: {
          billing_cycle: string
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          ended_at: string | null
          id: string
          mp_customer_email: string | null
          mp_last_payment_id: string | null
          mp_plan_id: string | null
          mp_preapproval_id: string | null
          owner_id: string
          payment_provider: string
          pending_downgrade_billing_cycle: string | null
          pending_downgrade_plan:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          started_at: string | null
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          ended_at?: string | null
          id?: string
          mp_customer_email?: string | null
          mp_last_payment_id?: string | null
          mp_plan_id?: string | null
          mp_preapproval_id?: string | null
          owner_id: string
          payment_provider?: string
          pending_downgrade_billing_cycle?: string | null
          pending_downgrade_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          started_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          ended_at?: string | null
          id?: string
          mp_customer_email?: string | null
          mp_last_payment_id?: string | null
          mp_plan_id?: string | null
          mp_preapproval_id?: string | null
          owner_id?: string
          payment_provider?: string
          pending_downgrade_billing_cycle?: string | null
          pending_downgrade_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          started_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      client_interactions: {
        Row: {
          client_id: string
          created_at: string
          id: string
          interaction_type: Database["public"]["Enums"]["interaction_type"]
          occurred_at: string
          owner_id: string
          summary: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          interaction_type?: Database["public"]["Enums"]["interaction_type"]
          occurred_at?: string
          owner_id: string
          summary: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          interaction_type?: Database["public"]["Enums"]["interaction_type"]
          occurred_at?: string
          owner_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          client_type: Database["public"]["Enums"]["client_type"]
          commercial_status: Database["public"]["Enums"]["commercial_status"]
          company: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          industry: string | null
          is_active: boolean
          last_contact_at: string | null
          name: string
          next_action: string | null
          notes: string | null
          owner_id: string
          phone: string | null
          ruc: string | null
          updated_at: string
        }
        Insert: {
          client_type?: Database["public"]["Enums"]["client_type"]
          commercial_status?: Database["public"]["Enums"]["commercial_status"]
          company?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean
          last_contact_at?: string | null
          name: string
          next_action?: string | null
          notes?: string | null
          owner_id: string
          phone?: string | null
          ruc?: string | null
          updated_at?: string
        }
        Update: {
          client_type?: Database["public"]["Enums"]["client_type"]
          commercial_status?: Database["public"]["Enums"]["commercial_status"]
          company?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean
          last_contact_at?: string | null
          name?: string
          next_action?: string | null
          notes?: string | null
          owner_id?: string
          phone?: string | null
          ruc?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          alert_type: Database["public"]["Enums"]["alert_type"]
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          read_at: string | null
          related_id: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          title: string
          user_id: string
        }
        Insert: {
          alert_type?: Database["public"]["Enums"]["alert_type"]
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          read_at?: string | null
          related_id?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          title: string
          user_id: string
        }
        Update: {
          alert_type?: Database["public"]["Enums"]["alert_type"]
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          read_at?: string | null
          related_id?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_contributions: {
        Row: {
          amount: number
          contributed_at: string
          created_at: string
          id: string
          owner_id: string
          project_id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          contributed_at?: string
          created_at?: string
          id?: string
          owner_id: string
          project_id: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          contributed_at?: string
          created_at?: string
          id?: string
          owner_id?: string
          project_id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["team_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: Database["public"]["Enums"]["team_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["team_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_resources: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["resource_kind"]
          name: string
          notes: string | null
          owner_id: string
          project_id: string
          quantity: number
          role_or_type: string | null
          status: string
          total_cost: number
          unit: Database["public"]["Enums"]["resource_unit"]
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["resource_kind"]
          name: string
          notes?: string | null
          owner_id: string
          project_id: string
          quantity?: number
          role_or_type?: string | null
          status?: string
          total_cost?: number
          unit?: Database["public"]["Enums"]["resource_unit"]
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["resource_kind"]
          name?: string
          notes?: string | null
          owner_id?: string
          project_id?: string
          quantity?: number
          role_or_type?: string | null
          status?: string
          total_cost?: number
          unit?: Database["public"]["Enums"]["resource_unit"]
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_resources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_cost: number
          budget: number
          client_id: string
          created_at: string
          currency: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          owner_id: string
          planning_mode: Database["public"]["Enums"]["planning_mode"]
          progress: number
          quotation_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          actual_cost?: number
          budget?: number
          client_id: string
          created_at?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          owner_id: string
          planning_mode?: Database["public"]["Enums"]["planning_mode"]
          progress?: number
          quotation_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          actual_cost?: number
          budget?: number
          client_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          owner_id?: string
          planning_mode?: Database["public"]["Enums"]["planning_mode"]
          progress?: number
          quotation_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          created_at: string
          description: string
          id: string
          line_total: number
          position: number
          quantity: number
          quotation_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          line_total?: number
          position?: number
          quantity?: number
          quotation_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          line_total?: number
          position?: number
          quantity?: number
          quotation_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          client_id: string
          close_probability: number
          converted_to_project: boolean
          created_at: string
          currency: string
          description: string | null
          id: string
          owner_id: string
          status: Database["public"]["Enums"]["quotation_status"]
          status_changed_at: string
          subtotal: number
          tax_rate: number
          title: string
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          client_id: string
          close_probability?: number
          converted_to_project?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          owner_id: string
          status?: Database["public"]["Enums"]["quotation_status"]
          status_changed_at?: string
          subtotal?: number
          tax_rate?: number
          title: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          client_id?: string
          close_probability?: number
          converted_to_project?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          owner_id?: string
          status?: Database["public"]["Enums"]["quotation_status"]
          status_changed_at?: string
          subtotal?: number
          tax_rate?: number
          title?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      risks: {
        Row: {
          category: Database["public"]["Enums"]["risk_category"]
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_cost: number
          id: string
          impact: number
          mitigation_plan: string | null
          owner_id: string
          owner_name: string | null
          probability: number
          project_id: string | null
          status: Database["public"]["Enums"]["risk_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["risk_category"]
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_cost?: number
          id?: string
          impact?: number
          mitigation_plan?: string | null
          owner_id: string
          owner_name?: string | null
          probability?: number
          project_id?: string | null
          status?: Database["public"]["Enums"]["risk_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["risk_category"]
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_cost?: number
          id?: string
          impact?: number
          mitigation_plan?: string | null
          owner_id?: string
          owner_name?: string | null
          probability?: number
          project_id?: string | null
          status?: Database["public"]["Enums"]["risk_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          billing_cycle: string | null
          created_at: string
          event_type: string
          from_plan: Database["public"]["Enums"]["subscription_plan"] | null
          id: string
          metadata: Json | null
          owner_id: string
          stripe_event_id: string | null
          stripe_subscription_id: string | null
          to_plan: Database["public"]["Enums"]["subscription_plan"] | null
        }
        Insert: {
          billing_cycle?: string | null
          created_at?: string
          event_type: string
          from_plan?: Database["public"]["Enums"]["subscription_plan"] | null
          id?: string
          metadata?: Json | null
          owner_id: string
          stripe_event_id?: string | null
          stripe_subscription_id?: string | null
          to_plan?: Database["public"]["Enums"]["subscription_plan"] | null
        }
        Update: {
          billing_cycle?: string | null
          created_at?: string
          event_type?: string
          from_plan?: Database["public"]["Enums"]["subscription_plan"] | null
          id?: string
          metadata?: Json | null
          owner_id?: string
          stripe_event_id?: string | null
          stripe_subscription_id?: string | null
          to_plan?: Database["public"]["Enums"]["subscription_plan"] | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          actual_cost: number
          assignee_id: string | null
          assignee_name: string | null
          blocked_reason: string | null
          blocked_since: string | null
          blocks_project: boolean
          created_at: string
          description: string | null
          due_date: string | null
          estimated_cost: number
          id: string
          impact: Database["public"]["Enums"]["task_impact"]
          node_type: Database["public"]["Enums"]["task_node_type"]
          owner_id: string
          parent_id: string | null
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          weight: number
        }
        Insert: {
          actual_cost?: number
          assignee_id?: string | null
          assignee_name?: string | null
          blocked_reason?: string | null
          blocked_since?: string | null
          blocks_project?: boolean
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_cost?: number
          id?: string
          impact?: Database["public"]["Enums"]["task_impact"]
          node_type?: Database["public"]["Enums"]["task_node_type"]
          owner_id: string
          parent_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          weight?: number
        }
        Update: {
          actual_cost?: number
          assignee_id?: string | null
          assignee_name?: string | null
          blocked_reason?: string | null
          blocked_since?: string | null
          blocks_project?: boolean
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_cost?: number
          id?: string
          impact?: Database["public"]["Enums"]["task_impact"]
          node_type?: Database["public"]["Enums"]["task_node_type"]
          owner_id?: string
          parent_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          assigned_project_ids: string[]
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by_name: string | null
          owner_id: string
          role: Database["public"]["Enums"]["team_role"]
          scope: string
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_project_ids?: string[]
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by_name?: string | null
          owner_id: string
          role?: Database["public"]["Enums"]["team_role"]
          scope?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_project_ids?: string[]
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by_name?: string | null
          owner_id?: string
          role?: Database["public"]["Enums"]["team_role"]
          scope?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          joined_at: string
          owner_id: string
          role: Database["public"]["Enums"]["team_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          joined_at?: string
          owner_id: string
          role?: Database["public"]["Enums"]["team_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          joined_at?: string
          owner_id?: string
          role?: Database["public"]["Enums"]["team_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          alerts: Json
          auto_alerts: Json
          auto_behavior: Json
          channel: string
          cost_model: string
          created_at: string
          currency: string
          id: string
          target_margin: number
          updated_at: string
          user_id: string
        }
        Insert: {
          alerts?: Json
          auto_alerts?: Json
          auto_behavior?: Json
          channel?: string
          cost_model?: string
          created_at?: string
          currency?: string
          id?: string
          target_margin?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          alerts?: Json
          auto_alerts?: Json
          auto_behavior?: Json
          channel?: string
          cost_model?: string
          created_at?: string
          currency?: string
          id?: string
          target_margin?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_admin_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_admin_workspace: {
        Args: { _owner_id: string; _user_id: string }
        Returns: boolean
      }
      can_write_workspace: {
        Args: { _owner_id: string; _user_id: string }
        Returns: boolean
      }
      count_team_usage: { Args: { _owner_id: string }; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_plan_user_limit: {
        Args: { _plan: Database["public"]["Enums"]["subscription_plan"] }
        Returns: number
      }
      get_workspace_role: {
        Args: { _owner_id: string; _user_id: string }
        Returns: string
      }
      has_project_access: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
      is_workspace_member: {
        Args: { _owner_id: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recalc_project_actual_cost: {
        Args: { _project_id: string }
        Returns: undefined
      }
      recalc_project_progress: {
        Args: { _project_id: string }
        Returns: undefined
      }
    }
    Enums: {
      alert_severity: "info" | "warning" | "critical"
      alert_type:
        | "task_blocked"
        | "project_risk"
        | "client_no_followup"
        | "cost_overrun"
        | "resource_overload"
        | "quotation_stale"
        | "general"
      app_role: "admin" | "manager" | "user" | "superadmin"
      client_type:
        | "hotel"
        | "spa"
        | "business"
        | "other"
        | "industrial"
        | "tech"
        | "retail"
        | "healthcare"
        | "education"
        | "government"
        | "manufacturing"
        | "logistics"
        | "finance"
        | "international"
      commercial_status: "active" | "pending" | "no_followup"
      interaction_type:
        | "call"
        | "meeting"
        | "email"
        | "whatsapp"
        | "note"
        | "proposal_sent"
      invitation_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "cancelled"
        | "expired"
      planning_mode: "agile" | "traditional"
      project_status:
        | "on_track"
        | "at_risk"
        | "over_budget"
        | "completed"
        | "cancelled"
      quotation_status: "pending" | "in_contact" | "quoted" | "won" | "lost"
      resource_kind: "human" | "tech" | "asset"
      resource_unit: "hour" | "month" | "use" | "fixed"
      risk_category:
        | "financial"
        | "operational"
        | "technical"
        | "commercial"
        | "hr"
        | "legal"
      risk_status: "open" | "in_treatment" | "mitigated" | "closed"
      subscription_plan: "free" | "starter" | "pro" | "business"
      task_impact: "time" | "cost" | "delivery"
      task_node_type:
        | "epic"
        | "story"
        | "task"
        | "phase"
        | "subphase"
        | "activity"
      task_priority: "low" | "medium" | "high" | "critical"
      task_status:
        | "todo"
        | "in_progress"
        | "in_review"
        | "done"
        | "blocked"
        | "cancelled"
      team_role: "admin" | "collaborator" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alert_severity: ["info", "warning", "critical"],
      alert_type: [
        "task_blocked",
        "project_risk",
        "client_no_followup",
        "cost_overrun",
        "resource_overload",
        "quotation_stale",
        "general",
      ],
      app_role: ["admin", "manager", "user", "superadmin"],
      client_type: [
        "hotel",
        "spa",
        "business",
        "other",
        "industrial",
        "tech",
        "retail",
        "healthcare",
        "education",
        "government",
        "manufacturing",
        "logistics",
        "finance",
        "international",
      ],
      commercial_status: ["active", "pending", "no_followup"],
      interaction_type: [
        "call",
        "meeting",
        "email",
        "whatsapp",
        "note",
        "proposal_sent",
      ],
      invitation_status: [
        "pending",
        "accepted",
        "rejected",
        "cancelled",
        "expired",
      ],
      planning_mode: ["agile", "traditional"],
      project_status: [
        "on_track",
        "at_risk",
        "over_budget",
        "completed",
        "cancelled",
      ],
      quotation_status: ["pending", "in_contact", "quoted", "won", "lost"],
      resource_kind: ["human", "tech", "asset"],
      resource_unit: ["hour", "month", "use", "fixed"],
      risk_category: [
        "financial",
        "operational",
        "technical",
        "commercial",
        "hr",
        "legal",
      ],
      risk_status: ["open", "in_treatment", "mitigated", "closed"],
      subscription_plan: ["free", "starter", "pro", "business"],
      task_impact: ["time", "cost", "delivery"],
      task_node_type: [
        "epic",
        "story",
        "task",
        "phase",
        "subphase",
        "activity",
      ],
      task_priority: ["low", "medium", "high", "critical"],
      task_status: [
        "todo",
        "in_progress",
        "in_review",
        "done",
        "blocked",
        "cancelled",
      ],
      team_role: ["admin", "collaborator", "viewer"],
    },
  },
} as const
