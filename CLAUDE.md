# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

An app that generates repository templates to bootstrap app development. Application code has not been scaffolded yet — this is a greenfield project.

## Dev Environment

Development runs inside a Docker devcontainer (`.devcontainer/`). The container is Ubuntu 24.04 with:

- **Python**: managed by `uv`, version 3.12.11, venv at `backend/.venv`
- **Node.js**: managed by `nvm` (v24), package manager is `bun`
- **Claude Code**: installed globally via npm
