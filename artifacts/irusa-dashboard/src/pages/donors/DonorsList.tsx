import { useListDonors, getListDonorsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useState } from "react";
import { Search } from "lucide-react";

export default function DonorsList() {
  const [search, setSearch] = useState("");
  const { data: donors, isLoading } = useListDonors({}, { query: { queryKey: getListDonorsQueryKey() } });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "major": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
      case "lapsed": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-800";
      case "recurring": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "emergency-responder": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 border-orange-200 dark:border-orange-800";
      case "seasonal": return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300 border-teal-200 dark:border-teal-800";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
    }
  };

  const getPersonalityColor = (type?: string | null) => {
    switch (type) {
      case "Altruist": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "Investor": return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300";
      case "Repayer": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";
      default: return "";
    }
  };

  const filteredDonors = donors?.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    (d.email && d.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Donors</h1>
          <p className="text-muted-foreground">Manage donor profiles and relationship history.</p>
        </div>
        <Link href="/donors/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
          New Donor
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search donors by name or email..."
              className="pl-8 max-w-md"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading donors...</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Donor Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Personality</TableHead>
                    <TableHead>Last Donation</TableHead>
                    <TableHead className="text-right">Total Donated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDonors?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No donors found matching "{search}"
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDonors?.map((donor) => (
                      <TableRow key={donor.id}>
                        <TableCell className="font-medium">
                          <Link href={`/donors/${donor.id}`} className="hover:underline block">
                            {donor.name}
                          </Link>
                          <span className="text-xs text-muted-foreground block">{donor.email}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`capitalize ${getCategoryColor(donor.donorCategory)}`}>
                            {donor.donorCategory.replace("-", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {donor.donorPersonalityType ? (
                            <Badge variant="secondary" className={getPersonalityColor(donor.donorPersonalityType)}>
                              {donor.donorPersonalityType}
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">-</span>}
                        </TableCell>
                        <TableCell>{donor.lastDonationDate ? new Date(donor.lastDonationDate).toLocaleDateString() : '-'}</TableCell>
                        <TableCell className="text-right font-medium">
                          ${donor.totalDonated.toLocaleString()}
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