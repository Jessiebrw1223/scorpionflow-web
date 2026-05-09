using Dapper;
using ScorpionFlow.Api.Contracts;
using ScorpionFlow.Api.Data;
using ScorpionFlow.Api.Security;
namespace ScorpionFlow.Api.Modules.Projects;
public static class ProjectEndpoints
{
    public static IEndpointRouteBuilder MapProjectEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/projects").RequireAuthorization();
        group.MapGet("/summary", async (DbConnectionFactory db, CurrentUser user, CancellationToken ct) =>
        {
            const string sql = """
                select p.id as Id, p.name as Name, p.status::text as Status, coalesce(p.progress, 0) as Progress, coalesce(p.budget, 0) as Budget, p.created_at as CreatedAt
                from public.projects p
                where public.is_workspace_member(@UserId, p.owner_id)
                  and (public.get_workspace_role(@UserId, p.owner_id) in ('owner','admin','viewer') or public.has_project_access(@UserId, p.id))
                order by p.created_at desc
                limit 50;
                """;
            await using var cn = await db.OpenConnectionAsync(ct);
            var projects = await cn.QueryAsync<ProjectSummaryDto>(new CommandDefinition(sql, new { user.UserId }, cancellationToken: ct));
            return Results.Ok(new ApiResult<IEnumerable<ProjectSummaryDto>>(projects));
        });
        return app;
    }
}
