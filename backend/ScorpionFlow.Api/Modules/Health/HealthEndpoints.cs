using Dapper;
using ScorpionFlow.Api.Data;
namespace ScorpionFlow.Api.Modules.Health;
public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/health", () => Results.Ok(new { service = "ScorpionFlow.Api", status = "ok", timeUtc = DateTimeOffset.UtcNow })).AllowAnonymous();
        app.MapGet("/api/health/db", async (DbConnectionFactory db, CancellationToken ct) =>
        {
            await using var cn = await db.OpenConnectionAsync(ct);
            var result = await cn.ExecuteScalarAsync<int>(new CommandDefinition("select 1", cancellationToken: ct));
            return Results.Ok(new { database = result == 1 ? "ok" : "unknown" });
        }).RequireAuthorization();
        return app;
    }
}
