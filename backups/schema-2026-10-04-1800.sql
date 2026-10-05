


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end $$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "notes" "text",
    "extra" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


ALTER TABLE "public"."clients" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."clients_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."content_toc_links" (
    "content_id" bigint NOT NULL,
    "toc_row_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."content_toc_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_types" (
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL
);


ALTER TABLE "public"."content_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contents" (
    "id" bigint NOT NULL,
    "client_id" bigint NOT NULL,
    "track_id" bigint,
    "content_type" "text" NOT NULL,
    "sequence_label" "text",
    "name" "text" NOT NULL,
    "delivery_date" "date",
    "notes" "text",
    "extra" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contents" OWNER TO "postgres";


ALTER TABLE "public"."contents" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."contents_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."toc_files" (
    "id" bigint NOT NULL,
    "client_id" bigint NOT NULL,
    "track_id" bigint,
    "file_name" "text" NOT NULL,
    "sheet_name" "text" NOT NULL,
    "header_row" integer NOT NULL,
    "columns" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "day_column" "text",
    "topic_column" "text",
    "source_link" "text",
    "notes" "text",
    "extra" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "uploaded_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."toc_files" OWNER TO "postgres";


ALTER TABLE "public"."toc_files" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."toc_files_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."toc_rows" (
    "id" bigint NOT NULL,
    "toc_file_id" bigint NOT NULL,
    "row_number" integer NOT NULL,
    "day_label" "text",
    "topic" "text",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."toc_rows" OWNER TO "postgres";


ALTER TABLE "public"."toc_rows" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."toc_rows_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tracks" (
    "id" bigint NOT NULL,
    "client_id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "notes" "text",
    "extra" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "csm" "text"
);


ALTER TABLE "public"."tracks" OWNER TO "postgres";


ALTER TABLE "public"."tracks" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."tracks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."v_contents" AS
SELECT
    NULL::bigint AS "id",
    NULL::bigint AS "client_id",
    NULL::"text" AS "client_name",
    NULL::bigint AS "track_id",
    NULL::"text" AS "track_name",
    NULL::"text" AS "content_type",
    NULL::integer AS "type_order",
    NULL::"text" AS "sequence_label",
    NULL::"text" AS "name",
    NULL::"date" AS "delivery_date",
    NULL::"text" AS "notes",
    NULL::"jsonb" AS "extra",
    NULL::timestamp with time zone AS "created_at",
    NULL::integer AS "link_count",
    NULL::"jsonb" AS "topics",
    NULL::"text" AS "topics_text",
    NULL::"text" AS "csm";


ALTER VIEW "public"."v_contents" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_toc_files" WITH ("security_invoker"='true') AS
 SELECT "tf"."id",
    "tf"."client_id",
    "tf"."track_id",
    "tf"."file_name",
    "tf"."sheet_name",
    "tf"."header_row",
    "tf"."columns",
    "tf"."day_column",
    "tf"."topic_column",
    "tf"."source_link",
    "tf"."notes",
    "tf"."extra",
    "tf"."uploaded_by",
    "tf"."created_at",
    "cl"."name" AS "client_name",
    "t"."name" AS "track_name",
    ( SELECT ("count"(*))::integer AS "count"
           FROM "public"."toc_rows" "r"
          WHERE ("r"."toc_file_id" = "tf"."id")) AS "row_count"
   FROM (("public"."toc_files" "tf"
     JOIN "public"."clients" "cl" ON (("cl"."id" = "tf"."client_id")))
     LEFT JOIN "public"."tracks" "t" ON (("t"."id" = "tf"."track_id")));


ALTER VIEW "public"."v_toc_files" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_toc_rows" AS
SELECT
    NULL::bigint AS "id",
    NULL::bigint AS "toc_file_id",
    NULL::"text" AS "file_name",
    NULL::"text" AS "sheet_name",
    NULL::"text" AS "topic_column",
    NULL::bigint AS "client_id",
    NULL::"text" AS "client_name",
    NULL::bigint AS "track_id",
    NULL::"text" AS "track_name",
    NULL::integer AS "row_number",
    NULL::"text" AS "day_label",
    NULL::"text" AS "topic",
    NULL::"jsonb" AS "data",
    NULL::"text" AS "data_text",
    NULL::integer AS "content_count",
    NULL::"jsonb" AS "contents";


ALTER VIEW "public"."v_toc_rows" OWNER TO "postgres";


ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_toc_links"
    ADD CONSTRAINT "content_toc_links_pkey" PRIMARY KEY ("content_id", "toc_row_id");



ALTER TABLE ONLY "public"."content_types"
    ADD CONSTRAINT "content_types_pkey" PRIMARY KEY ("name");



ALTER TABLE ONLY "public"."contents"
    ADD CONSTRAINT "contents_identity" UNIQUE NULLS NOT DISTINCT ("client_id", "track_id", "content_type", "sequence_label", "name");



ALTER TABLE ONLY "public"."contents"
    ADD CONSTRAINT "contents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."toc_files"
    ADD CONSTRAINT "toc_files_client_id_file_name_sheet_name_key" UNIQUE ("client_id", "file_name", "sheet_name");



ALTER TABLE ONLY "public"."toc_files"
    ADD CONSTRAINT "toc_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."toc_rows"
    ADD CONSTRAINT "toc_rows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."toc_rows"
    ADD CONSTRAINT "toc_rows_toc_file_id_row_number_key" UNIQUE ("toc_file_id", "row_number");



ALTER TABLE ONLY "public"."tracks"
    ADD CONSTRAINT "tracks_client_id_name_key" UNIQUE ("client_id", "name");



ALTER TABLE ONLY "public"."tracks"
    ADD CONSTRAINT "tracks_pkey" PRIMARY KEY ("id");



CREATE INDEX "content_toc_links_toc_row_id_idx" ON "public"."content_toc_links" USING "btree" ("toc_row_id");



CREATE INDEX "contents_client_id_idx" ON "public"."contents" USING "btree" ("client_id");



CREATE INDEX "contents_track_id_idx" ON "public"."contents" USING "btree" ("track_id");



CREATE INDEX "toc_files_client_id_idx" ON "public"."toc_files" USING "btree" ("client_id");



CREATE INDEX "toc_rows_toc_file_id_idx" ON "public"."toc_rows" USING "btree" ("toc_file_id");



CREATE INDEX "tracks_client_id_idx" ON "public"."tracks" USING "btree" ("client_id");



CREATE OR REPLACE VIEW "public"."v_contents" WITH ("security_invoker"='true') AS
 SELECT "c"."id",
    "c"."client_id",
    "cl"."name" AS "client_name",
    "c"."track_id",
    "t"."name" AS "track_name",
    "c"."content_type",
    "ct"."sort_order" AS "type_order",
    "c"."sequence_label",
    "c"."name",
    "c"."delivery_date",
    "c"."notes",
    "c"."extra",
    "c"."created_at",
    ("count"("tr"."id"))::integer AS "link_count",
    COALESCE("jsonb_agg"("jsonb_build_object"('toc_row_id', "tr"."id", 'file_name', "tf"."file_name", 'sheet_name', "tf"."sheet_name", 'row_number', "tr"."row_number", 'topic_column', "tf"."topic_column", 'day_label', "tr"."day_label", 'topic', "tr"."topic", 'data', "tr"."data", 'columns', "tf"."columns") ORDER BY "tf"."file_name", "tr"."row_number") FILTER (WHERE ("tr"."id" IS NOT NULL)), '[]'::"jsonb") AS "topics",
    COALESCE("string_agg"(((COALESCE("tr"."topic", ''::"text") || ' '::"text") || ("tr"."data")::"text"), ' | '::"text"), ''::"text") AS "topics_text",
    "t"."csm"
   FROM (((((("public"."contents" "c"
     JOIN "public"."clients" "cl" ON (("cl"."id" = "c"."client_id")))
     JOIN "public"."content_types" "ct" ON (("ct"."name" = "c"."content_type")))
     LEFT JOIN "public"."tracks" "t" ON (("t"."id" = "c"."track_id")))
     LEFT JOIN "public"."content_toc_links" "l" ON (("l"."content_id" = "c"."id")))
     LEFT JOIN "public"."toc_rows" "tr" ON (("tr"."id" = "l"."toc_row_id")))
     LEFT JOIN "public"."toc_files" "tf" ON (("tf"."id" = "tr"."toc_file_id")))
  GROUP BY "c"."id", "cl"."name", "t"."name", "t"."csm", "ct"."sort_order";



CREATE OR REPLACE VIEW "public"."v_toc_rows" WITH ("security_invoker"='true') AS
 SELECT "tr"."id",
    "tr"."toc_file_id",
    "tf"."file_name",
    "tf"."sheet_name",
    "tf"."topic_column",
    "tf"."client_id",
    "cl"."name" AS "client_name",
    "tf"."track_id",
    "t"."name" AS "track_name",
    "tr"."row_number",
    "tr"."day_label",
    "tr"."topic",
    "tr"."data",
    ("tr"."data")::"text" AS "data_text",
    ("count"("c"."id"))::integer AS "content_count",
    COALESCE("jsonb_agg"("jsonb_build_object"('id', "c"."id", 'name', "c"."name", 'content_type', "c"."content_type", 'sequence_label', "c"."sequence_label", 'client_name', "ccl"."name") ORDER BY "c"."content_type", "c"."name") FILTER (WHERE ("c"."id" IS NOT NULL)), '[]'::"jsonb") AS "contents"
   FROM (((((("public"."toc_rows" "tr"
     JOIN "public"."toc_files" "tf" ON (("tf"."id" = "tr"."toc_file_id")))
     JOIN "public"."clients" "cl" ON (("cl"."id" = "tf"."client_id")))
     LEFT JOIN "public"."tracks" "t" ON (("t"."id" = "tf"."track_id")))
     LEFT JOIN "public"."content_toc_links" "l" ON (("l"."toc_row_id" = "tr"."id")))
     LEFT JOIN "public"."contents" "c" ON (("c"."id" = "l"."content_id")))
     LEFT JOIN "public"."clients" "ccl" ON (("ccl"."id" = "c"."client_id")))
  GROUP BY "tr"."id", "tf"."id", "cl"."name", "t"."name";



CREATE OR REPLACE TRIGGER "contents_touch" BEFORE UPDATE ON "public"."contents" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



ALTER TABLE ONLY "public"."content_toc_links"
    ADD CONSTRAINT "content_toc_links_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_toc_links"
    ADD CONSTRAINT "content_toc_links_toc_row_id_fkey" FOREIGN KEY ("toc_row_id") REFERENCES "public"."toc_rows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contents"
    ADD CONSTRAINT "contents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contents"
    ADD CONSTRAINT "contents_content_type_fkey" FOREIGN KEY ("content_type") REFERENCES "public"."content_types"("name") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."contents"
    ADD CONSTRAINT "contents_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."toc_files"
    ADD CONSTRAINT "toc_files_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."toc_files"
    ADD CONSTRAINT "toc_files_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."toc_rows"
    ADD CONSTRAINT "toc_rows_toc_file_id_fkey" FOREIGN KEY ("toc_file_id") REFERENCES "public"."toc_files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tracks"
    ADD CONSTRAINT "tracks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_toc_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team full access" ON "public"."clients" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "team full access" ON "public"."content_toc_links" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "team full access" ON "public"."content_types" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "team full access" ON "public"."contents" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "team full access" ON "public"."toc_files" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "team full access" ON "public"."toc_rows" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "team full access" ON "public"."tracks" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."toc_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."toc_rows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tracks" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON SEQUENCE "public"."clients_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."clients_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."clients_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."content_toc_links" TO "authenticated";
GRANT ALL ON TABLE "public"."content_toc_links" TO "service_role";



GRANT ALL ON TABLE "public"."content_types" TO "authenticated";
GRANT ALL ON TABLE "public"."content_types" TO "service_role";



GRANT ALL ON TABLE "public"."contents" TO "authenticated";
GRANT ALL ON TABLE "public"."contents" TO "service_role";



GRANT ALL ON SEQUENCE "public"."contents_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."contents_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."contents_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."toc_files" TO "authenticated";
GRANT ALL ON TABLE "public"."toc_files" TO "service_role";



GRANT ALL ON SEQUENCE "public"."toc_files_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."toc_files_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."toc_files_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."toc_rows" TO "authenticated";
GRANT ALL ON TABLE "public"."toc_rows" TO "service_role";



GRANT ALL ON SEQUENCE "public"."toc_rows_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."toc_rows_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."toc_rows_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tracks" TO "authenticated";
GRANT ALL ON TABLE "public"."tracks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tracks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tracks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tracks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."v_contents" TO "authenticated";
GRANT ALL ON TABLE "public"."v_contents" TO "service_role";



GRANT ALL ON TABLE "public"."v_toc_files" TO "authenticated";
GRANT ALL ON TABLE "public"."v_toc_files" TO "service_role";



GRANT ALL ON TABLE "public"."v_toc_rows" TO "authenticated";
GRANT ALL ON TABLE "public"."v_toc_rows" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































