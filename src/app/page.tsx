
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Utensils, LogIn, CalendarPlus, Rocket, UserPlus, Camera } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getPublicRestaurantSettings } from "@/services/settingsService";

export default async function HomePage() {
  const settings = await getPublicRestaurantSettings();
  const galleryImageUrls = settings?.restaurantGalleryUrls?.filter(url => url !== null) as string[] || [];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 sm:p-8">
      <div className="space-y-8 w-full max-w-md">
        <Card className="shadow-2xl rounded-xl overflow-hidden">
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

        <Card className="shadow-2xl rounded-xl overflow-hidden">
          <CardHeader className="bg-secondary text-center p-8">
            <div className="flex justify-center mb-4">
              <Rocket className="w-16 h-16 text-secondary-foreground" />
            </div>
            <h2 className="text-3xl font-headline text-secondary-foreground">Get Your Own Table Maestro</h2>
            <CardDescription className="text-secondary-foreground/80 mt-2 font-body">
              Take control of your restaurant's table bookings and waitlist with your own dedicated system.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <p className="text-center text-muted-foreground font-body">
              Empower your restaurant with seamless booking management, AI-powered waitlist optimization, and insightful analytics.
            </p>
            <Link href="/signup" passHref>
              <Button variant="default" className="w-full h-12 text-base btn-subtle-animate bg-primary hover:bg-primary/90 text-primary-foreground">
                <UserPlus className="mr-2 h-5 w-5" />
                Sign Up Now
              </Button>
            </Link>
             <p className="text-xs text-center text-muted-foreground font-body">
              Start managing your restaurant bookings efficiently today!
            </p>
          </CardContent>
        </Card>

        {/* Food Gallery Section */}
        <Card className="shadow-2xl rounded-xl overflow-hidden">
          <CardHeader className="bg-muted text-center p-8">
            <div className="flex justify-center mb-4">
              <Camera className="w-16 h-16 text-muted-foreground" />
            </div>
            <h2 className="text-3xl font-headline text-foreground">View Our Food Gallery</h2>
            <CardDescription className="text-muted-foreground/80 mt-2 font-body">
              A glimpse of the culinary delights awaiting you.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            {galleryImageUrls.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {galleryImageUrls.slice(0, 4).map((url, index) => (
                  <div key={index} className="rounded-lg overflow-hidden shadow-md aspect-square">
                    <Image
                      src={url}
                      alt={`Restaurant gallery image ${index + 1}`}
                      width={300}
                      height={300}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      data-ai-hint="restaurant food" 
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground font-body py-4">
                The restaurant's photo gallery is not available at the moment. Please check back later or visit the restaurant to see our offerings!
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <footer className="mt-12 text-center text-muted-foreground text-sm font-body">
        <p>&copy; {new Date().getFullYear()} Table Maestro V2. All rights reserved.</p>
        {settings?.restaurantName && <p className="text-xs">Proudly serving: {settings.restaurantName}</p>}
      </footer>
    </div>
  );
}
