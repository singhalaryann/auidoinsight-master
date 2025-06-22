import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { SignupPage } from "./pages/signup";
import { Toaster } from "@/components/ui/toaster";
import { buttonVariants } from "@/components/ui/button";

// A placeholder for the dashboard you'll build in the next steps.
function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p>Welcome! You have successfully signed up or logged in.</p>
      <Link to="/" className={buttonVariants({ variant: "link", className: "mt-4" })}>
        Back to Home
      </Link>
    </div>
  );
}

function App() {
  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<SignupPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </Router>
      <Toaster />
    </>
  );
}

export default App;
