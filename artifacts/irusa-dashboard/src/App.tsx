import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/Layout";

import Dashboard from "@/pages/Dashboard";
import EventsList from "@/pages/events/EventsList";
import EventNew from "@/pages/events/EventNew";
import EventDetail from "@/pages/events/EventDetail";
import DonorsList from "@/pages/donors/DonorsList";
import DonorNew from "@/pages/donors/DonorNew";
import DonorProfile from "@/pages/donors/DonorProfile";
import Reports from "@/pages/Reports";
import ImportData from "@/pages/ImportData";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/events/new" component={EventNew} />
        <Route path="/events/:id" component={EventDetail} />
        <Route path="/events" component={EventsList} />
        <Route path="/donors/new" component={DonorNew} />
        <Route path="/donors/:id" component={DonorProfile} />
        <Route path="/donors" component={DonorsList} />
        <Route path="/reports" component={Reports} />
        <Route path="/import" component={ImportData} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
