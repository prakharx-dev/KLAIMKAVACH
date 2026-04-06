import { lazy, Suspense } from "react";
import {
  Switch,
  Route,
  Router as WouterRouter,
  useLocation,
  Redirect,
} from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { ErrorBoundary } from "react-error-boundary";
import { HelmetProvider } from "react-helmet-async";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

const Home = lazy(() => import("@/pages/home"));
const Features = lazy(() => import("@/pages/features"));
const Pricing = lazy(() => import("@/pages/pricing"));
const About = lazy(() => import("@/pages/about"));
const Register = lazy(() => import("@/pages/register"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Claim = lazy(() => import("@/pages/claim"));
const Fraud = lazy(() => import("@/pages/fraud"));
const Admin = lazy(() => import("@/pages/admin"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

/* ── Route guards ── */
function AdminRoute() {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Redirect to="/register" />;
  if (!isAdmin) return <Redirect to="/dashboard" />;
  return <Admin />;
}

function GigworkerRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Redirect to="/register" />;
  if (isAdmin) return <Redirect to="/admin" />;
  return <Component />;
}

function GuestOnlyRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (isAuthenticated) {
    return <Redirect to={isAdmin ? "/admin" : "/dashboard"} />;
  }
  return <Component />;
}

function AdminBlockedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (isAuthenticated && isAdmin) return <Redirect to="/admin" />;
  return <Component />;
}

function NotFoundRoute() {
  const { isAuthenticated, isAdmin } = useAuth();
  if (isAuthenticated && isAdmin) return <Redirect to="/admin" />;
  return <NotFound />;
}

function RouteHandler() {
  const [location] = useLocation();

  return (
    <ErrorBoundary
      fallback={
        <div className="p-8 flex items-center justify-center h-full text-red-400">
          Something went wrong. Please refresh the page.
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="p-8 flex items-center justify-center h-full text-muted-foreground">
            Loading...
          </div>
        }
      >
        <AnimatePresence mode="wait">
          <Switch location={location} key={location}>
            <Route path="/" component={Home} />
            <Route path="/features">
              <AdminBlockedRoute component={Features} />
            </Route>
            <Route path="/pricing">
              <AdminBlockedRoute component={Pricing} />
            </Route>
            <Route path="/about">
              <AdminBlockedRoute component={About} />
            </Route>
            <Route path="/register">
              <GuestOnlyRoute component={Register} />
            </Route>
            <Route path="/dashboard">
              <GigworkerRoute component={Dashboard} />
            </Route>
            <Route path="/claim">
              <GigworkerRoute component={Claim} />
            </Route>
            <Route path="/fraud">
              <GigworkerRoute component={Fraud} />
            </Route>
            <Route path="/admin">
              <AdminRoute />
            </Route>
            <Route>
              <NotFoundRoute />
            </Route>
          </Switch>
        </AnimatePresence>
      </Suspense>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={300}>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Layout>
                <RouteHandler />
              </Layout>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;
