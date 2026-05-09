using System.Security.Claims;
namespace ScorpionFlow.Api.Security;
public sealed class CurrentUser(IHttpContextAccessor accessor)
{
    public Guid UserId
    {
        get
        {
            var raw = accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? accessor.HttpContext?.User.FindFirstValue("sub");
            return Guid.TryParse(raw, out var id) ? id : throw new UnauthorizedAccessException("JWT inválido: no se encontró sub como UUID.");
        }
    }
    public string? Email => accessor.HttpContext?.User.FindFirstValue(ClaimTypes.Email)
        ?? accessor.HttpContext?.User.FindFirstValue("email");
}
