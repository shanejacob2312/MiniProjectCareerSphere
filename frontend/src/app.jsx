import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/navbar";
import Homepage from "./pages/homepage";
import ResumeBuilder from "./pages/resumebuilder";
import AIAnalysis from "./pages/AIAnalysis";
import "./styles/App.css";
import Login from "./pages/login";
import Signup from "./pages/signup";
import Dashboard from "./pages/dashboard";
import ResumeInput from "./pages/resumeinput";
import UploadResume from "./pages/uploadresume";
import ForgotPassword from "./pages/forgotpassword";
import ResetPassword from "./pages/resetpassword";

const App = () => {
  const location = useLocation();
  const showNavbar = !['/', '/login', '/signup', '/forgotpassword', '/reset-password'].includes(location.pathname);

  return (
    <div className="App">
      {showNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/resumeinput" element={<ResumeInput />} />
        <Route path="/resumebuilder" element={<ResumeBuilder />} />
        <Route path="/uploadresume" element={<UploadResume />} />
        <Route path="/forgotpassword" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/aianalysis" element={<AIAnalysis />} />
      </Routes>
    </div>
  );
};

export default App;
