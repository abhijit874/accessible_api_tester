using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using AccessibleApiTester.Models;
using AccessibleApiTester.Storage;
using MySqlConnector;

namespace AccessibleApiTester.Endpoints;

static class ApiEndpoints
{
    public static void MapApiEndpoints(this WebApplication app)
    {
        app.MapGet("/api/workspaces", async (IAppStateStore store, CancellationToken cancellationToken) =>
        {
            return Results.Ok(await store.LoadWorkspacesAsync(cancellationToken));
        });

        app.MapGet("/api/workspaces/active", async (IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            var workspaces = await store.LoadWorkspacesAsync(cancellationToken);
            var active = workspaces.FirstOrDefault(w => string.Equals(w.Id, context.WorkspaceId, StringComparison.OrdinalIgnoreCase))
                ?? new WorkspaceItem(context.WorkspaceId, context.WorkspaceId == "default" ? "Default" : context.WorkspaceId, DateTimeOffset.UtcNow.ToString("O"));
            return Results.Ok(active);
        });

        app.MapPut("/api/workspaces/active", (string workspaceId, WorkspaceContext context) =>
        {
            context.WorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId);
            return Results.NoContent();
        });

        app.MapPut("/api/workspaces/{id}", async (string id, WorkspaceItem item, IAppStateStore store, CancellationToken cancellationToken) =>
        {
            if (!string.Equals(id, item.Id, StringComparison.Ordinal))
            {
                return Results.BadRequest(new ApiError("Workspace ID did not match the route."));
            }

            await store.UpsertWorkspaceAsync(item, cancellationToken);
            return Results.NoContent();
        });

        app.MapDelete("/api/workspaces/{id}", async (string id, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            await store.DeleteWorkspaceAsync(id, cancellationToken);
            if (string.Equals(context.WorkspaceId, id, StringComparison.Ordinal))
            {
                context.WorkspaceId = "default";
            }
            return Results.NoContent();
        });

        app.MapGet("/api/store", async (string? workspaceId, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            try
            {
                var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
                context.WorkspaceId = normalizedWorkspaceId;
                return Results.Ok(await store.LoadAsync(normalizedWorkspaceId, cancellationToken));
            }
            catch (Exception ex) when (ex is MySqlException or InvalidOperationException)
            {
                return Results.Json(new ApiError($"Saved request storage is unavailable: {ex.Message}"), statusCode: StatusCodes.Status503ServiceUnavailable);
            }
        });

        app.MapPut("/api/store", async (string? workspaceId, AppState state, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            try
            {
                var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
                context.WorkspaceId = normalizedWorkspaceId;
                await store.SaveAsync(normalizedWorkspaceId, state, cancellationToken);
                return Results.NoContent();
            }
            catch (Exception ex) when (ex is MySqlException or InvalidOperationException)
            {
                return Results.Json(new ApiError($"Saved request storage is unavailable: {ex.Message}"), statusCode: StatusCodes.Status503ServiceUnavailable);
            }
        });

        app.MapGet("/api/history", async (string? workspaceId, string? query, int? skip, int? take, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            var paging = NormalizePaging(skip, take);
            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            return Results.Ok(await store.QueryHistoryAsync(normalizedWorkspaceId, query, paging.Skip, paging.Take, cancellationToken));
        });

        app.MapPut("/api/history/{id}", async (string id, string? workspaceId, SavedHistoryItem item, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            if (!string.Equals(id, item.Id, StringComparison.Ordinal))
            {
                return Results.BadRequest(new ApiError("History item ID did not match the route."));
            }

            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            await store.UpsertHistoryAsync(normalizedWorkspaceId, item, cancellationToken);
            return Results.NoContent();
        });

        app.MapDelete("/api/history/{id}", async (string id, string? workspaceId, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            await store.DeleteHistoryAsync(normalizedWorkspaceId, id, cancellationToken);
            return Results.NoContent();
        });

        app.MapDelete("/api/history", async (string? workspaceId, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            await store.ClearHistoryAsync(normalizedWorkspaceId, cancellationToken);
            return Results.NoContent();
        });

        app.MapGet("/api/collections", async (string? workspaceId, string? query, int? skip, int? take, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            var paging = NormalizePaging(skip, take);
            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            return Results.Ok(await store.QueryCollectionsAsync(normalizedWorkspaceId, query, paging.Skip, paging.Take, cancellationToken));
        });

