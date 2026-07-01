using System.Text.Json;
using AccessibleApiTester.Models;
using MySqlConnector;

namespace AccessibleApiTester.Storage;

sealed class MySqlRequestStore : IAppStateStore
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly string databaseConnectionString;
    private readonly MySqlSchemaManager schema;
    private bool initialized;

    public MySqlRequestStore(string connectionString, ILogger<MySqlRequestStore> logger)
    {
        var builder = new MySqlConnectionStringBuilder(connectionString);
        var databaseName = string.IsNullOrWhiteSpace(builder.Database)
            ? "accessible_api_tester"
            : builder.Database;

        builder.Database = string.Empty;
        var serverConnectionString = builder.ConnectionString;

        builder.Database = databaseName;
        databaseConnectionString = builder.ConnectionString;
        schema = new MySqlSchemaManager(databaseName, serverConnectionString, databaseConnectionString, logger);
    }

    public async Task<WorkspaceItem[]> LoadWorkspacesAsync(CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            await EnsureDatabaseAsync(cancellationToken);
            await using var connection = new MySqlConnection(databaseConnectionString);
            await connection.OpenAsync(cancellationToken);

            var workspaces = new List<WorkspaceItem>();
            await using var command = new MySqlCommand(
                """
                SELECT id, name, updated_at
                FROM workspaces
                ORDER BY sort_order, name;
                """,
                connection);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                workspaces.Add(new WorkspaceItem(
                    ReadString(reader, "id"),
                    ReadString(reader, "name"),
                    ReadString(reader, "updated_at")));
            }

            return AppStateStoreHelpers.NormalizeWorkspaces(workspaces);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task UpsertWorkspaceAsync(WorkspaceItem item, CancellationToken cancellationToken)
    {
        var workspace = AppStateStoreHelpers.NormalizeWorkspace(item) with
        {
            UpdatedAt = string.IsNullOrWhiteSpace(item.UpdatedAt) ? DateTimeOffset.UtcNow.ToString("O") : item.UpdatedAt
        };

        await ExecuteInTransactionAsync(async (connection, transaction) =>
        {
            await ExecuteAsync(connection, transaction,
                """
                INSERT INTO workspaces (id, name, updated_at, sort_order)
                VALUES (@id, @name, @updatedAt, 0)
                ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = VALUES(updated_at);
                """,
                cancellationToken,
                command =>
                {
                    command.Parameters.AddWithValue("@id", workspace.Id);
                    command.Parameters.AddWithValue("@name", workspace.Name);
                    command.Parameters.AddWithValue("@updatedAt", workspace.UpdatedAt);
                });
        }, cancellationToken);
    }

    public async Task DeleteWorkspaceAsync(string id, CancellationToken cancellationToken)
    {
        var workspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(id);
        if (string.Equals(workspaceId, "default", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        await ExecuteInTransactionAsync(async (connection, transaction) =>
        {
            await ExecuteAsync(connection, transaction, "DELETE FROM request_history WHERE workspace_id = @workspaceId;", cancellationToken, command => command.Parameters.AddWithValue("@workspaceId", workspaceId));
            await ExecuteAsync(connection, transaction, "DELETE FROM saved_requests WHERE workspace_id = @workspaceId;", cancellationToken, command => command.Parameters.AddWithValue("@workspaceId", workspaceId));
            await ExecuteAsync(connection, transaction, "DELETE FROM environment_variables WHERE workspace_id = @workspaceId;", cancellationToken, command => command.Parameters.AddWithValue("@workspaceId", workspaceId));
            await ExecuteAsync(connection, transaction, "DELETE FROM collection_variables WHERE workspace_id = @workspaceId;", cancellationToken, command => command.Parameters.AddWithValue("@workspaceId", workspaceId));
            await ExecuteAsync(connection, transaction, "DELETE FROM mock_routes WHERE workspace_id = @workspaceId;", cancellationToken, command => command.Parameters.AddWithValue("@workspaceId", workspaceId));
            await ExecuteAsync(connection, transaction, "DELETE FROM workspaces WHERE id = @workspaceId;", cancellationToken, command => command.Parameters.AddWithValue("@workspaceId", workspaceId));
        }, cancellationToken);
    }

    public async Task<AppState> LoadAsync(string workspaceId, CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            await EnsureDatabaseAsync(cancellationToken);
            await using var connection = new MySqlConnection(databaseConnectionString);
            await connection.OpenAsync(cancellationToken);

            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId);
            await EnsureWorkspaceAsync(connection, null, new WorkspaceItem(normalizedWorkspaceId, normalizedWorkspaceId == "default" ? "Default" : normalizedWorkspaceId, DateTimeOffset.UtcNow.ToString("O")), cancellationToken);

            var history = new List<SavedHistoryItem>();
            await using (var command = new MySqlCommand(
                """
                SELECT id, method, url, headers, content_type, body, status_code, request_time, auth_type, auth_token, auth_key_name, auth_key_in, response_status_text, response_duration_ms, response_headers, response_body, response_is_base64
                FROM request_history
                WHERE workspace_id = @workspaceId
                ORDER BY sort_order;
                """,
                connection))
            {
                command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId);
                await using var reader = await command.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken))
                {
                    history.Add(new SavedHistoryItem(
                        ReadString(reader, "id"),
                        ReadString(reader, "method"),
                        ReadString(reader, "url"),
                        ReadString(reader, "headers"),
                        ReadString(reader, "content_type"),
                        ReadString(reader, "body"),
                        reader.GetInt32(reader.GetOrdinal("status_code")),
                        ReadString(reader, "request_time"),
                        ReadString(reader, "auth_type"),
                        ReadString(reader, "auth_token"),
                        ReadString(reader, "auth_key_name"),
                        ReadString(reader, "auth_key_in"),
                        ReadNullableString(reader, "response_status_text"),
                        ReadNullableLong(reader, "response_duration_ms"),
                        ReadHeaders(reader, "response_headers"),
                        ReadNullableString(reader, "response_body"),
                        ReadBool(reader, "response_is_base64")));
                }
            }

            var collections = new List<SavedRequestItem>();
            await using (var command = new MySqlCommand(
                """
                SELECT id, name, method, url, params, headers, auth_type, auth_token, auth_key_name, auth_key_in, content_type, body, assertions_json, captures_json, pre_request_script, post_response_script, folder, updated_at, timeout_ms, description
                FROM saved_requests
                WHERE workspace_id = @workspaceId
                ORDER BY sort_order;
                """,
                connection))
            {
                command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId);
                await using var reader = await command.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken))
                {
                    collections.Add(new SavedRequestItem(
                        ReadString(reader, "id"),
                        ReadString(reader, "name"),
                        ReadString(reader, "method"),
                        ReadString(reader, "url"),
                        ReadString(reader, "params"),
                        ReadString(reader, "headers"),
                        ReadString(reader, "auth_type"),
                        ReadString(reader, "auth_token"),
                        ReadString(reader, "auth_key_name"),
                        ReadString(reader, "auth_key_in"),
                        ReadString(reader, "content_type"),
                        ReadString(reader, "body"),
                        ReadAssertions(reader, "assertions_json"),
                        ReadCaptures(reader, "captures_json"),
                        ReadString(reader, "pre_request_script"),
                        ReadString(reader, "post_response_script"),
                        ReadString(reader, "folder"),
                        ReadString(reader, "updated_at"),
                        ReadNullableInt(reader, "timeout_ms"),
                        ReadString(reader, "description")));
                }
            }

            var environments = new List<EnvironmentVariableItem>();
            await using (var command = new MySqlCommand(
                """
                SELECT id, name, value, updated_at, COALESCE(is_secret, 0) AS is_secret
                FROM environment_variables
                WHERE workspace_id = @workspaceId
                ORDER BY sort_order;
                """,
                connection))
            {
                command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId);
                await using var reader = await command.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken))
                {
                    environments.Add(new EnvironmentVariableItem(
                        ReadString(reader, "id"),
                        ReadString(reader, "name"),
                        ReadString(reader, "value"),
                        ReadString(reader, "updated_at"),
                        reader.GetInt32(reader.GetOrdinal("is_secret")) != 0));
                }
            }

            var mocks = new List<MockRouteItem>();
            await using (var command = new MySqlCommand(
                """
                SELECT id, name, method, path, status_code, content_type, headers, body, updated_at, delay_ms
                FROM mock_routes
                WHERE workspace_id = @workspaceId
                ORDER BY sort_order;
                """,
                connection))
            {
                command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId);
                await using var reader = await command.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken))
                {
                    var delayOrdinal = reader.GetOrdinal("delay_ms");
                    mocks.Add(new MockRouteItem(
                        ReadString(reader, "id"),
                        ReadString(reader, "name"),
                        ReadString(reader, "method"),
                        ReadString(reader, "path"),
                        reader.GetInt32(reader.GetOrdinal("status_code")),
                        ReadString(reader, "content_type"),
                        ReadString(reader, "headers"),
                        ReadString(reader, "body"),
                        ReadString(reader, "updated_at"),
                        reader.IsDBNull(delayOrdinal) ? null : reader.GetInt32(delayOrdinal)));
                }
            }

            var collectionVars = new List<EnvironmentVariableItem>();
            await using (var command = new MySqlCommand(
                """
                SELECT id, name, value, updated_at, COALESCE(is_secret, 0) AS is_secret
                FROM collection_variables
                WHERE workspace_id = @workspaceId
                ORDER BY sort_order;
                """,
                connection))
            {
                command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId);
                await using var reader = await command.ExecuteReaderAsync(cancellationToken);
                while (await reader.ReadAsync(cancellationToken))
                {
                    collectionVars.Add(new EnvironmentVariableItem(
                        ReadString(reader, "id"),
                        ReadString(reader, "name"),
                        ReadString(reader, "value"),
                        ReadString(reader, "updated_at"),
                        reader.GetInt32(reader.GetOrdinal("is_secret")) != 0));
                }
            }

            return AppStateStoreHelpers.Normalize(new AppState(history.ToArray(), collections.ToArray(), environments.ToArray(), mocks.ToArray(), collectionVars.ToArray()));
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task SaveAsync(string workspaceId, AppState state, CancellationToken cancellationToken)
    {
        var normalized = AppStateStoreHelpers.Normalize(state);
        var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId);

        await gate.WaitAsync(cancellationToken);
        try
        {
            await EnsureDatabaseAsync(cancellationToken);

            await using var connection = new MySqlConnection(databaseConnectionString);
            await connection.OpenAsync(cancellationToken);
            await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

            await EnsureWorkspaceAsync(connection, transaction, new WorkspaceItem(normalizedWorkspaceId, normalizedWorkspaceId == "default" ? "Default" : normalizedWorkspaceId, DateTimeOffset.UtcNow.ToString("O")), cancellationToken);

            await ExecuteAsync(connection, transaction, "DELETE FROM request_history WHERE workspace_id = @workspaceId;", cancellationToken, command => command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId));
            await ExecuteAsync(connection, transaction, "DELETE FROM saved_requests WHERE workspace_id = @workspaceId;", cancellationToken, command => command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId));
            await ExecuteAsync(connection, transaction, "DELETE FROM environment_variables WHERE workspace_id = @workspaceId;", cancellationToken, command => command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId));
            await ExecuteAsync(connection, transaction, "DELETE FROM collection_variables WHERE workspace_id = @workspaceId;", cancellationToken, command => command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId));
            await ExecuteAsync(connection, transaction, "DELETE FROM mock_routes WHERE workspace_id = @workspaceId;", cancellationToken, command => command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId));

            for (var index = 0; index < normalized.History.Length; index++)
            {
                await InsertHistoryAsync(connection, transaction, normalizedWorkspaceId, normalized.History[index], index, cancellationToken);
            }

            for (var index = 0; index < normalized.Collections.Length; index++)
            {
                await InsertCollectionAsync(connection, transaction, normalizedWorkspaceId, normalized.Collections[index], index, cancellationToken);
            }

            for (var index = 0; index < normalized.Environments.Length; index++)
            {
                await InsertEnvironmentAsync(connection, transaction, normalizedWorkspaceId, normalized.Environments[index], index, cancellationToken);
            }

            for (var index = 0; index < normalized.Mocks.Length; index++)
            {
                await InsertMockAsync(connection, transaction, normalizedWorkspaceId, normalized.Mocks[index], index, cancellationToken);
            }

            var collectionVars = normalized.CollectionVariables ?? [];
            for (var index = 0; index < collectionVars.Length; index++)
            {
                await InsertCollectionVariableAsync(connection, transaction, normalizedWorkspaceId, collectionVars[index], index, cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
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
            await EnsureDatabaseAsync(cancellationToken);
            await using var connection = new MySqlConnection(databaseConnectionString);
            await connection.OpenAsync(cancellationToken);
            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId);

            var whereClause = string.IsNullOrWhiteSpace(query)
                ? "WHERE workspace_id = @workspaceId"
                : "WHERE workspace_id = @workspaceId AND (method LIKE @query OR url LIKE @query OR CAST(status_code AS CHAR) LIKE @query)";
            var total = await CountAsync(connection, $"SELECT COUNT(*) FROM request_history {whereClause};", query, normalizedWorkspaceId, cancellationToken);

            await using var command = new MySqlCommand(
                $"""
                SELECT id, method, url, headers, content_type, body, status_code, request_time, auth_type, auth_token, auth_key_name, auth_key_in, response_status_text, response_duration_ms, response_headers, response_body, response_is_base64
                FROM request_history
                {whereClause}
                ORDER BY sort_order
                LIMIT @take OFFSET @skip;
                """,
                connection);
            AddQueryPagingParameters(command, query, normalizedWorkspaceId, skip, take);

            var items = new List<SavedHistoryItem>();
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(new SavedHistoryItem(
                    ReadString(reader, "id"),
                    ReadString(reader, "method"),
                    ReadString(reader, "url"),
                    ReadString(reader, "headers"),
                    ReadString(reader, "content_type"),
                    ReadString(reader, "body"),
                    reader.GetInt32(reader.GetOrdinal("status_code")),
                    ReadString(reader, "request_time"),
                    ReadString(reader, "auth_type"),
                    ReadString(reader, "auth_token"),
                    ReadString(reader, "auth_key_name"),
                    ReadString(reader, "auth_key_in"),
                    ReadNullableString(reader, "response_status_text"),
                    ReadNullableLong(reader, "response_duration_ms"),
                    ReadHeaders(reader, "response_headers"),
                    ReadNullableString(reader, "response_body"),
                    ReadBool(reader, "response_is_base64")));
            }

            return new PagedResult<SavedHistoryItem>(items.ToArray(), total, skip, take);
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
            await EnsureDatabaseAsync(cancellationToken);
            await using var connection = new MySqlConnection(databaseConnectionString);
            await connection.OpenAsync(cancellationToken);
            var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId);

            var whereClause = string.IsNullOrWhiteSpace(query)
                ? "WHERE workspace_id = @workspaceId"
                : "WHERE workspace_id = @workspaceId AND (name LIKE @query OR method LIKE @query OR url LIKE @query OR folder LIKE @query)";
            var total = await CountAsync(connection, $"SELECT COUNT(*) FROM saved_requests {whereClause};", query, normalizedWorkspaceId, cancellationToken);

            await using var command = new MySqlCommand(
                $"""
                SELECT id, name, method, url, params, headers, auth_type, auth_token, auth_key_name, auth_key_in, content_type, body, assertions_json, captures_json, pre_request_script, post_response_script, folder, updated_at, timeout_ms, description
                FROM saved_requests
                {whereClause}
                ORDER BY sort_order
                LIMIT @take OFFSET @skip;
                """,
                connection);
            AddQueryPagingParameters(command, query, normalizedWorkspaceId, skip, take);

            var items = new List<SavedRequestItem>();
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(new SavedRequestItem(
                    ReadString(reader, "id"),
                    ReadString(reader, "name"),
                    ReadString(reader, "method"),
                    ReadString(reader, "url"),
                    ReadString(reader, "params"),
                    ReadString(reader, "headers"),
                    ReadString(reader, "auth_type"),
                    ReadString(reader, "auth_token"),
                    ReadString(reader, "auth_key_name"),
                    ReadString(reader, "auth_key_in"),
                    ReadString(reader, "content_type"),
                    ReadString(reader, "body"),
                    ReadAssertions(reader, "assertions_json"),
                    ReadCaptures(reader, "captures_json"),
                    ReadString(reader, "pre_request_script"),
                    ReadString(reader, "post_response_script"),
                    ReadString(reader, "folder"),
                    ReadString(reader, "updated_at"),
                    ReadNullableInt(reader, "timeout_ms"),
                    ReadString(reader, "description")));
            }

            return new PagedResult<SavedRequestItem>(items.ToArray(), total, skip, take);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task UpsertHistoryAsync(string workspaceId, SavedHistoryItem item, CancellationToken cancellationToken)
    {
        var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId);
        await ExecuteInTransactionAsync(async (connection, transaction) =>
        {
            await EnsureWorkspaceAsync(connection, transaction, new WorkspaceItem(normalizedWorkspaceId, normalizedWorkspaceId == "default" ? "Default" : normalizedWorkspaceId, DateTimeOffset.UtcNow.ToString("O")), cancellationToken);
            // Only replace an entry with the same id (idempotent upsert). Same URL+method
            // is intentionally kept as a separate entry so an old response is never overwritten.
            await ExecuteAsync(connection, transaction, "DELETE FROM request_history WHERE workspace_id = @workspaceId AND id = @id;", cancellationToken, command =>
            {
                command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId);
                command.Parameters.AddWithValue("@id", item.Id);
            });
            await ExecuteAsync(connection, transaction, "UPDATE request_history SET sort_order = sort_order + 1 WHERE workspace_id = @workspaceId;", cancellationToken, command => command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId));
            await InsertHistoryAsync(connection, transaction, normalizedWorkspaceId, item, 0, cancellationToken);
            await TrimTableAsync(connection, transaction, "request_history", normalizedWorkspaceId, 100, cancellationToken);
        }, cancellationToken);
    }

    public Task DeleteHistoryAsync(string workspaceId, string id, CancellationToken cancellationToken) =>
        ExecuteSingleWorkspaceAsync("DELETE FROM request_history WHERE workspace_id = @workspaceId AND id = @id;", workspaceId, id, cancellationToken);

    public Task ClearHistoryAsync(string workspaceId, CancellationToken cancellationToken) =>
        ExecuteSingleWorkspaceAsync("DELETE FROM request_history WHERE workspace_id = @workspaceId;", workspaceId, cancellationToken);

    public async Task UpsertCollectionAsync(string workspaceId, SavedRequestItem item, CancellationToken cancellationToken)
    {
        var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId);
        await ExecuteInTransactionAsync(async (connection, transaction) =>
        {
            await EnsureWorkspaceAsync(connection, transaction, new WorkspaceItem(normalizedWorkspaceId, normalizedWorkspaceId == "default" ? "Default" : normalizedWorkspaceId, DateTimeOffset.UtcNow.ToString("O")), cancellationToken);
            await ExecuteAsync(connection, transaction, "DELETE FROM saved_requests WHERE workspace_id = @workspaceId AND id = @id;", cancellationToken, command =>
            {
                command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId);
                command.Parameters.AddWithValue("@id", item.Id);
            });
            await ExecuteAsync(connection, transaction, "UPDATE saved_requests SET sort_order = sort_order + 1 WHERE workspace_id = @workspaceId;", cancellationToken, command => command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId));
            await InsertCollectionAsync(connection, transaction, normalizedWorkspaceId, item, 0, cancellationToken);
            await TrimTableAsync(connection, transaction, "saved_requests", normalizedWorkspaceId, 500, cancellationToken);
        }, cancellationToken);
    }

    public Task DeleteCollectionAsync(string workspaceId, string id, CancellationToken cancellationToken) =>
        ExecuteSingleWorkspaceAsync("DELETE FROM saved_requests WHERE workspace_id = @workspaceId AND id = @id;", workspaceId, id, cancellationToken);

    public Task ClearCollectionsAsync(string workspaceId, CancellationToken cancellationToken) =>
        ExecuteSingleWorkspaceAsync("DELETE FROM saved_requests WHERE workspace_id = @workspaceId;", workspaceId, cancellationToken);

    public async Task UpsertEnvironmentAsync(string workspaceId, EnvironmentVariableItem item, CancellationToken cancellationToken)
    {
        var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId);
        await ExecuteInTransactionAsync(async (connection, transaction) =>
        {
            await EnsureWorkspaceAsync(connection, transaction, new WorkspaceItem(normalizedWorkspaceId, normalizedWorkspaceId == "default" ? "Default" : normalizedWorkspaceId, DateTimeOffset.UtcNow.ToString("O")), cancellationToken);
            await ExecuteAsync(connection, transaction, "DELETE FROM environment_variables WHERE workspace_id = @workspaceId AND (id = @id OR LOWER(name) = LOWER(@name));", cancellationToken, command =>
            {
                command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId);
                command.Parameters.AddWithValue("@id", item.Id);
                command.Parameters.AddWithValue("@name", item.Name);
            });
            await ExecuteAsync(connection, transaction, "UPDATE environment_variables SET sort_order = sort_order + 1 WHERE workspace_id = @workspaceId;", cancellationToken, command => command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId));
            await InsertEnvironmentAsync(connection, transaction, normalizedWorkspaceId, item, 0, cancellationToken);
            await TrimTableAsync(connection, transaction, "environment_variables", normalizedWorkspaceId, 500, cancellationToken);
        }, cancellationToken);
    }

    public Task DeleteEnvironmentAsync(string workspaceId, string id, CancellationToken cancellationToken) =>
        ExecuteSingleWorkspaceAsync("DELETE FROM environment_variables WHERE workspace_id = @workspaceId AND id = @id;", workspaceId, id, cancellationToken);

    public Task ClearEnvironmentsAsync(string workspaceId, CancellationToken cancellationToken) =>
        ExecuteSingleWorkspaceAsync("DELETE FROM environment_variables WHERE workspace_id = @workspaceId;", workspaceId, cancellationToken);

    public async Task UpsertCollectionVariableAsync(string workspaceId, EnvironmentVariableItem item, CancellationToken cancellationToken)
    {
        var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId);
        await ExecuteInTransactionAsync(async (connection, transaction) =>
        {
            await EnsureWorkspaceAsync(connection, transaction, new WorkspaceItem(normalizedWorkspaceId, normalizedWorkspaceId == "default" ? "Default" : normalizedWorkspaceId, DateTimeOffset.UtcNow.ToString("O")), cancellationToken);
            await ExecuteAsync(connection, transaction, "DELETE FROM collection_variables WHERE workspace_id = @workspaceId AND (id = @id OR LOWER(name) = LOWER(@name));", cancellationToken, command =>
            {
                command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId);
                command.Parameters.AddWithValue("@id", item.Id);
                command.Parameters.AddWithValue("@name", item.Name);
            });
            await ExecuteAsync(connection, transaction, "UPDATE collection_variables SET sort_order = sort_order + 1 WHERE workspace_id = @workspaceId;", cancellationToken, command => command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId));
            await InsertCollectionVariableAsync(connection, transaction, normalizedWorkspaceId, item, 0, cancellationToken);
            await TrimTableAsync(connection, transaction, "collection_variables", normalizedWorkspaceId, 500, cancellationToken);
        }, cancellationToken);
    }

    public Task DeleteCollectionVariableAsync(string workspaceId, string id, CancellationToken cancellationToken) =>
        ExecuteSingleWorkspaceAsync("DELETE FROM collection_variables WHERE workspace_id = @workspaceId AND id = @id;", workspaceId, id, cancellationToken);

    public Task ClearCollectionVariablesAsync(string workspaceId, CancellationToken cancellationToken) =>
        ExecuteSingleWorkspaceAsync("DELETE FROM collection_variables WHERE workspace_id = @workspaceId;", workspaceId, cancellationToken);

    public async Task UpsertMockAsync(string workspaceId, MockRouteItem item, CancellationToken cancellationToken)
    {
        var normalizedWorkspaceId = AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId);
        await ExecuteInTransactionAsync(async (connection, transaction) =>
        {
            await EnsureWorkspaceAsync(connection, transaction, new WorkspaceItem(normalizedWorkspaceId, normalizedWorkspaceId == "default" ? "Default" : normalizedWorkspaceId, DateTimeOffset.UtcNow.ToString("O")), cancellationToken);
            await ExecuteAsync(connection, transaction, "DELETE FROM mock_routes WHERE workspace_id = @workspaceId AND (id = @id OR (LOWER(method) = LOWER(@method) AND path = @path));", cancellationToken, command =>
            {
                command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId);
                command.Parameters.AddWithValue("@id", item.Id);
                command.Parameters.AddWithValue("@method", item.Method);
                command.Parameters.AddWithValue("@path", item.Path);
            });
            await ExecuteAsync(connection, transaction, "UPDATE mock_routes SET sort_order = sort_order + 1 WHERE workspace_id = @workspaceId;", cancellationToken, command => command.Parameters.AddWithValue("@workspaceId", normalizedWorkspaceId));
            await InsertMockAsync(connection, transaction, normalizedWorkspaceId, item, 0, cancellationToken);
            await TrimTableAsync(connection, transaction, "mock_routes", normalizedWorkspaceId, 500, cancellationToken);
        }, cancellationToken);
    }

    public Task DeleteMockAsync(string workspaceId, string id, CancellationToken cancellationToken) =>
        ExecuteSingleWorkspaceAsync("DELETE FROM mock_routes WHERE workspace_id = @workspaceId AND id = @id;", workspaceId, id, cancellationToken);

    public Task ClearMocksAsync(string workspaceId, CancellationToken cancellationToken) =>
        ExecuteSingleWorkspaceAsync("DELETE FROM mock_routes WHERE workspace_id = @workspaceId;", workspaceId, cancellationToken);

    private async Task EnsureDatabaseAsync(CancellationToken cancellationToken)
    {
        if (initialized)
        {
            return;
        }

        await schema.EnsureInitializedAsync(cancellationToken);
        initialized = true;
    }

    private static async Task InsertCollectionAsync(
        MySqlConnection connection,
        MySqlTransaction transaction,
        string workspaceId,
        SavedRequestItem item,
        int sortOrder,
        CancellationToken cancellationToken)
    {
        await using var command = new MySqlCommand(
            """
            INSERT INTO saved_requests
                (id, workspace_id, name, method, url, params, headers, auth_type, auth_token, auth_key_name, auth_key_in, folder, content_type, body, assertions_json, captures_json, pre_request_script, post_response_script, updated_at, sort_order, timeout_ms, description)
            VALUES
                (@id, @workspaceId, @name, @method, @url, @params, @headers, @authType, @authToken, @authKeyName, @authKeyIn, @folder, @contentType, @body, @assertionsJson, @capturesJson, @preRequestScript, @postResponseScript, @updatedAt, @sortOrder, @timeoutMs, @description);
            """,
            connection,
            transaction);
        command.Parameters.AddWithValue("@id", item.Id);
        command.Parameters.AddWithValue("@workspaceId", workspaceId);
        command.Parameters.AddWithValue("@name", item.Name);
        command.Parameters.AddWithValue("@method", item.Method);
        command.Parameters.AddWithValue("@url", item.Url);
        command.Parameters.AddWithValue("@params", item.Params ?? string.Empty);
        command.Parameters.AddWithValue("@headers", item.Headers);
        command.Parameters.AddWithValue("@authType", NormalizeAuthType(item.AuthType, item.AuthToken));
        command.Parameters.AddWithValue("@authToken", item.AuthToken ?? string.Empty);
        command.Parameters.AddWithValue("@authKeyName", item.AuthKeyName ?? string.Empty);
        command.Parameters.AddWithValue("@authKeyIn", item.AuthKeyIn ?? "header");
        command.Parameters.AddWithValue("@folder", item.Folder ?? string.Empty);
        command.Parameters.AddWithValue("@contentType", item.ContentType);
        command.Parameters.AddWithValue("@body", item.Body);
        command.Parameters.AddWithValue("@assertionsJson", JsonSerializer.Serialize(item.Assertions));
        command.Parameters.AddWithValue("@capturesJson", JsonSerializer.Serialize(item.Captures));
        command.Parameters.AddWithValue("@preRequestScript", item.PreRequestScript ?? string.Empty);
        command.Parameters.AddWithValue("@postResponseScript", item.PostResponseScript ?? string.Empty);
        command.Parameters.AddWithValue("@updatedAt", item.UpdatedAt);
        command.Parameters.AddWithValue("@sortOrder", sortOrder);
        command.Parameters.AddWithValue("@timeoutMs", item.TimeoutMs.HasValue ? (object)item.TimeoutMs.Value : DBNull.Value);
        command.Parameters.AddWithValue("@description", string.IsNullOrWhiteSpace(item.Description) ? DBNull.Value : (object)item.Description);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task InsertHistoryAsync(
        MySqlConnection connection,
        MySqlTransaction transaction,
        string workspaceId,
        SavedHistoryItem item,
        int sortOrder,
        CancellationToken cancellationToken)
    {
        await using var command = new MySqlCommand(
            """
            INSERT INTO request_history
                (id, workspace_id, method, url, headers, content_type, body, status_code, request_time, auth_type, auth_token, auth_key_name, auth_key_in, response_status_text, response_duration_ms, response_headers, response_body, response_is_base64, sort_order)
            VALUES
                (@id, @workspaceId, @method, @url, @headers, @contentType, @body, @status, @requestTime, @authType, @authToken, @authKeyName, @authKeyIn, @responseStatusText, @responseDurationMs, @responseHeaders, @responseBody, @responseIsBase64, @sortOrder);
            """,
            connection,
            transaction);
        command.Parameters.AddWithValue("@id", item.Id);
        command.Parameters.AddWithValue("@workspaceId", workspaceId);
        command.Parameters.AddWithValue("@method", item.Method);
        command.Parameters.AddWithValue("@url", item.Url);
        command.Parameters.AddWithValue("@headers", item.Headers);
        command.Parameters.AddWithValue("@contentType", item.ContentType);
        command.Parameters.AddWithValue("@body", item.Body);
        command.Parameters.AddWithValue("@status", item.Status);
        command.Parameters.AddWithValue("@requestTime", item.Time);
        command.Parameters.AddWithValue("@authType", item.AuthType ?? string.Empty);
        command.Parameters.AddWithValue("@authToken", item.AuthToken ?? string.Empty);
        command.Parameters.AddWithValue("@authKeyName", item.AuthKeyName ?? string.Empty);
        command.Parameters.AddWithValue("@authKeyIn", item.AuthKeyIn ?? "header");
        command.Parameters.AddWithValue("@responseStatusText", (object?)item.ResponseStatusText ?? DBNull.Value);
        command.Parameters.AddWithValue("@responseDurationMs", (object?)item.ResponseDurationMs ?? DBNull.Value);
        command.Parameters.AddWithValue("@responseHeaders", item.ResponseHeaders is null ? DBNull.Value : JsonSerializer.Serialize(item.ResponseHeaders));
        command.Parameters.AddWithValue("@responseBody", (object?)item.ResponseBody ?? DBNull.Value);
        command.Parameters.AddWithValue("@responseIsBase64", item.ResponseIsBase64 ? 1 : 0);
        command.Parameters.AddWithValue("@sortOrder", sortOrder);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task InsertEnvironmentAsync(
        MySqlConnection connection,
        MySqlTransaction transaction,
        string workspaceId,
        EnvironmentVariableItem item,
        int sortOrder,
        CancellationToken cancellationToken)
    {
        await using var command = new MySqlCommand(
            """
            INSERT INTO environment_variables
                (id, workspace_id, name, value, updated_at, sort_order, is_secret)
            VALUES
                (@id, @workspaceId, @name, @value, @updatedAt, @sortOrder, @isSecret);
            """,
            connection,
            transaction);
        command.Parameters.AddWithValue("@id", item.Id);
        command.Parameters.AddWithValue("@workspaceId", workspaceId);
        command.Parameters.AddWithValue("@name", item.Name);
        command.Parameters.AddWithValue("@value", item.Value);
        command.Parameters.AddWithValue("@updatedAt", item.UpdatedAt);
        command.Parameters.AddWithValue("@sortOrder", sortOrder);
        command.Parameters.AddWithValue("@isSecret", item.Secret ? 1 : 0);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task InsertCollectionVariableAsync(
        MySqlConnection connection,
        MySqlTransaction transaction,
        string workspaceId,
        EnvironmentVariableItem item,
        int sortOrder,
        CancellationToken cancellationToken)
    {
        await using var command = new MySqlCommand(
            """
            INSERT INTO collection_variables
                (id, workspace_id, name, value, updated_at, sort_order, is_secret)
            VALUES
                (@id, @workspaceId, @name, @value, @updatedAt, @sortOrder, @isSecret);
            """,
            connection,
            transaction);
        command.Parameters.AddWithValue("@id", item.Id);
        command.Parameters.AddWithValue("@workspaceId", workspaceId);
        command.Parameters.AddWithValue("@name", item.Name);
        command.Parameters.AddWithValue("@value", item.Value);
        command.Parameters.AddWithValue("@updatedAt", item.UpdatedAt);
        command.Parameters.AddWithValue("@sortOrder", sortOrder);
        command.Parameters.AddWithValue("@isSecret", item.Secret ? 1 : 0);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task InsertMockAsync(
        MySqlConnection connection,
        MySqlTransaction transaction,
        string workspaceId,
        MockRouteItem item,
        int sortOrder,
        CancellationToken cancellationToken)
    {
        await using var command = new MySqlCommand(
            """
            INSERT INTO mock_routes
                (id, workspace_id, name, method, path, status_code, content_type, headers, body, updated_at, sort_order, delay_ms)
            VALUES
                (@id, @workspaceId, @name, @method, @path, @statusCode, @contentType, @headers, @body, @updatedAt, @sortOrder, @delayMs);
            """,
            connection,
            transaction);
        command.Parameters.AddWithValue("@id", item.Id);
        command.Parameters.AddWithValue("@workspaceId", workspaceId);
        command.Parameters.AddWithValue("@name", item.Name);
        command.Parameters.AddWithValue("@method", item.Method);
        command.Parameters.AddWithValue("@path", item.Path);
        command.Parameters.AddWithValue("@statusCode", item.StatusCode);
        command.Parameters.AddWithValue("@contentType", item.ContentType);
        command.Parameters.AddWithValue("@headers", item.Headers);
        command.Parameters.AddWithValue("@body", item.Body);
        command.Parameters.AddWithValue("@updatedAt", item.UpdatedAt);
        command.Parameters.AddWithValue("@sortOrder", sortOrder);
        command.Parameters.AddWithValue("@delayMs", item.DelayMs.HasValue ? (object)item.DelayMs.Value : DBNull.Value);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static Task TrimTableAsync(
        MySqlConnection connection,
        MySqlTransaction transaction,
        string tableName,
        string workspaceId,
        int limit,
        CancellationToken cancellationToken)
    {
        var quoted = $"`{tableName.Replace("`", "``", StringComparison.Ordinal)}`";
        return ExecuteAsync(connection, transaction,
            $"""
            DELETE FROM {quoted}
            WHERE workspace_id = @workspaceId
              AND id NOT IN (
                SELECT id FROM (
                  SELECT id FROM {quoted}
                  WHERE workspace_id = @workspaceId
                  ORDER BY sort_order
                  LIMIT {limit}
                ) AS kept
              );
            """,
            cancellationToken,
            command => command.Parameters.AddWithValue("@workspaceId", workspaceId));
    }

    private static async Task ExecuteAsync(
        MySqlConnection connection,
        MySqlTransaction? transaction,
        string sql,
        CancellationToken cancellationToken,
        Action<MySqlCommand>? configure = null)
    {
        await using var command = new MySqlCommand(sql, connection, transaction);
        configure?.Invoke(command);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<int> CountAsync(MySqlConnection connection, string sql, string? query, string workspaceId, CancellationToken cancellationToken)
    {
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.AddWithValue("@workspaceId", workspaceId);
        if (!string.IsNullOrWhiteSpace(query))
        {
            command.Parameters.AddWithValue("@query", $"%{query.Trim()}%");
        }

        return Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken));
    }

    private static void AddQueryPagingParameters(MySqlCommand command, string? query, string workspaceId, int skip, int take)
    {
        command.Parameters.AddWithValue("@workspaceId", workspaceId);
        if (!string.IsNullOrWhiteSpace(query))
        {
            command.Parameters.AddWithValue("@query", $"%{query.Trim()}%");
        }

        command.Parameters.AddWithValue("@skip", skip);
        command.Parameters.AddWithValue("@take", take);
    }

    private async Task ExecuteSingleWorkspaceAsync(string sql, string workspaceId, string id, CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            await EnsureDatabaseAsync(cancellationToken);
            await using var connection = new MySqlConnection(databaseConnectionString);
            await connection.OpenAsync(cancellationToken);
            await ExecuteAsync(connection, null, sql, cancellationToken, command =>
            {
                command.Parameters.AddWithValue("@workspaceId", AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId));
                command.Parameters.AddWithValue("@id", id);
            });
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task ExecuteSingleWorkspaceAsync(string sql, string workspaceId, CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            await EnsureDatabaseAsync(cancellationToken);
            await using var connection = new MySqlConnection(databaseConnectionString);
            await connection.OpenAsync(cancellationToken);
            await ExecuteAsync(connection, null, sql, cancellationToken, command =>
            {
                command.Parameters.AddWithValue("@workspaceId", AppStateStoreHelpers.NormalizeWorkspaceId(workspaceId));
            });
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task ExecuteInTransactionAsync(
        Func<MySqlConnection, MySqlTransaction, Task> execute,
        CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            await EnsureDatabaseAsync(cancellationToken);
            await using var connection = new MySqlConnection(databaseConnectionString);
            await connection.OpenAsync(cancellationToken);
            await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
            await execute(connection, transaction);
            await transaction.CommitAsync(cancellationToken);
        }
        finally
        {
            gate.Release();
        }
    }

    private static async Task EnsureWorkspaceAsync(
        MySqlConnection connection,
        MySqlTransaction? transaction,
        WorkspaceItem workspace,
        CancellationToken cancellationToken)
    {
        await ExecuteAsync(connection, transaction,
            """
            INSERT IGNORE INTO workspaces (id, name, updated_at, sort_order)
            VALUES (@id, @name, @updatedAt, 0);
            """,
            cancellationToken,
            command =>
            {
                command.Parameters.AddWithValue("@id", workspace.Id);
                command.Parameters.AddWithValue("@name", workspace.Name);
                command.Parameters.AddWithValue("@updatedAt", workspace.UpdatedAt);
            });
    }

    private static string ReadString(MySqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? string.Empty : reader.GetString(ordinal);
    }

    private static int? ReadNullableInt(MySqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetInt32(ordinal);
    }

    private static long? ReadNullableLong(MySqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetInt64(ordinal);
    }

    private static string? ReadNullableString(MySqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    private static bool ReadBool(MySqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return !reader.IsDBNull(ordinal) && reader.GetBoolean(ordinal);
    }

    private static ApiHeader[]? ReadHeaders(MySqlDataReader reader, string name)
    {
        var json = ReadString(reader, name);
        if (string.IsNullOrWhiteSpace(json) || string.Equals(json, "null", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<ApiHeader[]>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static RequestAssertions? ReadAssertions(MySqlDataReader reader, string name)
    {
        var json = ReadString(reader, name);
        if (string.IsNullOrWhiteSpace(json) || string.Equals(json, "null", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<RequestAssertions>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static CaptureItem[]? ReadCaptures(MySqlDataReader reader, string name)
    {
        var json = ReadString(reader, name);
        if (string.IsNullOrWhiteSpace(json) || string.Equals(json, "null", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<CaptureItem[]>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string NormalizeAuthType(string? authType, string? authToken)
    {
        if (string.Equals(authType, "bearer", StringComparison.OrdinalIgnoreCase)) return "bearer";
        if (string.Equals(authType, "basic", StringComparison.OrdinalIgnoreCase)) return "basic";
        if (string.Equals(authType, "apikey", StringComparison.OrdinalIgnoreCase)) return "apikey";
        if (string.Equals(authType, "none", StringComparison.OrdinalIgnoreCase)) return "none";
        return string.IsNullOrWhiteSpace(authToken) ? "none" : "bearer";
    }

}
