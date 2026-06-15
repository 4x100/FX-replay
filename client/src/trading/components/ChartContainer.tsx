import  { forwardRef } from 'react';

interface ChartContainerProps {
    isLoading: boolean;
}

export const ChartContainer = forwardRef<HTMLDivElement, ChartContainerProps>(
    ({ isLoading }, ref) => (
        <div className="flex-1 relative w-full h-full overflow-hidden bg-[#0b0e14]">
            <div ref={ref} className="absolute inset-0 z-0" />

            {isLoading && (
                <div className="absolute inset-0 flex justify-center items-center z-10 bg-[#0b0e14]/50 backdrop-blur-sm transition-all duration-300">
                    <div className="bg-[#1e222d] border border-[#2a2e39] px-6 py-3 rounded-lg shadow-2xl flex items-center space-x-3">
                        <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <p className="animate-pulse text-gray-300 font-semibold tracking-widest text-sm">LOADING...</p>
                    </div>
                </div>
            )}
        </div>
    )
);

ChartContainer.displayName = 'ChartContainer';