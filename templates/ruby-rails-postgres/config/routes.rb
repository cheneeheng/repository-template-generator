Rails.application.routes.draw do
  get "/health", to: "health#index"

  namespace :api do
    namespace :v1 do
      resources :items, only: [:index, :show, :create, :update, :destroy]
    end
  end
end
