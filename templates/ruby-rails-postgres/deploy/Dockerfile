FROM ruby:3.3-slim AS base
RUN apt-get update && apt-get install -y build-essential libpq-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY Gemfile Gemfile.lock ./
RUN bundle install --without development test

COPY . .
RUN bundle exec bootsnap precompile --gemfile app/ lib/

ENV RAILS_ENV=production RAILS_LOG_TO_STDOUT=true
EXPOSE 3000
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
