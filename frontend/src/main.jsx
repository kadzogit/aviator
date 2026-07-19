import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { GameProvider }          from "./context/GameContext";
import Landing  from "./pages/Landing";
import Login    from "./pages/Login";
import Register from "./pages/Register";
import Game     from "./pages/Game";
import AdminPanelEnhanced from "./components/admin/AdminPanelEnhanced";
import "./index.css";

function Private({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0e0b1e",color:"rgba(255,255,255,0.3)",fontFamily:"'Orbitron',sans-serif",fontSize:14}}>
      Loading...
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function AdminPrivate({ children }) {
  const { user, profile, loading } = useAuth();
  
  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0e0b1e",color:"rgba(255,255,255,0.3)",fontFamily:"'Orbitron',sans-serif",fontSize:14}}>
      Verifying Admin Access...
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;
  
  // Check if user has admin or superadmin role
  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  
  if (!isAdmin) {
    return (
      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#0e0b1e",color:"#fff",fontFamily:"'Orbitron',sans-serif",textAlign:"center",padding:20}}>
        <h1 style={{color:"#ff1744",fontSize:48,marginBottom:20}}>403</h1>
        <h2>ACCESS DENIED</h2>
        <p style={{opacity:0.6,marginTop:10}}>You do not have permission to view this page.</p>
        <button 
          onClick={() => window.location.href = "/game"}
          style={{marginTop:30,background:"#e8003d",color:"#fff",border:"none",padding:"12px 24px",borderRadius:8,cursor:"pointer",fontWeight:700}}
        >
          Back to Game
        </button>
      </div>
    );
  }

  return children;
}

function Public({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return !user ? children : <Navigate to="/game" replace />;
}

function AppRoutes() {
  const { profile } = useAuth();
  
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/"         element={<Landing />} />
        <Route path="/login"    element={<Public><Login /></Public>} />
        <Route path="/register" element={<Public><Register /></Public>} />
        <Route path="/game"     element={
          <Private>
            <GameProvider>
              <Game />
            </GameProvider>
          </Private>
        } />
        <Route path="/admin"    element={
          <AdminPrivate>
            <AdminPanelEnhanced adminUser={profile} />
          </AdminPrivate>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </React.StrictMode>
);
