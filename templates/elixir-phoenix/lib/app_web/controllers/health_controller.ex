defmodule {{PROJECT_NAME}}Web.HealthController do
  use {{PROJECT_NAME}}Web, :controller

  def index(conn, _params) do
    json(conn, %{status: "ok"})
  end
end
