import Config

config :{{PROJECT_NAME}},
  ecto_repos: [{{PROJECT_NAME}}.Repo]

config :{{PROJECT_NAME}}, {{PROJECT_NAME}}Web.Endpoint,
  url: [host: "localhost"],
  render_errors: [
    formats: [json: {{PROJECT_NAME}}Web.ErrorJSON],
    layout: false
  ],
  pubsub_server: {{PROJECT_NAME}}.PubSub,
  live_view: [signing_salt: "changeme"]

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"
