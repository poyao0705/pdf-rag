"use client";

import { defineToolkit } from "@assistant-ui/react";
import { DashboardCard } from "../components/dashboard";

// Execution belongs to the server Deep Agent. This registry only renders its tool results.
export default defineToolkit({
  create_dashboard: {
    type: "backend",
    display: "standalone",
    render: DashboardCard,
  },
  edit_dashboard: {
    type: "backend",
    display: "standalone",
    render: DashboardCard,
  },
});
