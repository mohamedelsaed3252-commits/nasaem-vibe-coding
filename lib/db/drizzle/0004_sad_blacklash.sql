CREATE TABLE "nasaem_debt_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debt_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"notes" text,
	"actor_user_id" text,
	"actor_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nasaem_debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direction" text NOT NULL,
	"party_type" text NOT NULL,
	"party_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"notes" text,
	"supply_id" uuid,
	"actor_user_id" text,
	"actor_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nasaem_operating_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"expense_date" date NOT NULL,
	"notes" text,
	"actor_user_id" text,
	"actor_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nasaem_products" ADD COLUMN "units_per_carton" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "nasaem_supplies" ADD COLUMN "amount_paid" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "nasaem_debt_payments" ADD CONSTRAINT "nasaem_debt_payments_debt_id_nasaem_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."nasaem_debts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nasaem_debts" ADD CONSTRAINT "nasaem_debts_supply_id_nasaem_supplies_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."nasaem_supplies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nasaem_debt_payments_debt_idx" ON "nasaem_debt_payments" USING btree ("debt_id","created_at");--> statement-breakpoint
CREATE INDEX "nasaem_debts_created_at_idx" ON "nasaem_debts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "nasaem_debts_party_idx" ON "nasaem_debts" USING btree ("party_type","party_name");--> statement-breakpoint
CREATE UNIQUE INDEX "nasaem_debts_supply_id_unique" ON "nasaem_debts" USING btree ("supply_id");--> statement-breakpoint
CREATE INDEX "nasaem_expenses_date_idx" ON "nasaem_operating_expenses" USING btree ("expense_date");