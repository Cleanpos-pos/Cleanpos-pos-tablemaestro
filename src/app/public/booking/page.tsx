
import PublicBookingForm from "@/components/public/PublicBookingForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Utensils } from "lucide-react";

export default function PublicBookingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary/10 via-background to-background p-4 sm:p-8">
      <Card className="w-full max-w-lg shadow-2xl rounded-xl form-interaction-animate">
        <CardHeader className="text-center p-8 bg-muted/30">
          <div className="inline-block mx-auto mb-6">
             <Utensils className="w-16 h-16 text-primary" />
          </div>
          <CardTitle className="text-3xl font-headline text-foreground">Make a Reservation</CardTitle>
          <CardDescription className="font-body text-muted-foreground">
            Book your table at Our Restaurant. We look forward to serving you!
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <PublicBookingForm />
        </CardContent>
      </Card>
       <footer className="mt-12 text-center text-muted-foreground text-sm font-body">
        <p>&copy; {new Date().getFullYear()} Table Maestro V2. All rights reserved.</p>
        <p className="text-xs mt-1">Powered by Table Maestro</p>
      </footer>
    </div>
  );
}
