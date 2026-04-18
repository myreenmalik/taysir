import { useGetDashboardSummary, useGetDashboardAlerts, useGetDonorSegments, useGetTopEvents, getGetDashboardSummaryQueryKey, getGetDashboardAlertsQueryKey, getGetDonorSegmentsQueryKey, getGetTopEventsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, Info, ArrowRight, DollarSign, Users, Calendar, AlertOctagon } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: alerts, isLoading: loadingAlerts } = useGetDashboardAlerts({ query: { queryKey: getGetDashboardAlertsQueryKey() } });
  const { data: donorSegments, isLoading: loadingSegments } = useGetDonorSegments({ query: { queryKey: getGetDonorSegmentsQueryKey() } });
  const { data: topEvents, isLoading: loadingTopEvents } = useGetTopEvents({ query: { queryKey: getGetTopEventsQueryKey() } });

  if (loadingSummary || loadingAlerts || loadingSegments || loadingTopEvents) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading dashboard data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back. Here's what's happening today.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/events/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
            New Event
          </Link>
          <Link href="/donors/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
            New Donor
          </Link>
        </div>
      </div>

      {alerts && alerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Active Alerts</h2>
          <div className="grid gap-3">
            {alerts.map((alert) => (
              <Alert key={alert.id} variant={alert.severity === "critical" ? "destructive" : "default"} className={alert.severity === "warning" ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200" : ""}>
                {alert.severity === "critical" && <AlertCircle className="h-4 w-4" />}
                {alert.severity === "warning" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                {alert.severity === "info" && <Info className="h-4 w-4" />}
                <AlertTitle className="capitalize">{alert.type.replace("-", " ")}</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>{alert.message} {alert.entityName && <span className="font-medium">({alert.entityName})</span>}</span>
                  {(alert.eventId || alert.donorId) && (
                    <Link href={alert.eventId ? `/events/${alert.eventId}` : `/donors/${alert.donorId}`} className="flex items-center gap-1 text-sm underline underline-offset-4 font-medium">
                      View <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${summary.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">From {summary.totalDonations} donations</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Donors</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalDonors.toLocaleString()}</div>
              {summary.atRiskDonors > 0 && <p className="text-xs text-destructive font-medium">{summary.atRiskDonors} at risk of lapsing</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.upcomingEvents}</div>
              <p className="text-xs text-muted-foreground">Out of {summary.totalEvents} total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Action Items</CardTitle>
              <AlertOctagon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.unreconciledFRFs + summary.pendingFollowUps}</div>
              <p className="text-xs text-muted-foreground">{summary.unreconciledFRFs} unreconciled FRFs</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Events</CardTitle>
          </CardHeader>
          <CardContent>
            {topEvents && topEvents.length > 0 ? (
              <div className="space-y-4">
                {topEvents.map((event) => (
                  <div key={event.eventId} className="flex items-center justify-between pb-4 border-b last:border-0 last:pb-0">
                    <div>
                      <Link href={`/events/${event.eventId}`} className="font-medium hover:underline">{event.eventName}</Link>
                      <div className="text-sm text-muted-foreground flex gap-2 items-center">
                        <Badge variant="outline" className="capitalize text-xs font-normal">{event.eventType}</Badge>
                        <span>{new Date(event.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${event.totalRevenue.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{event.attendeeCount} attendees</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No events found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Donor Segments</CardTitle>
          </CardHeader>
          <CardContent>
            {donorSegments ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Recurring</span>
                  <span className="text-sm">{donorSegments.recurring}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Major</span>
                  <span className="text-sm">{donorSegments.major}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Emergency Responder</span>
                  <span className="text-sm">{donorSegments.emergencyResponder}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-destructive">Lapsed</span>
                  <span className="text-sm text-destructive">{donorSegments.lapsed}</span>
                </div>
                <div className="pt-4 border-t flex justify-between items-center">
                  <span className="text-sm font-medium">Total Active</span>
                  <span className="font-bold">{donorSegments.totalDonors}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No segment data available.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}