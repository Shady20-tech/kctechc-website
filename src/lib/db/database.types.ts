
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": string,"ip_hash": string | null,"metadata": NonNullable<Json>
                  }
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: string,"ip_hash"?: string | null,"metadata"?: NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: string,"ip_hash"?: string | null,"metadata"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"content_translations": {
                  Row: {
                    "created_at": string,"entity_id": string,"entity_type": Database["public"]['Enums']["translatable_entity_type"],"field_name": string,"id": string,"locale": Database["public"]['Enums']["locale_code"],"source_locale": Database["public"]['Enums']["locale_code"],"source_updated_at": string | null,"state": Database["public"]['Enums']["translation_state"],"translated_at": string | null,"translated_by": string | null,"updated_at": string,"value": string
                  }
                  Insert: {
                    "created_at"?: string,"entity_id": string,"entity_type": Database["public"]['Enums']["translatable_entity_type"],"field_name": string,"id"?: string,"locale": Database["public"]['Enums']["locale_code"],"source_locale"?: Database["public"]['Enums']["locale_code"],"source_updated_at"?: string | null,"state"?: Database["public"]['Enums']["translation_state"],"translated_at"?: string | null,"translated_by"?: string | null,"updated_at"?: string,"value": string
                  }
                  Update: {
                    "created_at"?: string,"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["translatable_entity_type"],"field_name"?: string,"id"?: string,"locale"?: Database["public"]['Enums']["locale_code"],"source_locale"?: Database["public"]['Enums']["locale_code"],"source_updated_at"?: string | null,"state"?: Database["public"]['Enums']["translation_state"],"translated_at"?: string | null,"translated_by"?: string | null,"updated_at"?: string,"value"?: string
                  }
                  Relationships: [
                    
                  ]
                },"departments": {
                  Row: {
                    "accent_color": string | null,"created_at": string,"id": string,"is_active": boolean,"name": string,"slug": string,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "accent_color"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "accent_color"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"divisions": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"name": string,"name_fr": string | null,"region_id": string,"slug": string,"updated_at": string
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"name": string,"name_fr"?: string | null,"region_id": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"name"?: string,"name_fr"?: string | null,"region_id"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "divisions_region_id_fkey"
      columns: ["region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"email": string | null,"full_name": string | null,"id": string,"is_active": boolean,"locale": Database["public"]['Enums']["locale_code"],"phone": string | null,"role": Database["public"]['Enums']["user_role"],"updated_at": string
                  }
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"is_active"?: boolean,"locale"?: Database["public"]['Enums']["locale_code"],"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"is_active"?: boolean,"locale"?: Database["public"]['Enums']["locale_code"],"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"redirects": {
                  Row: {
                    "created_at": string,"hit_count": number,"id": string,"is_active": boolean,"source_path": string,"status_code": number,"target_path": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"hit_count"?: number,"id"?: string,"is_active"?: boolean,"source_path": string,"status_code"?: number,"target_path": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"hit_count"?: number,"id"?: string,"is_active"?: boolean,"source_path"?: string,"status_code"?: number,"target_path"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"regions": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"name": string,"name_fr": string | null,"slug": string,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"name": string,"name_fr"?: string | null,"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"name"?: string,"name_fr"?: string | null,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"seo_metadata": {
                  Row: {
                    "canonical_override": string | null,"created_at": string,"description": string | null,"id": string,"locale": Database["public"]['Enums']["locale_code"],"noindex": boolean,"og_image_path": string | null,"path": string,"structured_data": Json | null,"title": string | null,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "canonical_override"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"locale": Database["public"]['Enums']["locale_code"],"noindex"?: boolean,"og_image_path"?: string | null,"path": string,"structured_data"?: Json | null,"title"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "canonical_override"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"locale"?: Database["public"]['Enums']["locale_code"],"noindex"?: boolean,"og_image_path"?: string | null,"path"?: string,"structured_data"?: Json | null,"title"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"site_settings": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"is_public": boolean,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_public"?: boolean,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_public"?: boolean,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"subdivisions": {
                  Row: {
                    "code": string,"created_at": string,"division_id": string,"id": string,"name": string,"name_fr": string | null,"slug": string,"updated_at": string
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"division_id": string,"id"?: string,"name": string,"name_fr"?: string | null,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"division_id"?: string,"id"?: string,"name"?: string,"name_fr"?: string | null,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subdivisions_division_id_fkey"
      columns: ["division_id"]
isOneToOne: false
      referencedRelation: "divisions"
      referencedColumns: ["id"]
    }
                  ]
                },"translation_entries": {
                  Row: {
                    "created_at": string,"entity_id": string,"entity_type": Database["public"]['Enums']["translatable_entity_type"],"error_message": string | null,"field_name": string,"id": string,"last_synced_at": string | null,"source_locale": Database["public"]['Enums']["locale_code"],"state": Database["public"]['Enums']["translation_state"],"sync_state": Database["public"]['Enums']["sync_state"],"target_locales": (Database["public"]['Enums']["locale_code"])[],"tolgee_key_id": string | null,"translation_key": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"entity_id": string,"entity_type": Database["public"]['Enums']["translatable_entity_type"],"error_message"?: string | null,"field_name": string,"id"?: string,"last_synced_at"?: string | null,"source_locale"?: Database["public"]['Enums']["locale_code"],"state"?: Database["public"]['Enums']["translation_state"],"sync_state"?: Database["public"]['Enums']["sync_state"],"target_locales": (Database["public"]['Enums']["locale_code"])[],"tolgee_key_id"?: string | null,"translation_key": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["translatable_entity_type"],"error_message"?: string | null,"field_name"?: string,"id"?: string,"last_synced_at"?: string | null,"source_locale"?: Database["public"]['Enums']["locale_code"],"state"?: Database["public"]['Enums']["translation_state"],"sync_state"?: Database["public"]['Enums']["sync_state"],"target_locales"?: (Database["public"]['Enums']["locale_code"])[],"tolgee_key_id"?: string | null,"translation_key"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"translation_sync_jobs": {
                  Row: {
                    "attempts": number,"created_at": string,"finished_at": string | null,"id": string,"job_type": string,"last_error": string | null,"max_attempts": number,"payload": NonNullable<Json>,"scheduled_at": string,"started_at": string | null,"status": Database["public"]['Enums']["sync_state"],"translation_entry_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"finished_at"?: string | null,"id"?: string,"job_type"?: string,"last_error"?: string | null,"max_attempts"?: number,"payload"?: NonNullable<Json>,"scheduled_at"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["sync_state"],"translation_entry_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"finished_at"?: string | null,"id"?: string,"job_type"?: string,"last_error"?: string | null,"max_attempts"?: number,"payload"?: NonNullable<Json>,"scheduled_at"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["sync_state"],"translation_entry_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "translation_sync_jobs_translation_entry_id_fkey"
      columns: ["translation_entry_id"]
isOneToOne: false
      referencedRelation: "translation_entries"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "can_access_department":
{ Args: { "department_slug": string }; Returns: boolean
                           },
"current_user_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"import_administrative_divisions":
{ Args: { "p_divisions": Json,"p_region_code": string }; Returns: {
              "inserted": number,"skipped": number
            }[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_super_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           }
          }
          Enums: {
            "locale_code": "en"|"fr","publish_state": "draft"|"published"|"archived","sync_state": "not_required"|"queued"|"syncing"|"synced"|"failed","translatable_entity_type": "department"|"service"|"product"|"category"|"electrical_project"|"property_listing"|"insight"|"site_setting","translation_state": "missing"|"pending"|"in_progress"|"translated"|"reviewed"|"outdated","user_role": "visitor"|"customer"|"real_estate_agent"|"digital_marketing_staff"|"digital_marketing_admin"|"electrical_staff"|"electrical_admin"|"department_staff"|"super_admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "locale_code": ["en", "fr"],"publish_state": ["draft", "published", "archived"],"sync_state": ["not_required", "queued", "syncing", "synced", "failed"],"translatable_entity_type": ["department", "service", "product", "category", "electrical_project", "property_listing", "insight", "site_setting"],"translation_state": ["missing", "pending", "in_progress", "translated", "reviewed", "outdated"],"user_role": ["visitor", "customer", "real_estate_agent", "digital_marketing_staff", "digital_marketing_admin", "electrical_staff", "electrical_admin", "department_staff", "super_admin"]
          }
        }
} as const

