
````markdown
# 🧠 ADHD Productivity Platform - Backend API

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> A backend RESTful API specifically designed for an ADHD productivity platform. It provides highly available focus time management, task tracking, and multi-dimensional data analytics to help users build positive feedback loops.

## ✨ Core Features

- **Focus Tracking**: Accurately records focus/Pomodoro sessions, with built-in support for logging interruptions.
- **Data Analytics**: Provides daily and weekly focus statistics to help users visualize their progress.
- **Type Safety**: Built with TypeScript and Prisma, ensuring end-to-end type safety from the database to API responses.
- **Separation of Concerns**: Utilizes a classic Controller-Service-Route architecture for maximum scalability and maintainability.

---

## 📂 Backend Structure

Following the principles of high cohesion and low coupling, all core code is located in the `src/` directory:

```text
src/
├── prisma/         # 🗄️ Database connection & Prisma Client instantiation
│   └── index.ts    # Global singleton for Prisma Client
├── routes/         # 🛣️ Routing Layer
│   ├── focus.ts    # Route definitions for focus-related endpoints
│   └── index.ts    # Main router entry, combining all module routes
├── controllers/    # 🎮 HTTP Layer (Controllers)
│   └── focus.ts    # Parses Req/Res, validates inputs, calls Services
├── services/       # ⚙️ Business Logic Layer
│   └── focus.ts    # Core business logic and Prisma CRUD operations
├── utils/          # 🛠️ Utilities
│   ├── logger.ts   # Custom logging wrapper
│   └── error.ts    # Global error handling and custom error classes
└── app.ts          # 🚀 Main application entry, Express & middleware setup
````

-----

## 🔌 API Design & Documentation

*Base URL: `http://localhost:3000/api`*

### 1\. Start Focus

Creates a new focus session.

  - **Endpoint**: `POST /focus/start`
  - **Headers**: `Authorization: Bearer <token>`
  - **Request Body**:
    ```json
    {
      "userId": "uuid-string",
      "taskName": "Deep Reading",
      "durationGoal": 25,     // Target duration in minutes
      "focusType": "POMODORO" // POMODORO | STOPWATCH
    }
    ```
  - **Response (201 Created)**:
    ```json
    {
      "success": true,
      "data": {
        "sessionId": "session-uuid",
        "startTime": "2023-10-25T10:00:00.000Z",
        "status": "IN_PROGRESS"
      }
    }
    ```

### 2\. End Focus

Ends the current focus session and calculates the actual duration and points earned.

  - **Endpoint**: `POST /focus/end`
  - **Headers**: `Authorization: Bearer <token>`
  - **Request Body**:
    ```json
    {
      "sessionId": "session-uuid",
      "endTime": "2023-10-25T10:25:00.000Z",
      "interruptions": 1,         // Number of times interrupted
      "completionStatus": "DONE"  // DONE | ABORTED
    }
    ```
  - **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "sessionId": "session-uuid",
        "actualDuration": 25,     // Actual completed minutes
        "pointsEarned": 50,       // Reward points earned
        "message": "Congratulations on completing your session!"
      }
    }
    ```

### 3\. Get Focus Stats

Retrieves user focus statistics for charts and dashboards.

  - **Endpoint**: `GET /focus/stats/:userId`
  - **Query Params**: `?range=weekly` (optional: daily, weekly, monthly)
  - **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "totalFocusMinutes": 150,
        "completedSessions": 6,
        "abortedSessions": 1,
        "mostFocusedTask": "Deep Reading"
      }
    }
    ```

-----

## 🚀 Getting Started

### 1\. Prerequisites

  - [Node.js](https://nodejs.org/) (v16.x or higher)
  - [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
  - PostgreSQL or MySQL database running locally or remotely

### 2\. Installation

Clone the repository and navigate into the directory:

```bash
git clone [https://github.com/your-username/adhd-productivity-backend.git](https://github.com/your-username/adhd-productivity-backend.git)
cd adhd-productivity-backend
```

Install dependencies:

```bash
npm install
```

Set up environment variables:
Copy the `.env.example` file, rename it to `.env`, and fill in your local configuration:

```bash
cp .env.example .env
```

*Example `.env` content:*

```env
# Server
PORT=3000
NODE_ENV=development

# Database (Prisma)
DATABASE_URL="postgresql://user:password@localhost:5432/adhd_db?schema=public"

# Security
JWT_SECRET="your-super-secret-key"
```

### 3\. Database Setup

Use Prisma to generate the client and sync the database schema:

```bash
# Generate Prisma Client
npx prisma generate

# Push schema to the database (Recommended for development)
npx prisma db push

# (Optional) Seed the database with test data
npx prisma db seed
```

### 4\. Running the App

Start the development server (with hot-reloading):

```bash
npm run dev
```

Once started, the console will output: `🚀 Server is running on http://localhost:3000`

-----

## 📜 Available Scripts

In the project directory, you can run:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the dev server using `ts-node-dev` or `nodemon` with hot-reloading. |
| `npm run build` | Compiles TypeScript code into production-ready JavaScript in the `dist/` folder. |
| `npm run start` | Runs the compiled code for production (`node dist/app.js`). |
| `npm run lint` | Runs ESLint to catch code style issues. |
| `npm run format` | Runs Prettier to format all code. |



## 📄 License

Distributed under the [MIT License](https://www.google.com/search?q=LICENSE).

```