        app.MapPut("/api/collections/{id}", async (string id, string? workspaceId, SavedRequestItem item, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            if (!string.Equals(id, item.Id, StringComparison.Ordinal))
            {
                return Results.BadRequest(new ApiError("Saved request ID did not match the route."));
            }

            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            await store.UpsertCollectionAsync(normalizedWorkspaceId, item, cancellationToken);
            return Results.NoContent();
        });

        app.MapDelete("/api/collections/{id}", async (string id, string? workspaceId, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            await store.DeleteCollectionAsync(normalizedWorkspaceId, id, cancellationToken);
            return Results.NoContent();
        });

        app.MapDelete("/api/collections", async (string? workspaceId, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            await store.ClearCollectionsAsync(normalizedWorkspaceId, cancellationToken);
            return Results.NoContent();
        });

        app.MapPut("/api/environments/{id}", async (string id, string? workspaceId, EnvironmentVariableItem item, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            if (!string.Equals(id, item.Id, StringComparison.Ordinal))
            {
                return Results.BadRequest(new ApiError("Variable ID did not match the route."));
            }

            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            await store.UpsertEnvironmentAsync(normalizedWorkspaceId, item, cancellationToken);
            return Results.NoContent();
        });

        app.MapDelete("/api/environments/{id}", async (string id, string? workspaceId, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            await store.DeleteEnvironmentAsync(normalizedWorkspaceId, id, cancellationToken);
            return Results.NoContent();
        });

        app.MapDelete("/api/environments", async (string? workspaceId, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            await store.ClearEnvironmentsAsync(normalizedWorkspaceId, cancellationToken);
            return Results.NoContent();
        });

        app.MapPut("/api/collection-variables/{id}", async (string id, string? workspaceId, EnvironmentVariableItem item, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            if (!string.Equals(id, item.Id, StringComparison.Ordinal))
                return Results.BadRequest(new ApiError("Variable ID did not match the route."));
            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            await store.UpsertCollectionVariableAsync(normalizedWorkspaceId, item, cancellationToken);
            return Results.NoContent();
        });

        app.MapDelete("/api/collection-variables/{id}", async (string id, string? workspaceId, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            await store.DeleteCollectionVariableAsync(normalizedWorkspaceId, id, cancellationToken);
            return Results.NoContent();
        });

        app.MapDelete("/api/collection-variables", async (string? workspaceId, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            await store.ClearCollectionVariablesAsync(normalizedWorkspaceId, cancellationToken);
            return Results.NoContent();
        });

        app.MapPut("/api/mocks/{id}", async (string id, string? workspaceId, MockRouteItem item, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            if (!string.Equals(id, item.Id, StringComparison.Ordinal))
            {
                return Results.BadRequest(new ApiError("Mock route ID did not match the route."));
            }

            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            await store.UpsertMockAsync(normalizedWorkspaceId, item, cancellationToken);
            return Results.NoContent();
        });

        app.MapDelete("/api/mocks/{id}", async (string id, string? workspaceId, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            await store.DeleteMockAsync(normalizedWorkspaceId, id, cancellationToken);
            return Results.NoContent();
        });

        app.MapDelete("/api/mocks", async (string? workspaceId, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            await store.ClearMocksAsync(normalizedWorkspaceId, cancellationToken);
            return Results.NoContent();
        });

