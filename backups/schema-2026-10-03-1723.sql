


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


CREATE SCHEMA IF NOT EXISTS "auth";


ALTER SCHEMA "auth" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "auth"."aal_level" AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE "auth"."aal_level" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."code_challenge_method" AS ENUM (
    's256',
    'plain'
);


ALTER TYPE "auth"."code_challenge_method" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_status" AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE "auth"."factor_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_type" AS ENUM (
    'totp',
    'webauthn',
    'phone',
    'recovery_code'
);


ALTER TYPE "auth"."factor_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_authorization_status" AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE "auth"."oauth_authorization_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_client_type" AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE "auth"."oauth_client_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_registration_type" AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE "auth"."oauth_registration_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_response_type" AS ENUM (
    'code'
);


ALTER TYPE "auth"."oauth_response_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."one_time_token_type" AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE "auth"."one_time_token_type" OWNER TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "auth"."email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION "auth"."email"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."email"() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';



CREATE OR REPLACE FUNCTION "auth"."jwt"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION "auth"."jwt"() OWNER TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "auth"."role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION "auth"."role"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."role"() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';



CREATE OR REPLACE FUNCTION "auth"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION "auth"."uid"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."uid"() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';



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


CREATE TABLE IF NOT EXISTS "auth"."audit_log_entries" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "payload" json,
    "created_at" timestamp with time zone,
    "ip_address" character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE "auth"."audit_log_entries" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."audit_log_entries" IS 'Auth: Audit trail for user actions.';



