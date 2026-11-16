
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_log": {
                  Row: {
                    "action": string,"created_at": string,"entity_id": string,"entity_type": string,"from_status": string | null,"id": number,"title": string | null,"to_status": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"entity_id": string,"entity_type": string,"from_status"?: string | null,"id"?: never,"title"?: string | null,"to_status"?: string | null,"user_id": string
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"entity_id"?: string,"entity_type"?: string,"from_status"?: string | null,"id"?: never,"title"?: string | null,"to_status"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_conversations": {
                  Row: {
                    "archived": boolean,"created_at": string,"id": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived"?: boolean,"created_at"?: string,"id"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived"?: boolean,"created_at"?: string,"id"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_memory": {
                  Row: {
                    "confirmed": boolean,"content": string,"created_at": string,"goal_id": string | null,"id": string,"kind": Database["public"]['Enums']["memory_kind"],"period_end": string | null,"period_start": string | null,"pinned": boolean,"project_id": string | null,"source": Database["public"]['Enums']["source_kind"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmed"?: boolean,"content": string,"created_at"?: string,"goal_id"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["memory_kind"],"period_end"?: string | null,"period_start"?: string | null,"pinned"?: boolean,"project_id"?: string | null,"source"?: Database["public"]['Enums']["source_kind"],"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "confirmed"?: boolean,"content"?: string,"created_at"?: string,"goal_id"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["memory_kind"],"period_end"?: string | null,"period_start"?: string | null,"pinned"?: boolean,"project_id"?: string | null,"source"?: Database["public"]['Enums']["source_kind"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_memory_goal_id_user_id_fkey"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goal_progress"
      referencedColumns: ["goal_id","user_id"]
    },{
      foreignKeyName: "ai_memory_goal_id_user_id_fkey"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "ai_memory_project_id_user_id_fkey"
      columns: ["project_id","user_id"]
isOneToOne: false
      referencedRelation: "project_progress"
      referencedColumns: ["project_id","user_id"]
    },{
      foreignKeyName: "ai_memory_project_id_user_id_fkey"
      columns: ["project_id","user_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"ai_messages": {
                  Row: {
                    "api_content": Json | null,"content": string,"conversation_id": string,"created_at": string,"id": string,"model": string | null,"role": string,"stop_reason": string | null,"usage": Json | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "api_content"?: Json | null,"content"?: string,"conversation_id": string,"created_at"?: string,"id"?: string,"model"?: string | null,"role": string,"stop_reason"?: string | null,"usage"?: Json | null,"user_id"?: string
                  }
                  Update: {
                    "api_content"?: Json | null,"content"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"model"?: string | null,"role"?: string,"stop_reason"?: string | null,"usage"?: Json | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_messages_conversation_id_user_id_fkey"
      columns: ["conversation_id","user_id"]
isOneToOne: false
      referencedRelation: "ai_conversations"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"ai_proposals": {
                  Row: {
                    "action": string,"applied_entity_id": string | null,"conversation_id": string | null,"created_at": string,"decided_at": string | null,"error": string | null,"id": string,"message_id": string | null,"payload": NonNullable<Json>,"rationale": string | null,"status": Database["public"]['Enums']["proposal_status"],"summary": string,"target_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"applied_entity_id"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"decided_at"?: string | null,"error"?: string | null,"id"?: string,"message_id"?: string | null,"payload": NonNullable<Json>,"rationale"?: string | null,"status"?: Database["public"]['Enums']["proposal_status"],"summary": string,"target_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "action"?: string,"applied_entity_id"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"decided_at"?: string | null,"error"?: string | null,"id"?: string,"message_id"?: string | null,"payload"?: NonNullable<Json>,"rationale"?: string | null,"status"?: Database["public"]['Enums']["proposal_status"],"summary"?: string,"target_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_proposals_conversation_id_user_id_fkey"
      columns: ["conversation_id","user_id"]
isOneToOne: false
      referencedRelation: "ai_conversations"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "ai_proposals_message_id_user_id_fkey"
      columns: ["message_id","user_id"]
isOneToOne: false
      referencedRelation: "ai_messages"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"daily_logs": {
                  Row: {
                    "ai_plan": Json | null,"ai_plan_at": string | null,"ai_recommendation": Json | null,"ai_recommendation_at": string | null,"available_minutes": number | null,"created_at": string,"energy": number | null,"id": string,"intention": string | null,"log_date": string,"summary": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_plan"?: Json | null,"ai_plan_at"?: string | null,"ai_recommendation"?: Json | null,"ai_recommendation_at"?: string | null,"available_minutes"?: number | null,"created_at"?: string,"energy"?: number | null,"id"?: string,"intention"?: string | null,"log_date": string,"summary"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "ai_plan"?: Json | null,"ai_plan_at"?: string | null,"ai_recommendation"?: Json | null,"ai_recommendation_at"?: string | null,"available_minutes"?: number | null,"created_at"?: string,"energy"?: number | null,"id"?: string,"intention"?: string | null,"log_date"?: string,"summary"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"decisions": {
                  Row: {
                    "context": string | null,"created_at": string,"decided_at": string | null,"decision": string | null,"goal_id": string | null,"id": string,"idea_id": string | null,"options": NonNullable<Json>,"project_id": string | null,"rationale": string | null,"review_on": string | null,"source": Database["public"]['Enums']["source_kind"],"status": Database["public"]['Enums']["decision_status"],"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "context"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decision"?: string | null,"goal_id"?: string | null,"id"?: string,"idea_id"?: string | null,"options"?: NonNullable<Json>,"project_id"?: string | null,"rationale"?: string | null,"review_on"?: string | null,"source"?: Database["public"]['Enums']["source_kind"],"status"?: Database["public"]['Enums']["decision_status"],"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "context"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decision"?: string | null,"goal_id"?: string | null,"id"?: string,"idea_id"?: string | null,"options"?: NonNullable<Json>,"project_id"?: string | null,"rationale"?: string | null,"review_on"?: string | null,"source"?: Database["public"]['Enums']["source_kind"],"status"?: Database["public"]['Enums']["decision_status"],"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "decisions_goal_id_user_id_fkey"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goal_progress"
      referencedColumns: ["goal_id","user_id"]
    },{
      foreignKeyName: "decisions_goal_id_user_id_fkey"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "decisions_idea_id_user_id_fkey"
      columns: ["idea_id","user_id"]
isOneToOne: false
      referencedRelation: "ideas"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "decisions_project_id_user_id_fkey"
      columns: ["project_id","user_id"]
isOneToOne: false
      referencedRelation: "project_progress"
      referencedColumns: ["project_id","user_id"]
    },{
      foreignKeyName: "decisions_project_id_user_id_fkey"
      columns: ["project_id","user_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"goal_checkins": {
                  Row: {
                    "created_at": string,"goal_id": string,"id": string,"note": string | null,"recorded_at": string,"user_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"goal_id": string,"id"?: string,"note"?: string | null,"recorded_at"?: string,"user_id"?: string,"value": number
                  }
                  Update: {
                    "created_at"?: string,"goal_id"?: string,"id"?: string,"note"?: string | null,"recorded_at"?: string,"user_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "goal_checkins_goal_id_user_id_fkey"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goal_progress"
      referencedColumns: ["goal_id","user_id"]
    },{
      foreignKeyName: "goal_checkins_goal_id_user_id_fkey"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"goals": {
                  Row: {
                    "category": string,"completed_at": string | null,"created_at": string,"description": string | null,"id": string,"is_primary": boolean,"manual_progress": number,"metric_current": number,"metric_name": string | null,"metric_start": number,"metric_target": number | null,"metric_unit": string | null,"priority": Database["public"]['Enums']["priority_level"],"progress_mode": Database["public"]['Enums']["goal_progress_mode"],"status": Database["public"]['Enums']["goal_status"],"target_date": string | null,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string,"completed_at"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"is_primary"?: boolean,"manual_progress"?: number,"metric_current"?: number,"metric_name"?: string | null,"metric_start"?: number,"metric_target"?: number | null,"metric_unit"?: string | null,"priority"?: Database["public"]['Enums']["priority_level"],"progress_mode"?: Database["public"]['Enums']["goal_progress_mode"],"status"?: Database["public"]['Enums']["goal_status"],"target_date"?: string | null,"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "category"?: string,"completed_at"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"is_primary"?: boolean,"manual_progress"?: number,"metric_current"?: number,"metric_name"?: string | null,"metric_start"?: number,"metric_target"?: number | null,"metric_unit"?: string | null,"priority"?: Database["public"]['Enums']["priority_level"],"progress_mode"?: Database["public"]['Enums']["goal_progress_mode"],"status"?: Database["public"]['Enums']["goal_status"],"target_date"?: string | null,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ideas": {
                  Row: {
                    "ai_evaluated_at": string | null,"ai_evaluation": Json | null,"category": string,"converted_project_id": string | null,"created_at": string,"currency": string,"description": string | null,"difficulty": number | null,"estimated_cost": number | null,"id": string,"potential": number | null,"status": Database["public"]['Enums']["idea_status"],"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_evaluated_at"?: string | null,"ai_evaluation"?: Json | null,"category"?: string,"converted_project_id"?: string | null,"created_at"?: string,"currency"?: string,"description"?: string | null,"difficulty"?: number | null,"estimated_cost"?: number | null,"id"?: string,"potential"?: number | null,"status"?: Database["public"]['Enums']["idea_status"],"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "ai_evaluated_at"?: string | null,"ai_evaluation"?: Json | null,"category"?: string,"converted_project_id"?: string | null,"created_at"?: string,"currency"?: string,"description"?: string | null,"difficulty"?: number | null,"estimated_cost"?: number | null,"id"?: string,"potential"?: number | null,"status"?: Database["public"]['Enums']["idea_status"],"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ideas_converted_project_id_user_id_fkey"
      columns: ["converted_project_id","user_id"]
isOneToOne: false
      referencedRelation: "project_progress"
      referencedColumns: ["project_id","user_id"]
    },{
      foreignKeyName: "ideas_converted_project_id_user_id_fkey"
      columns: ["converted_project_id","user_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"channel": string,"created_at": string,"id": string,"kind": string,"link": string | null,"read_at": string | null,"scheduled_for": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"channel"?: string,"created_at"?: string,"id"?: string,"kind": string,"link"?: string | null,"read_at"?: string | null,"scheduled_for"?: string | null,"title": string,"user_id"?: string
                  }
                  Update: {
                    "body"?: string | null,"channel"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"read_at"?: string | null,"scheduled_for"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "ai_effort": string,"ai_enabled": boolean,"ai_include_context": boolean,"ai_instructions": string | null,"created_at": string,"daily_capacity_minutes": number,"display_name": string | null,"id": string,"locale": string,"theme": string,"timezone": string,"updated_at": string,"week_starts_on": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_effort"?: string,"ai_enabled"?: boolean,"ai_include_context"?: boolean,"ai_instructions"?: string | null,"created_at"?: string,"daily_capacity_minutes"?: number,"display_name"?: string | null,"id": string,"locale"?: string,"theme"?: string,"timezone"?: string,"updated_at"?: string,"week_starts_on"?: number
                  }
                  Update: {
                    "ai_effort"?: string,"ai_enabled"?: boolean,"ai_include_context"?: boolean,"ai_instructions"?: string | null,"created_at"?: string,"daily_capacity_minutes"?: number,"display_name"?: string | null,"id"?: string,"locale"?: string,"theme"?: string,"timezone"?: string,"updated_at"?: string,"week_starts_on"?: number
                  }
                  Relationships: [
                    
                  ]
                },"projects": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"description": string | null,"due_date": string | null,"goal_id": string | null,"id": string,"notes": string | null,"outcomes": string | null,"priority": Database["public"]['Enums']["priority_level"],"started_at": string | null,"status": Database["public"]['Enums']["project_status"],"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"description"?: string | null,"due_date"?: string | null,"goal_id"?: string | null,"id"?: string,"notes"?: string | null,"outcomes"?: string | null,"priority"?: Database["public"]['Enums']["priority_level"],"started_at"?: string | null,"status"?: Database["public"]['Enums']["project_status"],"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"description"?: string | null,"due_date"?: string | null,"goal_id"?: string | null,"id"?: string,"notes"?: string | null,"outcomes"?: string | null,"priority"?: Database["public"]['Enums']["priority_level"],"started_at"?: string | null,"status"?: Database["public"]['Enums']["project_status"],"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_goal_id_user_id_fkey"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goal_progress"
      referencedColumns: ["goal_id","user_id"]
    },{
      foreignKeyName: "projects_goal_id_user_id_fkey"
      columns: ["goal_id","user_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"description": string | null,"due_date": string | null,"estimated_minutes": number | null,"focus_rank": number | null,"id": string,"priority": Database["public"]['Enums']["priority_level"],"project_id": string | null,"scheduled_date": string | null,"spent_minutes": number,"status": Database["public"]['Enums']["task_status"],"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"description"?: string | null,"due_date"?: string | null,"estimated_minutes"?: number | null,"focus_rank"?: number | null,"id"?: string,"priority"?: Database["public"]['Enums']["priority_level"],"project_id"?: string | null,"scheduled_date"?: string | null,"spent_minutes"?: number,"status"?: Database["public"]['Enums']["task_status"],"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"description"?: string | null,"due_date"?: string | null,"estimated_minutes"?: number | null,"focus_rank"?: number | null,"id"?: string,"priority"?: Database["public"]['Enums']["priority_level"],"project_id"?: string | null,"scheduled_date"?: string | null,"spent_minutes"?: number,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_project_id_user_id_fkey"
      columns: ["project_id","user_id"]
isOneToOne: false
      referencedRelation: "project_progress"
      referencedColumns: ["project_id","user_id"]
    },{
      foreignKeyName: "tasks_project_id_user_id_fkey"
      columns: ["project_id","user_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"time_entries": {
                  Row: {
                    "created_at": string,"id": string,"logged_on": string,"minutes": number,"note": string | null,"task_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"logged_on"?: string,"minutes": number,"note"?: string | null,"task_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"logged_on"?: string,"minutes"?: number,"note"?: string | null,"task_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "time_entries_task_id_user_id_fkey"
      columns: ["task_id","user_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","user_id"]
    }
                  ]
                }
          }
          Views: {
            "goal_progress": {
                  Row: {
                    "goal_id": string,"progress": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                           "goal_id"?: string | null,"progress"?: never,"user_id"?: string | null
                         }
                        Update: {
                           "goal_id"?: string | null,"progress"?: never,"user_id"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"project_progress": {
                  Row: {
                    "completed_tasks": number | null,"estimated_minutes": number | null,"progress": number | null,"project_id": string,"spent_minutes": number | null,"total_tasks": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "is_authorized":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           }
          }
          Enums: {
            "decision_status": "proposed"|"approved"|"rejected"|"revisited","goal_progress_mode": "manual"|"metric"|"projects","goal_status": "active"|"paused"|"completed"|"archived","idea_status": "new"|"exploring"|"validated"|"converted"|"parked"|"discarded","memory_kind": "fact"|"idea"|"recommendation"|"decision"|"summary"|"preference","priority_level": "low"|"medium"|"high"|"critical","project_status": "idea"|"planned"|"active"|"paused"|"completed"|"cancelled","proposal_status": "pending"|"approved"|"rejected"|"applied"|"failed","source_kind": "user"|"ai","task_status": "pending"|"in_progress"|"completed"|"cancelled"
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
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "decision_status": ["proposed", "approved", "rejected", "revisited"],"goal_progress_mode": ["manual", "metric", "projects"],"goal_status": ["active", "paused", "completed", "archived"],"idea_status": ["new", "exploring", "validated", "converted", "parked", "discarded"],"memory_kind": ["fact", "idea", "recommendation", "decision", "summary", "preference"],"priority_level": ["low", "medium", "high", "critical"],"project_status": ["idea", "planned", "active", "paused", "completed", "cancelled"],"proposal_status": ["pending", "approved", "rejected", "applied", "failed"],"source_kind": ["user", "ai"],"task_status": ["pending", "in_progress", "completed", "cancelled"]
          }
        }
} as const
