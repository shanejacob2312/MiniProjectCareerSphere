import React from "react";
import Dashboard from "./pages/dashboard";
import Login from "./pages/login";
import Signup from "./pages/signup";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/homepage";
import CreateResume from "./pages/createresume"; 
import UploadResume from "./pages/uploadresume"; 

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/createresume" element={<CreateResume />} />
      <Route path = "/uploadresume" element={<UploadResume />} />
    </Routes>
  );
};

export default App;
