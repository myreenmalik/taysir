import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateDonor } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const donorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  location: z.string().optional(),
  donorCategory: z.string().min(1, "Category is required"),
  donorPersonalityType: z.string().optional(),
  preferredContactFrequency: z.string().optional(),
  notes: z.string().optional(),
});

type DonorFormValues = z.infer<typeof donorSchema>;

export default function DonorNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createDonor = useCreateDonor();

  const form = useForm<DonorFormValues>({
    resolver: zodResolver(donorSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      location: "",
      donorCategory: "one-time",
      donorPersonalityType: "",
      preferredContactFrequency: "monthly",
      notes: "",
    },
  });

  const onSubmit = (data: DonorFormValues) => {
    createDonor.mutate(
      { data: { ...data, email: data.email || null } },
      {
        onSuccess: (donor) => {
          toast({ title: "Donor created", description: "The donor has been successfully created." });
          setLocation(`/donors/${donor.id}`);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create donor. Please try again.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add New Donor</h1>
        <p className="text-muted-foreground">Create a new donor profile in the database.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Donor Information</CardTitle>
          <CardDescription>Enter the donor's contact details and segmentation profile.</CardDescription>
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
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address (Optional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number (Optional)</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="+1 (555) 000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Location (City, State)</FormLabel>
                      <FormControl>
                        <Input placeholder="New York, NY" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="donorCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Donor Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="one-time">One Time</SelectItem>
                          <SelectItem value="recurring">Recurring</SelectItem>
                          <SelectItem value="seasonal">Seasonal</SelectItem>
                          <SelectItem value="major">Major</SelectItem>
                          <SelectItem value="lapsed">Lapsed</SelectItem>
                          <SelectItem value="emergency-responder">Emergency Responder</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="donorPersonalityType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Personality Type (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select personality" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Altruist">Altruist</SelectItem>
                          <SelectItem value="Investor">Investor</SelectItem>
                          <SelectItem value="Repayer">Repayer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preferredContactFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Contact Frequency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="annual">Annually</SelectItem>
                          <SelectItem value="rarely">Rarely</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Internal Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Context about this donor..." className="resize-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => setLocation("/donors")}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createDonor.isPending}>
                  {createDonor.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Donor
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}