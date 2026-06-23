using AccessibleApiTester.Endpoints;
using AccessibleApiTester.Models;
using AccessibleApiTester.Storage;
using MySqlConnector;

namespace AccessibleApiTester;

public static class WebAppFactory
{
    public static WebApplication Create(string[] args, string? contentRootPath = null)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            Args = args,
            ContentRootPath = string.IsNullOrWhiteSpace(contentRootPath)
                ? Directory.GetCurrentDirectory()
                : contentRootPath
        });

        builder.Services.AddSingleton<IAppStateStore>(services =>
        {
            var connectionString = services.GetRequiredService<IConfiguration>().GetConnectionString("SavedRequests");
            if (!string.IsNullOrWhiteSpace(connectionString))
            {
                return new MySqlRequestStore(connectionString, services.GetRequiredService<ILogger<MySqlRequestStore>>());
            }

            return new JsonRequestStore(
                services.GetRequiredService<ILogger<JsonRequestStore>>(),
                services.GetRequiredService<IConfiguration>());
        });
        builder.Services.AddSingleton<WorkspaceContext>();
        builder.Services.AddHttpClient("api-tester", client =>
        {
            client.Timeout = Timeout.InfiniteTimeSpan;
        })
        .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
        {
            AllowAutoRedirect = false,
            AutomaticDecompression = System.Net.DecompressionMethods.All
        });
        builder.Services.AddHttpClient("api-tester-no-ssl", client =>
        {
            client.Timeout = Timeout.InfiniteTimeSpan;
        })
        .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
        {
            AllowAutoRedirect = false,
            AutomaticDecompression = System.Net.DecompressionMethods.All,
            ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        });
        builder.Services.AddHttpClient("google-oauth", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(30);
        });

        var app = builder.Build();

        app.Use(async (httpContext, next) =>
        {
            try
            {
                await next(httpContext);
            }
            catch (Exception ex) when (ex is MySqlException or InvalidOperationException)
            {
                httpContext.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                httpContext.Response.ContentType = "application/json; charset=utf-8";
                await httpContext.Response.WriteAsJsonAsync(new ApiError($"Storage is unavailable: {ex.Message}"));
            }
        });

        // index.html references hashed asset filenames, so it must never be cached —
        // a stale cached copy (e.g. in WebView2's disk cache) would keep loading an old
        // bundle after a rebuild. Hashed assets are immutable and remain cacheable.
        var staticFileOptions = new StaticFileOptions
        {
            OnPrepareResponse = ctx =>
            {
                if (ctx.File.Name.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
                {
                    ctx.Context.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
                    ctx.Context.Response.Headers.Pragma = "no-cache";
                    ctx.Context.Response.Headers.Expires = "0";
                }
            }
        };

        app.UseDefaultFiles();
        app.UseStaticFiles(staticFileOptions);
        app.MapApiEndpoints();
        // The SPA fallback serves index.html through its own static-file pipeline, so it
        // needs the same no-cache options (the root "/" is served here, not by UseStaticFiles).
        app.MapFallbackToFile("index.html", staticFileOptions);

        return app;
    }
}
