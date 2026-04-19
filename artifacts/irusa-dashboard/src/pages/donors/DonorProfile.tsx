import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetDonorProfile, getGetDonorProfileQueryKey, useListFollowUpTasks, getListFollowUpTasksQueryKey, useUpdateFollowUpTask, useDeleteDonor, getListDonorsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Mail, Phone, MapPin, Calendar, AlertTriangle, Sparkles, ListChecks, Check, Trash2 } from "lucide-react";
import { SendEmailButton, deriveEmailSubject } from "@/components/SendEmailButton";
import { getTierColor } from "./DonorsList";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const OUTREACH_TASK_TYPES = new Set(["thank-you-email", "donation-ask", "volunteer-invite", "stewardship-call"]);

export default function DonorProfile() {
  const { id } = useParams<{ id: string }>();
  const donorId = parseInt(id || "0", 10);

  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { data: profile, isLoading } = useGetDonorProfile(donorId, { query: { enabled: !!donorId, queryKey: getGetDonorProfileQueryKey(donorId) } });
  const { data: followUps } = useListFollowUpTasks({ donorId }, { query: { enabled: !!donorId, queryKey: getListFollowUpTasksQueryKey({ donorId }) } });
  const updateTask = useUpdateFollowUpTask();
  const deleteDonorMutation = useDeleteDonor();
  const openTasks = (followUps ?? []).filter(t => t.status !== "completed");

  const handleDelete = () => {
    if (!profile) return;
    const name = profile.donor.name;
    deleteDonorMutation.mutate(
      { id: donorId },
      {
        onSuccess: () => {
          toast({ title: "Donor deleted", description: `${name} and their related records were removed.` });
          setConfirmOpen(false);
          void queryClient.invalidateQueries({ queryKey: getListDonorsQueryKey() });
          void queryClient.invalidateQueries();
          setLocation("/donors");
        },
        onError: (err) => {
          toast({
            title: "Couldn't delete donor",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading donor profile...</div>;
  }

  if (!profile) {
    return <div className="p-8 text-center text-destructive">Donor not found</div>;
  }

  const { donor, recommendations, topCauses } = profile;

  return (
    <div className="space-y-6">
      {/* Header Profile Card */}
      <Card className="border-t-4 border-t-primary">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-3xl font-bold tracking-tight">{donor.name}</h1>
                <Badge variant="outline" className={`text-sm font-semibold ${getTierColor(donor.donorTier)}`} data-testid="badge-donor-tier">
                  {donor.donorTier}
                </Badge>
                <Badge variant="outline" className="capitalize">{donor.donorCategory.replace("-", " ")}</Badge>
                {donor.donorPersonalityType && <Badge variant="secondary">{donor.donorPersonalityType}</Badge>}
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mt-4 text-sm text-muted-foreground">
                {donor.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" /> {donor.email}
                  </div>
                )}
                {donor.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" /> {donor.phone}
                  </div>
                )}
                {donor.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> {donor.location}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-3 min-w-[200px]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                data-testid="button-delete-donor"
              >
                <Trash2 className="h-4 w-4" /> Delete donor
              </Button>
              <div className="w-full flex flex-col gap-2 bg-muted/50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Giving</span>
                <span className="text-lg font-bold text-primary">${donor.totalDonated.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Gift</span>
                <span className="text-sm font-medium">${Math.round(donor.averageDonation).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Donations</span>
                <span className="text-sm font-medium">{donor.donationCount}</span>
              </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this donor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-semibold">{donor.name}</span> along with all of their donations, event attendance records, and follow-up tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDonorMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleteDonorMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-donor"
            >
              {deleteDonorMutation.isPending ? "Deleting…" : "Delete donor"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* AI Recommendations */}
          {recommendations && recommendations.length > 0 && (
            <Card className="border-primary/20 shadow-sm bg-primary/5 dark:bg-primary/10">
              <CardHeader className="pb-3 flex flex-row items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle>Smart Outreach Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recommendations.map(rec => (
                  <div key={rec.id} className="bg-background rounded-md p-4 border shadow-sm">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="font-semibold text-primary">{rec.action}</div>
                      <Badge variant={rec.urgency === "high" ? "destructive" : "secondary"}>
                        {rec.urgency} urgency
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{rec.reason}</p>
                    {rec.suggestedMessage && (
                      <div className="mt-3 p-3 bg-muted rounded-md text-sm italic border-l-2 border-primary">
                        "{rec.suggestedMessage}"
                      </div>
                    )}
                    <div className="mt-3 flex justify-end">
                      <SendEmailButton
                        email={donor.email}
                        subject={rec.suggestedSubject || deriveEmailSubject(rec.action)}
                        body={rec.suggestedMessage || rec.action}
                        noEmailTooltip={`No email on file for ${donor.name}.`}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Open Follow-Up Tasks */}
          {openTasks.length > 0 && (
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center gap-2">
                <ListChecks className="h-5 w-5 text-primary" />
                <CardTitle>Open Follow-Up Tasks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {openTasks.map(task => (
                  <div key={task.id} className="bg-background rounded-md p-4 border shadow-sm" data-testid={`followup-task-${task.id}`}>
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <div>
                        <div className="font-semibold">{task.recommendedAction}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {task.taskType.replace(/-/g, " ")}{task.dueDate ? ` · due ${new Date(task.dueDate).toLocaleDateString()}` : ""}
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize">{task.status.replace(/-/g, " ")}</Badge>
                    </div>
                    {task.notes && <p className="text-sm text-muted-foreground mt-2">{task.notes}</p>}
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          updateTask.mutate(
                            { id: task.id, data: { status: "completed" } },
                            { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFollowUpTasksQueryKey({ donorId }) }) },
                          );
                        }}
                        disabled={updateTask.isPending}
                        data-testid={`button-complete-task-${task.id}`}
                      >
                        <Check className="h-4 w-4 mr-1" /> Mark done
                      </Button>
                      {OUTREACH_TASK_TYPES.has(task.taskType) && (
                        <SendEmailButton
                          email={donor.email}
                          subject={deriveEmailSubject(task.recommendedAction)}
                          body={task.notes || task.recommendedAction}
                          noEmailTooltip={`No email on file for ${donor.name}.`}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Giving Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Giving History</CardTitle>
            </CardHeader>
            <CardContent>
              {profile.donations.length > 0 ? (
                <div className="space-y-4">
                  {profile.donations.map(donation => (
                    <div key={donation.id} className="flex justify-between items-center p-3 hover:bg-muted/50 rounded-lg transition-colors">
                      <div>
                        <div className="font-medium">${donation.amount.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(donation.date).toLocaleDateString()} • {donation.cause || 'General Fund'}
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize">{donation.donationType}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No donation history available.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Causes</CardTitle>
            </CardHeader>
            <CardContent>
              {topCauses.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {topCauses.map(cause => (
                    <Badge key={cause} variant="secondary">{cause}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not enough data.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Intelligence Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Giving Frequency</span>
                  <span className="font-medium">{profile.givingFrequencyScore}/100</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{width: `${profile.givingFrequencyScore}%`}}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Engagement Risk</span>
                  <span className={`font-medium ${profile.engagementRiskScore > 70 ? 'text-destructive' : ''}`}>{profile.engagementRiskScore}/100</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className={`h-2 rounded-full ${profile.engagementRiskScore > 70 ? 'bg-destructive' : 'bg-amber-500'}`} style={{width: `${profile.engagementRiskScore}%`}}></div>
                </div>
              </div>
              
              <div className="pt-4 border-t space-y-2">
                {profile.isRamadanGiver && (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <Calendar className="h-4 w-4" /> Strong Ramadan Giver
                  </div>
                )}
                {profile.isEmergencyResponder && (
                  <div className="flex items-center gap-2 text-sm text-orange-600">
                    <AlertTriangle className="h-4 w-4" /> Emergency Responder
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}