using AccessibleApiTester.Models;

namespace AccessibleApiTester.Storage;

interface IAppStateStore
{
    Task<WorkspaceItem[]> LoadWorkspacesAsync(CancellationToken cancellationToken);
    Task UpsertWorkspaceAsync(WorkspaceItem item, CancellationToken cancellationToken);
    Task DeleteWorkspaceAsync(string id, CancellationToken cancellationToken);
    Task<AppState> LoadAsync(string workspaceId, CancellationToken cancellationToken);
    Task SaveAsync(string workspaceId, AppState state, CancellationToken cancellationToken);
    Task<PagedResult<SavedHistoryItem>> QueryHistoryAsync(string workspaceId, string? query, int skip, int take, CancellationToken cancellationToken);
    Task<PagedResult<SavedRequestItem>> QueryCollectionsAsync(string workspaceId, string? query, int skip, int take, CancellationToken cancellationToken);
    Task UpsertHistoryAsync(string workspaceId, SavedHistoryItem item, CancellationToken cancellationToken);
    Task DeleteHistoryAsync(string workspaceId, string id, CancellationToken cancellationToken);
    Task ClearHistoryAsync(string workspaceId, CancellationToken cancellationToken);
    Task UpsertCollectionAsync(string workspaceId, SavedRequestItem item, CancellationToken cancellationToken);
    Task DeleteCollectionAsync(string workspaceId, string id, CancellationToken cancellationToken);
    Task ClearCollectionsAsync(string workspaceId, CancellationToken cancellationToken);
    Task UpsertEnvironmentAsync(string workspaceId, EnvironmentVariableItem item, CancellationToken cancellationToken);
    Task DeleteEnvironmentAsync(string workspaceId, string id, CancellationToken cancellationToken);
    Task ClearEnvironmentsAsync(string workspaceId, CancellationToken cancellationToken);
    Task UpsertMockAsync(string workspaceId, MockRouteItem item, CancellationToken cancellationToken);
    Task DeleteMockAsync(string workspaceId, string id, CancellationToken cancellationToken);
    Task ClearMocksAsync(string workspaceId, CancellationToken cancellationToken);
    Task UpsertCollectionVariableAsync(string workspaceId, EnvironmentVariableItem item, CancellationToken cancellationToken);
    Task DeleteCollectionVariableAsync(string workspaceId, string id, CancellationToken cancellationToken);
    Task ClearCollectionVariablesAsync(string workspaceId, CancellationToken cancellationToken);
}
