import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

const MonthPicker = ({ value, onChange, className }: MonthPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(() => {
    const [year] = value.split('-').map(Number);
    return year;
  });
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMonthSelect = (month: number) => {
    const newValue = `${currentYear}-${String(month + 1).padStart(2, '0')}`;
    onChange(newValue);
    setIsOpen(false);
  };

  const handleYearChange = (direction: 'prev' | 'next') => {
    setCurrentYear(prev => prev + (direction === 'prev' ? -1 : 1));
  };

  const [selectedYear, selectedMonth] = value.split('-').map(Number);
  const selectedMonthName = MONTHS[selectedMonth - 1];

  return (
    <div ref={pickerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-muted/40 border border-border/50 rounded-lg px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors duration-200"
      >
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-card-foreground">
          {selectedMonthName} {selectedYear}
        </span>
        <ChevronDown 
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-300",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      <div
        className={cn(
          "absolute top-full left-0 mt-1 bg-card border border-border/50 rounded-lg shadow-soft z-50 w-[200px]",
          "transition-dropdown",
          isOpen 
            ? "opacity-100 transform translate-y-0 scale-100" 
            : "opacity-0 transform -translate-y-2 scale-95 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-2 border-b border-border/30">
          <button
            onClick={() => handleYearChange('prev')}
            className="p-1 rounded-md hover:bg-muted/50 transition-colors"
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground rotate-90" />
          </button>
          <span className="font-semibold text-card-foreground text-sm">
            {currentYear}
          </span>
          <button
            onClick={() => handleYearChange('next')}
            className="p-1 rounded-md hover:bg-muted/50 transition-colors"
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground -rotate-90" />
          </button>
        </div>

        {/* Months Grid */}
        <div className="grid grid-cols-3 gap-1 p-2">
          {MONTHS.map((month, index) => (
            <button
              key={month}
              onClick={() => handleMonthSelect(index)}
              className={cn(
                "px-1 py-2 text-xs rounded-md transition-all duration-200 w-full h-8 flex items-center justify-center",
                "hover:bg-muted/50 hover:text-card-foreground",
                currentYear === selectedYear && index === selectedMonth - 1
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              <span className="truncate">{month}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export { MonthPicker };
