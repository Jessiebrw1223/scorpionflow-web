namespace ScorpionFlow.Api.Modules.Reports;
public sealed record ExecutiveReportDto(int TotalProjects, int ActiveProjects, decimal TotalBudget, decimal EstimatedCosts, decimal EstimatedMargin, int OpenRisks);
