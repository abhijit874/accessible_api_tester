using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using AccessibleApiTester;

var port = GetFreePort();
var baseUrl = $"http://127.0.0.1:{port}";
var storageDirectory = Path.Combine(Path.GetTempPath(), "AccessibleApiTester.Tests", Guid.NewGuid().ToString("N"));

await using var app = WebAppFactory.Create(
[
    "--urls",
    baseUrl,
    $"--Storage:Directory={storageDirectory}",
    "--ConnectionStrings:SavedRequests="
],
Directory.GetCurrentDirectory());

try
{
    await app.StartAsync();
    using var client = new HttpClient { BaseAddress = new Uri(baseUrl), Timeout = TimeSpan.FromSeconds(15) };

    await AssertHomePageAsync(client);
    await AssertStoreRoundTripAsync(client);
    await AssertMockRouteAsync(client);
    await AssertSendValidationAsync(client);
    await AssertSendCanCallLocalMockAsync(client);

    Console.WriteLine("Integration tests passed.");
}
finally
{
    await app.StopAsync();
    if (Directory.Exists(storageDirectory))
    {
        Directory.Delete(storageDirectory, recursive: true);
    }
}

static async Task AssertHomePageAsync(HttpClient client)
{
    using var response = await client.GetAsync("/");
    AssertEqual(HttpStatusCode.OK, response.StatusCode, "Home page should return HTTP 200.");
    var content = await response.Content.ReadAsStringAsync();
    AssertTrue(content.Contains("Accessible API Tester", StringComparison.Ordinal), "Home page should contain the app title.");
}

static async Task AssertStoreRoundTripAsync(HttpClient client)
{
    var state = new
    {
        history = new[]
        {
            new
            {
                id = "history-1",
                method = "GET",
                url = "http://example.test/",
                headers = "",
                contentType = "application/json",
                body = "",
                status = 200,
                time = "2026-05-08T00:00:00.000Z"
            }
        },
        collections = new[]
        {
            new
            {
                id = "collection-1",
                name = "Saved request",
                method = "GET",
                url = "{{baseUrl}}/items",
                headers = "Accept: application/json",
                authType = "none",
                authToken = "",
                folder = "Smoke",
                contentType = "application/json",
                body = "",
                assertions = new
                {
                    statusCode = 200,
                    bodyContains = "ok",
                    headerName = "",
                    headerValue = "",
                    maxDurationMs = 1000
                },
                updatedAt = "2026-05-08T00:00:00.000Z"
            }
        },
        environments = new[]
        {
            new
            {
                id = "env-1",
                name = "baseUrl",
                value = "http://127.0.0.1",
                updatedAt = "2026-05-08T00:00:00.000Z"
            }
        },
        mocks = new[]
        {
            new
            {
                id = "mock-1",
                name = "Local mock",
                method = "GET",
                path = "/items",
                statusCode = 201,
                contentType = "application/json",
                headers = "X-Test: yes",
                body = "{\"ok\":true}",
                updatedAt = "2026-05-08T00:00:00.000Z"
            }
        }
    };

    using var saveResponse = await client.PutAsJsonAsync("/api/store", state);
    AssertEqual(HttpStatusCode.NoContent, saveResponse.StatusCode, "Store save should return HTTP 204.");

    using var loadResponse = await client.GetAsync("/api/store");
    AssertEqual(HttpStatusCode.OK, loadResponse.StatusCode, "Store load should return HTTP 200.");
    using var document = JsonDocument.Parse(await loadResponse.Content.ReadAsStringAsync());
    var root = document.RootElement;
    AssertEqual(1, root.GetProperty("history").GetArrayLength(), "History should round-trip.");
    AssertEqual(1, root.GetProperty("collections").GetArrayLength(), "Collections should round-trip.");
    AssertEqual("Smoke", root.GetProperty("collections")[0].GetProperty("folder").GetString(), "Collection folder should round-trip.");
    AssertEqual(1, root.GetProperty("environments").GetArrayLength(), "Variables should round-trip.");
    AssertEqual(1, root.GetProperty("mocks").GetArrayLength(), "Mocks should round-trip.");
}

static async Task AssertMockRouteAsync(HttpClient client)
{
    using var response = await client.GetAsync("/mock/items");
    AssertEqual(HttpStatusCode.Created, response.StatusCode, "Configured mock should return its status code.");
    AssertTrue(response.Headers.TryGetValues("X-Test", out var values) && values.Contains("yes"), "Configured mock should return headers.");
    AssertEqual("{\"ok\":true}", await response.Content.ReadAsStringAsync(), "Configured mock should return body.");
}

static async Task AssertSendValidationAsync(HttpClient client)
{
    using var response = await client.PostAsJsonAsync("/api/send", new
    {
        method = "GET",
        url = "not-a-url",
        headers = Array.Empty<object>(),
        body = "",
        contentType = "application/json"
    });
    AssertEqual(HttpStatusCode.BadRequest, response.StatusCode, "Invalid send URL should return HTTP 400.");
}

static async Task AssertSendCanCallLocalMockAsync(HttpClient client)
{
    using var response = await client.PostAsJsonAsync("/api/send", new
    {
        method = "GET",
        url = $"{client.BaseAddress}mock/items",
        headers = Array.Empty<object>(),
        body = "",
        contentType = "application/json"
    });
    AssertEqual(HttpStatusCode.OK, response.StatusCode, "Send endpoint should call local mock.");

    using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    var root = document.RootElement;
    AssertEqual(201, root.GetProperty("status").GetInt32(), "Send endpoint should report mock status.");
    AssertEqual("{\"ok\":true}", root.GetProperty("body").GetString(), "Send endpoint should report mock body.");
}

static int GetFreePort()
{
    using var listener = new TcpListener(IPAddress.Loopback, 0);
    listener.Start();
    return ((IPEndPoint)listener.LocalEndpoint).Port;
}

static void AssertTrue(bool condition, string message)
{
    if (!condition)
    {
        throw new InvalidOperationException(message);
    }
}

static void AssertEqual<T>(T expected, T actual, string message)
{
    if (!EqualityComparer<T>.Default.Equals(expected, actual))
    {
        throw new InvalidOperationException($"{message} Expected: {expected}. Actual: {actual}.");
    }
}
