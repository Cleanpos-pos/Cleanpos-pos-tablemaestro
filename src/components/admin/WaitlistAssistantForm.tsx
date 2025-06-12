
"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, AlertCircle, CheckCircle, Lightbulb, Loader2 } from "lucide-react"; // Added Loader2
import { optimizeWaitlistAction, type WaitlistFormState } from "@/lib/actions"; // Updated import

const initialState: WaitlistFormState = {
  message: undefined,
  errors: undefined,
  output: undefined,
};

export default function WaitlistAssistantForm() {
  const [state, formAction] = useFormState(optimizeWaitlistAction, initialState);

  // Check if the form is in a pending state (submitting)
  // Note: React's useFormState doesn't directly expose a `pending` status like react-hook-form's `isSubmitting`.
  // We can infer pending state if there's no message and no errors yet, but this is not foolproof.
  // For a more robust solution, you might manage a separate loading state, or rely on the UI update after submission.
  // For Cloud Build, the error might be related to the initial render.

  const exampleReservationData = JSON.stringify([{ "partySize": 4, "arrivalTime": "19:00", "specialRequests": "window seat" }, { "partySize": 2, "arrivalTime": "19:30" }], null, 2);
  const exampleTableAvailability = JSON.stringify([{ "tableId": "T1", "capacity": 4, "status": "available" }, { "tableId": "T2", "capacity": 2, "status": "available" }], null, 2);
  const exampleCustomerWaitlist = JSON.stringify([{ "name": "John Doe", "partySize": 3, "arrivalTime": "18:45" }], null, 2);

  return (
    <Card className="w-full shadow-lg rounded-xl form-interaction-animate">
      <CardHeader>
        <CardTitle className="font-headline flex items-center">
          <Sparkles className="mr-3 h-6 w-6 text-accent" />
          AI Waitlist Assistant
        </CardTitle>
        <CardDescription className="font-body">
          Optimize seating arrangements and estimate wait times using AI. Provide data in JSON format.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="reservationData" className="font-body">Reservation Data (JSON)</Label>
            <Textarea
              id="reservationData"
              name="reservationData"
              rows={5}
              placeholder={exampleReservationData}
              className="font-code mt-1"
              aria-describedby="reservationDataError"
              defaultValue={''} // Ensure it's controlled from the start
            />
            {state?.errors?.reservationData && <p id="reservationDataError" className="text-sm text-destructive mt-1">{state.errors.reservationData.join(", ")}</p>}
          </div>
          <div>
            <Label htmlFor="tableAvailability" className="font-body">Table Availability (JSON)</Label>
            <Textarea
              id="tableAvailability"
              name="tableAvailability"
              rows={5}
              placeholder={exampleTableAvailability}
              className="font-code mt-1"
              aria-describedby="tableAvailabilityError"
              defaultValue={''} // Ensure it's controlled from the start
            />
            {state?.errors?.tableAvailability && <p id="tableAvailabilityError" className="text-sm text-destructive mt-1">{state.errors.tableAvailability.join(", ")}</p>}
          </div>
          <div>
            <Label htmlFor="customerWaitlist" className="font-body">Customer Waitlist (JSON)</Label>
            <Textarea
              id="customerWaitlist"
              name="customerWaitlist"
              rows={5}
              placeholder={exampleCustomerWaitlist}
              className="font-code mt-1"
              aria-describedby="customerWaitlistError"
              defaultValue={''} // Ensure it's controlled from the start
            />
            {state?.errors?.customerWaitlist && <p id="customerWaitlistError" className="text-sm text-destructive mt-1">{state.errors.customerWaitlist.join(", ")}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-4">
          <Button type="submit" className="w-full md:w-auto font-body text-lg py-3 btn-subtle-animate bg-accent hover:bg-accent/90 text-accent-foreground">
            <Lightbulb className="mr-2 h-5 w-5" /> Optimize Seating
          </Button>

          {/* Display general form errors or AI flow errors */}
          {state?.errors?._form && (
             <Alert variant="destructive">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle className="font-headline">Error</AlertTitle>
                <AlertDescription className="font-body">
                {state.errors._form.join(", ")}
                </AlertDescription>
            </Alert>
          )}

          {/* Display success message (can be combined with output display) */}
          {state?.message && !state.errors?._form && !state.errors?.customerWaitlist && !state.errors?.reservationData && !state.errors?.tableAvailability && (
            <Alert variant="default" className="bg-green-50 border-green-300">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <AlertTitle className="font-headline text-green-700">Status</AlertTitle>
              <AlertDescription className="font-body text-green-600">{state.message}</AlertDescription>
            </Alert>
          )}
          
          {/* Display AI output if available */}
          {state?.output && (
            <div className="w-full space-y-4 pt-4 border-t mt-4">
              <h3 className="text-xl font-headline text-foreground">Optimization Results:</h3>
              <Card>
                <CardHeader><CardTitle className="font-headline text-lg">Suggested Seating Arrangements</CardTitle></CardHeader>
                <CardContent>
                  <pre className="font-code bg-muted p-4 rounded-md overflow-x-auto text-sm">
                    {typeof state.output.suggestedSeatingArrangements === 'string' ? JSON.stringify(JSON.parse(state.output.suggestedSeatingArrangements), null, 2) : JSON.stringify(state.output.suggestedSeatingArrangements, null, 2)}
                  </pre>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="font-headline text-lg">Estimated Wait Times</CardTitle></CardHeader>
                <CardContent>
                  <pre className="font-code bg-muted p-4 rounded-md overflow-x-auto text-sm">
                    {typeof state.output.estimatedWaitTimes === 'string' ? JSON.stringify(JSON.parse(state.output.estimatedWaitTimes), null, 2) : JSON.stringify(state.output.estimatedWaitTimes, null, 2)}
                  </pre>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="font-headline text-lg">Predicted Occupancy Rate</CardTitle></CardHeader>
                <CardContent>
                  <p className="font-body text-2xl font-bold text-primary">{state.output.occupancyRate}%</p>
                </CardContent>
              </Card>
            </div>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}

