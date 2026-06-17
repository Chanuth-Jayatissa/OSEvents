# OSEvents

OSEvents is an event planning workspace powered by specialized AI agents. The app is structured around an EventOS-style workflow where different agents help with project timelines, compliance, sponsor research, finance, marketing, communications, and event context gathering.

## Features

- Auth-protected React app shell with EventOS loading and dashboard flow.
- Python backend agents for project management, compliance, finance, marketing, sponsors, communications, and context research.
- Timeline builder that converts natural language event goals into milestones and tasks.
- Compliance-aware planning flow that can cross-reference extracted venue rules.
- Agent logging/contracts for structured results and domain-specific outputs.
- Frontend test setup with Vitest and Playwright dependencies.

## Tech Stack

- React, TypeScript, Vite, Tailwind CSS
- Radix UI and shadcn-style components
- Python and FastAPI-oriented backend modules
- Gemini API via google-genai
- Playwright, Vitest, and Testing Library

## Project Structure

- src/App.tsx - frontend route shell and protected route handling
- backend/agents - specialized event planning agents
- backend/core - contracts, auth, and master orchestration code
- backend/db - backend data access layer
- backend/.env.example - backend environment example

## Getting Started

Install frontend dependencies:

~~~bash
npm install
npm run dev
~~~

Install backend dependencies from the backend directory:

~~~bash
pip install -r backend/requirements.txt
~~~

Set backend environment variables as needed for agent integrations:

~~~bash
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CSE_API_KEY=your_google_custom_search_key
API_KEY=your_backend_or_provider_key
~~~

## Useful Commands

~~~bash
npm run dev
npm run build
npm run lint
npm run test
~~~

## Status

Active prototype with a strong multi-agent architecture. The previous README was a placeholder; this project should be treated as a high-value portfolio candidate once setup and screenshots are polished.
