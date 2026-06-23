namespace AccessibleApiTester.Storage;

sealed class WorkspaceContext
{
    private string workspaceId = "default";

    public string WorkspaceId
    {
        get => workspaceId;
        set => workspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(value);
    }
}
