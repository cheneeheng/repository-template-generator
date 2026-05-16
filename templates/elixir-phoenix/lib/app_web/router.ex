defmodule {{PROJECT_NAME}}Web.Router do
  use {{PROJECT_NAME}}Web, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", {{PROJECT_NAME}}Web do
    pipe_through :api

    get "/health", HealthController, :index
    resources "/items", ItemController, except: [:new, :edit]
  end
end
