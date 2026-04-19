import { useListEvents, getListEventsQueryKey, useDeleteEvent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "wouter";
import { useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_OPTIONS = ["planned", "upcoming", "completed", "reconciled", "closed"] as const;
const EVENT_TYPE_OPTIONS = ["dinner", "gala", "community", "outreach", "zakat"] as const;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const initialFilters = {
  search: "",
  dateFrom: "",
  dateTo: "",
  eventType: "all",
  status: "all",
  location: "",
  attendeesMin: "",
  attendeesMax: "",
};

export default function EventsList() {
  const [filters, setFilters] = useState(initialFilters);
  const { data: events, isLoading } = useListEvents({}, { query: { queryKey: getListEventsQueryKey() } });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteEventMutation = useDeleteEvent();
  const [eventToDelete, setEventToDelete] = useState<{ id: number; name: string } | null>(null);

  const confirmDeleteEvent = () => {
    if (!eventToDelete) return;
    const { id, name } = eventToDelete;
    deleteEventMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Event deleted", description: `${name} and its related records were removed.` });
          setEventToDelete(null);
          void queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
          void queryClient.invalidateQueries();
        },
        onError: (err) => {
          toast({
            title: "Couldn't delete event",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      },
    );
  };

  const updateFilter = <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => setFilters(initialFilters);

  const eventTypeOptions = useMemo(() => {
    const set = new Set<string>(EVENT_TYPE_OPTIONS);
    events?.forEach(e => {
      if (e.eventType) set.add(e.eventType);
    });
    return Array.from(set).sort();
  }, [events]);

  const filtersActive = useMemo(
    () => Object.entries(filters).some(([k, v]) => v !== (initialFilters as Record<string, string>)[k]),
    [filters],
  );

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "planned": return "secondary";
      case "upcoming": return "default";
      case "completed": return "default";
      case "reconciled": return "outline";
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

  const filteredEvents = useMemo(() => {
    if (!events) return events;
    const searchLower = filters.search.trim().toLowerCase();
    const locationLower = filters.location.trim().toLowerCase();
    const fromTime = filters.dateFrom ? new Date(filters.dateFrom).getTime() : null;
    const toTime = filters.dateTo ? new Date(filters.dateTo).getTime() : null;
    const minAttendees = filters.attendeesMin === "" ? null : Number(filters.attendeesMin);
    const maxAttendees = filters.attendeesMax === "" ? null : Number(filters.attendeesMax);

    return events.filter(e => {
      if (searchLower) {
        const inName = e.name.toLowerCase().includes(searchLower);
        const inLocation = (e.location ?? "").toLowerCase().includes(searchLower);
        if (!inName && !inLocation) return false;
      }
      if (fromTime !== null) {
        const eventTime = new Date(e.date).getTime();
        if (Number.isFinite(eventTime) && eventTime < fromTime) return false;
      }
      if (toTime !== null) {
        const eventTime = new Date(e.date).getTime();
        const endOfDay = toTime + 24 * 60 * 60 * 1000 - 1;
        if (Number.isFinite(eventTime) && eventTime > endOfDay) return false;
      }
      if (filters.eventType !== "all" && e.eventType !== filters.eventType) return false;
      if (filters.status !== "all" && e.status !== filters.status) return false;
      if (locationLower && !(e.location ?? "").toLowerCase().includes(locationLower)) return false;

      const attendees = e.attendeeCount ?? 0;
      if (minAttendees !== null && !Number.isNaN(minAttendees) && attendees < minAttendees) return false;
      if (maxAttendees !== null && !Number.isNaN(maxAttendees) && attendees > maxAttendees) return false;

      return true;
    });
  }, [events, filters]);

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
        <CardHeader className="pb-3 space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search events by name or location..."
              className="pl-8 max-w-md"
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              data-testid="filter-search"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="filter-date-from" className="text-xs">Date from</Label>
              <Input
                id="filter-date-from"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter("dateFrom", e.target.value)}
                data-testid="filter-date-from"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-date-to" className="text-xs">Date to</Label>
              <Input
                id="filter-date-to"
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter("dateTo", e.target.value)}
                data-testid="filter-date-to"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={filters.eventType} onValueChange={(v) => updateFilter("eventType", v)}>
                <SelectTrigger data-testid="filter-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {eventTypeOptions.map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
                <SelectTrigger data-testid="filter-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-location" className="text-xs">Location</Label>
              <Input
                id="filter-location"
                placeholder="Filter by location"
                value={filters.location}
                onChange={(e) => updateFilter("location", e.target.value)}
                data-testid="filter-location"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-attendees-min" className="text-xs">Attendees min</Label>
              <Input
                id="filter-attendees-min"
                type="number"
                min={0}
                placeholder="0"
                value={filters.attendeesMin}
                onChange={(e) => updateFilter("attendeesMin", e.target.value)}
                data-testid="filter-attendees-min"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-attendees-max" className="text-xs">Attendees max</Label>
              <Input
                id="filter-attendees-max"
                type="number"
                min={0}
                placeholder="—"
                value={filters.attendeesMax}
                onChange={(e) => updateFilter("attendeesMax", e.target.value)}
                data-testid="filter-attendees-max"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                disabled={!filtersActive}
                className="w-full"
                data-testid="filter-clear"
              >
                Clear filters
              </Button>
            </div>
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
                    <TableHead className="text-right">Raised</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {filtersActive ? "No events match your filters" : "No events found"}
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
                        <TableCell className="text-right tabular-nums" data-testid={`event-attendees-${event.id}`}>
                          {event.attendeeCount ?? 0}
                        </TableCell>
                        <TableCell className="text-right tabular-nums" data-testid={`event-raised-${event.id}`}>
                          {currencyFormatter.format(event.totalRaised ?? 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEventToDelete({ id: event.id, name: event.name });
                            }}
                            aria-label={`Delete ${event.name}`}
                            data-testid={`button-delete-event-${event.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      <AlertDialog open={eventToDelete !== null} onOpenChange={(open) => { if (!open) setEventToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-semibold">{eventToDelete?.name}</span> along with its attendees, donations, logistics tasks, revenue entries, fund allocations, and reconciliation record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEventMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDeleteEvent(); }}
              disabled={deleteEventMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-event"
            >
              {deleteEventMutation.isPending ? "Deleting…" : "Delete event"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
