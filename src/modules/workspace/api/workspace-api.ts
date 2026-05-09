import { apiRequest } from "@/services/api/http-client";
export type WorkspaceContext = { ownerId: string; role: "owner" | "admin" | "collaborator" | "viewer"; ownerName?: string | null; };
export type WorkspaceMember = { userId: string; fullName?: string | null; email?: string | null; role: string; active: boolean; };
export async function getCurrentWorkspace() { return apiRequest<{ data: WorkspaceContext }>("/api/workspace/current"); }
export async function getWorkspaceMembers() { return apiRequest<{ data: WorkspaceMember[] }>("/api/workspace/members"); }
