CREATE TABLE "approval_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"previous_value" text,
	"new_value" text,
	"changed_fields" text,
	"reason" text,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"state" text DEFAULT 'ALL' NOT NULL,
	"threshold_amount" real DEFAULT 5000 NOT NULL,
	"requires_roles" text,
	"is_active" boolean DEFAULT true,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user" text NOT NULL,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"details" text,
	"ip_address" text,
	"severity" text DEFAULT 'INFO' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text,
	"routing_number" text,
	"bank_name" text NOT NULL,
	"account_type" text,
	"state" text,
	"is_active" boolean DEFAULT true,
	"last_updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_authorizations" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"amount" real NOT NULL,
	"threshold_amount" real DEFAULT 5000,
	"requested_by" text NOT NULL,
	"authorized_by" text,
	"authorization_status" text DEFAULT 'Pending',
	"authorization_date" timestamp,
	"expiry_date" timestamp,
	"reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_run_updates" (
	"id" text PRIMARY KEY NOT NULL,
	"run_date" timestamp NOT NULL,
	"update_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"previous_value" text,
	"new_value" text,
	"updated_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disbursement_statuses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "disbursement_statuses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "disbursement_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "disbursement_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "expense_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_code" text NOT NULL,
	"account_name" text NOT NULL,
	"description" text,
	"account_type" text,
	"parent_account_id" text,
	"state" text,
	"is_active" boolean DEFAULT true,
	"last_updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expense_accounts_account_code_unique" UNIQUE("account_code")
);
--> statement-breakpoint
CREATE TABLE "invoice_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"storage_type" text DEFAULT 'local',
	"uploaded_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" text,
	"invoice_date" text,
	"vendor_name" text,
	"vendor_address" text,
	"customer_name" text,
	"total_amount" real,
	"payment_terms" text,
	"line_items" text,
	"amount" real,
	"client_name" text,
	"description" text,
	"due_date" text,
	"status" text NOT NULL,
	"document_type" text,
	"invoice_data_uri" text NOT NULL,
	"is_duplicate" boolean DEFAULT false,
	"duplicate_reason" text,
	"is_recurring" boolean DEFAULT false,
	"recurring_pattern" text,
	"has_amount_anomaly" boolean DEFAULT false,
	"amount_anomaly_reason" text,
	"expected_amount" real,
	"amount_deviation_percent" real,
	"is_high_value" boolean DEFAULT false,
	"high_value_reason" text,
	"requires_escalation" boolean DEFAULT false,
	"escalation_level" text,
	"escalation_reason" text,
	"has_multiple_vendors" boolean DEFAULT false,
	"accuracy_score" real,
	"requires_special_handling" boolean DEFAULT false,
	"special_handling_reason" text,
	"comment" text,
	"case_number" text,
	"state" text,
	"payment_type" text,
	"approval_status" text DEFAULT 'Pending',
	"approved_by" text,
	"approved_at" timestamp,
	"created_by" text,
	"assigned_to" text,
	"invoice_number_meta" text,
	"invoice_date_meta" text,
	"vendor_name_meta" text,
	"vendor_address_meta" text,
	"customer_name_meta" text,
	"total_amount_meta" text,
	"payment_terms_meta" text,
	"line_items_meta" text,
	"document_type_meta" text,
	"amount_meta" text,
	"client_name_meta" text,
	"description_meta" text,
	"due_date_meta" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"vendor_type" text,
	"invoice_id" text,
	"status" text DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"assigned_states" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendor_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "vendor_w9_status" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"is_required" boolean DEFAULT false,
	"status" text DEFAULT 'Not Required',
	"received_date" timestamp,
	"expiry_date" timestamp,
	"document_path" text,
	"threshold_amount" real DEFAULT 600,
	"notes" text,
	"last_updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"vendor_type" text,
	"requires_1099" boolean DEFAULT false,
	"requires_w9" boolean DEFAULT false,
	"w9_status" text DEFAULT 'Not Required',
	"w9_received_date" timestamp,
	"w9_expiry_date" timestamp,
	"is_paused" boolean DEFAULT false,
	"paused_reason" text,
	"paused_until" timestamp,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
