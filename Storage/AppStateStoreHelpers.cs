using AccessibleApiTester.Models;

namespace AccessibleApiTester.Storage;

static class AppStateStoreHelpers
{
    public static AppState Normalize(AppState? state)
    {
        if (state is null)
        {
            return EmptyState();
        }

        return new AppState(
            (state.History ?? []).Take(50).ToArray(),
            (state.Collections ?? []).Take(500).ToArray(),
            (state.Environments ?? []).Take(500).ToArray(),
            (state.Mocks ?? []).Take(500).ToArray(),
            (state.CollectionVariables ?? []).Take(500).ToArray());
    }

    public static AppState EmptyState() => new([], [], [], [], []);

    public static WorkspaceItem NormalizeWorkspace(WorkspaceItem? workspace)
    {
        if (workspace is null)
        {
            return DefaultWorkspace();
        }

        var id = NormalizeWorkspaceId(workspace.Id);
        return new WorkspaceItem(id, string.IsNullOrWhiteSpace(workspace.Name) ? "Default" : workspace.Name.Trim(), workspace.UpdatedAt);
    }

    public static WorkspaceItem[] NormalizeWorkspaces(IEnumerable<WorkspaceItem>? workspaces)
    {
        var items = (workspaces ?? []).Select(NormalizeWorkspace).ToArray();
        var deduplicated = items
            .GroupBy(item => item.Id, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderByDescending(item => string.Equals(item.Id, "default", StringComparison.OrdinalIgnoreCase))
            .ThenBy(item => item.Name, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (deduplicated.Any(item => string.Equals(item.Id, "default", StringComparison.OrdinalIgnoreCase)))
        {
            return deduplicated;
        }

        return [DefaultWorkspace(), .. deduplicated];
    }

    public static WorkspaceItem DefaultWorkspace() => new("default", "Default", DateTimeOffset.UtcNow.ToString("O"));

    public static string NormalizeWorkspaceId(string? workspaceId)
    {
        var normalized = string.IsNullOrWhiteSpace(workspaceId) ? "default" : workspaceId.Trim();
        return normalized.Length == 0 ? "default" : normalized;
    }
}
