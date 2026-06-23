using System.Text.Json;
using AccessibleApiTester.Models;

namespace AccessibleApiTester.Storage;

sealed class JsonRequestStore(ILogger<JsonRequestStore> logger, IConfiguration configuration) : IAppStateStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly string storeDirectory = GetStoreDirectory(configuration);
    private readonly string workspaceCatalogPath = Path.Combine(GetStoreDirectory(configuration), "workspaces.json");
    private readonly string defaultWorkspacePath = Path.Combine(GetStoreDirectory(configuration), "requests.json");

    public async Task<WorkspaceItem[]> LoadWorkspacesAsync(CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            return await LoadWorkspacesCoreAsync(cancellationToken);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task UpsertWorkspaceAsync(WorkspaceItem item, CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            var current = await LoadWorkspacesCoreAsync(cancellationToken);
            var normalized = AppStateStoreHelpers.NormalizeWorkspace(item) with { UpdatedAt = string.IsNullOrWhiteSpace(item.UpdatedAt) ? DateTimeOffset.UtcNow.ToString("O") : item.UpdatedAt };
            var next = current.Where(workspace => !string.Equals(workspace.Id, normalized.Id, StringComparison.OrdinalIgnoreCase)).Append(normalized);
            await SaveWorkspacesCoreAsync(AppStateStoreHelpers.NormalizeWorkspaces(next), cancellationToken);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task DeleteWorkspaceAsync(string id, CancellationToken cancellationToken)
    {
        var workspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(id);
        if (string.Equals(workspaceId, "default", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        await gate.WaitAsync(cancellationToken);
        try
        {
            var workspaces = await LoadWorkspacesCoreAsync(cancellationToken);
            await SaveWorkspacesCoreAsync(workspaces.Where(workspace => !string.Equals(workspace.Id, workspaceId, StringComparison.OrdinalIgnoreCase)), cancellationToken);
            DeleteWorkspaceStateFile(workspaceId);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task<AppState> LoadAsync(string workspaceId, CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            return await LoadStateCoreAsync(GetWorkspaceStatePath(workspaceId), cancellationToken);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task SaveAsync(string workspaceId, AppState state, CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            var workspace = AppStateStoreHelpers.NormalizeWorkspace(new WorkspaceItem(AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId), workspaceId, DateTimeOffset.UtcNow.ToString("O")));
            await UpsertWorkspaceCoreAsync(workspace, cancellationToken);
            await SaveStateCoreAsync(GetWorkspaceStatePath(workspaceId), AppStateStoreHelpers.Normalize(state), cancellationToken);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task<PagedResult<SavedHistoryItem>> QueryHistoryAsync(string workspaceId, string? query, int skip, int take, CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            var state = await LoadStateCoreAsync(GetWorkspaceStatePath(workspaceId), cancellationToken);
            var filtered = state.History.Where(item => Matches(query, item.Method, item.Url, item.Status.ToString())).ToArray();
            return new PagedResult<SavedHistoryItem>(filtered.Skip(skip).Take(take).ToArray(), filtered.Length, skip, take);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task<PagedResult<SavedRequestItem>> QueryCollectionsAsync(string workspaceId, string? query, int skip, int take, CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            var state = await LoadStateCoreAsync(GetWorkspaceStatePath(workspaceId), cancellationToken);
            var filtered = state.Collections.Where(item => Matches(query, item.Name, item.Method, item.Url)).ToArray();
            return new PagedResult<SavedRequestItem>(filtered.Skip(skip).Take(take).ToArray(), filtered.Length, skip, take);
        }
        finally
        {
            gate.Release();
        }
    }

    public Task UpsertHistoryAsync(string workspaceId, SavedHistoryItem item, CancellationToken cancellationToken) =>
        UpdateStateAsync(workspaceId, state => state with
        {
            History = [item, .. state.History.Where(existing =>
                existing.Id != item.Id &&
                (!string.Equals(existing.Method, item.Method, StringComparison.OrdinalIgnoreCase) ||
                 !string.Equals(existing.Url, item.Url, StringComparison.OrdinalIgnoreCase)))]
        }, cancellationToken);

    public Task DeleteHistoryAsync(string workspaceId, string id, CancellationToken cancellationToken) =>
        UpdateStateAsync(workspaceId, state => state with { History = state.History.Where(item => item.Id != id).ToArray() }, cancellationToken);

    public Task ClearHistoryAsync(string workspaceId, CancellationToken cancellationToken) =>
        UpdateStateAsync(workspaceId, state => state with { History = [] }, cancellationToken);

    public Task UpsertCollectionAsync(string workspaceId, SavedRequestItem item, CancellationToken cancellationToken) =>
        UpdateStateAsync(workspaceId, state => state with { Collections = [item, .. state.Collections.Where(existing => existing.Id != item.Id)] }, cancellationToken);

    public Task DeleteCollectionAsync(string workspaceId, string id, CancellationToken cancellationToken) =>
        UpdateStateAsync(workspaceId, state => state with { Collections = state.Collections.Where(item => item.Id != id).ToArray() }, cancellationToken);

    public Task ClearCollectionsAsync(string workspaceId, CancellationToken cancellationToken) =>
        UpdateStateAsync(workspaceId, state => state with { Collections = [] }, cancellationToken);

    public Task UpsertEnvironmentAsync(string workspaceId, EnvironmentVariableItem item, CancellationToken cancellationToken) =>
        UpdateStateAsync(workspaceId, state => state with
        {
            Environments = [item, .. state.Environments.Where(existing =>
                existing.Id != item.Id &&
                !string.Equals(existing.Name, item.Name, StringComparison.OrdinalIgnoreCase))]
        }, cancellationToken);

    public Task DeleteEnvironmentAsync(string workspaceId, string id, CancellationToken cancellationToken) =>
        UpdateStateAsync(workspaceId, state => state with { Environments = state.Environments.Where(item => item.Id != id).ToArray() }, cancellationToken);

    public Task ClearEnvironmentsAsync(string workspaceId, CancellationToken cancellationToken) =>
        UpdateStateAsync(workspaceId, state => state with { Environments = [] }, cancellationToken);

    public Task UpsertMockAsync(string workspaceId, MockRouteItem item, CancellationToken cancellationToken) =>
        UpdateStateAsync(workspaceId, state => state with
        {
            Mocks = [item, .. state.Mocks.Where(existing =>
                existing.Id != item.Id &&
                (!string.Equals(existing.Method, item.Method, StringComparison.OrdinalIgnoreCase) ||
                 !string.Equals(existing.Path, item.Path, StringComparison.OrdinalIgnoreCase)))]
        }, cancellationToken);

    public Task DeleteMockAsync(string workspaceId, string id, CancellationToken cancellationToken) =>
        UpdateStateAsync(workspaceId, state => state with { Mocks = state.Mocks.Where(item => item.Id != id).ToArray() }, cancellationToken);

    public Task ClearMocksAsync(string workspaceId, CancellationToken cancellationToken) =>
        UpdateStateAsync(workspaceId, state => state with { Mocks = [] }, cancellationToken);

    public Task UpsertCollectionVariableAsync(string workspaceId, EnvironmentVariableItem item, CancellationToken cancellationToken) =>
        UpdateStateAsync(workspaceId, state => state with
        {
            CollectionVariables = [item, .. (state.CollectionVariables ?? []).Where(existing =>
                existing.Id != item.Id &&
                !string.Equals(existing.Name, item.Name, StringComparison.OrdinalIgnoreCase))]
        }, cancellationToken);

    public Task DeleteCollectionVariableAsync(string workspaceId, string id, CancellationToken cancellationToken) =>
        UpdateStateAsync(workspaceId, state => state with { CollectionVariables = (state.CollectionVariables ?? []).Where(item => item.Id != id).ToArray() }, cancellationToken);

    public Task ClearCollectionVariablesAsync(string workspaceId, CancellationToken cancellationToken) =>
        UpdateStateAsync(workspaceId, state => state with { CollectionVariables = [] }, cancellationToken);

    private async Task UpdateStateAsync(string workspaceId, Func<AppState, AppState> update, CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            var path = GetWorkspaceStatePath(workspaceId);
            var current = await LoadStateCoreAsync(path, cancellationToken);
            await SaveStateCoreAsync(path, AppStateStoreHelpers.Normalize(update(current)), cancellationToken);
            await UpsertWorkspaceCoreAsync(new WorkspaceItem(AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId), AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId), DateTimeOffset.UtcNow.ToString("O")), cancellationToken);
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<WorkspaceItem[]> LoadWorkspacesCoreAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(workspaceCatalogPath))
        {
            return [AppStateStoreHelpers.DefaultWorkspace()];
        }

        await using var stream = File.OpenRead(workspaceCatalogPath);
        var workspaces = await JsonSerializer.DeserializeAsync<WorkspaceItem[]>(stream, JsonOptions, cancellationToken);
        return AppStateStoreHelpers.NormalizeWorkspaces(workspaces);
    }

    private async Task SaveWorkspacesCoreAsync(IEnumerable<WorkspaceItem> workspaces, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(storeDirectory);
        var normalized = AppStateStoreHelpers.NormalizeWorkspaces(workspaces);
        var tempPath = $"{workspaceCatalogPath}.tmp";
        await using (var stream = File.Create(tempPath))
        {
            await JsonSerializer.SerializeAsync(stream, normalized, JsonOptions, cancellationToken);
        }

        File.Move(tempPath, workspaceCatalogPath, overwrite: true);
    }

    private async Task UpsertWorkspaceCoreAsync(WorkspaceItem workspace, CancellationToken cancellationToken)
    {
        var workspaces = await LoadWorkspacesCoreAsync(cancellationToken);
        var next = workspaces.Where(item => !string.Equals(item.Id, workspace.Id, StringComparison.OrdinalIgnoreCase)).Append(workspace);
        await SaveWorkspacesCoreAsync(next, cancellationToken);
    }

    private async Task<AppState> LoadStateCoreAsync(string path, CancellationToken cancellationToken)
    {
        if (!File.Exists(path))
        {
            return AppStateStoreHelpers.EmptyState();
        }

        try
        {
            await using var stream = File.OpenRead(path);
            var state = await JsonSerializer.DeserializeAsync<AppState>(stream, JsonOptions, cancellationToken);
            return AppStateStoreHelpers.Normalize(state);
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Could not read saved requests from {FilePath}.", path);
            return AppStateStoreHelpers.EmptyState();
        }
    }

    private async Task SaveStateCoreAsync(string path, AppState normalized, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(storeDirectory);
        var tempPath = $"{path}.tmp";
        await using (var stream = File.Create(tempPath))
        {
            await JsonSerializer.SerializeAsync(stream, normalized, JsonOptions, cancellationToken);
        }

        File.Move(tempPath, path, overwrite: true);
    }

    private void DeleteWorkspaceStateFile(string workspaceId)
    {
        var path = GetWorkspaceStatePath(workspaceId);
        if (File.Exists(path))
        {
            File.Delete(path);
        }
    }

    private string GetWorkspaceStatePath(string workspaceId)
    {
        var normalized = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId);
        if (string.Equals(normalized, "default", StringComparison.OrdinalIgnoreCase))
        {
            return defaultWorkspacePath;
        }

        return Path.Combine(storeDirectory, $"requests-{SanitizeFileName(normalized)}.json");
    }

    private static string SanitizeFileName(string value)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return new string(value.Select(ch => invalid.Contains(ch) ? '_' : ch).ToArray());
    }

    private static string GetStoreDirectory(IConfiguration configuration)
    {
        var configuredDirectory = configuration["Storage:Directory"];
        if (!string.IsNullOrWhiteSpace(configuredDirectory))
        {
            return configuredDirectory;
        }

        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        if (string.IsNullOrWhiteSpace(appData))
        {
            appData = AppContext.BaseDirectory;
        }

        return Path.Combine(appData, "AccessibleApiTester");
    }

    private static bool Matches(string? query, params string?[] values)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return true;
        }

        return values.Any(value => value?.Contains(query, StringComparison.OrdinalIgnoreCase) == true);
    }
}
