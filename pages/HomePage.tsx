import React from 'react';
import StockCard from '../components/StockCard';
import { useStockContext } from '../context/StockContext';
import { EnrichedStock } from '../types';
import ThreeDBackground from '../components/ThreeDBackground'; // Import the new component

const HomePage: React.FC = () => {
  const { state } = useStockContext();
  const { allStocks, isLoading, error, searchTerm } = state;

  const filteredStocks = allStocks.filter(stock =>
    stock.company.toLowerCase().includes(searchTerm.toLowerCase()) // Changed from stock.name
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        {/* Optional: Add ThreeDBackground here too if desired for loading state */}
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <ThreeDBackground />
        <div className="text-center text-red-500 p-8 text-xl relative z-10">Error loading stocks: {error}</div>
      </>
    );
  }
  
  // Log the filtered stocks data before rendering
  console.log('Filtered Stocks Data (HomePage):', JSON.stringify(filteredStocks, null, 2));

  return (
    <>
      <ThreeDBackground />
      <div className="container mx-auto p-4 sm:p-6 relative z-10"> {/* Ensure content is above background */}
        <h1 className="text-3xl sm:text-4xl font-bold text-center text-teal-400 mb-8">Available Stocks</h1>
        {filteredStocks.length === 0 && !isLoading ? (
          <div className="text-center text-gray-400 p-8 text-xl">No stocks found matching your criteria.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredStocks.map((stock: EnrichedStock) => (
              <StockCard key={stock.id} stock={stock} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default HomePage;