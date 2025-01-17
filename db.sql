CREATE TABLE public.users (
	id uuid DEFAULT uuid_generate_v4() NOT NULL,
	"name" varchar(255) NOT NULL,
	email varchar(255) NOT NULL,
	password_hash varchar(255) NULL,
	profile_picture_url text NULL,
	created_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
	google_oauth_id varchar NULL,
	facebook_oauth_id varchar NULL,
	verified bool DEFAULT false NULL,
	CONSTRAINT users_email_key UNIQUE (email),
	CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_users_email ON public.users USING btree (email);

CREATE TABLE public.sessions (
	id uuid DEFAULT uuid_generate_v4() NOT NULL,
	user_id uuid NOT NULL,
	"token" text NOT NULL,
	created_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
	expires_at timestamptz NOT NULL,
	last_activity timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT sessions_pkey PRIMARY KEY (id),
	CONSTRAINT sessions_token_key UNIQUE (token),
	CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_sessions_token ON public.sessions USING btree (token);
CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);

CREATE TABLE public.login_history (
	id uuid DEFAULT uuid_generate_v4() NOT NULL,
	user_id uuid NOT NULL,
	logged_in_at timestamptz DEFAULT CURRENT_TIMESTAMP NULL,
	logged_out_at timestamptz NULL,
	ip_address inet NULL,
	user_agent text NULL,
	CONSTRAINT login_history_pkey PRIMARY KEY (id),
	CONSTRAINT login_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_login_history_logged_in_at ON public.login_history USING btree (logged_in_at);
CREATE INDEX idx_login_history_user_id ON public.login_history USING btree (user_id);