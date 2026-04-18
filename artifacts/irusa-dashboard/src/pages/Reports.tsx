import { useGetRevenueByEvent, useGetDonorConversionReport, getGetRevenueByEventQueryKey, getGetDonorConversionReportQueryKey, getGetFRFStatusReportQueryKey, getGetCauseInterestReportQueryKey, useGetFRFStatusReport, useGetCauseInterestReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";

export default function Reports() {
  const { data: revenueData, isLoading: loadingRevenue } = useGetRevenueByEvent({ query: { queryKey: getGetRevenueByEventQueryKey() } });
  const { data: conversionData, isLoading: loadingConversion } = useGetDonorConversionReport({ query: { queryKey: getGetDonorConversionReportQueryKey() } });
  const { data: frfData, isLoading: loadingFrf } = useGetFRFStatusReport({ query: { queryKey: getGetFRFStatusReportQueryKey() } });
  const { data: causeData, isLoading: loadingCause } = useGetCauseInterestReport({ query: { queryKey: getGetCauseInterestReportQueryKey() } });

  if (loadingRevenue || loadingConversion || loadingFrf || loadingCause) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading reports...</div>;
  }

  const COLORS = ['#0f766e', '#1d4ed8', '#b45309', '#be123c', '#6d28d9'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
        <p className="text-muted-foreground">Deep dive into event performance and donor metrics.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue by Event</CardTitle>
            <CardDescription>Total funds raised per event broken down by payment type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              {revenueData && revenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="eventName" />
                    <YAxis tickFormatter={(value) => `$${value/1000}k`} />
                    <RechartsTooltip formatter={(value: number) => [`$${value.toLocaleString()}`, '']} />
                    <Legend />
                    <Bar dataKey="cashAmount" name="Cash" stackId="a" fill="#10b981" />
                    <Bar dataKey="checkAmount" name="Check" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="onlineAmount" name="Online" stackId="a" fill="#0f766e" />
                    <Bar dataKey="otherAmount" name="Other" stackId="a" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Event Conversion Rates</CardTitle>
            <CardDescription>Percentage of attendees who donated</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {conversionData && conversionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={conversionData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                    <YAxis dataKey="eventName" type="category" width={100} tick={{fontSize: 12}} />
                    <RechartsTooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Conversion Rate']} />
                    <Bar dataKey="conversionRate" fill="#0f766e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cause Interest Breakdown</CardTitle>
            <CardDescription>Total donations distributed by cause</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {causeData && causeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={causeData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="totalDonated"
                      nameKey="cause"
                      label={({ cause, percent }) => `${cause} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {causeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Total']} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}