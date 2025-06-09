import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Utensils, LogIn, CalendarPlus } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 sm:p-8">
      <Card className="w-full max-w-md shadow-2xl rounded-xl overflow-hidden">
        <CardHeader className="bg-primary text-center p-8">
          <div className="flex justify-center mb-4">
            <Utensils className="w-16 h-16 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-headline text-primary-foreground">Table Maestro V2</h1>
          <CardDescription className="text-primary-foreground/80 mt-2 font-body">
            Your ultimate solution for restaurant booking and waitlist optimization.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <p className="text-center text-muted-foreground font-body">
            Welcome to Table Maestro V2. Choose your path below to get started.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/public/booking" passHref>
              <Button variant="default" className="w-full h-12 text-base btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground">
                <CalendarPlus className="mr-2 h-5 w-5" />
                Make a Reservation
              </Button>
            </Link>
            <Link href="/admin/login" passHref>
              <Button variant="outline" className="w-full h-12 text-base btn-subtle-animate">
                <LogIn className="mr-2 h-5 w-5" />
                Admin Login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      <footer className="mt-12 text-center text-muted-foreground text-sm font-body">
        <p>&copy; {new Date().getFullYear()} Table Maestro V2. All rights reserved.</p>
      </footer>
    </div>
  );
}
