import type { RestaurantDetails } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import { MapPin, Phone, Utensils, Star } from "lucide-react";

interface RestaurantDetailsCardProps {
  details: RestaurantDetails;
}

export default function RestaurantDetailsCard({ details }: RestaurantDetailsCardProps) {
  return (
    <Card className="w-full overflow-hidden shadow-lg rounded-xl">
      <div className="relative h-64 w-full">
        <Image
          src={details.imageUrl}
          alt={details.name}
          layout="fill"
          objectFit="cover"
          data-ai-hint="restaurant food"
        />
      </div>
      <CardHeader className="p-6">
        <CardTitle className="text-3xl font-headline">{details.name}</CardTitle>
        <CardDescription className="text-lg text-muted-foreground font-body flex items-center mt-1">
          <Utensils className="h-5 w-5 mr-2 text-primary" /> {details.cuisine}
          {details.rating && (
            <>
              <span className="mx-2">|</span>
              <Star className="h-5 w-5 mr-1 text-yellow-400 fill-yellow-400" />
              {details.rating.toFixed(1)}
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0 font-body space-y-3">
        <p className="text-foreground/90">{details.description}</p>
        <div className="space-y-2 text-sm">
          <p className="flex items-center text-muted-foreground">
            <MapPin className="h-4 w-4 mr-2 text-primary" /> {details.address}
          </p>
          <p className="flex items-center text-muted-foreground">
            <Phone className="h-4 w-4 mr-2 text-primary" /> {details.phone}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
