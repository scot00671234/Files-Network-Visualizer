# Epstein Files Network Visualizer

A reactive graph visualization of entities and relationships from the Epstein Files, sourced via LittleSis API.

## 🚀 Deployment (Dokploy / Nixpacks)

1.  **Repository**: Connect this repo to Dokploy.
2.  **Build Engine**: Select **Nixpacks**.
3.  **Environment Variables**:
    *   `DATABASE_URL`: Your PostgreSQL connection string (e.g., `postgres://user:pass@host:5432/db`).
    *   `PORT`: `3000` (Optional, defaults to 3000).

## 🛠 Local Development

1.  `npm install` (Installs both client and server dependencies)
2.  `npm run dev` (Starts both client and server in watch mode)

## 🏗 Architecture

*   **Frontend**: React + Vite + react-force-graph-2d
*   **Backend**: Node.js + Express + PostgreSQL
*   **Data Source**: LittleSis API (Ingestor runs automatically if DB is empty)
