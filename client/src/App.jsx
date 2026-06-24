import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Receptionist from "./pages/Receptionist";
import WaitingRoom from "./pages/WaitingRoom";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <nav className="nav">
        <span className="nav-brand">🏥 Queue Cure <span>'26</span></span>
        <div className="nav-links">
          <Link to="/">Receptionist</Link>
          <Link to="/waiting">Waiting Room</Link>
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<Receptionist />} />
        <Route path="/waiting" element={<WaitingRoom />} />
      </Routes>
    </BrowserRouter>
  );
}
