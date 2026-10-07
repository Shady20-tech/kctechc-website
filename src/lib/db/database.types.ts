export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      agent_profiles: {
        Row: {
          bio: string | null;
          created_at: string;
          display_name: string;
          id: string;
          is_active: boolean;
          license_number: string | null;
          photo_path: string | null;
          public_email: string | null;
          public_phone: string | null;
          region_id: string | null;
          service_areas: string[];
          slug: string;
          title: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          bio?: string | null;
          created_at?: string;
          display_name: string;
          id?: string;
          is_active?: boolean;
          license_number?: string | null;
          photo_path?: string | null;
          public_email?: string | null;
          public_phone?: string | null;
          region_id?: string | null;
          service_areas?: string[];
          slug: string;
          title?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          is_active?: boolean;
          license_number?: string | null;
          photo_path?: string | null;
          public_email?: string | null;
          public_phone?: string | null;
          region_id?: string | null;
          service_areas?: string[];
          slug?: string;
          title?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_profiles_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          created_at: string;
          id: string;
          inquiry_id: string;
          notes: string | null;
          preferred_date: string;
          preferred_window: Database["public"]["Enums"]["appointment_window"];
          scheduled_for: string | null;
          status: Database["public"]["Enums"]["appointment_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          inquiry_id: string;
          notes?: string | null;
          preferred_date: string;
          preferred_window?: Database["public"]["Enums"]["appointment_window"];
          scheduled_for?: string | null;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          inquiry_id?: string;
          notes?: string | null;
          preferred_date?: string;
          preferred_window?: Database["public"]["Enums"]["appointment_window"];
          scheduled_for?: string | null;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_inquiry_id_fkey";
            columns: ["inquiry_id"];
            isOneToOne: false;
            referencedRelation: "crm_inbox";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_inquiry_id_fkey";
            columns: ["inquiry_id"];
            isOneToOne: false;
            referencedRelation: "inquiries";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          ip_hash: string | null;
          metadata: NonNullable<Json>;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          ip_hash?: string | null;
          metadata?: NonNullable<Json>;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          ip_hash?: string | null;
          metadata?: NonNullable<Json>;
        };
        Relationships: [];
      };
      authors: {
        Row: {
          bio: string | null;
          created_at: string;
          display_name: string;
          id: string;
          is_active: boolean;
          role_title: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          bio?: string | null;
          created_at?: string;
          display_name: string;
          id?: string;
          is_active?: boolean;
          role_title?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          is_active?: boolean;
          role_title?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cart_items: {
        Row: {
          cart_id: string;
          created_at: string;
          currency: string;
          id: string;
          product_id: string;
          quantity: number;
          unit_price_minor: number;
          updated_at: string;
        };
        Insert: {
          cart_id: string;
          created_at?: string;
          currency?: string;
          id?: string;
          product_id: string;
          quantity: number;
          unit_price_minor: number;
          updated_at?: string;
        };
        Update: {
          cart_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          product_id?: string;
          quantity?: number;
          unit_price_minor?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey";
            columns: ["cart_id"];
            isOneToOne: false;
            referencedRelation: "carts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "report_inventory_status";
            referencedColumns: ["product_id"];
          },
        ];
      };
      carts: {
        Row: {
          created_at: string;
          currency: string;
          customer_id: string | null;
          expires_at: string;
          id: string;
          locale: Database["public"]["Enums"]["locale_code"];
          status: Database["public"]["Enums"]["cart_status"];
          token: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          customer_id?: string | null;
          expires_at?: string;
          id?: string;
          locale?: Database["public"]["Enums"]["locale_code"];
          status?: Database["public"]["Enums"]["cart_status"];
          token: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          customer_id?: string | null;
          expires_at?: string;
          id?: string;
          locale?: Database["public"]["Enums"]["locale_code"];
          status?: Database["public"]["Enums"]["cart_status"];
          token?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      case_studies: {
        Row: {
          approach: string | null;
          challenge: string | null;
          client_approved: boolean;
          client_name: string | null;
          client_named_with_consent: boolean;
          created_at: string;
          department_id: string;
          id: string;
          outcome: string | null;
          publish_state: Database["public"]["Enums"]["publish_state"];
          published_at: string | null;
          results: NonNullable<Json>;
          service_id: string | null;
          slug: string;
          sort_order: number;
          summary: string;
          tags: string[];
          title: string;
          updated_at: string;
        };
        Insert: {
          approach?: string | null;
          challenge?: string | null;
          client_approved?: boolean;
          client_name?: string | null;
          client_named_with_consent?: boolean;
          created_at?: string;
          department_id: string;
          id?: string;
          outcome?: string | null;
          publish_state?: Database["public"]["Enums"]["publish_state"];
          published_at?: string | null;
          results?: NonNullable<Json>;
          service_id?: string | null;
          slug: string;
          sort_order?: number;
          summary: string;
          tags?: string[];
          title: string;
          updated_at?: string;
        };
        Update: {
          approach?: string | null;
          challenge?: string | null;
          client_approved?: boolean;
          client_name?: string | null;
          client_named_with_consent?: boolean;
          created_at?: string;
          department_id?: string;
          id?: string;
          outcome?: string | null;
          publish_state?: Database["public"]["Enums"]["publish_state"];
          published_at?: string | null;
          results?: NonNullable<Json>;
          service_id?: string | null;
          slug?: string;
          sort_order?: number;
          summary?: string;
          tags?: string[];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_studies_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_studies_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      content_translations: {
        Row: {
          created_at: string;
          entity_id: string;
          entity_type: Database["public"]["Enums"]["translatable_entity_type"];
          field_name: string;
          id: string;
          locale: Database["public"]["Enums"]["locale_code"];
          source_locale: Database["public"]["Enums"]["locale_code"];
          source_updated_at: string | null;
          state: Database["public"]["Enums"]["translation_state"];
          translated_at: string | null;
          translated_by: string | null;
          updated_at: string;
          value: string;
        };
        Insert: {
          created_at?: string;
          entity_id: string;
          entity_type: Database["public"]["Enums"]["translatable_entity_type"];
          field_name: string;
          id?: string;
          locale: Database["public"]["Enums"]["locale_code"];
          source_locale?: Database["public"]["Enums"]["locale_code"];
          source_updated_at?: string | null;
          state?: Database["public"]["Enums"]["translation_state"];
          translated_at?: string | null;
          translated_by?: string | null;
          updated_at?: string;
          value: string;
        };
        Update: {
          created_at?: string;
          entity_id?: string;
          entity_type?: Database["public"]["Enums"]["translatable_entity_type"];
          field_name?: string;
          id?: string;
          locale?: Database["public"]["Enums"]["locale_code"];
          source_locale?: Database["public"]["Enums"]["locale_code"];
          source_updated_at?: string | null;
          state?: Database["public"]["Enums"]["translation_state"];
          translated_at?: string | null;
          translated_by?: string | null;
          updated_at?: string;
          value?: string;
        };
        Relationships: [];
      };
      departments: {
        Row: {
          accent_color: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          accent_color?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          accent_color?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      divisions: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          name: string;
          name_fr: string | null;
          region_id: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          name_fr?: string | null;
          region_id: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          name_fr?: string | null;
          region_id?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "divisions_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      electrical_project_services: {
        Row: {
          created_at: string;
          project_id: string;
          service_id: string;
        };
        Insert: {
          created_at?: string;
          project_id: string;
          service_id: string;
        };
        Update: {
          created_at?: string;
          project_id?: string;
          service_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "electrical_project_services_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "electrical_projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "electrical_project_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      electrical_projects: {
        Row: {
          completed_year: number | null;
          created_at: string;
          department_id: string;
          description: string | null;
          id: string;
          location: string | null;
          outcome: string | null;
          property_type: Database["public"]["Enums"]["property_type"] | null;
          publish_state: Database["public"]["Enums"]["publish_state"];
          published_at: string | null;
          region_id: string | null;
          scope: string | null;
          slug: string;
          sort_order: number;
          summary: string;
          tags: string[];
          title: string;
          updated_at: string;
        };
        Insert: {
          completed_year?: number | null;
          created_at?: string;
          department_id: string;
          description?: string | null;
          id?: string;
          location?: string | null;
          outcome?: string | null;
          property_type?: Database["public"]["Enums"]["property_type"] | null;
          publish_state?: Database["public"]["Enums"]["publish_state"];
          published_at?: string | null;
          region_id?: string | null;
          scope?: string | null;
          slug: string;
          sort_order?: number;
          summary: string;
          tags?: string[];
          title: string;
          updated_at?: string;
        };
        Update: {
          completed_year?: number | null;
          created_at?: string;
          department_id?: string;
          description?: string | null;
          id?: string;
          location?: string | null;
          outcome?: string | null;
          property_type?: Database["public"]["Enums"]["property_type"] | null;
          publish_state?: Database["public"]["Enums"]["publish_state"];
          published_at?: string | null;
          region_id?: string | null;
          scope?: string | null;
          slug?: string;
          sort_order?: number;
          summary?: string;
          tags?: string[];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "electrical_projects_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "electrical_projects_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      entity_seo: {
        Row: {
          canonical_override: string | null;
          created_at: string;
          description: string | null;
          entity_id: string;
          entity_type: Database["public"]["Enums"]["translatable_entity_type"];
          id: string;
          locale: Database["public"]["Enums"]["locale_code"];
          noindex: boolean;
          og_image_path: string | null;
          structured_data: Json | null;
          title: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          canonical_override?: string | null;
          created_at?: string;
          description?: string | null;
          entity_id: string;
          entity_type: Database["public"]["Enums"]["translatable_entity_type"];
          id?: string;
          locale: Database["public"]["Enums"]["locale_code"];
          noindex?: boolean;
          og_image_path?: string | null;
          structured_data?: Json | null;
          title?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          canonical_override?: string | null;
          created_at?: string;
          description?: string | null;
          entity_id?: string;
          entity_type?: Database["public"]["Enums"]["translatable_entity_type"];
          id?: string;
          locale?: Database["public"]["Enums"]["locale_code"];
          noindex?: boolean;
          og_image_path?: string | null;
          structured_data?: Json | null;
          title?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      geo_landing_content: {
        Row: {
          created_at: string;
          division_id: string | null;
          geo_id: string | null;
          heading: string | null;
          id: string;
          intro: string;
          level: Database["public"]["Enums"]["geo_landing_level"];
          locale: Database["public"]["Enums"]["locale_code"];
          region_id: string | null;
          seo_description: string | null;
          seo_title: string | null;
          state: Database["public"]["Enums"]["publish_state"];
          subdivision_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          division_id?: string | null;
          geo_id?: never;
          heading?: string | null;
          id?: string;
          intro: string;
          level: Database["public"]["Enums"]["geo_landing_level"];
          locale: Database["public"]["Enums"]["locale_code"];
          region_id?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          state?: Database["public"]["Enums"]["publish_state"];
          subdivision_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          division_id?: string | null;
          geo_id?: never;
          heading?: string | null;
          id?: string;
          intro?: string;
          level?: Database["public"]["Enums"]["geo_landing_level"];
          locale?: Database["public"]["Enums"]["locale_code"];
          region_id?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          state?: Database["public"]["Enums"]["publish_state"];
          subdivision_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "geo_landing_content_division_id_fkey";
            columns: ["division_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "geo_landing_content_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "geo_landing_content_subdivision_id_fkey";
            columns: ["subdivision_id"];
            isOneToOne: false;
            referencedRelation: "subdivisions";
            referencedColumns: ["id"];
          },
        ];
      };
      inquiries: {
        Row: {
          assigned_at: string | null;
          assigned_to: string | null;
          closed_at: string | null;
          consent_at: string | null;
          consent_given: boolean;
          contact_method: Database["public"]["Enums"]["contact_method"] | null;
          created_at: string;
          department_id: string | null;
          email: string;
          full_name: string;
          id: string;
          inquiry_type: Database["public"]["Enums"]["inquiry_type"];
          ip_hash: string | null;
          last_activity_at: string;
          locale: Database["public"]["Enums"]["locale_code"];
          locality: string | null;
          message: string;
          phone: string | null;
          preferred_contact: string | null;
          priority: Database["public"]["Enums"]["inquiry_priority"];
          property_type: Database["public"]["Enums"]["property_type"] | null;
          reference: string;
          region_id: string | null;
          responded_at: string | null;
          service_id: string | null;
          source: Database["public"]["Enums"]["inquiry_source"];
          status: Database["public"]["Enums"]["inquiry_status"];
          subject: string;
          updated_at: string;
          user_agent: string | null;
        };
        Insert: {
          assigned_at?: string | null;
          assigned_to?: string | null;
          closed_at?: string | null;
          consent_at?: string | null;
          consent_given?: boolean;
          contact_method?: Database["public"]["Enums"]["contact_method"] | null;
          created_at?: string;
          department_id?: string | null;
          email: string;
          full_name: string;
          id?: string;
          inquiry_type?: Database["public"]["Enums"]["inquiry_type"];
          ip_hash?: string | null;
          last_activity_at?: string;
          locale?: Database["public"]["Enums"]["locale_code"];
          locality?: string | null;
          message: string;
          phone?: string | null;
          preferred_contact?: string | null;
          priority?: Database["public"]["Enums"]["inquiry_priority"];
          property_type?: Database["public"]["Enums"]["property_type"] | null;
          reference: string;
          region_id?: string | null;
          responded_at?: string | null;
          service_id?: string | null;
          source?: Database["public"]["Enums"]["inquiry_source"];
          status?: Database["public"]["Enums"]["inquiry_status"];
          subject: string;
          updated_at?: string;
          user_agent?: string | null;
        };
        Update: {
          assigned_at?: string | null;
          assigned_to?: string | null;
          closed_at?: string | null;
          consent_at?: string | null;
          consent_given?: boolean;
          contact_method?: Database["public"]["Enums"]["contact_method"] | null;
          created_at?: string;
          department_id?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          inquiry_type?: Database["public"]["Enums"]["inquiry_type"];
          ip_hash?: string | null;
          last_activity_at?: string;
          locale?: Database["public"]["Enums"]["locale_code"];
          locality?: string | null;
          message?: string;
          phone?: string | null;
          preferred_contact?: string | null;
          priority?: Database["public"]["Enums"]["inquiry_priority"];
          property_type?: Database["public"]["Enums"]["property_type"] | null;
          reference?: string;
          region_id?: string | null;
          responded_at?: string | null;
          service_id?: string | null;
          source?: Database["public"]["Enums"]["inquiry_source"];
          status?: Database["public"]["Enums"]["inquiry_status"];
          subject?: string;
          updated_at?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inquiries_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiries_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiries_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      inquiry_attachments: {
        Row: {
          byte_size: number;
          created_at: string;
          detected_mime: string;
          id: string;
          inquiry_id: string;
          original_filename: string;
          storage_path: string;
        };
        Insert: {
          byte_size: number;
          created_at?: string;
          detected_mime: string;
          id?: string;
          inquiry_id: string;
          original_filename: string;
          storage_path: string;
        };
        Update: {
          byte_size?: number;
          created_at?: string;
          detected_mime?: string;
          id?: string;
          inquiry_id?: string;
          original_filename?: string;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inquiry_attachments_inquiry_id_fkey";
            columns: ["inquiry_id"];
            isOneToOne: false;
            referencedRelation: "crm_inbox";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiry_attachments_inquiry_id_fkey";
            columns: ["inquiry_id"];
            isOneToOne: false;
            referencedRelation: "inquiries";
            referencedColumns: ["id"];
          },
        ];
      };
      inquiry_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          event_type: string;
          from_status: Database["public"]["Enums"]["inquiry_status"] | null;
          id: string;
          inquiry_id: string;
          metadata: NonNullable<Json>;
          note: string | null;
          to_status: Database["public"]["Enums"]["inquiry_status"] | null;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          event_type: string;
          from_status?: Database["public"]["Enums"]["inquiry_status"] | null;
          id?: string;
          inquiry_id: string;
          metadata?: NonNullable<Json>;
          note?: string | null;
          to_status?: Database["public"]["Enums"]["inquiry_status"] | null;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          event_type?: string;
          from_status?: Database["public"]["Enums"]["inquiry_status"] | null;
          id?: string;
          inquiry_id?: string;
          metadata?: NonNullable<Json>;
          note?: string | null;
          to_status?: Database["public"]["Enums"]["inquiry_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "inquiry_events_inquiry_id_fkey";
            columns: ["inquiry_id"];
            isOneToOne: false;
            referencedRelation: "crm_inbox";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiry_events_inquiry_id_fkey";
            columns: ["inquiry_id"];
            isOneToOne: false;
            referencedRelation: "inquiries";
            referencedColumns: ["id"];
          },
        ];
      };
      insight_categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      insights: {
        Row: {
          author_id: string | null;
          body: string;
          category_id: string | null;
          cover_image_path: string | null;
          created_at: string;
          department_id: string | null;
          id: string;
          is_featured: boolean;
          publish_state: Database["public"]["Enums"]["publish_state"];
          published_at: string | null;
          related_service_slugs: string[];
          slug: string;
          summary: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          body: string;
          category_id?: string | null;
          cover_image_path?: string | null;
          created_at?: string;
          department_id?: string | null;
          id?: string;
          is_featured?: boolean;
          publish_state?: Database["public"]["Enums"]["publish_state"];
          published_at?: string | null;
          related_service_slugs?: string[];
          slug: string;
          summary: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          category_id?: string | null;
          cover_image_path?: string | null;
          created_at?: string;
          department_id?: string | null;
          id?: string;
          is_featured?: boolean;
          publish_state?: Database["public"]["Enums"]["publish_state"];
          published_at?: string | null;
          related_service_slugs?: string[];
          slug?: string;
          summary?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "insights_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "authors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "insights_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "insight_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "insights_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_movements: {
        Row: {
          actor_id: string | null;
          created_at: string;
          delta: number;
          id: string;
          note: string | null;
          product_id: string;
          reason: Database["public"]["Enums"]["inventory_reason"];
          stock_after: number;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          delta: number;
          id?: string;
          note?: string | null;
          product_id: string;
          reason: Database["public"]["Enums"]["inventory_reason"];
          stock_after: number;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          delta?: number;
          id?: string;
          note?: string | null;
          product_id?: string;
          reason?: Database["public"]["Enums"]["inventory_reason"];
          stock_after?: number;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "report_inventory_status";
            referencedColumns: ["product_id"];
          },
        ];
      };
      listing_events: {
        Row: {
          event_type: Database["public"]["Enums"]["listing_event_type"];
          id: number;
          inquiry_id: string | null;
          listing_id: string;
          occurred_at: string;
          visitor_digest: string | null;
        };
        Insert: {
          event_type: Database["public"]["Enums"]["listing_event_type"];
          id?: never;
          inquiry_id?: string | null;
          listing_id: string;
          occurred_at?: string;
          visitor_digest?: string | null;
        };
        Update: {
          event_type?: Database["public"]["Enums"]["listing_event_type"];
          id?: never;
          inquiry_id?: string | null;
          listing_id?: string;
          occurred_at?: string;
          visitor_digest?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "listing_events_inquiry_id_fkey";
            columns: ["inquiry_id"];
            isOneToOne: false;
            referencedRelation: "crm_inbox";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_events_inquiry_id_fkey";
            columns: ["inquiry_id"];
            isOneToOne: false;
            referencedRelation: "inquiries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listing_events_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_favorites: {
        Row: {
          created_at: string;
          id: string;
          listing_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          listing_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          listing_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_favorites_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_media: {
        Row: {
          alt_text: string;
          caption: string | null;
          created_at: string;
          height: number | null;
          id: string;
          is_primary: boolean;
          listing_id: string;
          position: number;
          storage_path: string;
          updated_at: string;
          width: number | null;
        };
        Insert: {
          alt_text: string;
          caption?: string | null;
          created_at?: string;
          height?: number | null;
          id?: string;
          is_primary?: boolean;
          listing_id: string;
          position?: number;
          storage_path: string;
          updated_at?: string;
          width?: number | null;
        };
        Update: {
          alt_text?: string;
          caption?: string | null;
          created_at?: string;
          height?: number | null;
          id?: string;
          is_primary?: boolean;
          listing_id?: string;
          position?: number;
          storage_path?: string;
          updated_at?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "listing_media_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_private_details: {
        Row: {
          created_at: string;
          exact_address: string | null;
          exact_location: unknown;
          internal_notes: string | null;
          listing_id: string;
          owner_email: string | null;
          owner_name: string | null;
          owner_notes: string | null;
          owner_phone: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          exact_address?: string | null;
          exact_location?: unknown;
          internal_notes?: string | null;
          listing_id: string;
          owner_email?: string | null;
          owner_name?: string | null;
          owner_notes?: string | null;
          owner_phone?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          exact_address?: string | null;
          exact_location?: unknown;
          internal_notes?: string | null;
          listing_id?: string;
          owner_email?: string | null;
          owner_name?: string | null;
          owner_notes?: string | null;
          owner_phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_private_details_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: true;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_slugs: {
        Row: {
          created_at: string;
          id: string;
          listing_id: string;
          locale: Database["public"]["Enums"]["locale_code"];
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          listing_id: string;
          locale: Database["public"]["Enums"]["locale_code"];
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          listing_id?: string;
          locale?: Database["public"]["Enums"]["locale_code"];
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_slugs_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_submissions: {
        Row: {
          created_at: string;
          id: string;
          ip_hash: string | null;
          listing_id: string;
          notes: string | null;
          review_notes: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["submission_status"];
          submitted_by: string | null;
          submitter_email: string | null;
          submitter_name: string;
          submitter_phone: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          ip_hash?: string | null;
          listing_id: string;
          notes?: string | null;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["submission_status"];
          submitted_by?: string | null;
          submitter_email?: string | null;
          submitter_name: string;
          submitter_phone?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          ip_hash?: string | null;
          listing_id?: string;
          notes?: string | null;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["submission_status"];
          submitted_by?: string | null;
          submitter_email?: string | null;
          submitter_name?: string;
          submitter_phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "listing_submissions_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      order_events: {
        Row: {
          actor_id: string | null;
          actor_kind: string;
          created_at: string;
          event_type: string;
          from_status: Database["public"]["Enums"]["order_status"] | null;
          id: number;
          metadata: NonNullable<Json>;
          note: string | null;
          order_id: string;
          to_status: Database["public"]["Enums"]["order_status"] | null;
        };
        Insert: {
          actor_id?: string | null;
          actor_kind?: string;
          created_at?: string;
          event_type: string;
          from_status?: Database["public"]["Enums"]["order_status"] | null;
          id?: never;
          metadata?: NonNullable<Json>;
          note?: string | null;
          order_id: string;
          to_status?: Database["public"]["Enums"]["order_status"] | null;
        };
        Update: {
          actor_id?: string | null;
          actor_kind?: string;
          created_at?: string;
          event_type?: string;
          from_status?: Database["public"]["Enums"]["order_status"] | null;
          id?: never;
          metadata?: NonNullable<Json>;
          note?: string | null;
          order_id?: string;
          to_status?: Database["public"]["Enums"]["order_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "customer_transactions";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "order_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          currency: string;
          id: string;
          line_total_minor: number | null;
          order_id: string;
          product_id: string | null;
          quantity: number;
          sku: string;
          slug: string;
          title: string;
          unit_price_minor: number;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          id?: string;
          line_total_minor?: never;
          order_id: string;
          product_id?: string | null;
          quantity: number;
          sku: string;
          slug: string;
          title: string;
          unit_price_minor: number;
        };
        Update: {
          created_at?: string;
          currency?: string;
          id?: string;
          line_total_minor?: never;
          order_id?: string;
          product_id?: string | null;
          quantity?: number;
          sku?: string;
          slug?: string;
          title?: string;
          unit_price_minor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "customer_transactions";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "report_inventory_status";
            referencedColumns: ["product_id"];
          },
        ];
      };
      orders: {
        Row: {
          access_token: string;
          cancelled_at: string | null;
          cart_id: string | null;
          created_at: string;
          currency: string;
          customer_id: string | null;
          delivery_address_line1: string | null;
          delivery_address_line2: string | null;
          delivery_city: string | null;
          delivery_minor: number;
          delivery_notes: string | null;
          delivery_region_id: string | null;
          email: string;
          fulfilled_at: string | null;
          fulfillment: Database["public"]["Enums"]["order_fulfillment"];
          full_name: string;
          id: string;
          idempotency_key: string;
          inventory_applied: boolean;
          inventory_released_at: string | null;
          locale: Database["public"]["Enums"]["locale_code"];
          manual_payment_reference: string | null;
          paid_at: string | null;
          paid_minor: number;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          phone: string | null;
          placed_at: string;
          reference: string;
          refunded_at: string | null;
          status: Database["public"]["Enums"]["order_status"];
          subtotal_minor: number;
          total_minor: number;
          updated_at: string;
        };
        Insert: {
          access_token: string;
          cancelled_at?: string | null;
          cart_id?: string | null;
          created_at?: string;
          currency?: string;
          customer_id?: string | null;
          delivery_address_line1?: string | null;
          delivery_address_line2?: string | null;
          delivery_city?: string | null;
          delivery_minor?: number;
          delivery_notes?: string | null;
          delivery_region_id?: string | null;
          email: string;
          fulfilled_at?: string | null;
          fulfillment?: Database["public"]["Enums"]["order_fulfillment"];
          full_name: string;
          id?: string;
          idempotency_key: string;
          inventory_applied?: boolean;
          inventory_released_at?: string | null;
          locale?: Database["public"]["Enums"]["locale_code"];
          manual_payment_reference?: string | null;
          paid_at?: string | null;
          paid_minor?: number;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          phone?: string | null;
          placed_at?: string;
          reference: string;
          refunded_at?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_minor?: number;
          total_minor?: number;
          updated_at?: string;
        };
        Update: {
          access_token?: string;
          cancelled_at?: string | null;
          cart_id?: string | null;
          created_at?: string;
          currency?: string;
          customer_id?: string | null;
          delivery_address_line1?: string | null;
          delivery_address_line2?: string | null;
          delivery_city?: string | null;
          delivery_minor?: number;
          delivery_notes?: string | null;
          delivery_region_id?: string | null;
          email?: string;
          fulfilled_at?: string | null;
          fulfillment?: Database["public"]["Enums"]["order_fulfillment"];
          full_name?: string;
          id?: string;
          idempotency_key?: string;
          inventory_applied?: boolean;
          inventory_released_at?: string | null;
          locale?: Database["public"]["Enums"]["locale_code"];
          manual_payment_reference?: string | null;
          paid_at?: string | null;
          paid_minor?: number;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          phone?: string | null;
          placed_at?: string;
          reference?: string;
          refunded_at?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_minor?: number;
          total_minor?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_cart_id_fkey";
            columns: ["cart_id"];
            isOneToOne: false;
            referencedRelation: "carts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_delivery_region_id_fkey";
            columns: ["delivery_region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_webhook_events: {
        Row: {
          event_type: string | null;
          id: string;
          payload: NonNullable<Json>;
          process_note: string | null;
          processed: boolean;
          provider: string;
          provider_event_id: string;
          provider_tx_ref: string | null;
          received_at: string;
          signature_valid: boolean;
        };
        Insert: {
          event_type?: string | null;
          id?: string;
          payload?: NonNullable<Json>;
          process_note?: string | null;
          processed?: boolean;
          provider?: string;
          provider_event_id: string;
          provider_tx_ref?: string | null;
          received_at?: string;
          signature_valid?: boolean;
        };
        Update: {
          event_type?: string | null;
          id?: string;
          payload?: NonNullable<Json>;
          process_note?: string | null;
          processed?: boolean;
          provider?: string;
          provider_event_id?: string;
          provider_tx_ref?: string | null;
          received_at?: string;
          signature_valid?: boolean;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_minor: number;
          authorized_at: string | null;
          captured_at: string | null;
          created_at: string;
          currency: string;
          failed_at: string | null;
          failure_reason: string | null;
          id: string;
          idempotency_key: string;
          method: Database["public"]["Enums"]["payment_method"];
          order_id: string;
          provider: string;
          provider_metadata: NonNullable<Json>;
          provider_reference: string | null;
          provider_tx_ref: string;
          refunded_at: string | null;
          refunded_minor: number;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          authorized_at?: string | null;
          captured_at?: string | null;
          created_at?: string;
          currency?: string;
          failed_at?: string | null;
          failure_reason?: string | null;
          id?: string;
          idempotency_key: string;
          method: Database["public"]["Enums"]["payment_method"];
          order_id: string;
          provider?: string;
          provider_metadata?: NonNullable<Json>;
          provider_reference?: string | null;
          provider_tx_ref: string;
          refunded_at?: string | null;
          refunded_minor?: number;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          authorized_at?: string | null;
          captured_at?: string | null;
          created_at?: string;
          currency?: string;
          failed_at?: string | null;
          failure_reason?: string | null;
          id?: string;
          idempotency_key?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          order_id?: string;
          provider?: string;
          provider_metadata?: NonNullable<Json>;
          provider_reference?: string | null;
          provider_tx_ref?: string;
          refunded_at?: string | null;
          refunded_minor?: number;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "customer_transactions";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      product_categories: {
        Row: {
          created_at: string;
          department_id: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          publish_state: Database["public"]["Enums"]["publish_state"];
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          department_id: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          publish_state?: Database["public"]["Enums"]["publish_state"];
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          department_id?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          publish_state?: Database["public"]["Enums"]["publish_state"];
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_categories_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      product_category_slugs: {
        Row: {
          category_id: string;
          created_at: string;
          id: string;
          locale: Database["public"]["Enums"]["locale_code"];
          slug: string;
          updated_at: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          id?: string;
          locale: Database["public"]["Enums"]["locale_code"];
          slug: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          id?: string;
          locale?: Database["public"]["Enums"]["locale_code"];
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_category_slugs_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      product_media: {
        Row: {
          alt_text: string;
          created_at: string;
          height: number | null;
          id: string;
          is_primary: boolean;
          position: number;
          product_id: string;
          storage_path: string;
          updated_at: string;
          width: number | null;
        };
        Insert: {
          alt_text: string;
          created_at?: string;
          height?: number | null;
          id?: string;
          is_primary?: boolean;
          position?: number;
          product_id: string;
          storage_path: string;
          updated_at?: string;
          width?: number | null;
        };
        Update: {
          alt_text?: string;
          created_at?: string;
          height?: number | null;
          id?: string;
          is_primary?: boolean;
          position?: number;
          product_id?: string;
          storage_path?: string;
          updated_at?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_media_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "report_inventory_status";
            referencedColumns: ["product_id"];
          },
        ];
      };
      product_slugs: {
        Row: {
          created_at: string;
          id: string;
          locale: Database["public"]["Enums"]["locale_code"];
          product_id: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          locale: Database["public"]["Enums"]["locale_code"];
          product_id: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          locale?: Database["public"]["Enums"]["locale_code"];
          product_id?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_slugs_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_slugs_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "report_inventory_status";
            referencedColumns: ["product_id"];
          },
        ];
      };
      products: {
        Row: {
          availability:
            | Database["public"]["Enums"]["product_availability"]
            | null;
          availability_override:
            | Database["public"]["Enums"]["product_availability"]
            | null;
          brand: string | null;
          category_id: string;
          condition: Database["public"]["Enums"]["product_condition"];
          created_at: string;
          currency: string;
          description: string;
          gtin: string | null;
          id: string;
          price_minor: number;
          publish_state: Database["public"]["Enums"]["publish_state"];
          published_at: string | null;
          short_description: string;
          sku: string;
          slug: string;
          specifications: NonNullable<Json>;
          stock: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          availability?: never;
          availability_override?:
            | Database["public"]["Enums"]["product_availability"]
            | null;
          brand?: string | null;
          category_id: string;
          condition?: Database["public"]["Enums"]["product_condition"];
          created_at?: string;
          currency?: string;
          description: string;
          gtin?: string | null;
          id?: string;
          price_minor: number;
          publish_state?: Database["public"]["Enums"]["publish_state"];
          published_at?: string | null;
          short_description: string;
          sku: string;
          slug: string;
          specifications?: NonNullable<Json>;
          stock?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          availability?: never;
          availability_override?:
            | Database["public"]["Enums"]["product_availability"]
            | null;
          brand?: string | null;
          category_id?: string;
          condition?: Database["public"]["Enums"]["product_condition"];
          created_at?: string;
          currency?: string;
          description?: string;
          gtin?: string | null;
          id?: string;
          price_minor?: number;
          publish_state?: Database["public"]["Enums"]["publish_state"];
          published_at?: string | null;
          short_description?: string;
          sku?: string;
          slug?: string;
          specifications?: NonNullable<Json>;
          stock?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          is_active: boolean;
          locale: Database["public"]["Enums"]["locale_code"];
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          is_active?: boolean;
          locale?: Database["public"]["Enums"]["locale_code"];
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          is_active?: boolean;
          locale?: Database["public"]["Enums"]["locale_code"];
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      project_media: {
        Row: {
          alt_text: string;
          caption: string | null;
          created_at: string;
          credit: string | null;
          height: number | null;
          id: string;
          position: number;
          project_id: string;
          role: Database["public"]["Enums"]["project_media_role"];
          storage_path: string;
          updated_at: string;
          width: number | null;
        };
        Insert: {
          alt_text: string;
          caption?: string | null;
          created_at?: string;
          credit?: string | null;
          height?: number | null;
          id?: string;
          position?: number;
          project_id: string;
          role?: Database["public"]["Enums"]["project_media_role"];
          storage_path: string;
          updated_at?: string;
          width?: number | null;
        };
        Update: {
          alt_text?: string;
          caption?: string | null;
          created_at?: string;
          credit?: string | null;
          height?: number | null;
          id?: string;
          position?: number;
          project_id?: string;
          role?: Database["public"]["Enums"]["project_media_role"];
          storage_path?: string;
          updated_at?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "project_media_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "electrical_projects";
            referencedColumns: ["id"];
          },
        ];
      };
      property_listings: {
        Row: {
          agent_id: string | null;
          amenities: string[];
          bathrooms: number | null;
          bedrooms: number | null;
          building_area_sqm: number | null;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          description: string;
          division_id: string | null;
          highlights: string[];
          id: string;
          inquiry_count: number;
          is_featured: boolean;
          land_area_sqm: number | null;
          listed_on: string | null;
          listing_type: Database["public"]["Enums"]["listing_type"];
          locality: string | null;
          price_minor: number | null;
          price_on_request: boolean;
          price_period: Database["public"]["Enums"]["price_period"];
          property_kind: Database["public"]["Enums"]["listing_property_kind"];
          property_type: Database["public"]["Enums"]["property_type"];
          published_at: string | null;
          reference: string;
          region_id: string;
          search_vector: unknown;
          slug: string;
          source: Database["public"]["Enums"]["listing_source"];
          status: Database["public"]["Enums"]["listing_status"];
          subdivision_id: string | null;
          title: string;
          updated_at: string;
          video_url: string | null;
          view_count: number;
          virtual_tour_url: string | null;
          year_built: number | null;
        };
        Insert: {
          agent_id?: string | null;
          amenities?: string[];
          bathrooms?: number | null;
          bedrooms?: number | null;
          building_area_sqm?: number | null;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description: string;
          division_id?: string | null;
          highlights?: string[];
          id?: string;
          inquiry_count?: number;
          is_featured?: boolean;
          land_area_sqm?: number | null;
          listed_on?: string | null;
          listing_type: Database["public"]["Enums"]["listing_type"];
          locality?: string | null;
          price_minor?: number | null;
          price_on_request?: boolean;
          price_period?: Database["public"]["Enums"]["price_period"];
          property_kind: Database["public"]["Enums"]["listing_property_kind"];
          property_type: Database["public"]["Enums"]["property_type"];
          published_at?: string | null;
          reference?: string;
          region_id: string;
          search_vector?: never;
          slug: string;
          source?: Database["public"]["Enums"]["listing_source"];
          status?: Database["public"]["Enums"]["listing_status"];
          subdivision_id?: string | null;
          title: string;
          updated_at?: string;
          video_url?: string | null;
          view_count?: number;
          virtual_tour_url?: string | null;
          year_built?: number | null;
        };
        Update: {
          agent_id?: string | null;
          amenities?: string[];
          bathrooms?: number | null;
          bedrooms?: number | null;
          building_area_sqm?: number | null;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string;
          division_id?: string | null;
          highlights?: string[];
          id?: string;
          inquiry_count?: number;
          is_featured?: boolean;
          land_area_sqm?: number | null;
          listed_on?: string | null;
          listing_type?: Database["public"]["Enums"]["listing_type"];
          locality?: string | null;
          price_minor?: number | null;
          price_on_request?: boolean;
          price_period?: Database["public"]["Enums"]["price_period"];
          property_kind?: Database["public"]["Enums"]["listing_property_kind"];
          property_type?: Database["public"]["Enums"]["property_type"];
          published_at?: string | null;
          reference?: string;
          region_id?: string;
          search_vector?: never;
          slug?: string;
          source?: Database["public"]["Enums"]["listing_source"];
          status?: Database["public"]["Enums"]["listing_status"];
          subdivision_id?: string | null;
          title?: string;
          updated_at?: string;
          video_url?: string | null;
          view_count?: number;
          virtual_tour_url?: string | null;
          year_built?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "property_listings_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agent_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_listings_division_region_fkey";
            columns: ["division_id", "region_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id", "region_id"];
          },
          {
            foreignKeyName: "property_listings_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_listings_subdivision_region_fkey";
            columns: ["subdivision_id", "division_id", "region_id"];
            isOneToOne: false;
            referencedRelation: "subdivisions";
            referencedColumns: ["id", "division_id", "region_id"];
          },
        ];
      };
      public_listing_locations: {
        Row: {
          approximate_location: unknown;
          listing_id: string;
          precision_metres: number;
          updated_at: string;
        };
        Insert: {
          approximate_location?: unknown;
          listing_id: string;
          precision_metres?: number;
          updated_at?: string;
        };
        Update: {
          approximate_location?: unknown;
          listing_id?: string;
          precision_metres?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "public_listing_locations_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: true;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      redirects: {
        Row: {
          created_at: string;
          hit_count: number;
          id: string;
          is_active: boolean;
          source_path: string;
          status_code: number;
          target_path: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          hit_count?: number;
          id?: string;
          is_active?: boolean;
          source_path: string;
          status_code?: number;
          target_path: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          hit_count?: number;
          id?: string;
          is_active?: boolean;
          source_path?: string;
          status_code?: number;
          target_path?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      regions: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          name: string;
          name_fr: string | null;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          name_fr?: string | null;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          name_fr?: string | null;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_searches: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          locale: Database["public"]["Enums"]["locale_code"];
          query_string: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label: string;
          locale?: Database["public"]["Enums"]["locale_code"];
          query_string?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          locale?: Database["public"]["Enums"]["locale_code"];
          query_string?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      search_alert_preferences: {
        Row: {
          created_at: string;
          enabled: boolean;
          frequency: Database["public"]["Enums"]["search_alert_frequency"];
          id: string;
          saved_search_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          frequency?: Database["public"]["Enums"]["search_alert_frequency"];
          id?: string;
          saved_search_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          frequency?: Database["public"]["Enums"]["search_alert_frequency"];
          id?: string;
          saved_search_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "search_alert_preferences_saved_search_id_fkey";
            columns: ["saved_search_id"];
            isOneToOne: true;
            referencedRelation: "saved_searches";
            referencedColumns: ["id"];
          },
        ];
      };
      seo_metadata: {
        Row: {
          canonical_override: string | null;
          created_at: string;
          description: string | null;
          id: string;
          locale: Database["public"]["Enums"]["locale_code"];
          noindex: boolean;
          og_image_path: string | null;
          path: string;
          structured_data: Json | null;
          title: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          canonical_override?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          locale: Database["public"]["Enums"]["locale_code"];
          noindex?: boolean;
          og_image_path?: string | null;
          path: string;
          structured_data?: Json | null;
          title?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          canonical_override?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          locale?: Database["public"]["Enums"]["locale_code"];
          noindex?: boolean;
          og_image_path?: string | null;
          path?: string;
          structured_data?: Json | null;
          title?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      services: {
        Row: {
          created_at: string;
          delivery_notes: string | null;
          department_id: string;
          description: string;
          faqs: NonNullable<Json>;
          features: NonNullable<Json>;
          id: string;
          is_active: boolean;
          publish_state: Database["public"]["Enums"]["publish_state"];
          published_at: string | null;
          slug: string;
          sort_order: number;
          summary: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          delivery_notes?: string | null;
          department_id: string;
          description: string;
          faqs?: NonNullable<Json>;
          features?: NonNullable<Json>;
          id?: string;
          is_active?: boolean;
          publish_state?: Database["public"]["Enums"]["publish_state"];
          published_at?: string | null;
          slug: string;
          sort_order?: number;
          summary: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          delivery_notes?: string | null;
          department_id?: string;
          description?: string;
          faqs?: NonNullable<Json>;
          features?: NonNullable<Json>;
          id?: string;
          is_active?: boolean;
          publish_state?: Database["public"]["Enums"]["publish_state"];
          published_at?: string | null;
          slug?: string;
          sort_order?: number;
          summary?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      site_settings: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_public: boolean;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: NonNullable<Json>;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: NonNullable<Json>;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      subdivisions: {
        Row: {
          code: string;
          created_at: string;
          division_id: string;
          id: string;
          name: string;
          name_fr: string | null;
          region_id: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          division_id: string;
          id?: string;
          name: string;
          name_fr?: string | null;
          region_id: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          division_id?: string;
          id?: string;
          name?: string;
          name_fr?: string | null;
          region_id?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subdivisions_division_id_fkey";
            columns: ["division_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subdivisions_division_region_fkey";
            columns: ["division_id", "region_id"];
            isOneToOne: false;
            referencedRelation: "divisions";
            referencedColumns: ["id", "region_id"];
          },
          {
            foreignKeyName: "subdivisions_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      translation_entries: {
        Row: {
          created_at: string;
          entity_id: string;
          entity_type: Database["public"]["Enums"]["translatable_entity_type"];
          error_message: string | null;
          field_name: string;
          id: string;
          last_synced_at: string | null;
          source_locale: Database["public"]["Enums"]["locale_code"];
          state: Database["public"]["Enums"]["translation_state"];
          sync_state: Database["public"]["Enums"]["sync_state"];
          target_locales: Database["public"]["Enums"]["locale_code"][];
          tolgee_key_id: string | null;
          translation_key: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          entity_id: string;
          entity_type: Database["public"]["Enums"]["translatable_entity_type"];
          error_message?: string | null;
          field_name: string;
          id?: string;
          last_synced_at?: string | null;
          source_locale?: Database["public"]["Enums"]["locale_code"];
          state?: Database["public"]["Enums"]["translation_state"];
          sync_state?: Database["public"]["Enums"]["sync_state"];
          target_locales: Database["public"]["Enums"]["locale_code"][];
          tolgee_key_id?: string | null;
          translation_key: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          entity_id?: string;
          entity_type?: Database["public"]["Enums"]["translatable_entity_type"];
          error_message?: string | null;
          field_name?: string;
          id?: string;
          last_synced_at?: string | null;
          source_locale?: Database["public"]["Enums"]["locale_code"];
          state?: Database["public"]["Enums"]["translation_state"];
          sync_state?: Database["public"]["Enums"]["sync_state"];
          target_locales?: Database["public"]["Enums"]["locale_code"][];
          tolgee_key_id?: string | null;
          translation_key?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      translation_sync_jobs: {
        Row: {
          attempts: number;
          created_at: string;
          finished_at: string | null;
          id: string;
          job_type: string;
          last_error: string | null;
          max_attempts: number;
          payload: NonNullable<Json>;
          scheduled_at: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["sync_state"];
          translation_entry_id: string | null;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          job_type?: string;
          last_error?: string | null;
          max_attempts?: number;
          payload?: NonNullable<Json>;
          scheduled_at?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["sync_state"];
          translation_entry_id?: string | null;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          job_type?: string;
          last_error?: string | null;
          max_attempts?: number;
          payload?: NonNullable<Json>;
          scheduled_at?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["sync_state"];
          translation_entry_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "translation_sync_jobs_translation_entry_id_fkey";
            columns: ["translation_entry_id"];
            isOneToOne: false;
            referencedRelation: "translation_entries";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      crm_inbox: {
        Row: {
          assigned_at: string | null;
          assigned_to: string | null;
          assignee_name: string | null;
          awaiting_response: boolean | null;
          closed_at: string | null;
          created_at: string | null;
          department_id: string | null;
          department_name: string | null;
          department_slug: string | null;
          email: string | null;
          full_name: string | null;
          hours_since_activity: number | null;
          id: string | null;
          inquiry_type: Database["public"]["Enums"]["inquiry_type"] | null;
          last_activity_at: string | null;
          locale: Database["public"]["Enums"]["locale_code"] | null;
          phone: string | null;
          priority: Database["public"]["Enums"]["inquiry_priority"] | null;
          reference: string | null;
          responded_at: string | null;
          source: Database["public"]["Enums"]["inquiry_source"] | null;
          status: Database["public"]["Enums"]["inquiry_status"] | null;
          subject: string | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inquiries_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_inbox_summary: {
        Row: {
          awaiting_response_count: number | null;
          department_id: string | null;
          department_slug: string | null;
          escalated_count: number | null;
          inquiry_count: number | null;
          priority: Database["public"]["Enums"]["inquiry_priority"] | null;
          status: Database["public"]["Enums"]["inquiry_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "inquiries_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_transactions: {
        Row: {
          amount_minor: number | null;
          captured_at: string | null;
          created_at: string | null;
          currency: string | null;
          customer_id: string | null;
          order_id: string | null;
          order_reference: string | null;
          order_status: Database["public"]["Enums"]["order_status"] | null;
          order_total_minor: number | null;
          payment_id: string | null;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          payment_status: Database["public"]["Enums"]["payment_status"] | null;
          refunded_at: string | null;
          refunded_minor: number | null;
        };
        Relationships: [];
      };
      listing_locations_api: {
        Row: {
          latitude: number | null;
          listing_id: string | null;
          longitude: number | null;
          precision_metres: number | null;
          updated_at: string | null;
        };
        Insert: {
          latitude?: never;
          listing_id?: string | null;
          longitude?: never;
          precision_metres?: number | null;
          updated_at?: string | null;
        };
        Update: {
          latitude?: never;
          listing_id?: string | null;
          longitude?: never;
          precision_metres?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "public_listing_locations_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: true;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_private_details_api: {
        Row: {
          exact_address: string | null;
          exact_latitude: number | null;
          exact_longitude: number | null;
          internal_notes: string | null;
          listing_id: string | null;
          owner_email: string | null;
          owner_name: string | null;
          owner_notes: string | null;
          owner_phone: string | null;
          updated_at: string | null;
        };
        Insert: {
          exact_address?: string | null;
          exact_latitude?: never;
          exact_longitude?: never;
          internal_notes?: string | null;
          listing_id?: string | null;
          owner_email?: never;
          owner_name?: string | null;
          owner_notes?: string | null;
          owner_phone?: string | null;
          updated_at?: string | null;
        };
        Update: {
          exact_address?: string | null;
          exact_latitude?: never;
          exact_longitude?: never;
          internal_notes?: string | null;
          listing_id?: string | null;
          owner_email?: never;
          owner_name?: string | null;
          owner_notes?: string | null;
          owner_phone?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "listing_private_details_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: true;
            referencedRelation: "property_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      report_inquiries_daily: {
        Row: {
          department_slug: string | null;
          inquiry_count: number | null;
          inquiry_date: string | null;
          inquiry_type: Database["public"]["Enums"]["inquiry_type"] | null;
          responded_count: number | null;
          source: Database["public"]["Enums"]["inquiry_source"] | null;
        };
        Relationships: [];
      };
      report_inventory_status: {
        Row: {
          availability:
            | Database["public"]["Enums"]["product_availability"]
            | null;
          currency: string | null;
          low_stock: boolean | null;
          price_minor: number | null;
          product_id: string | null;
          publish_state: Database["public"]["Enums"]["publish_state"] | null;
          sku: string | null;
          stock: number | null;
          times_ordered: number | null;
          title: string | null;
        };
        Insert: {
          availability?:
            | Database["public"]["Enums"]["product_availability"]
            | null;
          currency?: string | null;
          low_stock?: never;
          price_minor?: number | null;
          product_id?: string | null;
          publish_state?: Database["public"]["Enums"]["publish_state"] | null;
          sku?: string | null;
          stock?: number | null;
          times_ordered?: never;
          title?: string | null;
        };
        Update: {
          availability?:
            | Database["public"]["Enums"]["product_availability"]
            | null;
          currency?: string | null;
          low_stock?: never;
          price_minor?: number | null;
          product_id?: string | null;
          publish_state?: Database["public"]["Enums"]["publish_state"] | null;
          sku?: string | null;
          stock?: number | null;
          times_ordered?: never;
          title?: string | null;
        };
        Relationships: [];
      };
      report_listing_activity_daily: {
        Row: {
          activity_date: string | null;
          event_count: number | null;
          event_type: Database["public"]["Enums"]["listing_event_type"] | null;
          listing_status: Database["public"]["Enums"]["listing_status"] | null;
        };
        Relationships: [];
      };
      report_order_pipeline: {
        Row: {
          currency: string | null;
          order_count: number | null;
          status: Database["public"]["Enums"]["order_status"] | null;
          total_minor: number | null;
        };
        Relationships: [];
      };
      report_sales_daily: {
        Row: {
          currency: string | null;
          gross_minor: number | null;
          ordered_minor: number | null;
          overpayment_minor: number | null;
          paid_order_count: number | null;
          sale_date: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      apply_payment_result: {
        Args: {
          p_failure_reason?: string;
          p_payment_id: string;
          p_provider_metadata?: Json;
          p_provider_reference?: string;
          p_status: Database["public"]["Enums"]["payment_status"];
        };
        Returns: {
          amount_minor: number;
          authorized_at: string | null;
          captured_at: string | null;
          created_at: string;
          currency: string;
          failed_at: string | null;
          failure_reason: string | null;
          id: string;
          idempotency_key: string;
          method: Database["public"]["Enums"]["payment_method"];
          order_id: string;
          provider: string;
          provider_metadata: NonNullable<Json>;
          provider_reference: string | null;
          provider_tx_ref: string;
          refunded_at: string | null;
          refunded_minor: number;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "payments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      build_translation_key: {
        Args: {
          p_entity_id: string;
          p_entity_type: Database["public"]["Enums"]["translatable_entity_type"];
          p_field_name: string;
          p_locale: Database["public"]["Enums"]["locale_code"];
        };
        Returns: string;
      };
      can_access_department: {
        Args: { department_slug: string };
        Returns: boolean;
      };
      cancel_order: {
        Args: {
          p_actor_id?: string;
          p_actor_kind?: string;
          p_note?: string;
          p_order_id: string;
        };
        Returns: {
          access_token: string;
          cancelled_at: string | null;
          cart_id: string | null;
          created_at: string;
          currency: string;
          customer_id: string | null;
          delivery_address_line1: string | null;
          delivery_address_line2: string | null;
          delivery_city: string | null;
          delivery_minor: number;
          delivery_notes: string | null;
          delivery_region_id: string | null;
          email: string;
          fulfilled_at: string | null;
          fulfillment: Database["public"]["Enums"]["order_fulfillment"];
          full_name: string;
          id: string;
          idempotency_key: string;
          inventory_applied: boolean;
          inventory_released_at: string | null;
          locale: Database["public"]["Enums"]["locale_code"];
          manual_payment_reference: string | null;
          paid_at: string | null;
          paid_minor: number;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          phone: string | null;
          placed_at: string;
          reference: string;
          refunded_at: string | null;
          status: Database["public"]["Enums"]["order_status"];
          subtotal_minor: number;
          total_minor: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "orders";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      claim_translation_sync_jobs: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          created_at: string;
          finished_at: string | null;
          id: string;
          job_type: string;
          last_error: string | null;
          max_attempts: number;
          payload: NonNullable<Json>;
          scheduled_at: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["sync_state"];
          translation_entry_id: string | null;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "translation_sync_jobs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      complete_translation_sync_job: {
        Args: { p_job_id: string; p_tolgee_key_id?: string };
        Returns: undefined;
      };
      current_agent_id: { Args: Record<PropertyKey, never>; Returns: string };
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      fail_translation_sync_job: {
        Args: { p_error: string; p_job_id: string };
        Returns: undefined;
      };
      generate_inquiry_reference: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      generate_listing_reference: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      generate_order_reference: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      gtin_is_valid: { Args: { value: string }; Returns: boolean };
      immutable_array_to_string: { Args: { arr: string[] }; Returns: string };
      import_administrative_divisions: {
        Args: { p_divisions: Json; p_region_code: string };
        Returns: {
          inserted: number;
          skipped: number;
        }[];
      };
      inquiry_is_for_agent_listing: {
        Args: { p_inquiry_id: string };
        Returns: boolean;
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_inquiry_manager: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_real_estate_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_super_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      listing_geography_counts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          geo_id: string;
          level: Database["public"]["Enums"]["geo_landing_level"];
          parent_id: string;
          total: number;
        }[];
      };
      listing_status_transition_allowed: {
        Args: {
          p_from: Database["public"]["Enums"]["listing_status"];
          p_to: Database["public"]["Enums"]["listing_status"];
        };
        Returns: boolean;
      };
      match_region_by_name: {
        Args: { p_name: string };
        Returns: {
          code: string;
          id: string;
          name: string;
          similarity: number;
          slug: string;
        }[];
      };
      order_transition_allowed: {
        Args: {
          p_from: Database["public"]["Enums"]["order_status"];
          p_to: Database["public"]["Enums"]["order_status"];
        };
        Returns: boolean;
      };
      place_order: {
        Args: {
          p_cart_id: string;
          p_customer_id?: string;
          p_delivery_address_line1?: string;
          p_delivery_address_line2?: string;
          p_delivery_city?: string;
          p_delivery_minor?: number;
          p_delivery_notes?: string;
          p_delivery_region_id?: string;
          p_email?: string;
          p_fulfillment?: Database["public"]["Enums"]["order_fulfillment"];
          p_full_name?: string;
          p_idempotency_key: string;
          p_locale?: Database["public"]["Enums"]["locale_code"];
          p_payment_method?: Database["public"]["Enums"]["payment_method"];
          p_phone?: string;
        };
        Returns: {
          access_token: string;
          cancelled_at: string | null;
          cart_id: string | null;
          created_at: string;
          currency: string;
          customer_id: string | null;
          delivery_address_line1: string | null;
          delivery_address_line2: string | null;
          delivery_city: string | null;
          delivery_minor: number;
          delivery_notes: string | null;
          delivery_region_id: string | null;
          email: string;
          fulfilled_at: string | null;
          fulfillment: Database["public"]["Enums"]["order_fulfillment"];
          full_name: string;
          id: string;
          idempotency_key: string;
          inventory_applied: boolean;
          inventory_released_at: string | null;
          locale: Database["public"]["Enums"]["locale_code"];
          manual_payment_reference: string | null;
          paid_at: string | null;
          paid_minor: number;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          phone: string | null;
          placed_at: string;
          reference: string;
          refunded_at: string | null;
          status: Database["public"]["Enums"]["order_status"];
          subtotal_minor: number;
          total_minor: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "orders";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      product_translatable_fields: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      property_translatable_fields: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      publish_state_is_consistent: {
        Args: {
          p_published_at: string;
          p_status: Database["public"]["Enums"]["listing_status"];
        };
        Returns: boolean;
      };
      record_listing_view: {
        Args: { p_listing_id: string; p_visitor_digest?: string };
        Returns: undefined;
      };
      recount_listing_metrics: {
        Args: { p_listing_id: string };
        Returns: undefined;
      };
      release_order_inventory: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      requeue_translation_entry: {
        Args: { p_entry_id: string };
        Returns: undefined;
      };
      review_listing_submission: {
        Args: {
          p_decision: Database["public"]["Enums"]["submission_status"];
          p_publish?: boolean;
          p_review_notes?: string;
          p_submission_id: string;
        };
        Returns: undefined;
      };
      search_property_listings: {
        Args: {
          p_amenities?: string[];
          p_division_id?: string;
          p_limit?: number;
          p_listing_type?: Database["public"]["Enums"]["listing_type"];
          p_locale?: Database["public"]["Enums"]["locale_code"];
          p_max_price?: number;
          p_max_size?: number;
          p_min_bathrooms?: number;
          p_min_bedrooms?: number;
          p_min_price?: number;
          p_min_size?: number;
          p_offset?: number;
          p_property_kind?: Database["public"]["Enums"]["listing_property_kind"];
          p_property_type?: Database["public"]["Enums"]["property_type"];
          p_query?: string;
          p_region_id?: string;
          p_sort?: Database["public"]["Enums"]["listing_sort_order"];
          p_statuses?: Database["public"]["Enums"]["listing_status"][];
          p_subdivision_id?: string;
        };
        Returns: {
          bathrooms: number;
          bedrooms: number;
          building_area_sqm: number;
          currency: string;
          id: string;
          is_featured: boolean;
          land_area_sqm: number;
          listing_type: Database["public"]["Enums"]["listing_type"];
          locality: string;
          price_minor: number;
          price_on_request: boolean;
          price_period: Database["public"]["Enums"]["price_period"];
          property_kind: Database["public"]["Enums"]["listing_property_kind"];
          published_at: string;
          rank: number;
          reference: string;
          region_slug: string;
          slug: string;
          title: string;
          total_count: number;
          view_count: number;
        }[];
      };
      set_listing_localized_slug: {
        Args: {
          p_listing_id: string;
          p_locale: Database["public"]["Enums"]["locale_code"];
          p_slug: string;
        };
        Returns: undefined;
      };
      set_listing_private_details: {
        Args: {
          p_exact_address?: string;
          p_internal_notes?: string;
          p_latitude?: number;
          p_listing_id: string;
          p_longitude?: number;
          p_owner_email?: string;
          p_owner_name?: string;
          p_owner_notes?: string;
          p_owner_phone?: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      appointment_status: "requested" | "confirmed" | "completed" | "cancelled";
      appointment_window: "morning" | "afternoon" | "anytime";
      cart_status: "active" | "converted" | "abandoned" | "expired";
      contact_method: "email" | "phone" | "whatsapp";
      geo_landing_level: "region" | "division" | "subdivision";
      inquiry_priority: "low" | "normal" | "high" | "urgent";
      inquiry_source:
        | "contact_form"
        | "quote_request"
        | "property_inquiry"
        | "viewing_request"
        | "phone"
        | "email"
        | "walk_in"
        | "service_inquiry"
        | "site_visit_request";
      inquiry_status:
        | "new"
        | "assigned"
        | "in_progress"
        | "responded"
        | "closed"
        | "spam";
      inquiry_type:
        | "general"
        | "quote"
        | "property"
        | "viewing"
        | "service"
        | "support";
      inventory_reason:
        | "initial"
        | "restock"
        | "sale"
        | "return"
        | "correction"
        | "damage";
      listing_event_type:
        | "view"
        | "inquiry"
        | "share"
        | "save"
        | "contact_reveal";
      listing_property_kind:
        | "house"
        | "apartment"
        | "villa"
        | "duplex"
        | "studio"
        | "bungalow"
        | "land"
        | "farm"
        | "office"
        | "shop"
        | "warehouse"
        | "hotel"
        | "guesthouse"
        | "restaurant"
        | "mixed_use"
        | "other";
      listing_sort_order: "newest" | "price_asc" | "price_desc" | "most_viewed";
      listing_source: "admin" | "agent" | "owner_submission" | "import";
      listing_status:
        | "draft"
        | "pending_review"
        | "published"
        | "under_offer"
        | "sold"
        | "rented"
        | "archived"
        | "rejected";
      listing_type: "sale" | "rent" | "lease" | "short_term";
      locale_code: "en" | "fr";
      order_fulfillment: "delivery" | "pickup";
      order_status:
        | "pending_payment"
        | "paid"
        | "processing"
        | "fulfilled"
        | "cancelled"
        | "refunded";
      payment_method:
        | "card"
        | "mobile_money_mtn"
        | "mobile_money_orange"
        | "bank_transfer"
        | "cash_on_confirmation";
      payment_status:
        | "pending"
        | "requires_action"
        | "succeeded"
        | "failed"
        | "cancelled"
        | "refunded"
        | "manual_pending";
      price_period:
        | "total"
        | "monthly"
        | "quarterly"
        | "yearly"
        | "weekly"
        | "nightly";
      product_availability:
        | "in_stock"
        | "out_of_stock"
        | "preorder"
        | "backorder"
        | "discontinued";
      product_condition: "new" | "refurbished" | "used";
      project_media_role: "before" | "after" | "general";
      property_type: "residential" | "commercial" | "industrial";
      publish_state: "draft" | "published" | "archived";
      search_alert_frequency: "instant" | "daily" | "weekly";
      submission_status:
        | "pending_review"
        | "approved"
        | "rejected"
        | "changes_requested";
      sync_state: "not_required" | "queued" | "syncing" | "synced" | "failed";
      translatable_entity_type:
        | "department"
        | "service"
        | "product"
        | "category"
        | "electrical_project"
        | "property_listing"
        | "insight"
        | "site_setting"
        | "product_media"
        | "project_media"
        | "property_media";
      translation_state:
        | "missing"
        | "pending"
        | "in_progress"
        | "translated"
        | "reviewed"
        | "outdated";
      user_role:
        | "visitor"
        | "customer"
        | "real_estate_agent"
        | "digital_marketing_staff"
        | "digital_marketing_admin"
        | "electrical_staff"
        | "electrical_admin"
        | "department_staff"
        | "super_admin"
        | "real_estate_admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      appointment_status: ["requested", "confirmed", "completed", "cancelled"],
      appointment_window: ["morning", "afternoon", "anytime"],
      cart_status: ["active", "converted", "abandoned", "expired"],
      contact_method: ["email", "phone", "whatsapp"],
      geo_landing_level: ["region", "division", "subdivision"],
      inquiry_priority: ["low", "normal", "high", "urgent"],
      inquiry_source: [
        "contact_form",
        "quote_request",
        "property_inquiry",
        "viewing_request",
        "phone",
        "email",
        "walk_in",
        "service_inquiry",
        "site_visit_request",
      ],
      inquiry_status: [
        "new",
        "assigned",
        "in_progress",
        "responded",
        "closed",
        "spam",
      ],
      inquiry_type: [
        "general",
        "quote",
        "property",
        "viewing",
        "service",
        "support",
      ],
      inventory_reason: [
        "initial",
        "restock",
        "sale",
        "return",
        "correction",
        "damage",
      ],
      listing_event_type: [
        "view",
        "inquiry",
        "share",
        "save",
        "contact_reveal",
      ],
      listing_property_kind: [
        "house",
        "apartment",
        "villa",
        "duplex",
        "studio",
        "bungalow",
        "land",
        "farm",
        "office",
        "shop",
        "warehouse",
        "hotel",
        "guesthouse",
        "restaurant",
        "mixed_use",
        "other",
      ],
      listing_sort_order: ["newest", "price_asc", "price_desc", "most_viewed"],
      listing_source: ["admin", "agent", "owner_submission", "import"],
      listing_status: [
        "draft",
        "pending_review",
        "published",
        "under_offer",
        "sold",
        "rented",
        "archived",
        "rejected",
      ],
      listing_type: ["sale", "rent", "lease", "short_term"],
      locale_code: ["en", "fr"],
      order_fulfillment: ["delivery", "pickup"],
      order_status: [
        "pending_payment",
        "paid",
        "processing",
        "fulfilled",
        "cancelled",
        "refunded",
      ],
      payment_method: [
        "card",
        "mobile_money_mtn",
        "mobile_money_orange",
        "bank_transfer",
        "cash_on_confirmation",
      ],
      payment_status: [
        "pending",
        "requires_action",
        "succeeded",
        "failed",
        "cancelled",
        "refunded",
        "manual_pending",
      ],
      price_period: [
        "total",
        "monthly",
        "quarterly",
        "yearly",
        "weekly",
        "nightly",
      ],
      product_availability: [
        "in_stock",
        "out_of_stock",
        "preorder",
        "backorder",
        "discontinued",
      ],
      product_condition: ["new", "refurbished", "used"],
      project_media_role: ["before", "after", "general"],
      property_type: ["residential", "commercial", "industrial"],
      publish_state: ["draft", "published", "archived"],
      search_alert_frequency: ["instant", "daily", "weekly"],
      submission_status: [
        "pending_review",
        "approved",
        "rejected",
        "changes_requested",
      ],
      sync_state: ["not_required", "queued", "syncing", "synced", "failed"],
      translatable_entity_type: [
        "department",
        "service",
        "product",
        "category",
        "electrical_project",
        "property_listing",
        "insight",
        "site_setting",
        "product_media",
        "project_media",
        "property_media",
      ],
      translation_state: [
        "missing",
        "pending",
        "in_progress",
        "translated",
        "reviewed",
        "outdated",
      ],
      user_role: [
        "visitor",
        "customer",
        "real_estate_agent",
        "digital_marketing_staff",
        "digital_marketing_admin",
        "electrical_staff",
        "electrical_admin",
        "department_staff",
        "super_admin",
        "real_estate_admin",
      ],
    },
  },
} as const;
