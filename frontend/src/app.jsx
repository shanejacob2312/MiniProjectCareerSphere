import React from "react";
import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/homepage";
import Login from "./pages/login";
import Signup from "./pages/signup";
import Dashboard from "./pages/dashboard";
import ResumeInput from "./pages/resumeinput"; 
import ResumeBuilder from "./pages/resumebuilder"; 
import UploadResume from "./pages/uploadresume";
import ForgotPassword from "./pages/forgotpassword";
import AIAnalysis from "./pages/aianalysis";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/resumeinput" element={<ResumeInput />} />
      <Route path="/resumebuilder" element={<ResumeBuilder />} />
      <Route path="/uploadresume" element={<UploadResume />} />
      <Route path="/forgotpassword" element={<ForgotPassword />} />
      <Route path="/aianalysis" element={<AIAnalysis />} />
    </Routes>
  );
};

export default App;
