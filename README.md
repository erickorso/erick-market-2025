# Stock Market Simulator

The Stock Market Simulator is an interactive web application designed to provide users with a hands-on experience of stock trading without financial risk. Built using a modern frontend stack including React, TypeScript, and Tailwind CSS, this project emphasizes a clean, responsive user interface and engaging user experience.

## Core Features

*   **Dynamic Stock Listings:** Fetches and displays a list of available stocks with simulated real-time price updates and historical chart data (generated dynamically).
*   **Interactive Trading:** Users can "buy" and "sell" stocks, with transactions impacting their virtual fund and portfolio.
*   **Portfolio Management:** A dedicated "My Stocks" section allows users to track their holdings, view average purchase prices, current values, and profit/loss for each stock.
*   **Fund Tracking:** The "My Fund" page provides a clear overview of the initial capital, total amount invested, and remaining funds.
*   **Interactive Charts:** Each stock features a simple line chart (using Recharts) to visualize price trends, enhancing the decision-making process.
*   **Search Functionality:** Users can easily search for specific stocks within the application.
*   **Engaging Visuals:** The application incorporates a dynamic 3D background animated with Three.js, featuring pixel-art chess piece icons, adding a unique visual flair to the user experience.
*   **Responsive Design:** Ensures a seamless experience across various devices, from desktops to mobile phones.

## Technical Highlights

*   State management is handled efficiently using React Context API and `useReducer` for managing stock data, portfolio, and funds.
*   Routing is implemented with React Router DOM for a single-page application experience.
*   The application demonstrates good practices in component-based architecture, type safety with TypeScript, and utility-first styling with Tailwind CSS.
*   The 3D background showcases the integration of WebGL via Three.js, with custom SVG-based textures for particles, demonstrating creative UI enhancements.

This project was an excellent opportunity to combine core frontend development skills with more advanced concepts like state management, API data handling (simulated), and integrating 3D graphics for a richer user interface. It focuses on providing a functional, educational, and visually appealing simulation of stock market trading.

## Getting Started

To run this project locally:

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd stock-market-simulator
    ```
2.  **Install dependencies:**
    This project uses ES modules and imports dependencies via an import map in `index.html`. No separate `npm install` step is required for these dependencies as they are fetched by the browser. Ensure you have a modern browser.
3.  **Set up API Key (if applicable):**
    Currently, this project uses a mock API for stock data (`https://s3-ap-southeast-1.amazonaws.com/he-public-data/db12a41f8.json`) and does not require an API key for its core functionality. If a real API (like Gemini API) were integrated, you would need to set up the `API_KEY` environment variable.
4.  **Run the application:**
    Open the `index.html` file in your web browser. A simple way to do this is using a live server extension in your code editor (like Live Server for VS Code) to serve the `index.html` file.

## Project Structure

```
.
├── public/                  # Static assets (if any)
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Chart.tsx
│   │   ├── Navbar.tsx
│   │   ├── SellStockForm.tsx
│   │   ├── StockCard.tsx
│   │   ├── StockListItem.tsx
│   │   └── ThreeDBackground.tsx
│   ├── context/             # React Context for state management
│   │   └── StockContext.tsx
│   ├── pages/               # Page-level components
│   │   ├── HomePage.tsx
│   │   ├── MyFundPage.tsx
│   │   └── MyStocksPage.tsx
│   ├── services/            # API service integrations (currently minimal)
│   │   └── stockService.ts
│   ├── App.tsx              # Main application component with routing
│   ├── constants.ts         # Application constants
│   ├── index.tsx            # Entry point of the React application
│   └── types.ts             # TypeScript type definitions
├── index.html               # Main HTML file
├── metadata.json            # Application metadata
├── README.md                # This file
└── tailwind.config.js       # (Implicit, as CDN is used) Tailwind CSS configuration
```

## Technologies Used

*   **React:** For building the user interface.
*   **TypeScript:** For static typing and improved developer experience.
*   **Tailwind CSS:** For utility-first styling.
*   **React Router DOM:** For client-side routing.
*   **Recharts:** For creating interactive charts.
*   **Three.js:** For the 3D animated background.
*   **ES Modules & Import Maps:** For managing JavaScript dependencies directly in the browser.
