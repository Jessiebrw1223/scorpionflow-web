namespace ScorpionFlow.Api.Modules.Workspace;
public sealed record WorkspaceContextDto(Guid OwnerId, string Role, string? OwnerName);
public sealed record WorkspaceMemberDto(Guid UserId, string? FullName, string? Email, string Role, bool Active);
