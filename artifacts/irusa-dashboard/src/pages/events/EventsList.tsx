import { useListEvents, getListEventsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useState } from "react";
import { Search } from "lucide-react";

export default function EventsList() {
  const [search, setSearch] = useState("");
  const { data: events, isLoading } = useListEvents({}, { query: { queryKey: getListEventsQueryKey() } });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "planned": return "secondary";
      case "upcoming": return "default";
      case "completed": return "default"; // green would be better
      case "reconciled": return "outline"; // teal
      case "closed": return "outline";
      default: return "outline";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "planned": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      case "upcoming": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "completed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "reconciled": return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300";
      case "closed": return "bg-gray-800 text-gray-100 dark:bg-gray-200 dark:text-gray-800";
      default: return "";
    }
  };

  const filteredEvents = events?.filter(e => 
    e.name.toLowerCase().includes(search.toLowerCase()) || 
    e.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground">Manage and track all fundraising events.</p>
        </div>
        <Link href="/events/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
          New Event
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search events by name or location..."
              className="pl-8 max-w-md"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading events...</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Attendees</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No events found matching "{search}"
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEvents?.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">
                          <Link href={`/events/${event.id}`} className="hover:underline">
                            {event.name}
                          </Link>
                        </TableCell>
                        <TableCell>{new Date(event.date).toLocaleDateString()}</TableCell>
                        <TableCell className="capitalize">{event.eventType}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(event.status)} className={getStatusBadgeColor(event.status)}>
                            {event.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{event.location}</TableCell>
                        <TableCell className="text-right">
                          {event.actualAttendees ?? event.estimatedAttendees ?? 0}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}