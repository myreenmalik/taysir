import {
  useListFollowUpTasks,
  getListFollowUpTasksQueryKey,
  useUpdateFollowUpTask,
  useListDonors,
  getListDonorsQueryKey,
  useListEvents,
  getListEventsQueryKey,
  useGetDashboardAlerts,
  getGetDashboardAlertsQueryKey,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Check, ListChecks, AlertOctagon, AlertTriangle, ArrowRight, Calendar } from "lucide-react";
import { SendEmailButton, deriveEmailSubject } from "@/components/SendEmailButton";

const OUTREACH_TASK_TYPES = new Set(["thank-you-email", "donation-ask", "volunteer-invite", "stewardship-call"]);

type StatusFilter = "open" | "completed" | "all";

export default function Tasks() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const queryClient = useQueryClient();

  const { data: tasks, isLoading: loadingTasks } = useListFollowUpTasks(
    {},
    { query: { queryKey: getListFollowUpTasksQueryKey({}) } },
  );
  const { data: donors } = useListDonors({}, { query: { queryKey: getListDonorsQueryKey() } });
  const { data: events } = useListEvents({}, { query: { queryKey: getListEventsQueryKey() } });
  const { data: alerts } = useGetDashboardAlerts({ query: { queryKey: getGetDashboardAlertsQueryKey() } });

  const updateTask = useUpdateFollowUpTask();

  const donorById = useMemo(() => {
    const m = new Map<number, { id: number; name: string; email: string | null | undefined }>();
    (donors ?? []).forEach(d => m.set(d.id, { id: d.id, name: d.name, email: d.email }));
    return m;
  }, [donors]);

  const eventById = useMemo(() => {
    const m = new Map<number, { id: number; name: string }>();
    (events ?? []).forEach(e => m.set(e.id, { id: e.id, name: e.name }));
    return m;
  }, [events]);

  const visibleTasks = useMemo(() => {
    const list = tasks ?? [];
    const filtered = list.filter(t => {
      if (statusFilter === "open") return t.status !== "completed";
      if (statusFilter === "completed") return t.status === "completed";
      return true;
    });
    return filtered.sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tasks, statusFilter]);

  const counts = useMemo(() => {
    const list = tasks ?? [];
    return {
      open: list.filter(t => t.status !== "completed").length,
      completed: list.filter(t => t.status === "completed").length,
      all: list.length,
    };
  }, [tasks]);

  const dataAlerts = (alerts ?? []).filter(a =>
    ["missing-frf", "frf-mismatch", "missing-attendance"].includes(a.type),
  );

  return (
    <div className="space-y-6 p-6" data-testid="page-tasks">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tasks &amp; Action Items</h1>
        <p className="text-muted-foreground">
          Everything that needs your attention — donor follow-ups, missing FRFs, and data gaps.
        </p>
      </div>

      {dataAlerts.length > 0 && (
        <Card data-testid="card-data-alerts">
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <AlertOctagon className="h-5 w-5 text-destructive" />
            <CardTitle>Event &amp; Data Alerts ({dataAlerts.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dataAlerts.map(alert => (
              <div
                key={alert.id}
                className="flex items-center justify-between rounded-md border p-3"
                data-testid={`alert-${alert.id}`}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle
                    className={`h-4 w-4 ${alert.severity === "critical" ? "text-destructive" : "text-amber-500"}`}
                  />
                  <div>
                    <div className="text-sm">{alert.message}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {alert.type.replace(/-/g, " ")} · {alert.severity}
                    </div>
                  </div>
                </div>
                {alert.eventId && (
                  <Link href={`/events/${alert.eventId}`}>
                    <Button variant="outline" size="sm">
                      Open event <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <CardTitle>Follow-Up Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <TabsList>
              <TabsTrigger value="open" data-testid="tab-open">Open ({counts.open})</TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-completed">Completed ({counts.completed})</TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all">All ({counts.all})</TabsTrigger>
            </TabsList>

            <TabsContent value={statusFilter} className="mt-4 space-y-3">
              {loadingTasks ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : visibleTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-empty-tasks">
                  Nothing here. You're all caught up.
                </p>
              ) : (
                visibleTasks.map(task => {
                  const donor = task.donorId ? donorById.get(task.donorId) : null;
                  const event = task.eventId ? eventById.get(task.eventId) : null;
                  const overdue =
                    task.dueDate &&
                    task.status !== "completed" &&
                    new Date(task.dueDate).getTime() < Date.now();
                  return (
                    <div
                      key={task.id}
                      className="bg-background rounded-md p-4 border shadow-sm"
                      data-testid={`task-row-${task.id}`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <div className="min-w-0">
                          <div className="font-semibold">{task.recommendedAction}</div>
                          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                            <span className="capitalize">{task.taskType.replace(/-/g, " ")}</span>
                            {donor && (
                              <>
                                <span>·</span>
                                <Link
                                  href={`/donors/${donor.id}`}
                                  className="hover:underline text-primary"
                                  data-testid={`link-donor-${donor.id}`}
                                >
                                  {donor.name}
                                </Link>
                              </>
                            )}
                            {event && (
                              <>
                                <span>·</span>
                                <Link
                                  href={`/events/${event.id}`}
                                  className="hover:underline text-primary"
                                  data-testid={`link-event-${event.id}`}
                                >
                                  {event.name}
                                </Link>
                              </>
                            )}
                            {task.dueDate && (
                              <>
                                <span>·</span>
                                <span className={`flex items-center gap-1 ${overdue ? "text-destructive font-medium" : ""}`}>
                                  <Calendar className="h-3 w-3" />
                                  {overdue ? "Overdue " : "Due "}
                                  {new Date(task.dueDate).toLocaleDateString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize whitespace-nowrap">
                          {task.status.replace(/-/g, " ")}
                        </Badge>
                      </div>
                      {task.notes && <p className="text-sm text-muted-foreground mt-2">{task.notes}</p>}
                      <div className="mt-3 flex justify-end gap-2">
                        {task.status !== "completed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              updateTask.mutate(
                                { id: task.id, data: { status: "completed" } },
                                {
                                  onSuccess: () => {
                                    void queryClient.invalidateQueries({ queryKey: getListFollowUpTasksQueryKey({}) });
                                    void queryClient.invalidateQueries({ queryKey: getGetDashboardAlertsQueryKey() });
                                  },
                                },
                              );
                            }}
                            disabled={updateTask.isPending}
                            data-testid={`button-complete-task-${task.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" /> Mark done
                          </Button>
                        )}
                        {donor && OUTREACH_TASK_TYPES.has(task.taskType) && (
                          <SendEmailButton
                            email={donor.email}
                            subject={deriveEmailSubject(task.recommendedAction)}
                            body={
                              task.suggestedMessage ||
                              `Dear ${donor.name},\n\n${task.recommendedAction}.${task.notes ? `\n\n${task.notes}` : ""}\n\nWith gratitude,\nThe Islamic Relief USA Team`
                            }
                            noEmailTooltip={`No email on file for ${donor.name}.`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
