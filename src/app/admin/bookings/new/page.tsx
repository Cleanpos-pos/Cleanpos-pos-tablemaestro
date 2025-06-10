
"use client";

import AdminBookingForm from "@/components/admin/AdminBookingForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NewBookingPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="btn-subtle-animate">
          <Link href="/admin/bookings">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Bookings</span>
          </Link>
        </Button>
        <h1 className="text-3xl font-headline text-foreground">Add New Booking</h1>
      </div>
      
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline">Create a Reservation</CardTitle>
          <CardDescription className="font-body">
            Manually enter booking details for a new reservation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminBookingForm />
        </CardContent>
      </Card>
    </div>
  );
}
