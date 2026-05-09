namespace ScorpionFlow.Api.Modules.Projects;
public sealed record ProjectSummaryDto(Guid Id, string Name, string Status, int Progress, decimal Budget, DateTimeOffset CreatedAt);
