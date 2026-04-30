<img width="1536" height="1024" alt="investnest-logo" src="https://github.com/user-attachments/assets/adf1613f-62fd-4727-874b-770ef1700b80" />


# InvestNest for CS 1530
> Track · Budget · Grow

InvestNest is a personal finance web-application designed to help users manage budgets, track expenses, monitor assets, and view their overall net worth in one place. Its main purpose is to replace user-unfriendly manual methods like spreadsheets, banking apps, and finance websites with a single system that gives users a clearer and more accurate picture of their financial situation. The project also aims to improve decision-making by providing budget progress visuals, dashboard summaries, stock watchlists, and notifications for important financial events. InvestNest is meant to make personal finance tracking simpler, faster, and more organized for everyday users.

InvestNest is built for CS1530 during the Spring of 2026.

**Live site:** https://investnest-one.vercel.app  
**API:** https://investnest-3e4i.onrender.com  
**Team:** David Lindsey, Vladimir Deianov, Sean Morisoli, Lucas Loepke, Ian O'Leary, James Heffernan

| Layer | Team Member |
|---|---|
| Frontend | Lucas Loepke |
| Backend | James Heffernan + Ian O'Leary |
| Database | Vladimir Deianov |
| Authentication | James Heffernan |
| Stock Market API | Ian O'Leary |
| Frontend Deployment | Lucas Loepke |
| Backend Deployment | Sean Morisoli |
| Uptime Monitoring | Sean Morisoli |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Authentication | JWT + bcrypt |
| Stock Market API | Alpha Vantage |
| Frontend Deployment | Vercel |
| Backend Deployment | Render |
| Uptime Monitoring | UptimeRobot |

---

## Features

### Expense Tracker
An expense tracking page that lets users log and manage individual expenses. Users can create entries with an amount, category, and type, and view all recorded expenses in one place.

### Expense Type Dropdown
The expense entry form includes a dropdown selector for expense type, allowing users to categorize expenses consistently rather than entering free-form text.

### Logout
The top navigation bar includes a logout button that ends the user's session and redirects them to the login page.

### Stock Ticker API
Integrates with the Alpha Vantage API to display real-time and historical stock data on the assets page. Users can look up stock symbols and view current pricing information to inform asset tracking decisions.

### Asset Page
A dedicated page for managing user assets. Displays a list of assets with their values and shows a total net worth summary. UI matches the design language of the rest of the application.

### Budget Management
Users can create budgets with a name, total amount, start date, and end date. Each budget tracks spending against the total and displays progress. Budgets update in real time as new expenses and categories are added.

### Dashboard
A summary view showing the user's overall financial picture, including net worth, budget progress, and asset totals at a glance.

### Authentication
Users can register for an account and log in securely. Passwords are hashed with bcrypt and sessions are managed via JSON Web Tokens (JWT).

---

## Setup & Installation

### Prerequisites
- Node.js (v18+)
- PostgreSQL
- An Alpha Vantage API key (free at https://www.alphavantage.co)

### Clone the Repository
```bash
git clone https://github.com/lucasloepke/investnest.git
cd investnest
```

### Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:
```
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_jwt_secret
ALPHA_VANTAGE_API_KEY=your_api_key
```

Start the backend server:
```bash
npm start
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173` by default.

---

## Deployment

The frontend is deployed on **Vercel** and automatically rebuilds on pushes to `main`. The backend runs on **Render**'s free tier. **UptimeRobot** pings the backend every 5 minutes to prevent the free tier's inactivity timeout, keeping the live demo available at all times.
