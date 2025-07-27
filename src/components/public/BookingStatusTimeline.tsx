
import { CheckCircle, Clock, Utensils, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Booking } from "@/lib/types";

interface BookingStatusTimelineProps {
  currentStatus: Booking['status'];
}

const statusSteps = [
  { id: 'pending', label: 'Pending', icon: Clock, description: "Request received" },
  { id: 'confirmed', label: 'Confirmed', icon: CheckCircle, description: "Reservation confirmed" },
  { id: 'seated', label: 'Seated', icon: Utensils, description: "Guest is seated" }
];

const cancelledStep = {
  id: 'cancelled',
  label: 'Cancelled',
  icon: Ban,
  description: "Reservation cancelled"
};

const BookingStatusTimeline = ({ currentStatus }: BookingStatusTimelineProps) => {
  const currentStatusIndex = statusSteps.findIndex(step => step.id === currentStatus);

  if (currentStatus === 'cancelled') {
    return (
      <div className="flex items-center justify-center space-x-4 p-4 border-2 border-dashed border-destructive rounded-lg bg-destructive/10">
        <cancelledStep.icon className="w-10 h-10 text-destructive" />
        <div>
          <h3 className="font-headline text-lg text-destructive">{cancelledStep.label}</h3>
          <p className="font-body text-sm text-destructive/80">{cancelledStep.description}</p>
        </div>
      </div>
    );
  }
  
  if (currentStatus === 'completed') {
    return (
      <div className="flex items-center justify-center space-x-4 p-4 border-2 border-dashed border-green-600 rounded-lg bg-green-600/10">
        <CheckCircle className="w-10 h-10 text-green-600" />
        <div>
          <h3 className="font-headline text-lg text-green-700">Completed</h3>
          <p className="font-body text-sm text-green-600/80">Thank you for dining with us!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ol className="relative grid grid-cols-3 text-sm font-medium text-gray-500">
        {statusSteps.map((step, index) => {
          const isCompleted = index < currentStatusIndex;
          const isCurrent = index === currentStatusIndex;
          const isFuture = index > currentStatusIndex;

          return (
            <li key={step.id} className={cn("relative flex items-center justify-start", 
              index < statusSteps.length -1 && "pr-12",
              index > 0 && "justify-center",
              index === statusSteps.length -1 && "justify-end"
            )}>
              {/* Line Connector */}
              {index < statusSteps.length - 1 && (
                <div className={cn("absolute top-1/2 -right-6 hidden h-0.5 w-full -translate-y-1/2 sm:block",
                    isCompleted || isCurrent ? "bg-primary" : "bg-gray-200"
                )}></div>
              )}
              
              <div className="flex flex-col items-center text-center">
                 <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-white",
                  isCompleted ? "bg-primary" :
                  isCurrent ? "bg-accent ring-4 ring-accent/30" :
                  "bg-gray-300"
                )}>
                  <step.icon className="h-6 w-6" />
                </div>
                <div className="mt-2">
                    <h3 className={cn("font-headline",
                      isCurrent ? "text-accent-foreground font-bold" : isCompleted ? "text-primary" : "text-muted-foreground"
                    )}>{step.label}</h3>
                    <p className="text-xs font-body text-muted-foreground">{step.description}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default BookingStatusTimeline;
