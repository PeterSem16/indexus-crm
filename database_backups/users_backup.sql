--
-- PostgreSQL database dump
--

\restrict hWXAto1O4yVlhtlln6paIdM0xmbzyhwapeba86tjMgsXyUqJWcOieWelFAXC0En

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    assigned_countries text[] DEFAULT ARRAY[]::text[] NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    password_hash text NOT NULL,
    role_id character varying,
    sip_enabled boolean DEFAULT false NOT NULL,
    sip_extension text DEFAULT ''::text,
    sip_password text DEFAULT ''::text,
    sip_display_name text DEFAULT ''::text,
    avatar_url text,
    jira_account_id text,
    jira_display_name text,
    auth_method text DEFAULT 'local'::text NOT NULL,
    nexus_enabled boolean DEFAULT false NOT NULL,
    phone_prefix text,
    phone text,
    show_notification_bell boolean DEFAULT true NOT NULL,
    show_email_queue boolean DEFAULT false NOT NULL,
    show_sip_phone boolean DEFAULT false NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, email, full_name, role, is_active, assigned_countries, created_at, password_hash, role_id, sip_enabled, sip_extension, sip_password, sip_display_name, avatar_url, jira_account_id, jira_display_name, auth_method, nexus_enabled, phone_prefix, phone, show_notification_bell, show_email_queue, show_sip_phone) FROM stdin;
aba4129a-6634-49b7-addd-a433a54b5852	kollar	kollar@cordbloodcenter.com	Martin Kollár	manager	t	{SK,CZ,DE,HU,IT,RO,US}	2026-01-14 12:47:31.509928	$2b$10$boZalZ60Cuw/dMMk.Y5BX.dsEztf79lWU9fthVARYlEquaY63YpfC	9ab86324-bb34-4886-94cf-b58b76f19dcd	f				\N	\N	\N	local	f	\N	\N	t	f	f
95c58392-d61e-41e2-b5d3-ed1f9d93147d	michal.kollar	michal.kollar@cordbloodcenter.com	Michal Kollár	admin	t	{SK,CZ,HU,RO,IT,DE,US}	2025-12-23 10:53:22.500086	$2b$10$NcaoSDC9inXbdoxJD3BFXOArxSkZypuxNeH0YTy.1BCwgYuOoddd2	79aa3568-c3be-4ae0-8488-e686ba66e061	f				/uploads/avatars/avatar-1768309562845-485621816.jpg	\N	\N	ms365	f	\N	\N	t	f	f
67467ce3-7a44-4f67-a3d3-6a251e2991e5	admin	seman@cordbloodcenter.com	System Administrator	admin	t	{SK,CZ,HU,RO,IT,DE,US}	2025-12-21 07:55:23.100654	$2b$10$95LZjDVfG/iexNNUN0aGseMAJcJ63jdPE/LAMDl2ZbLNIgJnN9iL.	79aa3568-c3be-4ae0-8488-e686ba66e061	t	100	1111	Administrator	/uploads/avatars/avatar-1767364151307-288459602.jpg	\N	\N	ms365	t	+421		t	f	t
62b874a9-d7b5-4432-bf74-8a62c0815218	seman	seman@dialcom.sk	Peter Seman	user	t	{IT,SK}	2025-12-21 08:04:37.640321	$2b$10$r/eBEjoBEVFkglv8ktwWx.abGgW/nv5QlDNEGH67ZjpzZAUmUaLsC	5de3b300-6307-43bc-b64c-1f8d1da217a5	t	100	111	Peter Seaman	/uploads/avatars/avatar-1767364072812-200663631.jpg	\N	\N	local	f	+421		t	f	t
\.


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- PostgreSQL database dump complete
--

\unrestrict hWXAto1O4yVlhtlln6paIdM0xmbzyhwapeba86tjMgsXyUqJWcOieWelFAXC0En

