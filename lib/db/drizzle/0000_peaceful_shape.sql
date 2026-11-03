CREATE TYPE "public"."nasaem_app_role" AS ENUM('owner', 'manager', 'cashier');--> statement-breakpoint
CREATE TABLE "nasaem_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"category" text DEFAULT 'عام' NOT NULL,
	"unit" text DEFAULT 'قطعة' NOT NULL,
	"purchase_price" numeric(12, 2) DEFAULT 0 NOT NULL,
	"selling_price" numeric(12, 2) DEFAULT 0 NOT NULL,
	"stock" numeric(14, 3) DEFAULT 0 NOT NULL,
	"low_stock_threshold" numeric(14, 3) DEFAULT 5 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nasaem_staff" (
	"clerk_user_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"role" "nasaem_app_role" DEFAULT 'cashier' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nasaem_sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nasaem_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"estimated_profit" numeric(12, 2) NOT NULL,
	"notes" text,
	"actor_user_id" text,
	"actor_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nasaem_sales_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "nasaem_stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"delta" numeric(14, 3) NOT NULL,
	"reason" text NOT NULL,
	"actor_user_id" text,
	"actor_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nasaem_supplies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_name" text NOT NULL,
	"reference" text,
	"total" numeric(12, 2) NOT NULL,
	"notes" text,
	"actor_user_id" text,
	"actor_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nasaem_supply_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supply_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nasaem_local_credentials" (
	"user_id" text PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nasaem_sale_items" ADD CONSTRAINT "nasaem_sale_items_sale_id_nasaem_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."nasaem_sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nasaem_sale_items" ADD CONSTRAINT "nasaem_sale_items_product_id_nasaem_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."nasaem_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nasaem_stock_adjustments" ADD CONSTRAINT "nasaem_stock_adjustments_product_id_nasaem_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."nasaem_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nasaem_supply_items" ADD CONSTRAINT "nasaem_supply_items_supply_id_nasaem_supplies_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."nasaem_supplies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nasaem_supply_items" ADD CONSTRAINT "nasaem_supply_items_product_id_nasaem_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."nasaem_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nasaem_local_credentials" ADD CONSTRAINT "nasaem_local_credentials_user_id_nasaem_staff_clerk_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nasaem_staff"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nasaem_products_name_idx" ON "nasaem_products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "nasaem_sales_created_at_idx" ON "nasaem_sales" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "nasaem_stock_adjustments_created_at_idx" ON "nasaem_stock_adjustments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "nasaem_supplies_created_at_idx" ON "nasaem_supplies" USING btree ("created_at");