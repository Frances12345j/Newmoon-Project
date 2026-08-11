import { Routes, Route, Navigate } from "react-router-dom";

// Layout
import Layout from "./Layout/Layout.jsx";

// Admin
import Dashboard from "./Admin/Dashboard.jsx";
import BranchDetails from "./Admin/BranchDetails.jsx";
import Login from "./Admin/Login.jsx";
import Attendance from "./Admin/AttendanceSheet.jsx";
import ProductList from "./Admin/ProductList.jsx";
import StaffList from "./Admin/Staff.jsx";
import BranchAssignments from "./Admin/BranchAssignments.jsx";
import EmployeeTracker from "./Admin/EmployeeTracker.jsx";
import BranchMap from "./Admin/BranchMap.jsx";
import RequestAdmin from "./Admin/RequestAdmin.jsx";
import CashAdvance from "./Admin/CashAdvance.jsx";
import SupplyRequest from "./Admin/SupplyRequest.jsx";
import StaffPerformance from "./Admin/StaffPerformance.jsx";
import BackToSale from "./Admin/BackToSale.jsx";
import PullOutAdmin from "./Admin/PullOutAdmin.jsx";
import Customers from "./Admin/Customers.jsx";
import Reservations from "./Admin/Reservations.jsx";
import SalesRecord from "./Admin/SalesRecord.jsx";

// Reports
import SalesReport from "./Reports/SalesReport.jsx";
import InventoryReport from "./Reports/InventoryReport.jsx";
import AttendanceReport from "./Reports/AttendanceReport.jsx";
import BranchReport from "./Reports/BranchReport.jsx";
import PullOutReport from "./Reports/PullOutReport.jsx";
import DeliveryReport from "./Reports/DeliveryReport.jsx";
import ReportGeneration from "./Reports/ReportGeneration.jsx";

// Auth
import ProtectedRoute from "./ProtectedRoute.jsx";

function App() {
  return (
    <Routes>
      {/* Default route - redirect to login */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/branch/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <BranchDetails />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/branch-map"
        element={
          <ProtectedRoute>
            <Layout>
              <BranchMap />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <Layout>
              <Attendance />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/sales"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <SalesRecord />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/customers"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <Customers />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/reservations"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <Reservations />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/inventory"
        element={
          <ProtectedRoute>
            <Layout>
              <ProductList />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/cash-advance"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <CashAdvance />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/supply-requests"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <SupplyRequest />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/staff-performance"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <StaffPerformance />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/staff"
        element={
          <ProtectedRoute>
            <Layout>
              <StaffList />
            </Layout>
          </ProtectedRoute>
        }
      />
      
      {/* Branch Assignments - corrected path */}
      <Route
        path="/branch-assign"
        element={
          <ProtectedRoute>
            <Layout>
              <BranchAssignments />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Redirect from old path to new */}
      <Route
        path="/branch-assignments"
        element={<Navigate to="/branch-assign" replace />}
      />

      <Route
        path="/RequestAdmin"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <RequestAdmin />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/pullout-admin"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <PullOutAdmin />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/back-to-sales"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <BackToSale />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      {/* Reports Routes */}
      <Route
        path="/reports"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <ReportGeneration />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/reports/sales"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <SalesReport />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/reports/inventory"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <InventoryReport />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/reports/attendance"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <AttendanceReport />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/reports/branch"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <BranchReport />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/reports/pullout"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <PullOutReport />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/employee-tracker"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <EmployeeTracker />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      <Route
        path="/delivery"
        element={
          localStorage.getItem("role") === "admin" ? (
            <ProtectedRoute>
              <Layout>
                <DeliveryReport />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      {/* Catch all - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;