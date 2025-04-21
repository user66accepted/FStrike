import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoutes";

// Lazy load pages for code splitting
const Home = lazy(() => import("../pages/HomePage"));
const Login = lazy(() => import("../pages/LoginPage"));
//const NotFound = lazy(() => import("../pages/NotFound"));

function AppRoutes() {
  return (
    <BrowserRouter>
      {/* Suspense will show a fallback while components load */}
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>

          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />

          {/* Catch-all for non-existing routes */}
          {/*<Route path="*" element={<NotFound />} />*/}
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default AppRoutes;
