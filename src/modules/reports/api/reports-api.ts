import { apiRequest } from "@/services/api/http-client";
export type ExecutiveReport = { totalProjects: number; activeProjects: number; totalBudget: number; estimatedCosts: number; estimatedMargin: number; openRisks: number; };
export async function getExecutiveReport() { return apiRequest<{ data: ExecutiveReport }>("/api/reports/executive"); }
