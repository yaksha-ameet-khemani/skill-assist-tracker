--
-- PostgreSQL database dump
--

\restrict 5Trqhj2XPtkpBXbCEA83Gx6DdXa3Qgez2mDwOB4ZyibJPjSNEmv88dOkDdl4u07

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end $$;


ALTER FUNCTION public.touch_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id bigint NOT NULL,
    name text NOT NULL,
    notes text,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.clients ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.clients_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: content_toc_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.content_toc_links (
    content_id bigint NOT NULL,
    toc_row_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.content_toc_links OWNER TO postgres;

--
-- Name: content_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.content_types (
    name text NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL
);


ALTER TABLE public.content_types OWNER TO postgres;

--
-- Name: contents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contents (
    id bigint NOT NULL,
    client_id bigint NOT NULL,
    track_id bigint,
    content_type text NOT NULL,
    sequence_label text,
    name text NOT NULL,
    delivery_date date,
    notes text,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.contents OWNER TO postgres;

--
-- Name: contents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.contents ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.contents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: toc_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.toc_files (
    id bigint NOT NULL,
    client_id bigint NOT NULL,
    track_id bigint,
    file_name text NOT NULL,
    sheet_name text NOT NULL,
    header_row integer NOT NULL,
    columns jsonb DEFAULT '[]'::jsonb NOT NULL,
    day_column text,
    topic_column text,
    source_link text,
    notes text,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL,
    uploaded_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.toc_files OWNER TO postgres;

--
-- Name: toc_files_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.toc_files ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.toc_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: toc_rows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.toc_rows (
    id bigint NOT NULL,
    toc_file_id bigint NOT NULL,
    row_number integer NOT NULL,
    day_label text,
    topic text,
    data jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.toc_rows OWNER TO postgres;

--
-- Name: toc_rows_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.toc_rows ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.toc_rows_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: tracks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tracks (
    id bigint NOT NULL,
    client_id bigint NOT NULL,
    name text NOT NULL,
    notes text,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    csm text
);


ALTER TABLE public.tracks OWNER TO postgres;

--
-- Name: tracks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.tracks ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.tracks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: v_contents; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_contents AS
SELECT
    NULL::bigint AS id,
    NULL::bigint AS client_id,
    NULL::text AS client_name,
    NULL::bigint AS track_id,
    NULL::text AS track_name,
    NULL::text AS content_type,
    NULL::integer AS type_order,
    NULL::text AS sequence_label,
    NULL::text AS name,
    NULL::date AS delivery_date,
    NULL::text AS notes,
    NULL::jsonb AS extra,
    NULL::timestamp with time zone AS created_at,
    NULL::integer AS link_count,
    NULL::jsonb AS topics,
    NULL::text AS topics_text,
    NULL::text AS csm,
    NULL::text AS track_date;


ALTER VIEW public.v_contents OWNER TO postgres;

--
-- Name: v_toc_files; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_toc_files WITH (security_invoker='true') AS
 SELECT tf.id,
    tf.client_id,
    tf.track_id,
    tf.file_name,
    tf.sheet_name,
    tf.header_row,
    tf.columns,
    tf.day_column,
    tf.topic_column,
    tf.source_link,
    tf.notes,
    tf.extra,
    tf.uploaded_by,
    tf.created_at,
    cl.name AS client_name,
    t.name AS track_name,
    ( SELECT (count(*))::integer AS count
           FROM public.toc_rows r
          WHERE (r.toc_file_id = tf.id)) AS row_count
   FROM ((public.toc_files tf
     JOIN public.clients cl ON ((cl.id = tf.client_id)))
     LEFT JOIN public.tracks t ON ((t.id = tf.track_id)));


ALTER VIEW public.v_toc_files OWNER TO postgres;

--
-- Name: v_toc_rows; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_toc_rows AS
SELECT
    NULL::bigint AS id,
    NULL::bigint AS toc_file_id,
    NULL::text AS file_name,
    NULL::text AS sheet_name,
    NULL::text AS topic_column,
    NULL::bigint AS client_id,
    NULL::text AS client_name,
    NULL::bigint AS track_id,
    NULL::text AS track_name,
    NULL::integer AS row_number,
    NULL::text AS day_label,
    NULL::text AS topic,
    NULL::jsonb AS data,
    NULL::text AS data_text,
    NULL::integer AS content_count,
    NULL::jsonb AS contents;


ALTER VIEW public.v_toc_rows OWNER TO postgres;

--
-- Name: clients clients_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_name_key UNIQUE (name);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: content_toc_links content_toc_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_toc_links
    ADD CONSTRAINT content_toc_links_pkey PRIMARY KEY (content_id, toc_row_id);


--
-- Name: content_types content_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_types
    ADD CONSTRAINT content_types_pkey PRIMARY KEY (name);


--
-- Name: contents contents_identity; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT contents_identity UNIQUE NULLS NOT DISTINCT (client_id, track_id, content_type, sequence_label, name);


--
-- Name: contents contents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT contents_pkey PRIMARY KEY (id);


--
-- Name: toc_files toc_files_client_id_file_name_sheet_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.toc_files
    ADD CONSTRAINT toc_files_client_id_file_name_sheet_name_key UNIQUE (client_id, file_name, sheet_name);


--
-- Name: toc_files toc_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.toc_files
    ADD CONSTRAINT toc_files_pkey PRIMARY KEY (id);


--
-- Name: toc_rows toc_rows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.toc_rows
    ADD CONSTRAINT toc_rows_pkey PRIMARY KEY (id);


--
-- Name: toc_rows toc_rows_toc_file_id_row_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.toc_rows
    ADD CONSTRAINT toc_rows_toc_file_id_row_number_key UNIQUE (toc_file_id, row_number);


--
-- Name: tracks tracks_client_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tracks
    ADD CONSTRAINT tracks_client_id_name_key UNIQUE (client_id, name);


--
-- Name: tracks tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tracks
    ADD CONSTRAINT tracks_pkey PRIMARY KEY (id);


--
-- Name: content_toc_links_toc_row_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX content_toc_links_toc_row_id_idx ON public.content_toc_links USING btree (toc_row_id);


--
-- Name: contents_client_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contents_client_id_idx ON public.contents USING btree (client_id);


--
-- Name: contents_track_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contents_track_id_idx ON public.contents USING btree (track_id);


--
-- Name: toc_files_client_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX toc_files_client_id_idx ON public.toc_files USING btree (client_id);


--
-- Name: toc_rows_toc_file_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX toc_rows_toc_file_id_idx ON public.toc_rows USING btree (toc_file_id);


--
-- Name: tracks_client_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tracks_client_id_idx ON public.tracks USING btree (client_id);


--
-- Name: v_contents _RETURN; Type: RULE; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW public.v_contents WITH (security_invoker='true') AS
 SELECT c.id,
    c.client_id,
    cl.name AS client_name,
    c.track_id,
    t.name AS track_name,
    c.content_type,
    ct.sort_order AS type_order,
    c.sequence_label,
    c.name,
    c.delivery_date,
    c.notes,
    c.extra,
    c.created_at,
    (count(tr.id))::integer AS link_count,
    COALESCE(jsonb_agg(jsonb_build_object('toc_row_id', tr.id, 'file_name', tf.file_name, 'sheet_name', tf.sheet_name, 'row_number', tr.row_number, 'topic_column', tf.topic_column, 'day_label', tr.day_label, 'topic', tr.topic, 'data', tr.data, 'columns', tf.columns) ORDER BY tf.file_name, tr.row_number) FILTER (WHERE (tr.id IS NOT NULL)), '[]'::jsonb) AS topics,
    COALESCE(string_agg(((COALESCE(tr.topic, ''::text) || ' '::text) || (tr.data)::text), ' | '::text), ''::text) AS topics_text,
    t.csm,
    (t.extra ->> 'date'::text) AS track_date
   FROM ((((((public.contents c
     JOIN public.clients cl ON ((cl.id = c.client_id)))
     JOIN public.content_types ct ON ((ct.name = c.content_type)))
     LEFT JOIN public.tracks t ON ((t.id = c.track_id)))
     LEFT JOIN public.content_toc_links l ON ((l.content_id = c.id)))
     LEFT JOIN public.toc_rows tr ON ((tr.id = l.toc_row_id)))
     LEFT JOIN public.toc_files tf ON ((tf.id = tr.toc_file_id)))
  GROUP BY c.id, cl.name, t.name, t.csm, t.extra, ct.sort_order;


--
-- Name: v_toc_rows _RETURN; Type: RULE; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW public.v_toc_rows WITH (security_invoker='true') AS
 SELECT tr.id,
    tr.toc_file_id,
    tf.file_name,
    tf.sheet_name,
    tf.topic_column,
    tf.client_id,
    cl.name AS client_name,
    tf.track_id,
    t.name AS track_name,
    tr.row_number,
    tr.day_label,
    tr.topic,
    tr.data,
    (tr.data)::text AS data_text,
    (count(c.id))::integer AS content_count,
    COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'content_type', c.content_type, 'sequence_label', c.sequence_label, 'client_name', ccl.name) ORDER BY c.content_type, c.name) FILTER (WHERE (c.id IS NOT NULL)), '[]'::jsonb) AS contents
   FROM ((((((public.toc_rows tr
     JOIN public.toc_files tf ON ((tf.id = tr.toc_file_id)))
     JOIN public.clients cl ON ((cl.id = tf.client_id)))
     LEFT JOIN public.tracks t ON ((t.id = tf.track_id)))
     LEFT JOIN public.content_toc_links l ON ((l.toc_row_id = tr.id)))
     LEFT JOIN public.contents c ON ((c.id = l.content_id)))
     LEFT JOIN public.clients ccl ON ((ccl.id = c.client_id)))
  GROUP BY tr.id, tf.id, cl.name, t.name;


--
-- Name: contents contents_touch; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER contents_touch BEFORE UPDATE ON public.contents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: content_toc_links content_toc_links_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_toc_links
    ADD CONSTRAINT content_toc_links_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.contents(id) ON DELETE CASCADE;


--
-- Name: content_toc_links content_toc_links_toc_row_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.content_toc_links
    ADD CONSTRAINT content_toc_links_toc_row_id_fkey FOREIGN KEY (toc_row_id) REFERENCES public.toc_rows(id) ON DELETE CASCADE;


--
-- Name: contents contents_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT contents_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: contents contents_content_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT contents_content_type_fkey FOREIGN KEY (content_type) REFERENCES public.content_types(name) ON UPDATE CASCADE;


--
-- Name: contents contents_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT contents_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE SET NULL;


--
-- Name: toc_files toc_files_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.toc_files
    ADD CONSTRAINT toc_files_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: toc_files toc_files_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.toc_files
    ADD CONSTRAINT toc_files_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE SET NULL;


--
-- Name: toc_rows toc_rows_toc_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.toc_rows
    ADD CONSTRAINT toc_rows_toc_file_id_fkey FOREIGN KEY (toc_file_id) REFERENCES public.toc_files(id) ON DELETE CASCADE;


--
-- Name: tracks tracks_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tracks
    ADD CONSTRAINT tracks_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: content_toc_links; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.content_toc_links ENABLE ROW LEVEL SECURITY;

--
-- Name: content_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.content_types ENABLE ROW LEVEL SECURITY;

--
-- Name: contents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;

--
-- Name: clients team full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "team full access" ON public.clients TO authenticated USING (true) WITH CHECK (true);


--
-- Name: content_toc_links team full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "team full access" ON public.content_toc_links TO authenticated USING (true) WITH CHECK (true);


--
-- Name: content_types team full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "team full access" ON public.content_types TO authenticated USING (true) WITH CHECK (true);


--
-- Name: contents team full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "team full access" ON public.contents TO authenticated USING (true) WITH CHECK (true);


--
-- Name: toc_files team full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "team full access" ON public.toc_files TO authenticated USING (true) WITH CHECK (true);


--
-- Name: toc_rows team full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "team full access" ON public.toc_rows TO authenticated USING (true) WITH CHECK (true);


--
-- Name: tracks team full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "team full access" ON public.tracks TO authenticated USING (true) WITH CHECK (true);


--
-- Name: toc_files; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.toc_files ENABLE ROW LEVEL SECURITY;

--
-- Name: toc_rows; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.toc_rows ENABLE ROW LEVEL SECURITY;

--
-- Name: tracks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION touch_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.touch_updated_at() TO anon;
GRANT ALL ON FUNCTION public.touch_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.touch_updated_at() TO service_role;


--
-- Name: TABLE clients; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.clients TO authenticated;
GRANT ALL ON TABLE public.clients TO service_role;


--
-- Name: SEQUENCE clients_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.clients_id_seq TO anon;
GRANT ALL ON SEQUENCE public.clients_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.clients_id_seq TO service_role;


--
-- Name: TABLE content_toc_links; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.content_toc_links TO authenticated;
GRANT ALL ON TABLE public.content_toc_links TO service_role;


--
-- Name: TABLE content_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.content_types TO authenticated;
GRANT ALL ON TABLE public.content_types TO service_role;


--
-- Name: TABLE contents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contents TO authenticated;
GRANT ALL ON TABLE public.contents TO service_role;


--
-- Name: SEQUENCE contents_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.contents_id_seq TO anon;
GRANT ALL ON SEQUENCE public.contents_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.contents_id_seq TO service_role;


--
-- Name: TABLE toc_files; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.toc_files TO authenticated;
GRANT ALL ON TABLE public.toc_files TO service_role;


--
-- Name: SEQUENCE toc_files_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.toc_files_id_seq TO anon;
GRANT ALL ON SEQUENCE public.toc_files_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.toc_files_id_seq TO service_role;


--
-- Name: TABLE toc_rows; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.toc_rows TO authenticated;
GRANT ALL ON TABLE public.toc_rows TO service_role;


--
-- Name: SEQUENCE toc_rows_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.toc_rows_id_seq TO anon;
GRANT ALL ON SEQUENCE public.toc_rows_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.toc_rows_id_seq TO service_role;


--
-- Name: TABLE tracks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tracks TO authenticated;
GRANT ALL ON TABLE public.tracks TO service_role;


--
-- Name: SEQUENCE tracks_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.tracks_id_seq TO anon;
GRANT ALL ON SEQUENCE public.tracks_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.tracks_id_seq TO service_role;


--
-- Name: TABLE v_contents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.v_contents TO authenticated;
GRANT ALL ON TABLE public.v_contents TO service_role;


--
-- Name: TABLE v_toc_files; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.v_toc_files TO authenticated;
GRANT ALL ON TABLE public.v_toc_files TO service_role;


--
-- Name: TABLE v_toc_rows; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.v_toc_rows TO authenticated;
GRANT ALL ON TABLE public.v_toc_rows TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict 5Trqhj2XPtkpBXbCEA83Gx6DdXa3Qgez2mDwOB4ZyibJPjSNEmv88dOkDdl4u07

