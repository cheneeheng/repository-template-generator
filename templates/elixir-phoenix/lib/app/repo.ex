defmodule {{PROJECT_NAME}}.Repo do
  use Ecto.Repo,
    otp_app: :{{PROJECT_NAME}},
    adapter: Ecto.Adapters.Postgres
end
