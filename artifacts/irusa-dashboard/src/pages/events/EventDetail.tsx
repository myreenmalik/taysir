import { useParams, Link } from "wouter";
import { 
  useGetEvent, 
  useGetEventSummary, 
  useListLogisticsTasks,
  useListRevenueEntries,
  useGetFRFRecord,
  useListAllocations,
  useListAttendees,
  useListFollowUpTasks,
  getGetEventQueryKey, 
  getGetEventSummaryQueryKey,
  getListLogisticsTasksQueryKey,
  getListRevenueEntriesQueryKey,
  getGetFRFRecordQueryKey,
  getListAllocationsQueryKey,
  getListAttendeesQueryKey,
  getListFollowUpTasksQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Calendar, Users, DollarSign, Target, CheckCircle2, AlertCircle, Clock, PieChart, Info, Search } from "lucide-react";
import { useState, useMemo } from "react";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0", 10);

  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [attendeeTypeFilter, setAttendeeTypeFilter] = useState("all");
  const [attendeeStatusFilter, setAttendeeStatusFilter] = useState("all");
  const [attendeeDonatedFilter, setAttendeeDonatedFilter] = useState("all");

  const { data: event, isLoading: loadingEvent } = useGetEvent(eventId, { query: { enabled: !!eventId, queryKey: getGetEventQueryKey(eventId) } });
  const { data: summary, isLoading: loadingSummary } = useGetEventSummary(eventId, { query: { enabled: !!eventId, queryKey: getGetEventSummaryQueryKey(eventId) } });
  const { data: logistics } = useListLogisticsTasks(eventId, { query: { enabled: !!eventId, queryKey: getListLogisticsTasksQueryKey(eventId) } });
  const { data: revenue } = useListRevenueEntries(eventId, { query: { enabled: !!eventId, queryKey: getListRevenueEntriesQueryKey(eventId) } });
  const { data: frfRecord } = useGetFRFRecord(eventId, { query: { enabled: !!eventId, queryKey: getGetFRFRecordQueryKey(eventId), retry: false } });
  const { data: allocations } = useListAllocations(eventId, { query: { enabled: !!eventId, queryKey: getListAllocationsQueryKey(eventId) } });
  const { data: attendees } = useListAttendees(eventId, { query: { enabled: !!eventId, queryKey: getListAttendeesQueryKey(eventId) } });

  const attendeeTypes = useMemo(() => {
    const set = new Set<string>();
    (attendees ?? []).forEach(a => { if (a.attendeeType) set.add(a.attendeeType); });
    return Array.from(set).sort();
  }, [attendees]);

  const filteredAttendees = useMemo(() => {
    const term = attendeeSearch.trim().toLowerCase();
    return (attendees ?? []).filter(a => {
      if (term && !a.name.toLowerCase().includes(term)) return false;
      if (attendeeTypeFilter !== "all" && a.attendeeType !== attendeeTypeFilter) return false;
      if (attendeeStatusFilter === "attended" && !a.attended) return false;
      if (attendeeStatusFilter === "rsvp" && a.attended) return false;
      if (attendeeDonatedFilter === "yes" && !a.donated) return false;
      if (attendeeDonatedFilter === "no" && a.donated) return false;
      return true;
    });
  }, [attendees, attendeeSearch, attendeeTypeFilter, attendeeStatusFilter, attendeeDonatedFilter]);
  const { data: followUps } = useListFollowUpTasks({ eventId }, { query: { enabled: !!eventId, queryKey: getListFollowUpTasksQueryKey({ eventId }) } });

  if (loadingEvent || loadingSummary) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading event details...</div>;
  }

  if (!event) {
    return <div className="p-8 text-center text-destructive">Event not found</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "planned": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      case "upcoming": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "completed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "reconciled": return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300";
      case "closed": return "bg-gray-800 text-gray-100 dark:bg-gray-200 dark:text-gray-800";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">{event.name}</h1>
            <Badge variant="outline" className="capitalize">{event.eventType}</Badge>
            <Badge variant="secondary" className={getStatusColor(event.status)}>{event.status}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(event.date).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {event.location}
            </div>
            {event.masjidPartner && (
              <div className="flex items-center gap-1.5">
                <Target className="h-4 w-4" />
                {event.masjidPartner}
              </div>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto bg-transparent border-b rounded-none p-0 h-auto">
          {["overview", "logistics", "revenue", "frf", "allocations", "attendees", "followups"].map((tab) => (
            <TabsTrigger 
              key={tab}
              value={tab} 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 capitalize"
            >
              {tab === "frf" ? "FRF/Reconciliation" : tab}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${summary?.totalRevenue.toLocaleString() || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Attendees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.attendeeCount || 0}</div>
                <p className="text-xs text-muted-foreground">Estimated: {event.estimatedAttendees || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                <PieChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.conversionRate.toFixed(1) || 0}%</div>
                <p className="text-xs text-muted-foreground">{summary?.donorAttendeeCount || 0} donors</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Logistics</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.logisticsCompletion.toFixed(0) || 0}%</div>
                <p className="text-xs text-muted-foreground">Completed</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Event Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{event.notes || "No notes provided for this event."}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logistics" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Logistics Tasks</CardTitle>
              <CardDescription>Manage and track operational tasks for this event.</CardDescription>
            </CardHeader>
            <CardContent>
              {logistics && logistics.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logistics.map(task => (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">{task.taskName}</TableCell>
                          <TableCell>{task.assignedTo || "Unassigned"}</TableCell>
                          <TableCell>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No date"}</TableCell>
                          <TableCell>
                            <Badge variant={task.status === "completed" ? "default" : task.status === "in-progress" ? "secondary" : "outline"}>
                              {task.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Info className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p>No logistics tasks added yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Entries</CardTitle>
              <CardDescription>Detailed log of funds received.</CardDescription>
            </CardHeader>
            <CardContent>
              {revenue && revenue.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Payment Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Entered By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenue.map(entry => (
                        <TableRow key={entry.id}>
                          <TableCell className="capitalize font-medium">{entry.paymentType}</TableCell>
                          <TableCell>${entry.amount.toLocaleString()}</TableCell>
                          <TableCell>{entry.quantity || 1}</TableCell>
                          <TableCell>{entry.receivedDate ? new Date(entry.receivedDate).toLocaleDateString() : "—"}</TableCell>
                          <TableCell>{entry.enteredBy || "System"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p>No revenue entries recorded.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="frf" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial Reconciliation Form (FRF)</CardTitle>
              <CardDescription>Match reported revenue against bank deposits.</CardDescription>
            </CardHeader>
            <CardContent>
              {frfRecord ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-4 border rounded-md bg-muted/30">
                    <div className="font-medium text-sm text-muted-foreground w-32">Status</div>
                    <Badge variant={frfRecord.reconciliationStatus === "matched" ? "default" : "destructive"}>
                      {frfRecord.reconciliationStatus.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 border rounded-md">
                      <div className="text-sm text-muted-foreground mb-1">Cash</div>
                      <div className="text-xl font-bold">${frfRecord.cashAmount.toLocaleString()}</div>
                    </div>
                    <div className="p-4 border rounded-md">
                      <div className="text-sm text-muted-foreground mb-1">Checks</div>
                      <div className="text-xl font-bold">${frfRecord.checkAmount.toLocaleString()}</div>
                    </div>
                    <div className="p-4 border rounded-md">
                      <div className="text-sm text-muted-foreground mb-1">Online</div>
                      <div className="text-xl font-bold">${frfRecord.onlineAmount.toLocaleString()}</div>
                    </div>
                    <div className="p-4 border rounded-md bg-primary/5">
                      <div className="text-sm font-medium mb-1">Total Reconciled</div>
                      <div className="text-xl font-bold text-primary">${frfRecord.totalAmount.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-3 opacity-50 text-amber-500" />
                  <p>No FRF record has been submitted for this event.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allocations" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Fund Allocations</CardTitle>
              <CardDescription>Distribution of raised funds to specific causes.</CardDescription>
            </CardHeader>
            <CardContent>
              {allocations && allocations.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allocations.map(allocation => (
                        <TableRow key={allocation.id}>
                          <TableCell className="capitalize font-medium">{allocation.category.replace("-", " ")}</TableCell>
                          <TableCell>${allocation.amount.toLocaleString()}</TableCell>
                          <TableCell className="text-muted-foreground">{allocation.notes || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <PieChart className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p>Funds have not been allocated yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendees" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Attendees ({filteredAttendees.length})</CardTitle>
              <CardDescription>List of people who RSVP'd or attended.</CardDescription>
            </CardHeader>
            <CardContent>
              {attendees && attendees.length > 0 ? (
                <>
                  <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center">
                    <div className="relative flex-1 md:max-w-sm">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name..."
                        value={attendeeSearch}
                        onChange={(e) => setAttendeeSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <Select value={attendeeTypeFilter} onValueChange={setAttendeeTypeFilter}>
                      <SelectTrigger className="md:w-[160px]">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {attendeeTypes.map(t => (
                          <SelectItem key={t} value={t} className="capitalize">{t.replace("-", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={attendeeStatusFilter} onValueChange={setAttendeeStatusFilter}>
                      <SelectTrigger className="md:w-[160px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="attended">Attended</SelectItem>
                        <SelectItem value="rsvp">RSVP</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={attendeeDonatedFilter} onValueChange={setAttendeeDonatedFilter}>
                      <SelectTrigger className="md:w-[160px]">
                        <SelectValue placeholder="Donated" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="yes">Donated: Yes</SelectItem>
                        <SelectItem value="no">Donated: No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Donated</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAttendees.length > 0 ? filteredAttendees.map(attendee => (
                        <TableRow key={attendee.id}>
                          <TableCell className="font-medium">
                            {attendee.donorId ? (
                              <Link href={`/donors/${attendee.donorId}`} className="hover:underline text-primary">
                                {attendee.name}
                              </Link>
                            ) : attendee.name}
                          </TableCell>
                          <TableCell className="capitalize">{attendee.attendeeType.replace("-", " ")}</TableCell>
                          <TableCell>
                            {attendee.attended ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200">Attended</Badge>
                            ) : (
                              <Badge variant="secondary">RSVP</Badge>
                            )}
                          </TableCell>
                          <TableCell>{attendee.donated ? "Yes" : "No"}</TableCell>
                          <TableCell>{attendee.donationAmount ? `$${attendee.donationAmount.toLocaleString()}` : "—"}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No attendees match the current filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p>No attendees recorded.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followups" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Follow-Up Tasks</CardTitle>
              <CardDescription>Post-event engagement and stewardship.</CardDescription>
            </CardHeader>
            <CardContent>
              {followUps && followUps.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {followUps.map(task => (
                        <TableRow key={task.id}>
                          <TableCell className="capitalize font-medium">{task.taskType.replace("-", " ")}</TableCell>
                          <TableCell>{task.recommendedAction}</TableCell>
                          <TableCell>
                            <Badge variant={task.status === "completed" ? "default" : task.status === "in-progress" ? "secondary" : "outline"}>
                              {task.status.replace("-", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p>No follow-up tasks generated yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}