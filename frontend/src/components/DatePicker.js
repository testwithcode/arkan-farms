import React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

export const DatePicker = ({ value, onChange, testId }) => {
  const dateValue = value ? new Date(value + 'T00:00:00') : undefined;

  const handleSelect = (date) => {
    if (date) {
      // Format as YYYY-MM-DD for backend
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      onChange(`${yyyy}-${mm}-${dd}`);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full px-4 py-2 glass-input rounded-xl text-left flex items-center justify-between gap-2"
          data-testid={testId}
        >
          <span className={dateValue ? 'text-white' : 'text-white/40'}>
            {dateValue ? format(dateValue, 'PPP') : 'Pick a date'}
          </span>
          <CalendarIcon className="w-4 h-4 text-white/60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-[#121410] border-white/10" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          initialFocus
          className="bg-[#121410] text-white"
        />
      </PopoverContent>
    </Popover>
  );
};
