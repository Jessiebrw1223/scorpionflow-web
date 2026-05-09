import { apiRequest } from "@/services/api/http-client";
export type ProjectSummary = { id: string; name: string; status: string; progress: number; budget: number; createdAt: string; };
export async function getProjectSummary() { return apiRequest<{ data: ProjectSummary[] }>("/api/projects/summary"); }
