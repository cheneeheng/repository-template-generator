import Config

config :{{PROJECT_NAME}}, {{PROJECT_NAME}}Web.Endpoint,
  url: [host: System.get_env("PHX_HOST", "example.com"), port: 443, scheme: "https"],
  http: [ip: {0, 0, 0, 0}, port: {:system, "PORT"}],
  secret_key_base: System.fetch_env!("SECRET_KEY_BASE"),
  cache_static_manifest: "priv/static/cache_manifest.json"

config :{{PROJECT_NAME}}, {{PROJECT_NAME}}.Repo,
  url: System.fetch_env!("DATABASE_URL"),
  pool_size: String.to_integer(System.get_env("POOL_SIZE", "10")),
  ssl: true

config :logger, level: :info
