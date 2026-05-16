FROM elixir:1.16-otp-26-slim AS builder
RUN apt-get update && apt-get install -y build-essential git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV MIX_ENV=prod
COPY mix.exs mix.lock ./
RUN mix local.hex --force && mix local.rebar --force && mix deps.get --only prod && mix deps.compile
COPY config config
COPY lib lib
COPY priv priv
RUN mix compile && mix release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libssl3 libncurses6 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/_build/prod/rel/{{PROJECT_NAME}} ./
ENV PHX_SERVER=true PORT=4000
EXPOSE 4000
CMD ["./bin/{{PROJECT_NAME}}", "start"]
