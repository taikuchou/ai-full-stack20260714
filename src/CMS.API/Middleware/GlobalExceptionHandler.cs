using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace CMS.API.Middleware;

/// <summary>
/// Last-resort handler for **unhandled** exceptions: logs the full detail server-side and returns a
/// generic 500 that leaks nothing about the internals.
/// <para>
/// Deliberate responses (401/403, validation 400s, 404s) never reach here — they are returned by the
/// pipeline or the controllers, and this only runs when something threw.
/// </para>
/// <para>
/// The response body is a fixed string. The exception's own message must never reach the client:
/// SqlException in particular carries table and column names, and a DbException can echo the SQL.
/// The traceId is the safe half — it ties the user's screen to the logged detail.
/// </para>
/// </summary>
public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) => _logger = logger;

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        // Full detail — message, stack trace, inner exceptions — stays in the server log.
        _logger.LogError(
            exception,
            "Unhandled exception for {Method} {Path} (traceId {TraceId})",
            httpContext.Request.Method,
            httpContext.Request.Path,
            httpContext.TraceIdentifier);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;

        await httpContext.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "系統錯誤 Server error",
                Detail = "操作未完成，請稍後再試。The request could not be completed.",
                Instance = httpContext.Request.Path,
                Extensions = { ["traceId"] = httpContext.TraceIdentifier },
            },
            cancellationToken);

        return true;
    }
}