        app.MapDelete("/api/mock-state", async (string path, string? workspaceId, IAppStateStore store, WorkspaceContext context, CancellationToken cancellationToken) =>
        {
            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId ?? context.WorkspaceId);
            var normalizedPath = NormalizeMockPath(path);
            var state = await store.LoadAsync(normalizedWorkspaceId, cancellationToken);
            var stateMock = state.Mocks.FirstOrDefault(item =>
                string.Equals(item.Method, "GET", StringComparison.OrdinalIgnoreCase) &&
                string.Equals(NormalizeMockPath(item.Path), normalizedPath, StringComparison.OrdinalIgnoreCase));
            if (stateMock is not null)
            {
                await store.DeleteMockAsync(normalizedWorkspaceId, stateMock.Id, cancellationToken);
            }

            return Results.NoContent();
        });

        app.MapGet("/oauth/google/callback", (HttpRequest request) =>
        {
            var code = System.Text.Json.JsonSerializer.Serialize(request.Query["code"].ToString());
            var state = System.Text.Json.JsonSerializer.Serialize(request.Query["state"].ToString());
            var error = System.Text.Json.JsonSerializer.Serialize(request.Query["error"].ToString());
            var errorDescription = System.Text.Json.JsonSerializer.Serialize(request.Query["error_description"].ToString());

            var html = $$"""
                <!doctype html>
                <html lang="en">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>Google sign-in returned</title>
                </head>
                <body>
                  <p>Returning to Accessible API Tester.</p>
                  <script>
                    sessionStorage.setItem("accessible-api-tester-google-oauth-callback", JSON.stringify({
                      code: {{code}},
                      state: {{state}},
                      error: {{error}},
                      errorDescription: {{errorDescription}}
                    }));
                    location.replace("/");
                  </script>
                </body>
                </html>
                """;

            return Results.Content(html, "text/html", Encoding.UTF8);
        });

        app.MapPost("/api/oauth/google/token", async (GoogleTokenRequest request, IHttpClientFactory httpClientFactory, CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(request.Code))
            {
                return Results.BadRequest(new ApiError("Google did not return an authorization code."));
            }

            if (string.IsNullOrWhiteSpace(request.ClientId))
            {
                return Results.BadRequest(new ApiError("Enter a Google OAuth client ID."));
            }

            if (string.IsNullOrWhiteSpace(request.RedirectUri) ||
                !Uri.TryCreate(request.RedirectUri, UriKind.Absolute, out var redirectUri) ||
                (redirectUri.Scheme != Uri.UriSchemeHttp && redirectUri.Scheme != Uri.UriSchemeHttps))
            {
                return Results.BadRequest(new ApiError("Enter a valid Google OAuth redirect URI."));
            }

            if (string.IsNullOrWhiteSpace(request.CodeVerifier))
            {
                return Results.BadRequest(new ApiError("The PKCE code verifier is missing. Start Google sign-in again."));
            }

            var values = new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["code"] = request.Code.Trim(),
                ["client_id"] = request.ClientId.Trim(),
                ["redirect_uri"] = request.RedirectUri.Trim(),
                ["code_verifier"] = request.CodeVerifier.Trim()
            };

            if (!string.IsNullOrWhiteSpace(request.ClientSecret))
            {
                values["client_secret"] = request.ClientSecret.Trim();
            }

            var client = httpClientFactory.CreateClient("google-oauth");
            using var content = new FormUrlEncodedContent(values);

            try
            {
                using var response = await client.PostAsync("https://oauth2.googleapis.com/token", content, cancellationToken);
                var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
                return Results.Content(responseBody, "application/json", Encoding.UTF8, statusCode: (int)response.StatusCode);
            }
            catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                return Results.Json(new ApiError("Google token exchange timed out after 30 seconds."), statusCode: StatusCodes.Status408RequestTimeout);
            }
            catch (HttpRequestException ex)
            {
                return Results.BadRequest(new ApiError(ex.Message));
            }
        });

        app.MapPost("/api/send", async (ApiRequest request, IHttpClientFactory httpClientFactory, CancellationToken cancellationToken) =>
        {
            if (!Uri.TryCreate(request.Url, UriKind.Absolute, out var uri) ||
                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                return Results.BadRequest(new ApiError("Enter a valid HTTP or HTTPS URL."));
            }

            if (string.IsNullOrWhiteSpace(request.Method))
            {
                return Results.BadRequest(new ApiError("Choose a request method."));
            }

            var mediaType = string.IsNullOrWhiteSpace(request.ContentType)
                ? "application/json"
                : request.ContentType.Trim();
            if (!MediaTypeHeaderValue.TryParse(mediaType, out var parsedContentType))
            {
                return Results.BadRequest(new ApiError("Enter a valid body content type."));
            }

            using var message = new HttpRequestMessage(new HttpMethod(request.Method.Trim().ToUpperInvariant()), uri);

            var body = request.Body ?? string.Empty;
            var hasFiles = request.FileFields?.Length > 0;
            var isMultipart = mediaType.Contains("multipart/form-data", StringComparison.OrdinalIgnoreCase);

            if (isMultipart || hasFiles)
            {
                var multipart = new MultipartFormDataContent();
                foreach (var pair in ParseFormValues(body))
                {
                    multipart.Add(new StringContent(pair.Value), pair.Key);
                }
                foreach (var file in request.FileFields ?? [])
                {
                    if (string.IsNullOrWhiteSpace(file.Base64Content)) continue;
                    byte[] bytes;
                    try { bytes = Convert.FromBase64String(file.Base64Content); }
                    catch { continue; }
                    var fileContent = new ByteArrayContent(bytes);
                    if (MediaTypeHeaderValue.TryParse(
                            string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
                            out var fileMediaType))
                    {
                        fileContent.Headers.ContentType = fileMediaType;
                    }
                    multipart.Add(fileContent, file.Name ?? "", file.FileName ?? "upload");
                }
                message.Content = multipart;
            }
            else if (!string.IsNullOrWhiteSpace(body))
            {
                message.Content = new StringContent(body, Encoding.UTF8);
                message.Content.Headers.ContentType = parsedContentType;
            }

            foreach (var header in request.Headers ?? [])
            {
                if (string.IsNullOrWhiteSpace(header.Name))
                {
                    continue;
                }

                var name = header.Name.Trim();
                var value = header.Value ?? string.Empty;
                if (string.Equals(name, "Content-Type", StringComparison.OrdinalIgnoreCase))
                {
                    if (message.Content is not null)
                    {
                        if (!MediaTypeHeaderValue.TryParse(value, out var contentTypeHeader))
                        {
                            return Results.BadRequest(new ApiError("Enter a valid Content-Type header."));
                        }

                        message.Content.Headers.ContentType = contentTypeHeader;
                    }
                    continue;
                }

                if (!message.Headers.TryAddWithoutValidation(name, value) && message.Content is not null)
                {
                    message.Content.Headers.TryAddWithoutValidation(name, value);
                }
            }

            HttpClientHandler? proxyHandler = null;
            if (!string.IsNullOrWhiteSpace(request.ProxyUrl))
            {
                if (!Uri.TryCreate(request.ProxyUrl.Trim(), UriKind.Absolute, out var proxyUri) ||
                    (proxyUri.Scheme != Uri.UriSchemeHttp && proxyUri.Scheme != Uri.UriSchemeHttps))
                {
                    return Results.BadRequest(new ApiError("Enter a valid HTTP or HTTPS proxy URL."));
                }

                var proxy = new WebProxy(proxyUri.GetComponents(UriComponents.SchemeAndServer, UriFormat.Unescaped));
                if (!string.IsNullOrEmpty(proxyUri.UserInfo))
                {
                    var infoParts = proxyUri.UserInfo.Split(':', 2);
                    proxy.Credentials = new NetworkCredential(
                        Uri.UnescapeDataString(infoParts[0]),
                        infoParts.Length > 1 ? Uri.UnescapeDataString(infoParts[1]) : string.Empty);
                }

                proxyHandler = new HttpClientHandler
                {
                    Proxy = proxy,
                    UseProxy = true,
                    AllowAutoRedirect = false,
                    AutomaticDecompression = System.Net.DecompressionMethods.All,
                    ServerCertificateCustomValidationCallback = request.IgnoreSslErrors
                        ? HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
                        : null
                };
            }

            HttpClient? ownedClient = proxyHandler is not null
                ? new HttpClient(proxyHandler, disposeHandler: true) { Timeout = Timeout.InfiniteTimeSpan }
                : null;
            var client = ownedClient ?? httpClientFactory.CreateClient(request.IgnoreSslErrors ? "api-tester-no-ssl" : "api-tester");
            var timeoutMs = request.TimeoutMs is > 0 ? request.TimeoutMs.Value : 60_000;
            using var timeoutCts = new CancellationTokenSource(timeoutMs);
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);
            var stopwatch = Stopwatch.StartNew();

            try
            {
                using var response = await client.SendAsync(message, HttpCompletionOption.ResponseHeadersRead, linkedCts.Token);
                var contentTypeMime = response.Content.Headers.ContentType?.MediaType ?? "";
                var isBinary = IsBinaryContentType(contentTypeMime);
                string responseBody;
                if (isBinary)
                {
                    var bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
                    responseBody = Convert.ToBase64String(bytes);
                }
                else
                {
                    responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
                }
                stopwatch.Stop();

                var headers = response.Headers
                    .Concat(response.Content.Headers)
                    .SelectMany(h => h.Value.Select(value => new ApiHeader(h.Key, value)))
                    .OrderBy(h => h.Name, StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                return Results.Ok(new ApiResponse(
                    (int)response.StatusCode,
                    response.ReasonPhrase ?? string.Empty,
                    stopwatch.ElapsedMilliseconds,
                    headers,
                    responseBody,
                    isBinary));
            }
            catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                var seconds = timeoutMs / 1000.0;
                var label = seconds == Math.Floor(seconds) ? $"{(int)seconds}" : $"{seconds:0.#}";
                return Results.Json(new ApiError($"The request timed out after {label} second{(seconds == 1 ? "" : "s")}."), statusCode: StatusCodes.Status408RequestTimeout);
            }
            catch (Exception ex) when (ex is HttpRequestException or InvalidOperationException or FormatException)
            {
                return Results.BadRequest(new ApiError(ex.Message));
            }
            finally
            {
                ownedClient?.Dispose();
            }
        });

        app.MapMethods("/mock/{**mockPath}", ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"], async (
            string? mockPath,
            HttpRequest request,
            IAppStateStore store,
            WorkspaceContext context,
            CancellationToken cancellationToken) =>
        {
            var state = await store.LoadAsync(context.WorkspaceId, cancellationToken);
            var requestedPath = NormalizeMockPath(mockPath);
            var requestedMethod = request.Method.Trim().ToUpperInvariant();
            var mock = state.Mocks.FirstOrDefault(item =>
                string.Equals(item.Method, requestedMethod, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(NormalizeMockPath(item.Path), requestedPath, StringComparison.OrdinalIgnoreCase));

            if (mock is null)
            {
                if (string.Equals(requestedMethod, "DELETE", StringComparison.OrdinalIgnoreCase))
                {
                    var stateMock = state.Mocks.FirstOrDefault(item =>
                        string.Equals(item.Method, "GET", StringComparison.OrdinalIgnoreCase) &&
                        string.Equals(NormalizeMockPath(item.Path), requestedPath, StringComparison.OrdinalIgnoreCase));
                    if (stateMock is not null)
                    {
                        await store.DeleteMockAsync(context.WorkspaceId, stateMock.Id, cancellationToken);
                        return Results.NoContent();
                    }
                }

                return Results.Json(new ApiError($"No mock route found for {requestedMethod} /mock{requestedPath}."), statusCode: StatusCodes.Status404NotFound);
            }

            if (string.Equals(requestedMethod, "DELETE", StringComparison.OrdinalIgnoreCase))
            {
                var stateMock = state.Mocks.FirstOrDefault(item =>
                    string.Equals(item.Method, "GET", StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(NormalizeMockPath(item.Path), requestedPath, StringComparison.OrdinalIgnoreCase));
                if (stateMock is not null)
                {
                    await store.DeleteMockAsync(context.WorkspaceId, stateMock.Id, cancellationToken);
                }
            }

            if (IsStateChangingMockMethod(requestedMethod))
            {
                var requestBody = await ReadRequestBodyAsync(request, cancellationToken);
                if (!string.IsNullOrWhiteSpace(requestBody))
                {
                    var nextBody = string.Equals(requestedMethod, "PATCH", StringComparison.OrdinalIgnoreCase)
                        ? MergePatchBody(mock.Body, requestBody)
                        : requestBody;
                    var updatedAt = DateTimeOffset.UtcNow.ToString("O");
                    var updatedMock = mock with { Body = nextBody, UpdatedAt = updatedAt };
                    await store.UpsertMockAsync(context.WorkspaceId, updatedMock, cancellationToken);

                    var getMock = state.Mocks.FirstOrDefault(item =>
                        string.Equals(item.Method, "GET", StringComparison.OrdinalIgnoreCase) &&
                        string.Equals(NormalizeMockPath(item.Path), requestedPath, StringComparison.OrdinalIgnoreCase));
                    var resourceMock = getMock is null
                        ? new MockRouteItem(
                            $"state-{Guid.NewGuid():N}",
                            $"State {requestedPath}",
                            "GET",
                            requestedPath,
                            StatusCodes.Status200OK,
                            mock.ContentType,
                            mock.Headers,
                            nextBody,
                            updatedAt)
                        : getMock with { Body = nextBody, ContentType = mock.ContentType, Headers = mock.Headers, UpdatedAt = updatedAt };
                    await store.UpsertMockAsync(context.WorkspaceId, resourceMock, cancellationToken);

                    mock = updatedMock;
                }
            }

            if (mock.DelayMs is > 0)
            {
                await Task.Delay(Math.Min(mock.DelayMs.Value, 30_000), cancellationToken);
            }

            var envVars = state.Environments.ToDictionary(e => e.Name, e => e.Value, StringComparer.OrdinalIgnoreCase);
            var resolvedBody = ResolveTemplateVariables(mock.Body, envVars);
            var resolvedHeaders = ResolveTemplateVariables(mock.Headers, envVars);
            var headers = ParseMockHeaders(resolvedHeaders);
            return new MockRouteResult(mock.StatusCode, mock.ContentType, resolvedBody, headers);
        });
    }

    private static bool IsBinaryContentType(string contentType)
    {
        var ct = contentType.Split(';')[0].Trim().ToLowerInvariant();
        if (ct == "image/svg+xml") return false; // SVG is XML text
        if (ct.StartsWith("image/", StringComparison.Ordinal)) return true;
        if (ct.StartsWith("audio/", StringComparison.Ordinal)) return true;
        if (ct.StartsWith("video/", StringComparison.Ordinal)) return true;
        return ct is "application/pdf" or "application/octet-stream"
            or "application/zip" or "application/x-zip-compressed" or "application/x-gzip";
    }

    private static IEnumerable<KeyValuePair<string, string>> ParseFormValues(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) yield break;
        foreach (var pair in body.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var eqIdx = pair.IndexOf('=');
            var key = eqIdx < 0 ? Uri.UnescapeDataString(pair.Trim()) : Uri.UnescapeDataString(pair[..eqIdx].Trim());
            var val = eqIdx < 0 ? "" : Uri.UnescapeDataString(pair[(eqIdx + 1)..].Trim());
            if (!string.IsNullOrWhiteSpace(key))
                yield return new KeyValuePair<string, string>(key, val);
        }
    }

    private static bool IsStateChangingMockMethod(string method) =>
        string.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(method, "PUT", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(method, "PATCH", StringComparison.OrdinalIgnoreCase);

    private static async Task<string> ReadRequestBodyAsync(HttpRequest request, CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, leaveOpen: true);
        return await reader.ReadToEndAsync(cancellationToken);
    }

    private static string MergePatchBody(string? currentBody, string patchBody)
    {
        try
        {
            var current = string.IsNullOrWhiteSpace(currentBody) ? new JsonObject() : JsonNode.Parse(currentBody);
            var patch = JsonNode.Parse(patchBody);
            if (current is JsonObject currentObject && patch is JsonObject patchObject)
            {
                foreach (var property in patchObject)
                {
                    currentObject[property.Key] = property.Value?.DeepClone();
                }

                return currentObject.ToJsonString(new JsonSerializerOptions { WriteIndented = true });
            }
        }
        catch (JsonException)
        {
        }

        return patchBody;
    }

    private static string NormalizeMockPath(string? path)
    {
        var normalized = $"/{(path ?? string.Empty).Trim().TrimStart('/')}";
        return normalized == "/" ? "/" : normalized.TrimEnd('/');
    }

    private static (int Skip, int Take) NormalizePaging(int? skip, int? take)
    {
        var normalizedSkip = Math.Max(0, skip ?? 0);
        var normalizedTake = Math.Clamp(take ?? 25, 1, 100);
        return (normalizedSkip, normalizedTake);
    }

    private static string ResolveTemplateVariables(string? text, Dictionary<string, string> variables)
    {
        if (string.IsNullOrEmpty(text) || variables.Count == 0) return text ?? "";
        return System.Text.RegularExpressions.Regex.Replace(
            text,
            @"\{\{\s*([A-Za-z_][A-Za-z0-9_.\-]*)\s*\}\}",
            match => variables.TryGetValue(match.Groups[1].Value, out var value) ? value : match.Value);
    }

    private static ApiHeader[] ParseMockHeaders(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return [];
        }

        return text
            .Split(["\r\n", "\n"], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(line =>
            {
                var separator = line.IndexOf(':');
                return separator < 1
                    ? null
                    : new ApiHeader(line[..separator].Trim(), line[(separator + 1)..].Trim());
            })
            .Where(header => header is not null && !string.Equals(header.Name, "Content-Type", StringComparison.OrdinalIgnoreCase))
            .Cast<ApiHeader>()
            .ToArray();
    }
}

sealed class MockRouteResult(int statusCode, string? contentType, string? body, ApiHeader[] headers) : IResult
{
    public async Task ExecuteAsync(HttpContext httpContext)
    {
        httpContext.Response.StatusCode = statusCode is >= 100 and <= 599
            ? statusCode
            : StatusCodes.Status200OK;
        httpContext.Response.ContentType = string.IsNullOrWhiteSpace(contentType)
            ? "application/json; charset=utf-8"
            : contentType.Trim();

        foreach (var header in headers)
        {
            if (!string.IsNullOrWhiteSpace(header.Name))
            {
                httpContext.Response.Headers[header.Name.Trim()] = header.Value ?? string.Empty;
            }
        }

        await httpContext.Response.WriteAsync(body ?? string.Empty, Encoding.UTF8);
    }
}
