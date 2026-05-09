using System.Net;
using System.Text.Json;
namespace ScorpionFlow.Api.Middleware;
public sealed class ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try { await next(context); }
        catch (UnauthorizedAccessException ex) { await WriteErrorAsync(context, HttpStatusCode.Unauthorized, ex.Message); }
        catch (InvalidOperationException ex) { await WriteErrorAsync(context, HttpStatusCode.BadRequest, ex.Message); }
        catch (Exception ex) { logger.LogError(ex, "Unhandled API error"); await WriteErrorAsync(context, HttpStatusCode.InternalServerError, "Error interno del servidor."); }
    }
    private static async Task WriteErrorAsync(HttpContext context, HttpStatusCode status, string message)
    {
        context.Response.StatusCode = (int)status;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync(JsonSerializer.Serialize(new { error = message }));
    }
}
