ALTER TABLE "nasaem_sales" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nasaem_sales" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "nasaem_sales" ADD COLUMN "cancellation_reason" text;