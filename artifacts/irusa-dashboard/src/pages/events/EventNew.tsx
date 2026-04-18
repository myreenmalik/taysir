import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateEvent } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const eventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  date: z.string().min(1, "Date is required"),
  location: z.string().min(1, "Location is required"),
  masjidPartner: z.string().optional(),
  eventType: z.string().min(1, "Event type is required"),
  campaign: z.string().optional(),
  organizer: z.string().optional(),
  status: z.string().min(1, "Status is required"),
  estimatedAttendees: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

type EventFormValues = z.infer<typeof eventSchema>;

export default function EventNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createEvent = useCreateEvent();

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: "",
      date: new Date().toISOString().split("T")[0],
      location: "",
      masjidPartner: "",
      eventType: "dinner",
      campaign: "",
      organizer: "",
      status: "planned",
      estimatedAttendees: 0,
      notes: "",
    },
  });

  const onSubmit = (data: EventFormValues) => {
    createEvent.mutate(
      { data },
      {
        onSuccess: (event) => {
          toast({ title: "Event created", description: "The event has been successfully created." });
          setLocation(`/events/${event.id}`);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create event. Please try again.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Event</h1>
        <p className="text-muted-foreground">Plan and setup a new fundraising event.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>Fill out the basic information for the new event.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Event Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Annual Fundraising Dinner" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="eventType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select event type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="dinner">Dinner</SelectItem>
                          <SelectItem value="iftar">Iftar</SelectItem>
                          <SelectItem value="gala">Gala</SelectItem>
                          <SelectItem value="community">Community</SelectItem>
                          <SelectItem value="outreach">Outreach</SelectItem>
                          <SelectItem value="zakat">Zakat</SelectItem>
                          <SelectItem value="emergency">Emergency Response</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Venue Name, City, State" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="masjidPartner"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Masjid Partner (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Islamic Center of..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="reconciled">Reconciled</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="campaign"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campaign (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Ramadan 2025" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estimatedAttendees"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Attendees (Optional)</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any additional details or context..." className="resize-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => setLocation("/events")}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createEvent.isPending}>
                  {createEvent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Event
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}