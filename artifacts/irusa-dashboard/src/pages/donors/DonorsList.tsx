import { useListDonors, getListDonorsQueryKey, useGenerateDonorFollowUps, useDeleteDonor } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
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
import { Link, useSearch, useLocation } from "wouter";
import { useMemo, useCallback, useState } from "react";
import { Search, ChevronDown, X, CalendarIcon, Sparkles, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["major", "lapsed", "recurring", "emergency-responder", "seasonal", "one-time"] as const;
const PERSONALITIES = ["Altruist", "Investor", "Repayer"] as const;
const TIERS = ["Bronze", "Silver", "Gold", "Platinum"] as const;

type FilterState = {
  search: string;
  categories: string[];
  personalities: string[];
  tiers: string[];
  dateFrom: string;
  dateTo: string;
  minTotal: string;
  maxTotal: string;
};

function parseFilters(searchStr: string): FilterState {
  const p = new URLSearchParams(searchStr);
  return {
    search: p.get("search") ?? "",
    categories: p.get("categories")?.split(",").filter(Boolean) ?? [],
    personalities: p.get("personalities")?.split(",").filter(Boolean) ?? [],
    tiers: p.get("tiers")?.split(",").filter(Boolean) ?? [],
    dateFrom: p.get("dateFrom") ?? "",
    dateTo: p.get("dateTo") ?? "",
    minTotal: p.get("minTotal") ?? "",
    maxTotal: p.get("maxTotal") ?? "",
  };
}

function serializeFilters(f: FilterState): string {
  const p = new URLSearchParams();
  if (f.search) p.set("search", f.search);
  if (f.categories.length) p.set("categories", f.categories.join(","));
  if (f.personalities.length) p.set("personalities", f.personalities.join(","));
  if (f.tiers.length) p.set("tiers", f.tiers.join(","));
  if (f.dateFrom) p.set("dateFrom", f.dateFrom);
  if (f.dateTo) p.set("dateTo", f.dateTo);
  if (f.minTotal) p.set("minTotal", f.minTotal);
  if (f.maxTotal) p.set("maxTotal", f.maxTotal);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function getTierColor(tier?: string | null) {
  switch (tier) {
    case "Platinum": return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700";
    case "Gold": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700";
    case "Silver": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600";
    case "Bronze": return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function DonorsList() {
  const searchStr = useSearch();
  const [, setLocation] = useLocation();
  const filters = useMemo(() => parseFilters(searchStr), [searchStr]);

  const updateFilters = useCallback((patch: Partial<FilterState>, replace = false) => {
    const next = { ...filters, ...patch };
    setLocation("/donors" + serializeFilters(next), { replace });
  }, [filters, setLocation]);

  const clearAll = () => setLocation("/donors", { replace: false });

  const { data: donors, isLoading } = useListDonors({}, { query: { queryKey: getListDonorsQueryKey() } });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const generateFollowUps = useGenerateDonorFollowUps();
  const deleteDonorMutation = useDeleteDonor();
  const [lastGenSummary, setLastGenSummary] = useState<{ created: number; byType: Record<string, number> } | null>(null);
  const [donorToDelete, setDonorToDelete] = useState<{ id: number; name: string } | null>(null);

  const confirmDeleteDonor = () => {
    if (!donorToDelete) return;
    const { id, name } = donorToDelete;
    deleteDonorMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Donor deleted", description: `${name} and their related records were removed.` });
          setDonorToDelete(null);
          void queryClient.invalidateQueries({ queryKey: getListDonorsQueryKey() });
          void queryClient.invalidateQueries();
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

  const handleGenerateFollowUps = () => {
    generateFollowUps.mutate(undefined, {
      onSuccess: (data) => {
        setLastGenSummary({ created: data.created, byType: data.byType ?? {} });
        const breakdown = Object.entries(data.byType ?? {})
          .map(([type, n]) => `${n} ${type.replace(/-/g, " ")}`)
          .join(", ");
        toast({
          title: data.created === 0 ? "No new follow-ups needed" : `Generated ${data.created} follow-up${data.created === 1 ? "" : "s"}`,
          description: data.created === 0
            ? "Every donor already has up-to-date outreach tasks."
            : breakdown,
        });
        void queryClient.invalidateQueries();
      },
      onError: (err) => {
        toast({ title: "Couldn't generate follow-ups", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
      },
    });
  };

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

  const filteredDonors = useMemo(() => {
    if (!donors) return undefined;
    const searchLower = filters.search.toLowerCase();
    const dateFromMs = filters.dateFrom ? new Date(filters.dateFrom).getTime() : null;
    const dateToMs = filters.dateTo ? new Date(filters.dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    const minTotal = filters.minTotal ? parseFloat(filters.minTotal) : null;
    const maxTotal = filters.maxTotal ? parseFloat(filters.maxTotal) : null;

    return donors.filter(d => {
      if (searchLower && !(
        d.name.toLowerCase().includes(searchLower) ||
        (d.email && d.email.toLowerCase().includes(searchLower))
      )) return false;
      if (filters.categories.length && !filters.categories.includes(d.donorCategory)) return false;
      if (filters.personalities.length && (!d.donorPersonalityType || !filters.personalities.includes(d.donorPersonalityType))) return false;
      if (filters.tiers.length && !filters.tiers.includes(d.donorTier)) return false;
      if (dateFromMs !== null || dateToMs !== null) {
        if (!d.lastDonationDate) return false;
        const t = new Date(d.lastDonationDate).getTime();
        if (dateFromMs !== null && t < dateFromMs) return false;
        if (dateToMs !== null && t > dateToMs) return false;
      }
      if (minTotal !== null && d.totalDonated < minTotal) return false;
      if (maxTotal !== null && d.totalDonated > maxTotal) return false;
      return true;
    });
  }, [donors, filters]);

  const totalCount = donors?.length ?? 0;
  const visibleCount = filteredDonors?.length ?? 0;

  const toggleArrayValue = (key: "categories" | "personalities" | "tiers", value: string) => {
    const current = filters[key];
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    updateFilters({ [key]: next } as Partial<FilterState>);
  };

  const hasAnyFilter =
    filters.search || filters.categories.length || filters.personalities.length || filters.tiers.length ||
    filters.dateFrom || filters.dateTo || filters.minTotal || filters.maxTotal;

  const tierLabel = filters.tiers.length === 0
    ? "Tier"
    : filters.tiers.length === 1 ? `Tier: ${filters.tiers[0]}`
    : `Tier (${filters.tiers.length})`;

  const categoryLabel = filters.categories.length === 0
    ? "Category"
    : filters.categories.length === 1 ? `Category: ${filters.categories[0].replace("-", " ")}`
    : `Category (${filters.categories.length})`;

  const personalityLabel = filters.personalities.length === 0
    ? "Personality"
    : filters.personalities.length === 1 ? `Personality: ${filters.personalities[0]}`
    : `Personality (${filters.personalities.length})`;

  const dateLabel = filters.dateFrom || filters.dateTo
    ? `${filters.dateFrom || "…"} → ${filters.dateTo || "…"}`
    : "Last donation";

  const totalLabel = filters.minTotal || filters.maxTotal
    ? `$${filters.minTotal || "0"} – $${filters.maxTotal || "∞"}`
    : "Total donated";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Donors</h1>
          <p className="text-muted-foreground">Manage donor profiles and relationship history.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleGenerateFollowUps}
            disabled={generateFollowUps.isPending}
            data-testid="button-generate-followups"
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {generateFollowUps.isPending ? "Generating…" : "Generate follow-ups"}
          </Button>
          <Link href="/donors/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
            New Donor
          </Link>
        </div>
      </div>

      {lastGenSummary && lastGenSummary.created > 0 && (
        <div className="rounded-md border bg-primary/5 px-4 py-3 text-sm" data-testid="banner-followups-generated">
          <div className="font-medium">Created {lastGenSummary.created} new follow-up task{lastGenSummary.created === 1 ? "" : "s"}.</div>
          <div className="text-muted-foreground mt-1">
            {Object.entries(lastGenSummary.byType).map(([type, n]) => (
              <span key={type} className="mr-3 capitalize">{n} × {type.replace(/-/g, " ")}</span>
            ))}
            <span>Open any donor to see their tasks.</span>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search donors by name or email..."
                className="pl-8"
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value }, true)}
                data-testid="input-search-donors"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Category multi-select */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" data-testid="button-filter-category">
                    <span className="capitalize">{categoryLabel}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-1">
                    {CATEGORIES.map(cat => (
                      <label key={cat} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
                        <Checkbox
                          checked={filters.categories.includes(cat)}
                          onCheckedChange={() => toggleArrayValue("categories", cat)}
                          data-testid={`checkbox-category-${cat}`}
                        />
                        <span className="text-sm capitalize">{cat.replace("-", " ")}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Tier multi-select */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" data-testid="button-filter-tier">
                    <span>{tierLabel}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-1">
                    {TIERS.map(t => (
                      <label key={t} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
                        <Checkbox
                          checked={filters.tiers.includes(t)}
                          onCheckedChange={() => toggleArrayValue("tiers", t)}
                          data-testid={`checkbox-tier-${t}`}
                        />
                        <Badge variant="outline" className={getTierColor(t)}>{t}</Badge>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Personality multi-select */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" data-testid="button-filter-personality">
                    <span>{personalityLabel}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-1">
                    {PERSONALITIES.map(p => (
                      <label key={p} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
                        <Checkbox
                          checked={filters.personalities.includes(p)}
                          onCheckedChange={() => toggleArrayValue("personalities", p)}
                          data-testid={`checkbox-personality-${p}`}
                        />
                        <span className="text-sm">{p}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Date range */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" data-testid="button-filter-date">
                    <CalendarIcon className="h-4 w-4" />
                    <span>{dateLabel}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">From</Label>
                        <Input
                          type="date"
                          value={filters.dateFrom}
                          onChange={(e) => updateFilters({ dateFrom: e.target.value })}
                          data-testid="input-date-from"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">To</Label>
                        <Input
                          type="date"
                          value={filters.dateTo}
                          onChange={(e) => updateFilters({ dateTo: e.target.value })}
                          data-testid="input-date-to"
                        />
                      </div>
                    </div>
                    <Calendar
                      mode="range"
                      selected={{
                        from: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
                        to: filters.dateTo ? new Date(filters.dateTo) : undefined,
                      }}
                      onSelect={(range) => {
                        updateFilters({
                          dateFrom: range?.from ? format(range.from, "yyyy-MM-dd") : "",
                          dateTo: range?.to ? format(range.to, "yyyy-MM-dd") : "",
                        });
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>

              {/* Total range */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" data-testid="button-filter-total">
                    <span>{totalLabel}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Min ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={filters.minTotal}
                        onChange={(e) => updateFilters({ minTotal: e.target.value }, true)}
                        data-testid="input-min-total"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Max ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Any"
                        value={filters.maxTotal}
                        onChange={(e) => updateFilters({ maxTotal: e.target.value }, true)}
                        data-testid="input-max-total"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Active filter chips */}
          {hasAnyFilter ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {filters.search && (
                <Badge variant="secondary" className="gap-1 pr-1" data-testid="chip-search">
                  Search: {filters.search}
                  <button onClick={() => updateFilters({ search: "" })} className="ml-1 rounded-sm hover:bg-muted-foreground/20 p-0.5" aria-label="Remove search filter">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filters.categories.map(c => (
                <Badge key={c} variant="secondary" className="gap-1 pr-1 capitalize" data-testid={`chip-category-${c}`}>
                  {c.replace("-", " ")}
                  <button onClick={() => toggleArrayValue("categories", c)} className="ml-1 rounded-sm hover:bg-muted-foreground/20 p-0.5" aria-label={`Remove ${c} category`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {filters.personalities.map(p => (
                <Badge key={p} variant="secondary" className="gap-1 pr-1" data-testid={`chip-personality-${p}`}>
                  {p}
                  <button onClick={() => toggleArrayValue("personalities", p)} className="ml-1 rounded-sm hover:bg-muted-foreground/20 p-0.5" aria-label={`Remove ${p} personality`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {filters.tiers.map(t => (
                <Badge key={t} variant="secondary" className="gap-1 pr-1" data-testid={`chip-tier-${t}`}>
                  Tier: {t}
                  <button onClick={() => toggleArrayValue("tiers", t)} className="ml-1 rounded-sm hover:bg-muted-foreground/20 p-0.5" aria-label={`Remove ${t} tier`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {(filters.dateFrom || filters.dateTo) && (
                <Badge variant="secondary" className="gap-1 pr-1" data-testid="chip-date">
                  Donated {filters.dateFrom || "…"} → {filters.dateTo || "…"}
                  <button onClick={() => updateFilters({ dateFrom: "", dateTo: "" })} className="ml-1 rounded-sm hover:bg-muted-foreground/20 p-0.5" aria-label="Remove date filter">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {(filters.minTotal || filters.maxTotal) && (
                <Badge variant="secondary" className="gap-1 pr-1" data-testid="chip-total">
                  ${filters.minTotal || "0"} – ${filters.maxTotal || "∞"}
                  <button onClick={() => updateFilters({ minTotal: "", maxTotal: "" })} className="ml-1 rounded-sm hover:bg-muted-foreground/20 p-0.5" aria-label="Remove total filter">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs" data-testid="button-clear-all">
                Clear all
              </Button>
            </div>
          ) : null}

          <div className="text-sm text-muted-foreground" data-testid="text-result-count">
            {isLoading ? "Loading…" : `Showing ${visibleCount} of ${totalCount} donor${totalCount === 1 ? "" : "s"}`}
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
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDonors?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {hasAnyFilter
                          ? "No donors match the selected filters."
                          : "No donors yet."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDonors?.map((donor) => (
                      <TableRow key={donor.id} data-testid={`row-donor-${donor.id}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Link href={`/donors/${donor.id}`} className="hover:underline">
                              {donor.name}
                            </Link>
                            <Badge variant="outline" className={getTierColor(donor.donorTier)} data-testid={`badge-tier-${donor.id}`}>
                              {donor.donorTier}
                            </Badge>
                          </div>
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
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDonorToDelete({ id: donor.id, name: donor.name });
                            }}
                            aria-label={`Delete ${donor.name}`}
                            data-testid={`button-delete-donor-${donor.id}`}
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

      <AlertDialog open={donorToDelete !== null} onOpenChange={(open) => { if (!open) setDonorToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this donor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-semibold">{donorToDelete?.name}</span> along with all of their donations, event attendance records, and follow-up tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDonorMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDeleteDonor(); }}
              disabled={deleteDonorMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-donor"
            >
              {deleteDonorMutation.isPending ? "Deleting…" : "Delete donor"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