CREATE TABLE IF NOT EXISTS "auth"."custom_oauth_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_type" "text" NOT NULL,
    "identifier" "text" NOT NULL,
    "name" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "client_secret" "text" NOT NULL,
    "acceptable_client_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "scopes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "pkce_enabled" boolean DEFAULT true NOT NULL,
    "attribute_mapping" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "authorization_params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "email_optional" boolean DEFAULT false NOT NULL,
    "issuer" "text",
    "discovery_url" "text",
    "skip_nonce_check" boolean DEFAULT false NOT NULL,
    "cached_discovery" "jsonb",
    "discovery_cached_at" timestamp with time zone,
    "authorization_url" "text",
    "token_url" "text",
    "userinfo_url" "text",
    "jwks_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "custom_claims_allowlist" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    CONSTRAINT "custom_oauth_providers_authorization_url_https" CHECK ((("authorization_url" IS NULL) OR ("authorization_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_authorization_url_length" CHECK ((("authorization_url" IS NULL) OR ("char_length"("authorization_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_client_id_length" CHECK ((("char_length"("client_id") >= 1) AND ("char_length"("client_id") <= 512))),
    CONSTRAINT "custom_oauth_providers_discovery_url_length" CHECK ((("discovery_url" IS NULL) OR ("char_length"("discovery_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_identifier_format" CHECK (("identifier" ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::"text")),
    CONSTRAINT "custom_oauth_providers_issuer_length" CHECK ((("issuer" IS NULL) OR (("char_length"("issuer") >= 1) AND ("char_length"("issuer") <= 2048)))),
    CONSTRAINT "custom_oauth_providers_jwks_uri_https" CHECK ((("jwks_uri" IS NULL) OR ("jwks_uri" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_jwks_uri_length" CHECK ((("jwks_uri" IS NULL) OR ("char_length"("jwks_uri") <= 2048))),
    CONSTRAINT "custom_oauth_providers_name_length" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 100))),
    CONSTRAINT "custom_oauth_providers_oauth2_requires_endpoints" CHECK ((("provider_type" <> 'oauth2'::"text") OR (("authorization_url" IS NOT NULL) AND ("token_url" IS NOT NULL) AND ("userinfo_url" IS NOT NULL)))),
    CONSTRAINT "custom_oauth_providers_oidc_discovery_url_https" CHECK ((("provider_type" <> 'oidc'::"text") OR ("discovery_url" IS NULL) OR ("discovery_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_oidc_issuer_https" CHECK ((("provider_type" <> 'oidc'::"text") OR ("issuer" IS NULL) OR ("issuer" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_oidc_requires_issuer" CHECK ((("provider_type" <> 'oidc'::"text") OR ("issuer" IS NOT NULL))),
    CONSTRAINT "custom_oauth_providers_provider_type_check" CHECK (("provider_type" = ANY (ARRAY['oauth2'::"text", 'oidc'::"text"]))),
    CONSTRAINT "custom_oauth_providers_token_url_https" CHECK ((("token_url" IS NULL) OR ("token_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_token_url_length" CHECK ((("token_url" IS NULL) OR ("char_length"("token_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_userinfo_url_https" CHECK ((("userinfo_url" IS NULL) OR ("userinfo_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_userinfo_url_length" CHECK ((("userinfo_url" IS NULL) OR ("char_length"("userinfo_url") <= 2048)))
);


ALTER TABLE "auth"."custom_oauth_providers" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."flow_state" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "auth_code" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "code_challenge" "text",
    "provider_type" "text" NOT NULL,
    "provider_access_token" "text",
    "provider_refresh_token" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "authentication_method" "text" NOT NULL,
    "auth_code_issued_at" timestamp with time zone,
    "invite_token" "text",
    "referrer" "text",
    "oauth_client_state_id" "uuid",
    "linking_target_id" "uuid",
    "email_optional" boolean DEFAULT false NOT NULL
);


ALTER TABLE "auth"."flow_state" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."flow_state" IS 'Stores metadata for all OAuth/SSO login flows';



CREATE TABLE IF NOT EXISTS "auth"."identities" (
    "provider_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identity_data" "jsonb" NOT NULL,
    "provider" "text" NOT NULL,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" "text" GENERATED ALWAYS AS ("lower"(("identity_data" ->> 'email'::"text"))) STORED,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "auth"."identities" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."identities" IS 'Auth: Stores identities associated to a user.';



COMMENT ON COLUMN "auth"."identities"."email" IS 'Auth: Email is a generated column that references the optional email property in the identity_data';



CREATE TABLE IF NOT EXISTS "auth"."instances" (
    "id" "uuid" NOT NULL,
    "uuid" "uuid",
    "raw_base_config" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "auth"."instances" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."instances" IS 'Auth: Manages users across multiple sites.';



CREATE TABLE IF NOT EXISTS "auth"."mfa_amr_claims" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "authentication_method" "text" NOT NULL,
    "id" "uuid" NOT NULL
);


ALTER TABLE "auth"."mfa_amr_claims" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_amr_claims" IS 'auth: stores authenticator method reference claims for multi factor authentication';



CREATE TABLE IF NOT EXISTS "auth"."mfa_challenges" (
    "id" "uuid" NOT NULL,
    "factor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "ip_address" "inet" NOT NULL,
    "otp_code" "text",
    "web_authn_session_data" "jsonb"
);


ALTER TABLE "auth"."mfa_challenges" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_challenges" IS 'auth: stores metadata about challenge requests made';



CREATE TABLE IF NOT EXISTS "auth"."mfa_factors" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friendly_name" "text",
    "factor_type" "auth"."factor_type" NOT NULL,
    "status" "auth"."factor_status" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "secret" "text",
    "phone" "text",
    "last_challenged_at" timestamp with time zone,
    "web_authn_credential" "jsonb",
    "web_authn_aaguid" "uuid",
    "last_webauthn_challenge_data" "jsonb"
);


ALTER TABLE "auth"."mfa_factors" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_factors" IS 'auth: stores metadata about factors';



COMMENT ON COLUMN "auth"."mfa_factors"."last_webauthn_challenge_data" IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';



CREATE TABLE IF NOT EXISTS "auth"."mfa_recovery_code_sets" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "mfa_factor_id" "uuid" NOT NULL,
    "failed_verification_count" integer DEFAULT 0 NOT NULL,
    "verification_locked_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mfa_recovery_code_sets_failed_verification_count_check" CHECK (("failed_verification_count" >= 0))
);


ALTER TABLE "auth"."mfa_recovery_code_sets" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."mfa_recovery_codes" (
    "id" "uuid" NOT NULL,
    "mfa_recovery_code_set_id" "uuid" NOT NULL,
    "code_hash" "text" NOT NULL,
    "consumed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "auth"."mfa_recovery_codes" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_authorizations" (
    "id" "uuid" NOT NULL,
    "authorization_id" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "redirect_uri" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "state" "text",
    "resource" "text",
    "code_challenge" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "response_type" "auth"."oauth_response_type" DEFAULT 'code'::"auth"."oauth_response_type" NOT NULL,
    "status" "auth"."oauth_authorization_status" DEFAULT 'pending'::"auth"."oauth_authorization_status" NOT NULL,
    "authorization_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:03:00'::interval) NOT NULL,
    "approved_at" timestamp with time zone,
    "nonce" "text",
    CONSTRAINT "oauth_authorizations_authorization_code_length" CHECK (("char_length"("authorization_code") <= 255)),
    CONSTRAINT "oauth_authorizations_code_challenge_length" CHECK (("char_length"("code_challenge") <= 128)),
    CONSTRAINT "oauth_authorizations_expires_at_future" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "oauth_authorizations_nonce_length" CHECK (("char_length"("nonce") <= 255)),
    CONSTRAINT "oauth_authorizations_redirect_uri_length" CHECK (("char_length"("redirect_uri") <= 2048)),
    CONSTRAINT "oauth_authorizations_resource_length" CHECK (("char_length"("resource") <= 2048)),
    CONSTRAINT "oauth_authorizations_scope_length" CHECK (("char_length"("scope") <= 4096)),
    CONSTRAINT "oauth_authorizations_state_length" CHECK (("char_length"("state") <= 4096))
);


ALTER TABLE "auth"."oauth_authorizations" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_client_states" (
    "id" "uuid" NOT NULL,
    "provider_type" "text" NOT NULL,
    "code_verifier" "text",
    "created_at" timestamp with time zone NOT NULL
);


ALTER TABLE "auth"."oauth_client_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."oauth_client_states" IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';



CREATE TABLE IF NOT EXISTS "auth"."oauth_clients" (
    "id" "uuid" NOT NULL,
    "client_secret_hash" "text",
    "registration_type" "auth"."oauth_registration_type" NOT NULL,
    "redirect_uris" "text" NOT NULL,
    "grant_types" "text" NOT NULL,
    "client_name" "text",
    "client_uri" "text",
    "logo_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "client_type" "auth"."oauth_client_type" DEFAULT 'confidential'::"auth"."oauth_client_type" NOT NULL,
    "token_endpoint_auth_method" "text" NOT NULL,
    CONSTRAINT "oauth_clients_client_name_length" CHECK (("char_length"("client_name") <= 1024)),
    CONSTRAINT "oauth_clients_client_uri_length" CHECK (("char_length"("client_uri") <= 2048)),
    CONSTRAINT "oauth_clients_logo_uri_length" CHECK (("char_length"("logo_uri") <= 2048)),
    CONSTRAINT "oauth_clients_token_endpoint_auth_method_check" CHECK (("token_endpoint_auth_method" = ANY (ARRAY['client_secret_basic'::"text", 'client_secret_post'::"text", 'none'::"text"])))
);


ALTER TABLE "auth"."oauth_clients" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_consents" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "scopes" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "oauth_consents_revoked_after_granted" CHECK ((("revoked_at" IS NULL) OR ("revoked_at" >= "granted_at"))),
    CONSTRAINT "oauth_consents_scopes_length" CHECK (("char_length"("scopes") <= 2048)),
    CONSTRAINT "oauth_consents_scopes_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "scopes")) > 0))
);


ALTER TABLE "auth"."oauth_consents" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."one_time_tokens" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_type" "auth"."one_time_token_type" NOT NULL,
    "token_hash" "text" NOT NULL,
    "relates_to" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    CONSTRAINT "one_time_tokens_token_hash_check" CHECK (("char_length"("token_hash") > 0))
);


ALTER TABLE "auth"."one_time_tokens" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."refresh_tokens" (
    "instance_id" "uuid",
    "id" bigint NOT NULL,
    "token" character varying(255),
    "user_id" character varying(255),
    "revoked" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "parent" character varying(255),
    "session_id" "uuid"
);


ALTER TABLE "auth"."refresh_tokens" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."refresh_tokens" IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';



CREATE SEQUENCE IF NOT EXISTS "auth"."refresh_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNER TO "supabase_auth_admin";


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNED BY "auth"."refresh_tokens"."id";



CREATE TABLE IF NOT EXISTS "auth"."saml_providers" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "metadata_xml" "text" NOT NULL,
    "metadata_url" "text",
    "attribute_mapping" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "name_id_format" "text",
    CONSTRAINT "entity_id not empty" CHECK (("char_length"("entity_id") > 0)),
    CONSTRAINT "metadata_url not empty" CHECK ((("metadata_url" = NULL::"text") OR ("char_length"("metadata_url") > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK (("char_length"("metadata_xml") > 0))
);


ALTER TABLE "auth"."saml_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_providers" IS 'Auth: Manages SAML Identity Provider connections.';



CREATE TABLE IF NOT EXISTS "auth"."saml_relay_states" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "for_email" "text",
    "redirect_to" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "flow_state_id" "uuid",
    CONSTRAINT "request_id not empty" CHECK (("char_length"("request_id") > 0))
);


ALTER TABLE "auth"."saml_relay_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_relay_states" IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';



CREATE TABLE IF NOT EXISTS "auth"."schema_migrations" (
    "version" character varying(255) NOT NULL
);


ALTER TABLE "auth"."schema_migrations" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."schema_migrations" IS 'Auth: Manages updates to the auth system.';



CREATE TABLE IF NOT EXISTS "auth"."scim_tokens" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "prefix" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "last_used_at" timestamp with time zone,
    CONSTRAINT "scim_tokens_expires_at_future" CHECK ((("expires_at" IS NULL) OR ("expires_at" > "created_at"))),
    CONSTRAINT "scim_tokens_revoked_after_created" CHECK ((("revoked_at" IS NULL) OR ("revoked_at" >= "created_at"))),
    CONSTRAINT "scim_tokens_token_hash_check" CHECK (("token_hash" ~ '^[0-9a-f]{64}$'::"text"))
);


ALTER TABLE "auth"."scim_tokens" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."scim_users" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "resource" "jsonb" NOT NULL,
    "user_name" "text" GENERATED ALWAYS AS ("lower"(("resource" ->> 'userName'::"text"))) STORED NOT NULL,
    "external_id" "text" GENERATED ALWAYS AS (("resource" ->> 'externalId'::"text")) STORED,
    "active" boolean GENERATED ALWAYS AS (COALESCE((("resource" ->> 'active'::"text"))::boolean, true)) STORED NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "auth"."scim_users" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "factor_id" "uuid",
    "aal" "auth"."aal_level",
    "not_after" timestamp with time zone,
    "refreshed_at" timestamp without time zone,
    "user_agent" "text",
    "ip" "inet",
    "tag" "text",
    "oauth_client_id" "uuid",
    "refresh_token_hmac_key" "text",
    "refresh_token_counter" bigint,
    "scopes" "text",
    CONSTRAINT "sessions_scopes_length" CHECK (("char_length"("scopes") <= 4096))
);


ALTER TABLE "auth"."sessions" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sessions" IS 'Auth: Stores session data associated to a user.';



COMMENT ON COLUMN "auth"."sessions"."not_after" IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_hmac_key" IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_counter" IS 'Holds the ID (counter) of the last issued refresh token.';



CREATE TABLE IF NOT EXISTS "auth"."sso_domains" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK (("char_length"("domain") > 0))
);


ALTER TABLE "auth"."sso_domains" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_domains" IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';



CREATE TABLE IF NOT EXISTS "auth"."sso_providers" (
    "id" "uuid" NOT NULL,
    "resource_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "disabled" boolean,
    CONSTRAINT "resource_id not empty" CHECK ((("resource_id" = NULL::"text") OR ("char_length"("resource_id") > 0)))
);


ALTER TABLE "auth"."sso_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_providers" IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';



COMMENT ON COLUMN "auth"."sso_providers"."resource_id" IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';



CREATE TABLE IF NOT EXISTS "auth"."users" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "aud" character varying(255),
    "role" character varying(255),
    "email" character varying(255),
    "encrypted_password" character varying(255),
    "email_confirmed_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "confirmation_token" character varying(255),
    "confirmation_sent_at" timestamp with time zone,
    "recovery_token" character varying(255),
    "recovery_sent_at" timestamp with time zone,
    "email_change_token_new" character varying(255),
    "email_change" character varying(255),
    "email_change_sent_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    "raw_app_meta_data" "jsonb",
    "raw_user_meta_data" "jsonb",
    "is_super_admin" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "phone" "text" DEFAULT NULL::character varying,
    "phone_confirmed_at" timestamp with time zone,
    "phone_change" "text" DEFAULT ''::character varying,
    "phone_change_token" character varying(255) DEFAULT ''::character varying,
    "phone_change_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone GENERATED ALWAYS AS (LEAST("email_confirmed_at", "phone_confirmed_at")) STORED,
    "email_change_token_current" character varying(255) DEFAULT ''::character varying,
    "email_change_confirm_status" smallint DEFAULT 0,
    "banned_until" timestamp with time zone,
    "reauthentication_token" character varying(255) DEFAULT ''::character varying,
    "reauthentication_sent_at" timestamp with time zone,
    "is_sso_user" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_email_change_confirm_status_check" CHECK ((("email_change_confirm_status" >= 0) AND ("email_change_confirm_status" <= 2)))
);


ALTER TABLE "auth"."users" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."users" IS 'Auth: Stores user login data within a secure schema.';



COMMENT ON COLUMN "auth"."users"."is_sso_user" IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';



CREATE TABLE IF NOT EXISTS "auth"."webauthn_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "challenge_type" "text" NOT NULL,
    "session_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "webauthn_challenges_challenge_type_check" CHECK (("challenge_type" = ANY (ARRAY['signup'::"text", 'registration'::"text", 'authentication'::"text"])))
);


ALTER TABLE "auth"."webauthn_challenges" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."webauthn_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credential_id" "bytea" NOT NULL,
    "public_key" "bytea" NOT NULL,
    "attestation_type" "text" DEFAULT ''::"text" NOT NULL,
    "aaguid" "uuid",
    "sign_count" bigint DEFAULT 0 NOT NULL,
    "transports" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "backup_eligible" boolean DEFAULT false NOT NULL,
    "backed_up" boolean DEFAULT false NOT NULL,
    "friendly_name" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone
);


ALTER TABLE "auth"."webauthn_credentials" OWNER TO "supabase_auth_admin";


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


ALTER TABLE ONLY "auth"."refresh_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"auth"."refresh_tokens_id_seq"'::"regclass");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "amr_id_pk" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."audit_log_entries"
    ADD CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."custom_oauth_providers"
    ADD CONSTRAINT "custom_oauth_providers_identifier_key" UNIQUE ("identifier");



ALTER TABLE ONLY "auth"."custom_oauth_providers"
    ADD CONSTRAINT "custom_oauth_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."flow_state"
    ADD CONSTRAINT "flow_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_provider_id_provider_unique" UNIQUE ("provider_id", "provider");



ALTER TABLE ONLY "auth"."instances"
    ADD CONSTRAINT "instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_authentication_method_pkey" UNIQUE ("session_id", "authentication_method");



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_last_challenged_at_key" UNIQUE ("last_challenged_at");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_recovery_code_sets"
    ADD CONSTRAINT "mfa_recovery_code_sets_mfa_factor_id_key" UNIQUE ("mfa_factor_id");



ALTER TABLE ONLY "auth"."mfa_recovery_code_sets"
    ADD CONSTRAINT "mfa_recovery_code_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_recovery_code_sets"
    ADD CONSTRAINT "mfa_recovery_code_sets_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "auth"."mfa_recovery_codes"
    ADD CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_code_key" UNIQUE ("authorization_code");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_id_key" UNIQUE ("authorization_id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_client_states"
    ADD CONSTRAINT "oauth_client_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_clients"
    ADD CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_client_unique" UNIQUE ("user_id", "client_id");



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_token_unique" UNIQUE ("token");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_entity_id_key" UNIQUE ("entity_id");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "auth"."scim_tokens"
    ADD CONSTRAINT "scim_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."scim_users"
    ADD CONSTRAINT "scim_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_providers"
    ADD CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."webauthn_challenges"
    ADD CONSTRAINT "webauthn_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id");



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



CREATE INDEX "audit_logs_instance_id_idx" ON "auth"."audit_log_entries" USING "btree" ("instance_id");



CREATE UNIQUE INDEX "confirmation_token_idx" ON "auth"."users" USING "btree" ("confirmation_token") WHERE (("confirmation_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "custom_oauth_providers_created_at_idx" ON "auth"."custom_oauth_providers" USING "btree" ("created_at");



CREATE INDEX "custom_oauth_providers_enabled_idx" ON "auth"."custom_oauth_providers" USING "btree" ("enabled");



CREATE INDEX "custom_oauth_providers_identifier_idx" ON "auth"."custom_oauth_providers" USING "btree" ("identifier");



CREATE INDEX "custom_oauth_providers_provider_type_idx" ON "auth"."custom_oauth_providers" USING "btree" ("provider_type");



CREATE UNIQUE INDEX "email_change_token_current_idx" ON "auth"."users" USING "btree" ("email_change_token_current") WHERE (("email_change_token_current")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_new_idx" ON "auth"."users" USING "btree" ("email_change_token_new") WHERE (("email_change_token_new")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "factor_id_created_at_idx" ON "auth"."mfa_factors" USING "btree" ("user_id", "created_at");



CREATE INDEX "flow_state_created_at_idx" ON "auth"."flow_state" USING "btree" ("created_at" DESC);



CREATE INDEX "identities_email_idx" ON "auth"."identities" USING "btree" ("email" "text_pattern_ops");



COMMENT ON INDEX "auth"."identities_email_idx" IS 'Auth: Ensures indexed queries on the email column';



CREATE INDEX "identities_user_id_idx" ON "auth"."identities" USING "btree" ("user_id");



CREATE INDEX "idx_auth_code" ON "auth"."flow_state" USING "btree" ("auth_code");



CREATE INDEX "idx_oauth_client_states_created_at" ON "auth"."oauth_client_states" USING "btree" ("created_at");



CREATE INDEX "idx_user_id_auth_method" ON "auth"."flow_state" USING "btree" ("user_id", "authentication_method");



CREATE INDEX "mfa_challenge_created_at_idx" ON "auth"."mfa_challenges" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "mfa_factors_user_friendly_name_unique" ON "auth"."mfa_factors" USING "btree" ("friendly_name", "user_id") WHERE (TRIM(BOTH FROM "friendly_name") <> ''::"text");



CREATE INDEX "mfa_factors_user_id_idx" ON "auth"."mfa_factors" USING "btree" ("user_id");



CREATE INDEX "mfa_recovery_codes_set_id_idx" ON "auth"."mfa_recovery_codes" USING "btree" ("mfa_recovery_code_set_id");



CREATE INDEX "oauth_auth_pending_exp_idx" ON "auth"."oauth_authorizations" USING "btree" ("expires_at") WHERE ("status" = 'pending'::"auth"."oauth_authorization_status");



CREATE INDEX "oauth_clients_deleted_at_idx" ON "auth"."oauth_clients" USING "btree" ("deleted_at");



CREATE INDEX "oauth_consents_active_client_idx" ON "auth"."oauth_consents" USING "btree" ("client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_active_user_client_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_user_order_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "granted_at" DESC);



CREATE INDEX "one_time_tokens_relates_to_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("relates_to");



CREATE INDEX "one_time_tokens_token_hash_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("token_hash");



CREATE UNIQUE INDEX "one_time_tokens_user_id_token_type_key" ON "auth"."one_time_tokens" USING "btree" ("user_id", "token_type");



CREATE UNIQUE INDEX "reauthentication_token_idx" ON "auth"."users" USING "btree" ("reauthentication_token") WHERE (("reauthentication_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "recovery_token_idx" ON "auth"."users" USING "btree" ("recovery_token") WHERE (("recovery_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "refresh_tokens_instance_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id");



CREATE INDEX "refresh_tokens_instance_id_user_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id", "user_id");



CREATE INDEX "refresh_tokens_parent_idx" ON "auth"."refresh_tokens" USING "btree" ("parent");



CREATE INDEX "refresh_tokens_session_id_revoked_idx" ON "auth"."refresh_tokens" USING "btree" ("session_id", "revoked");



CREATE INDEX "refresh_tokens_updated_at_idx" ON "auth"."refresh_tokens" USING "btree" ("updated_at" DESC);



CREATE INDEX "saml_providers_sso_provider_id_idx" ON "auth"."saml_providers" USING "btree" ("sso_provider_id");



CREATE INDEX "saml_relay_states_created_at_idx" ON "auth"."saml_relay_states" USING "btree" ("created_at" DESC);



CREATE INDEX "saml_relay_states_for_email_idx" ON "auth"."saml_relay_states" USING "btree" ("for_email");



CREATE INDEX "saml_relay_states_sso_provider_id_idx" ON "auth"."saml_relay_states" USING "btree" ("sso_provider_id");



CREATE INDEX "scim_tokens_expires_at_idx" ON "auth"."scim_tokens" USING "btree" ("expires_at");



CREATE INDEX "scim_tokens_revoked_at_idx" ON "auth"."scim_tokens" USING "btree" ("revoked_at");



CREATE INDEX "scim_tokens_sso_provider_id_idx" ON "auth"."scim_tokens" USING "btree" ("sso_provider_id");



CREATE UNIQUE INDEX "scim_tokens_token_hash_key" ON "auth"."scim_tokens" USING "btree" ("token_hash");



CREATE INDEX "scim_users_created_at_idx" ON "auth"."scim_users" USING "btree" ("sso_provider_id", "created_at", "id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "scim_users_deleted_at_idx" ON "auth"."scim_users" USING "btree" ("deleted_at");



CREATE UNIQUE INDEX "scim_users_external_id_key" ON "auth"."scim_users" USING "btree" ("sso_provider_id", "external_id") WHERE (("external_id" IS NOT NULL) AND ("deleted_at" IS NULL));



CREATE INDEX "scim_users_id_idx" ON "auth"."scim_users" USING "btree" ("sso_provider_id", "id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "scim_users_sso_provider_id_idx" ON "auth"."scim_users" USING "btree" ("sso_provider_id");



CREATE INDEX "scim_users_updated_at_idx" ON "auth"."scim_users" USING "btree" ("sso_provider_id", "updated_at", "id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "scim_users_user_id_idx" ON "auth"."scim_users" USING "btree" ("user_id");



CREATE INDEX "scim_users_user_name_idx" ON "auth"."scim_users" USING "btree" ("sso_provider_id", "user_name" COLLATE "C", "id") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "scim_users_user_name_key" ON "auth"."scim_users" USING "btree" ("sso_provider_id", "user_name") WHERE ("deleted_at" IS NULL);



CREATE INDEX "sessions_not_after_idx" ON "auth"."sessions" USING "btree" ("not_after" DESC);



CREATE INDEX "sessions_oauth_client_id_idx" ON "auth"."sessions" USING "btree" ("oauth_client_id");



CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "sso_domains_domain_idx" ON "auth"."sso_domains" USING "btree" ("lower"("domain"));



CREATE INDEX "sso_domains_sso_provider_id_idx" ON "auth"."sso_domains" USING "btree" ("sso_provider_id");



CREATE UNIQUE INDEX "sso_providers_resource_id_idx" ON "auth"."sso_providers" USING "btree" ("lower"("resource_id"));



CREATE INDEX "sso_providers_resource_id_pattern_idx" ON "auth"."sso_providers" USING "btree" ("resource_id" "text_pattern_ops");



CREATE UNIQUE INDEX "unique_phone_factor_per_user" ON "auth"."mfa_factors" USING "btree" ("user_id", "phone");



CREATE INDEX "user_id_created_at_idx" ON "auth"."sessions" USING "btree" ("user_id", "created_at");



CREATE UNIQUE INDEX "users_email_partial_key" ON "auth"."users" USING "btree" ("email") WHERE ("is_sso_user" = false);



COMMENT ON INDEX "auth"."users_email_partial_key" IS 'Auth: A partial unique index that applies only when is_sso_user is false';



CREATE INDEX "users_instance_id_email_idx" ON "auth"."users" USING "btree" ("instance_id", "lower"(("email")::"text"));



CREATE INDEX "users_instance_id_idx" ON "auth"."users" USING "btree" ("instance_id");



CREATE INDEX "users_is_anonymous_idx" ON "auth"."users" USING "btree" ("is_anonymous");



CREATE INDEX "webauthn_challenges_expires_at_idx" ON "auth"."webauthn_challenges" USING "btree" ("expires_at");



CREATE INDEX "webauthn_challenges_user_id_idx" ON "auth"."webauthn_challenges" USING "btree" ("user_id");



CREATE UNIQUE INDEX "webauthn_credentials_credential_id_key" ON "auth"."webauthn_credentials" USING "btree" ("credential_id");



CREATE INDEX "webauthn_credentials_user_id_idx" ON "auth"."webauthn_credentials" USING "btree" ("user_id");



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



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_auth_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "auth"."mfa_factors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_recovery_code_sets"
    ADD CONSTRAINT "mfa_recovery_code_sets_mfa_factor_id_fkey" FOREIGN KEY ("mfa_factor_id") REFERENCES "auth"."mfa_factors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_recovery_code_sets"
    ADD CONSTRAINT "mfa_recovery_code_sets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_recovery_codes"
    ADD CONSTRAINT "mfa_recovery_codes_mfa_recovery_code_set_id_fkey" FOREIGN KEY ("mfa_recovery_code_set_id") REFERENCES "auth"."mfa_recovery_code_sets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_flow_state_id_fkey" FOREIGN KEY ("flow_state_id") REFERENCES "auth"."flow_state"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."scim_tokens"
    ADD CONSTRAINT "scim_tokens_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."scim_users"
    ADD CONSTRAINT "scim_users_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."scim_users"
    ADD CONSTRAINT "scim_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_oauth_client_id_fkey" FOREIGN KEY ("oauth_client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."webauthn_challenges"
    ADD CONSTRAINT "webauthn_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



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



ALTER TABLE "auth"."audit_log_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."flow_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_amr_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."one_time_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."refresh_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_relay_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."schema_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."users" ENABLE ROW LEVEL SECURITY;


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


GRANT USAGE ON SCHEMA "auth" TO "anon";
GRANT USAGE ON SCHEMA "auth" TO "authenticated";
GRANT USAGE ON SCHEMA "auth" TO "service_role";
GRANT ALL ON SCHEMA "auth" TO "supabase_auth_admin";
GRANT ALL ON SCHEMA "auth" TO "dashboard_user";
GRANT USAGE ON SCHEMA "auth" TO "postgres";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "auth"."email"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."jwt"() TO "postgres";
GRANT ALL ON FUNCTION "auth"."jwt"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."role"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."uid"() TO "dashboard_user";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON TABLE "auth"."audit_log_entries" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."audit_log_entries" TO "postgres";
GRANT SELECT ON TABLE "auth"."audit_log_entries" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "auth"."custom_oauth_providers" TO "postgres";
GRANT ALL ON TABLE "auth"."custom_oauth_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."flow_state" TO "postgres";
GRANT SELECT ON TABLE "auth"."flow_state" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."flow_state" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."identities" TO "postgres";
GRANT SELECT ON TABLE "auth"."identities" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."identities" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."instances" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."instances" TO "postgres";
GRANT SELECT ON TABLE "auth"."instances" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_amr_claims" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_amr_claims" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_amr_claims" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_challenges" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_challenges" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_challenges" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_factors" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_factors" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_factors" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."mfa_recovery_code_sets" TO "postgres";
GRANT ALL ON TABLE "auth"."mfa_recovery_code_sets" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."mfa_recovery_codes" TO "postgres";
GRANT ALL ON TABLE "auth"."mfa_recovery_codes" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_client_states" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_client_states" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_clients" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_clients" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_consents" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_consents" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."one_time_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."one_time_tokens" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."one_time_tokens" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."refresh_tokens" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."refresh_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."refresh_tokens" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "dashboard_user";
GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "postgres";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_relay_states" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_relay_states" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_relay_states" TO "dashboard_user";



GRANT SELECT ON TABLE "auth"."schema_migrations" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "auth"."scim_tokens" TO "postgres";
GRANT ALL ON TABLE "auth"."scim_tokens" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."scim_users" TO "postgres";
GRANT ALL ON TABLE "auth"."scim_users" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sessions" TO "postgres";
GRANT SELECT ON TABLE "auth"."sessions" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sessions" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_domains" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_domains" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_domains" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_providers" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."users" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."users" TO "postgres";
GRANT SELECT ON TABLE "auth"."users" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "auth"."webauthn_challenges" TO "postgres";
GRANT ALL ON TABLE "auth"."webauthn_challenges" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."webauthn_credentials" TO "postgres";
GRANT ALL ON TABLE "auth"."webauthn_credentials" TO "dashboard_user";



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



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "dashboard_user";



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







