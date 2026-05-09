using Dapper;
using ScorpionFlow.Api.Contracts;
using ScorpionFlow.Api.Data;
using ScorpionFlow.Api.Security;
namespace ScorpionFlow.Api.Modules.Reports;
public static class ReportsEndpoints
{
    public static IEndpointRouteBuilder MapReportsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/reports").RequireAuthorization();
        group.MapGet("/executive", async (DbConnectionFactory db, CurrentUser user, CancellationToken ct) =>
        {
            const string sql = """
                with visible_projects as (
                  select p.* from public.projects p
                  where public.is_workspace_member(@UserId, p.owner_id)
                    and (public.get_workspace_role(@UserId, p.owner_id) in ('owner','admin','viewer') or public.has_project_access(@UserId, p.id))
                ), costs as (
                  select coalesce(sum(vp.actual_cost), 0) + coalesce((select sum(pr.total_cost) from public.project_resources pr join visible_projects vp2 on vp2.id = pr.project_id where pr.status = 'active'), 0) as total_costs
                  from visible_projects vp
                ), risks as (
                  select count(*)::int as open_risks from public.risks r
                  where public.is_workspace_member(@UserId, r.owner_id) and r.status::text in ('open','in_treatment')
                )
                select count(vp.id)::int as TotalProjects,
                       count(vp.id) filter (where vp.status::text in ('on_track','at_risk','over_budget'))::int as ActiveProjects,
                       coalesce(sum(vp.budget), 0) as TotalBudget,
                       (select total_costs from costs) as EstimatedCosts,
                       coalesce(sum(vp.budget), 0) - (select total_costs from costs) as EstimatedMargin,
                       (select open_risks from risks) as OpenRisks
                from visible_projects vp;
                """;
            await using var cn = await db.OpenConnectionAsync(ct);
            var report = await cn.QueryFirstAsync<ExecutiveReportDto>(new CommandDefinition(sql, new { user.UserId }, cancellationToken: ct));
            return Results.Ok(new ApiResult<ExecutiveReportDto>(report));
        });
        return app;
    }
}
