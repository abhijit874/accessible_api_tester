namespace AccessibleApiTester.Models;

record ApiFileField(string Name, string FileName, string Base64Content, string ContentType);
record ApiRequest(string Method, string Url, ApiHeader[]? Headers, string? Body, string? ContentType, int? TimeoutMs = null, bool IgnoreSslErrors = false, string? ProxyUrl = null, ApiFileField[]? FileFields = null);
record ApiHeader(string Name, string Value);
record ApiResponse(int Status, string StatusText, long DurationMs, ApiHeader[] Headers, string Body, bool IsBase64 = false);
record ApiError(string Message);
record PagedResult<T>(T[] Items, int Total, int Skip, int Take);
record WorkspaceItem(string Id, string Name, string UpdatedAt);
record GoogleTokenRequest(string Code, string ClientId, string? ClientSecret, string RedirectUri, string CodeVerifier);
record AppState(
    SavedHistoryItem[] History,
    SavedRequestItem[] Collections,
    EnvironmentVariableItem[] Environments,
    MockRouteItem[] Mocks,
    EnvironmentVariableItem[]? CollectionVariables = null);
record SavedHistoryItem(
    string Id,
    string Method,
    string Url,
    string Headers,
    string ContentType,
    string Body,
    int Status,
    string Time,
    string? AuthType = null,
    string? AuthToken = null,
    string? AuthKeyName = null,
    string? AuthKeyIn = null,
    string? ResponseStatusText = null,
    long? ResponseDurationMs = null,
    ApiHeader[]? ResponseHeaders = null,
    string? ResponseBody = null,
    bool ResponseIsBase64 = false);
record SavedRequestItem(
    string Id,
    string Name,
    string Method,
    string Url,
    string? Params,
    string Headers,
    string? AuthType,
    string? AuthToken,
    string? AuthKeyName,
    string? AuthKeyIn,
    string ContentType,
    string Body,
    RequestAssertions? Assertions,
    CaptureItem[]? Captures,
    string? PreRequestScript,
    string? PostResponseScript,
    string? Folder,
    string UpdatedAt,
    int? TimeoutMs = null,
    string? Description = null);
record EnvironmentVariableItem(string Id, string Name, string Value, string UpdatedAt, bool Secret = false);
record JsonpathAssertionItem(string Path, string Operator, string Expected);
record RequestAssertions(
    int? StatusCode,
    string? BodyContains,
    string? HeaderName,
    string? HeaderValue,
    int? MaxDurationMs,
    JsonpathAssertionItem[]? JsonpathAssertions = null,
    string? BodyMatchesRegex = null);
record CaptureItem(string Id, string VariableName, string Source, string Path);
record MockRouteItem(
    string Id,
    string Name,
    string Method,
    string Path,
    int StatusCode,
    string ContentType,
    string Headers,
    string Body,
    string UpdatedAt,
    int? DelayMs = null);
