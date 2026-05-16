defmodule {{PROJECT_NAME}}.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {{PROJECT_NAME}}.Repo,
      {Phoenix.PubSub, name: {{PROJECT_NAME}}.PubSub},
      {{PROJECT_NAME}}Web.Endpoint
    ]

    opts = [strategy: :one_for_one, name: {{PROJECT_NAME}}.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    {{PROJECT_NAME}}Web.Endpoint.config_change(changed, removed)
    :ok
  end
end
