using Dapper;
using ScorpionFlow.Api.Contracts;
using ScorpionFlow.Api.Data;
using ScorpionFlow.Api.Security;
namespace ScorpionFlow.Api.Modules.Workspace;
public static class WorkspaceEndpoints
{
    public static IEndpointRouteBuilder MapWorkspaceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/workspace").RequireAuthorization();
        group.MapGet("/current", async (DbConnectionFactory db, CurrentUser user, CancellationToken ct) =>
        {
            const string sql = """
                select wm.owner_id as OwnerId, wm.role::text as Role, p.full_name as OwnerName
                from public.workspace_members wm
                left join public.profiles p on p.id = wm.owner_id
                where wm.user_id = @UserId and wm.active = true
                order by case when wm.owner_id = @UserId then 0 else 1 end, wm.created_at asc
                limit 1;
                """;
            await using var cn = await db.OpenConnectionAsync(ct);
            var workspace = await cn.QueryFirstOrDefaultAsync<WorkspaceContextDto>(new CommandDefinition(sql, new { user.UserId }, cancellationToken: ct));
            return workspace is null ? Results.NotFound(new { error = "No se encontró workspace activo para el usuario." }) : Results.Ok(new ApiResult<WorkspaceContextDto>(workspace));
        });
        group.MapGet("/members", async (DbConnectionFactory db, CurrentUser user, CancellationToken ct) =>
        {
            const string sql = """
                select wm.user_id as UserId, p.full_name as FullName, p.email as Email, wm.role::text as Role, wm.active as Active
                from public.workspace_members wm
                join public.workspace_members me on me.owner_id = wm.owner_id
                left join public.profiles p on p.id = wm.user_id
                where me.user_id = @UserId and me.active = true and wm.active = true
                order by wm.created_at asc;
                """;
            await using var cn = await db.OpenConnectionAsync(ct);
            var members = await cn.QueryAsync<WorkspaceMemberDto>(new CommandDefinition(sql, new { user.UserId }, cancellationToken: ct));
            return Results.Ok(new ApiResult<IEnumerable<WorkspaceMemberDto>>(members));
        });
        return app;
    }
}
