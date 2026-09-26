
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
                },"authors": {
                  Row: {
                    "bio": string | null,"created_at": string,"display_name": string,"id": string,"is_active": boolean,"role_title": string | null,"slug": string,"updated_at": string
                  }
                  Insert: {
                    "bio"?: string | null,"created_at"?: string,"display_name": string,"id"?: string,"is_active"?: boolean,"role_title"?: string | null,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "bio"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"is_active"?: boolean,"role_title"?: string | null,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cart_items": {
                  Row: {
                    "cart_id": string,"created_at": string,"currency": string,"id": string,"product_id": string,"quantity": number,"unit_price_minor": number,"updated_at": string
                  }
                  Insert: {
                    "cart_id": string,"created_at"?: string,"currency"?: string,"id"?: string,"product_id": string,"quantity": number,"unit_price_minor": number,"updated_at"?: string
                  }
                  Update: {
                    "cart_id"?: string,"created_at"?: string,"currency"?: string,"id"?: string,"product_id"?: string,"quantity"?: number,"unit_price_minor"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_items_cart_id_fkey"
      columns: ["cart_id"]
isOneToOne: false
      referencedRelation: "carts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"carts": {
                  Row: {
                    "created_at": string,"currency": string,"customer_id": string | null,"expires_at": string,"id": string,"locale": Database["public"]['Enums']["locale_code"],"status": Database["public"]['Enums']["cart_status"],"token": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"currency"?: string,"customer_id"?: string | null,"expires_at"?: string,"id"?: string,"locale"?: Database["public"]['Enums']["locale_code"],"status"?: Database["public"]['Enums']["cart_status"],"token": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"customer_id"?: string | null,"expires_at"?: string,"id"?: string,"locale"?: Database["public"]['Enums']["locale_code"],"status"?: Database["public"]['Enums']["cart_status"],"token"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"case_studies": {
                  Row: {
                    "approach": string | null,"challenge": string | null,"client_approved": boolean,"client_name": string | null,"client_named_with_consent": boolean,"created_at": string,"department_id": string,"id": string,"outcome": string | null,"publish_state": Database["public"]['Enums']["publish_state"],"published_at": string | null,"results": NonNullable<Json>,"service_id": string | null,"slug": string,"sort_order": number,"summary": string,"tags": (string)[],"title": string,"updated_at": string
                  }
                  Insert: {
                    "approach"?: string | null,"challenge"?: string | null,"client_approved"?: boolean,"client_name"?: string | null,"client_named_with_consent"?: boolean,"created_at"?: string,"department_id": string,"id"?: string,"outcome"?: string | null,"publish_state"?: Database["public"]['Enums']["publish_state"],"published_at"?: string | null,"results"?: NonNullable<Json>,"service_id"?: string | null,"slug": string,"sort_order"?: number,"summary": string,"tags"?: (string)[],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "approach"?: string | null,"challenge"?: string | null,"client_approved"?: boolean,"client_name"?: string | null,"client_named_with_consent"?: boolean,"created_at"?: string,"department_id"?: string,"id"?: string,"outcome"?: string | null,"publish_state"?: Database["public"]['Enums']["publish_state"],"published_at"?: string | null,"results"?: NonNullable<Json>,"service_id"?: string | null,"slug"?: string,"sort_order"?: number,"summary"?: string,"tags"?: (string)[],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "case_studies_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "case_studies_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
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
                },"entity_seo": {
                  Row: {
                    "canonical_override": string | null,"created_at": string,"description": string | null,"entity_id": string,"entity_type": Database["public"]['Enums']["translatable_entity_type"],"id": string,"locale": Database["public"]['Enums']["locale_code"],"noindex": boolean,"og_image_path": string | null,"structured_data": Json | null,"title": string | null,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "canonical_override"?: string | null,"created_at"?: string,"description"?: string | null,"entity_id": string,"entity_type": Database["public"]['Enums']["translatable_entity_type"],"id"?: string,"locale": Database["public"]['Enums']["locale_code"],"noindex"?: boolean,"og_image_path"?: string | null,"structured_data"?: Json | null,"title"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "canonical_override"?: string | null,"created_at"?: string,"description"?: string | null,"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["translatable_entity_type"],"id"?: string,"locale"?: Database["public"]['Enums']["locale_code"],"noindex"?: boolean,"og_image_path"?: string | null,"structured_data"?: Json | null,"title"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"inquiries": {
                  Row: {
                    "assigned_to": string | null,"closed_at": string | null,"consent_at": string | null,"consent_given": boolean,"created_at": string,"department_id": string | null,"email": string,"full_name": string,"id": string,"ip_hash": string | null,"locale": Database["public"]['Enums']["locale_code"],"message": string,"phone": string | null,"reference": string,"responded_at": string | null,"service_id": string | null,"source": Database["public"]['Enums']["inquiry_source"],"status": Database["public"]['Enums']["inquiry_status"],"subject": string,"updated_at": string,"user_agent": string | null
                  }
                  Insert: {
                    "assigned_to"?: string | null,"closed_at"?: string | null,"consent_at"?: string | null,"consent_given"?: boolean,"created_at"?: string,"department_id"?: string | null,"email": string,"full_name": string,"id"?: string,"ip_hash"?: string | null,"locale"?: Database["public"]['Enums']["locale_code"],"message": string,"phone"?: string | null,"reference": string,"responded_at"?: string | null,"service_id"?: string | null,"source"?: Database["public"]['Enums']["inquiry_source"],"status"?: Database["public"]['Enums']["inquiry_status"],"subject": string,"updated_at"?: string,"user_agent"?: string | null
                  }
                  Update: {
                    "assigned_to"?: string | null,"closed_at"?: string | null,"consent_at"?: string | null,"consent_given"?: boolean,"created_at"?: string,"department_id"?: string | null,"email"?: string,"full_name"?: string,"id"?: string,"ip_hash"?: string | null,"locale"?: Database["public"]['Enums']["locale_code"],"message"?: string,"phone"?: string | null,"reference"?: string,"responded_at"?: string | null,"service_id"?: string | null,"source"?: Database["public"]['Enums']["inquiry_source"],"status"?: Database["public"]['Enums']["inquiry_status"],"subject"?: string,"updated_at"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inquiries_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inquiries_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"inquiry_events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"event_type": string,"from_status": Database["public"]['Enums']["inquiry_status"] | null,"id": string,"inquiry_id": string,"metadata": NonNullable<Json>,"note": string | null,"to_status": Database["public"]['Enums']["inquiry_status"] | null
                  }
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"event_type": string,"from_status"?: Database["public"]['Enums']["inquiry_status"] | null,"id"?: string,"inquiry_id": string,"metadata"?: NonNullable<Json>,"note"?: string | null,"to_status"?: Database["public"]['Enums']["inquiry_status"] | null
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"event_type"?: string,"from_status"?: Database["public"]['Enums']["inquiry_status"] | null,"id"?: string,"inquiry_id"?: string,"metadata"?: NonNullable<Json>,"note"?: string | null,"to_status"?: Database["public"]['Enums']["inquiry_status"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inquiry_events_inquiry_id_fkey"
      columns: ["inquiry_id"]
isOneToOne: false
      referencedRelation: "inquiries"
      referencedColumns: ["id"]
    }
                  ]
                },"insight_categories": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"is_active": boolean,"name": string,"slug": string,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"insights": {
                  Row: {
                    "author_id": string | null,"body": string,"category_id": string | null,"cover_image_path": string | null,"created_at": string,"department_id": string | null,"id": string,"is_featured": boolean,"publish_state": Database["public"]['Enums']["publish_state"],"published_at": string | null,"related_service_slugs": (string)[],"slug": string,"summary": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "author_id"?: string | null,"body": string,"category_id"?: string | null,"cover_image_path"?: string | null,"created_at"?: string,"department_id"?: string | null,"id"?: string,"is_featured"?: boolean,"publish_state"?: Database["public"]['Enums']["publish_state"],"published_at"?: string | null,"related_service_slugs"?: (string)[],"slug": string,"summary": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"category_id"?: string | null,"cover_image_path"?: string | null,"created_at"?: string,"department_id"?: string | null,"id"?: string,"is_featured"?: boolean,"publish_state"?: Database["public"]['Enums']["publish_state"],"published_at"?: string | null,"related_service_slugs"?: (string)[],"slug"?: string,"summary"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "insights_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "authors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "insights_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "insight_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "insights_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_movements": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"delta": number,"id": string,"note": string | null,"product_id": string,"reason": Database["public"]['Enums']["inventory_reason"],"stock_after": number
                  }
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"delta": number,"id"?: string,"note"?: string | null,"product_id": string,"reason": Database["public"]['Enums']["inventory_reason"],"stock_after": number
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"delta"?: number,"id"?: string,"note"?: string | null,"product_id"?: string,"reason"?: Database["public"]['Enums']["inventory_reason"],"stock_after"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_movements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_categories": {
                  Row: {
                    "created_at": string,"department_id": string,"description": string | null,"id": string,"is_active": boolean,"name": string,"publish_state": Database["public"]['Enums']["publish_state"],"slug": string,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"department_id": string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"publish_state"?: Database["public"]['Enums']["publish_state"],"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"department_id"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"publish_state"?: Database["public"]['Enums']["publish_state"],"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_categories_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    }
                  ]
                },"product_category_slugs": {
                  Row: {
                    "category_id": string,"created_at": string,"id": string,"locale": Database["public"]['Enums']["locale_code"],"slug": string,"updated_at": string
                  }
                  Insert: {
                    "category_id": string,"created_at"?: string,"id"?: string,"locale": Database["public"]['Enums']["locale_code"],"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: string,"created_at"?: string,"id"?: string,"locale"?: Database["public"]['Enums']["locale_code"],"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_category_slugs_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "product_categories"
      referencedColumns: ["id"]
    }
                  ]
                },"product_media": {
                  Row: {
                    "alt_text": string,"created_at": string,"height": number | null,"id": string,"is_primary": boolean,"position": number,"product_id": string,"storage_path": string,"updated_at": string,"width": number | null
                  }
                  Insert: {
                    "alt_text": string,"created_at"?: string,"height"?: number | null,"id"?: string,"is_primary"?: boolean,"position"?: number,"product_id": string,"storage_path": string,"updated_at"?: string,"width"?: number | null
                  }
                  Update: {
                    "alt_text"?: string,"created_at"?: string,"height"?: number | null,"id"?: string,"is_primary"?: boolean,"position"?: number,"product_id"?: string,"storage_path"?: string,"updated_at"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_media_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_slugs": {
                  Row: {
                    "created_at": string,"id": string,"locale": Database["public"]['Enums']["locale_code"],"product_id": string,"slug": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"locale": Database["public"]['Enums']["locale_code"],"product_id": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"locale"?: Database["public"]['Enums']["locale_code"],"product_id"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_slugs_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "availability": Database["public"]['Enums']["product_availability"] | null,"availability_override": Database["public"]['Enums']["product_availability"] | null,"brand": string | null,"category_id": string,"condition": Database["public"]['Enums']["product_condition"],"created_at": string,"currency": string,"description": string,"gtin": string | null,"id": string,"price_minor": number,"publish_state": Database["public"]['Enums']["publish_state"],"published_at": string | null,"short_description": string,"sku": string,"slug": string,"specifications": NonNullable<Json>,"stock": number,"title": string,"updated_at": string
                  }
                  Insert: {
                    "availability"?: never,"availability_override"?: Database["public"]['Enums']["product_availability"] | null,"brand"?: string | null,"category_id": string,"condition"?: Database["public"]['Enums']["product_condition"],"created_at"?: string,"currency"?: string,"description": string,"gtin"?: string | null,"id"?: string,"price_minor": number,"publish_state"?: Database["public"]['Enums']["publish_state"],"published_at"?: string | null,"short_description": string,"sku": string,"slug": string,"specifications"?: NonNullable<Json>,"stock"?: number,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "availability"?: never,"availability_override"?: Database["public"]['Enums']["product_availability"] | null,"brand"?: string | null,"category_id"?: string,"condition"?: Database["public"]['Enums']["product_condition"],"created_at"?: string,"currency"?: string,"description"?: string,"gtin"?: string | null,"id"?: string,"price_minor"?: number,"publish_state"?: Database["public"]['Enums']["publish_state"],"published_at"?: string | null,"short_description"?: string,"sku"?: string,"slug"?: string,"specifications"?: NonNullable<Json>,"stock"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "product_categories"
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
                },"services": {
                  Row: {
                    "created_at": string,"delivery_notes": string | null,"department_id": string,"description": string,"faqs": NonNullable<Json>,"features": NonNullable<Json>,"id": string,"is_active": boolean,"publish_state": Database["public"]['Enums']["publish_state"],"published_at": string | null,"slug": string,"sort_order": number,"summary": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"delivery_notes"?: string | null,"department_id": string,"description": string,"faqs"?: NonNullable<Json>,"features"?: NonNullable<Json>,"id"?: string,"is_active"?: boolean,"publish_state"?: Database["public"]['Enums']["publish_state"],"published_at"?: string | null,"slug": string,"sort_order"?: number,"summary": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"delivery_notes"?: string | null,"department_id"?: string,"description"?: string,"faqs"?: NonNullable<Json>,"features"?: NonNullable<Json>,"id"?: string,"is_active"?: boolean,"publish_state"?: Database["public"]['Enums']["publish_state"],"published_at"?: string | null,"slug"?: string,"sort_order"?: number,"summary"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    }
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
            "build_translation_key":
{ Args: { "p_entity_id": string,"p_entity_type": Database["public"]['Enums']["translatable_entity_type"],"p_field_name": string,"p_locale": Database["public"]['Enums']["locale_code"] }; Returns: string
                           },
"can_access_department":
{ Args: { "department_slug": string }; Returns: boolean
                           },
"claim_translation_sync_jobs":
{ Args: { "p_limit"?: number }; Returns: {
              "attempts": number,
"created_at": string,
"finished_at": string | null,
"id": string,
"job_type": string,
"last_error": string | null,
"max_attempts": number,
"payload": NonNullable<Json>,
"scheduled_at": string,
"started_at": string | null,
"status": Database["public"]['Enums']["sync_state"],
"translation_entry_id": string | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "translation_sync_jobs"
        isOneToOne: false
        isSetofReturn: true
      } },
"complete_translation_sync_job":
{ Args: { "p_job_id": string,"p_tolgee_key_id"?: string }; Returns: undefined
                           },
"current_user_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"fail_translation_sync_job":
{ Args: { "p_error": string,"p_job_id": string }; Returns: undefined
                           },
"generate_inquiry_reference":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"gtin_is_valid":
{ Args: { "value": string }; Returns: boolean
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
                           },
"product_translatable_fields":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"requeue_translation_entry":
{ Args: { "p_entry_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "cart_status": "active"|"converted"|"abandoned"|"expired","inquiry_source": "contact_form"|"quote_request"|"property_inquiry"|"viewing_request"|"phone"|"email"|"walk_in"|"service_inquiry","inquiry_status": "new"|"assigned"|"in_progress"|"responded"|"closed"|"spam","inventory_reason": "initial"|"restock"|"sale"|"return"|"correction"|"damage","locale_code": "en"|"fr","product_availability": "in_stock"|"out_of_stock"|"preorder"|"backorder"|"discontinued","product_condition": "new"|"refurbished"|"used","publish_state": "draft"|"published"|"archived","sync_state": "not_required"|"queued"|"syncing"|"synced"|"failed","translatable_entity_type": "department"|"service"|"product"|"category"|"electrical_project"|"property_listing"|"insight"|"site_setting"|"product_media","translation_state": "missing"|"pending"|"in_progress"|"translated"|"reviewed"|"outdated","user_role": "visitor"|"customer"|"real_estate_agent"|"digital_marketing_staff"|"digital_marketing_admin"|"electrical_staff"|"electrical_admin"|"department_staff"|"super_admin"
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
            "cart_status": ["active", "converted", "abandoned", "expired"],"inquiry_source": ["contact_form", "quote_request", "property_inquiry", "viewing_request", "phone", "email", "walk_in", "service_inquiry"],"inquiry_status": ["new", "assigned", "in_progress", "responded", "closed", "spam"],"inventory_reason": ["initial", "restock", "sale", "return", "correction", "damage"],"locale_code": ["en", "fr"],"product_availability": ["in_stock", "out_of_stock", "preorder", "backorder", "discontinued"],"product_condition": ["new", "refurbished", "used"],"publish_state": ["draft", "published", "archived"],"sync_state": ["not_required", "queued", "syncing", "synced", "failed"],"translatable_entity_type": ["department", "service", "product", "category", "electrical_project", "property_listing", "insight", "site_setting", "product_media"],"translation_state": ["missing", "pending", "in_progress", "translated", "reviewed", "outdated"],"user_role": ["visitor", "customer", "real_estate_agent", "digital_marketing_staff", "digital_marketing_admin", "electrical_staff", "electrical_admin", "department_staff", "super_admin"]
          }
        }
} as const

