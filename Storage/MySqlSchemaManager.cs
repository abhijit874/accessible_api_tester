using MySqlConnector;

namespace AccessibleApiTester.Storage;

sealed class MySqlSchemaManager(
    string databaseName,
    string serverConnectionString,
    string databaseConnectionString,
    ILogger logger)
{
    private const int CurrentSchemaVersion = 17;

    public async Task EnsureInitializedAsync(CancellationToken cancellationToken)
    {
        await EnsureDatabaseAsync(cancellationToken);

        await using var connection = new MySqlConnection(databaseConnectionString);
        await connection.OpenAsync(cancellationToken);

        await EnsureSchemaMetadataAsync(connection, cancellationToken);
        await ApplyBaselineSchemaAsync(connection, cancellationToken);
        await ApplyMigrationsAsync(connection, cancellationToken);
    }

    private async Task EnsureDatabaseAsync(CancellationToken cancellationToken)
    {
        await using var connection = new MySqlConnection(serverConnectionString);
        await connection.OpenAsync(cancellationToken);
        await ExecuteAsync(connection, $"CREATE DATABASE IF NOT EXISTS {QuoteIdentifier(databaseName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;", cancellationToken);
    }

    private static async Task EnsureSchemaMetadataAsync(MySqlConnection connection, CancellationToken cancellationToken)
    {
        await ExecuteAsync(connection,
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INT NOT NULL PRIMARY KEY,
                description VARCHAR(255) NOT NULL,
                applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            """,
            cancellationToken);
    }

    private async Task ApplyBaselineSchemaAsync(MySqlConnection connection, CancellationToken cancellationToken)
    {
        await ExecuteAsync(connection,
            """
            CREATE TABLE IF NOT EXISTS saved_requests (
                id VARCHAR(100) NOT NULL PRIMARY KEY,
                workspace_id VARCHAR(100) NOT NULL DEFAULT 'default',
                name VARCHAR(255) NOT NULL,
                method VARCHAR(20) NOT NULL,
                url TEXT NOT NULL,
                params TEXT NULL,
                headers MEDIUMTEXT NOT NULL,
                auth_type VARCHAR(40) NULL,
                auth_token MEDIUMTEXT NULL,
                folder VARCHAR(255) NULL,
                content_type VARCHAR(255) NOT NULL,
                body MEDIUMTEXT NOT NULL,
                assertions_json MEDIUMTEXT NOT NULL,
                updated_at VARCHAR(64) NOT NULL,
                sort_order INT NOT NULL,
                INDEX ix_saved_requests_workspace_sort_order (workspace_id, sort_order)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            """,
            cancellationToken);
        await EnsureColumnAsync(connection, "saved_requests", "workspace_id", "VARCHAR(100) NOT NULL DEFAULT 'default'", cancellationToken);
        await EnsureColumnAsync(connection, "saved_requests", "assertions_json", "MEDIUMTEXT NULL", cancellationToken);
        await EnsureColumnAsync(connection, "saved_requests", "auth_type", "VARCHAR(40) NULL", cancellationToken);
        await EnsureColumnAsync(connection, "saved_requests", "auth_token", "MEDIUMTEXT NULL", cancellationToken);
        await EnsureColumnAsync(connection, "saved_requests", "folder", "VARCHAR(255) NULL", cancellationToken);

        await ExecuteAsync(connection,
            """
            CREATE TABLE IF NOT EXISTS request_history (
                id VARCHAR(100) NOT NULL PRIMARY KEY,
                workspace_id VARCHAR(100) NOT NULL DEFAULT 'default',
                method VARCHAR(20) NOT NULL,
                url TEXT NOT NULL,
                headers MEDIUMTEXT NOT NULL,
                content_type VARCHAR(255) NOT NULL,
                body MEDIUMTEXT NOT NULL,
                status_code INT NOT NULL,
                request_time VARCHAR(64) NOT NULL,
                sort_order INT NOT NULL,
                INDEX ix_request_history_workspace_sort_order (workspace_id, sort_order)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            """,
            cancellationToken);
        await EnsureColumnAsync(connection, "request_history", "workspace_id", "VARCHAR(100) NOT NULL DEFAULT 'default'", cancellationToken);

        await ExecuteAsync(connection,
            """
            CREATE TABLE IF NOT EXISTS environment_variables (
                id VARCHAR(100) NOT NULL PRIMARY KEY,
                workspace_id VARCHAR(100) NOT NULL DEFAULT 'default',
                name VARCHAR(255) NOT NULL,
                value MEDIUMTEXT NOT NULL,
                updated_at VARCHAR(64) NOT NULL,
                sort_order INT NOT NULL,
                UNIQUE INDEX ux_environment_variables_workspace_name (workspace_id, name),
                INDEX ix_environment_variables_workspace_sort_order (workspace_id, sort_order)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            """,
            cancellationToken);
        await EnsureColumnAsync(connection, "environment_variables", "workspace_id", "VARCHAR(100) NOT NULL DEFAULT 'default'", cancellationToken);

        await ExecuteAsync(connection,
            """
            CREATE TABLE IF NOT EXISTS mock_routes (
                id VARCHAR(100) NOT NULL PRIMARY KEY,
                workspace_id VARCHAR(100) NOT NULL DEFAULT 'default',
                name VARCHAR(255) NOT NULL,
                method VARCHAR(20) NOT NULL,
                path TEXT NOT NULL,
                status_code INT NOT NULL,
                content_type VARCHAR(255) NOT NULL,
                headers MEDIUMTEXT NOT NULL,
                body MEDIUMTEXT NOT NULL,
                updated_at VARCHAR(64) NOT NULL,
                sort_order INT NOT NULL,
                INDEX ix_mock_routes_workspace_sort_order (workspace_id, sort_order)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            """,
            cancellationToken);
        await EnsureColumnAsync(connection, "mock_routes", "workspace_id", "VARCHAR(100) NOT NULL DEFAULT 'default'", cancellationToken);

        await ExecuteAsync(connection,
            """
            CREATE TABLE IF NOT EXISTS workspaces (
                id VARCHAR(100) NOT NULL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                updated_at VARCHAR(64) NOT NULL,
                sort_order INT NOT NULL,
                UNIQUE INDEX ux_workspaces_name (name),
                INDEX ix_workspaces_sort_order (sort_order)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            """,
            cancellationToken);

        await MarkMigrationAppliedAsync(connection, 1, "Baseline app schema", cancellationToken);
    }

    private async Task ApplyMigrationsAsync(MySqlConnection connection, CancellationToken cancellationToken)
    {
        var appliedVersion = await GetAppliedVersionAsync(connection, cancellationToken);
        if (appliedVersion < 2)
        {
            await EnsureIndexAsync(connection, "saved_requests", "ix_saved_requests_method", "method", cancellationToken);
            await EnsureIndexAsync(connection, "request_history", "ix_request_history_request_time", "request_time", cancellationToken);
            await EnsureIndexAsync(connection, "mock_routes", "ix_mock_routes_method_path", "method, path(255)", cancellationToken);
            await MarkMigrationAppliedAsync(connection, 2, "Add lookup indexes for request and mock schema", cancellationToken);
        }

        if (appliedVersion < 3)
        {
            await EnsureIndexAsync(connection, "saved_requests", "ix_saved_requests_workspace_sort_order", "workspace_id, sort_order", cancellationToken);
            await EnsureIndexAsync(connection, "request_history", "ix_request_history_workspace_sort_order", "workspace_id, sort_order", cancellationToken);
            await EnsureIndexAsync(connection, "environment_variables", "ix_environment_variables_workspace_sort_order", "workspace_id, sort_order", cancellationToken);
            await EnsureIndexAsync(connection, "mock_routes", "ix_mock_routes_workspace_sort_order", "workspace_id, sort_order", cancellationToken);
            await EnsureIndexAsync(connection, "workspaces", "ix_workspaces_sort_order", "sort_order", cancellationToken);
            await MarkMigrationAppliedAsync(connection, 3, "Add workspace scoping to saved data", cancellationToken);
        }

        if (appliedVersion < 4)
        {
            await EnsureColumnAsync(connection, "saved_requests", "folder", "VARCHAR(255) NULL", cancellationToken);
            await EnsureIndexAsync(connection, "saved_requests", "ix_saved_requests_workspace_folder_sort_order", "workspace_id, folder, sort_order", cancellationToken);
            await MarkMigrationAppliedAsync(connection, 4, "Add folders to saved requests", cancellationToken);
        }

        if (appliedVersion < 5)
        {
            await EnsureColumnAsync(connection, "saved_requests", "params", "TEXT NULL", cancellationToken);
            await DropIndexIfExistsAsync(connection, "environment_variables", "ux_environment_variables_name", cancellationToken);
            await EnsureIndexAsync(connection, "environment_variables", "ux_environment_variables_workspace_name", "workspace_id, name", cancellationToken);
            await MarkMigrationAppliedAsync(connection, 5, "Add params to saved requests, fix env vars unique index scope", cancellationToken);
        }

        if (appliedVersion < 6)
        {
            await EnsureColumnAsync(connection, "saved_requests", "auth_key_name", "VARCHAR(255) NULL", cancellationToken);
            await EnsureColumnAsync(connection, "saved_requests", "auth_key_in", "VARCHAR(40) NULL", cancellationToken);
            await MarkMigrationAppliedAsync(connection, 6, "Add API key auth fields to saved requests", cancellationToken);
        }

        if (appliedVersion < 7)
        {
            await EnsureColumnAsync(connection, "saved_requests", "captures_json", "MEDIUMTEXT NULL", cancellationToken);
            await MarkMigrationAppliedAsync(connection, 7, "Add captures to saved requests", cancellationToken);
        }

        if (appliedVersion < 8)
        {
            await EnsureColumnAsync(connection, "saved_requests", "pre_request_script", "MEDIUMTEXT NULL", cancellationToken);
            await EnsureColumnAsync(connection, "saved_requests", "post_response_script", "MEDIUMTEXT NULL", cancellationToken);
            await MarkMigrationAppliedAsync(connection, 8, "Add pre/post scripts to saved requests", cancellationToken);
        }

        if (appliedVersion < 9)
        {
            await EnsureColumnAsync(connection, "request_history", "auth_type", "VARCHAR(40) NULL", cancellationToken);
            await EnsureColumnAsync(connection, "request_history", "auth_token", "MEDIUMTEXT NULL", cancellationToken);
            await EnsureColumnAsync(connection, "request_history", "auth_key_name", "VARCHAR(255) NULL", cancellationToken);
            await EnsureColumnAsync(connection, "request_history", "auth_key_in", "VARCHAR(40) NULL", cancellationToken);
            await MarkMigrationAppliedAsync(connection, 9, "Add auth fields to request history", cancellationToken);
        }

        if (appliedVersion < 10)
        {
            await EnsureColumnAsync(connection, "saved_requests", "timeout_ms", "INT NULL", cancellationToken);
            await MarkMigrationAppliedAsync(connection, 10, "Add timeout to saved requests", cancellationToken);
        }

        if (appliedVersion < 11)
        {
            await EnsureColumnAsync(connection, "environment_variables", "is_secret", "TINYINT(1) NOT NULL DEFAULT 0", cancellationToken);
            await MarkMigrationAppliedAsync(connection, 11, "Add secret flag to environment variables", cancellationToken);
        }

        if (appliedVersion < 12)
        {
            await EnsureColumnAsync(connection, "mock_routes", "delay_ms", "INT NULL", cancellationToken);
            await MarkMigrationAppliedAsync(connection, 12, "Add response delay to mock routes", cancellationToken);
        }

        if (appliedVersion < 13)
        {
            await EnsureColumnAsync(connection, "saved_requests", "description", "MEDIUMTEXT NULL", cancellationToken);
            await MarkMigrationAppliedAsync(connection, 13, "Add description (docs) to saved requests", cancellationToken);
        }

        if (appliedVersion < 14)
        {
            await ExecuteAsync(connection,
                """
                CREATE TABLE IF NOT EXISTS collection_variables (
                    id VARCHAR(100) NOT NULL PRIMARY KEY,
                    workspace_id VARCHAR(100) NOT NULL DEFAULT 'default',
                    name VARCHAR(255) NOT NULL,
                    value MEDIUMTEXT NOT NULL,
                    updated_at VARCHAR(64) NOT NULL,
                    is_secret TINYINT(1) NOT NULL DEFAULT 0,
                    sort_order INT NOT NULL,
                    UNIQUE INDEX ux_collection_variables_workspace_name (workspace_id, name),
                    INDEX ix_collection_variables_workspace_sort_order (workspace_id, sort_order)
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
                """,
                cancellationToken);
            await MarkMigrationAppliedAsync(connection, 14, "Add collection-scoped variables table", cancellationToken);
        }

        if (appliedVersion < 15)
        {
            await ExecuteAsync(connection,
                """
                CREATE TABLE IF NOT EXISTS projects (
                    id VARCHAR(100) NOT NULL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    updated_at VARCHAR(64) NOT NULL,
                    sort_order INT NOT NULL,
                    INDEX ix_projects_sort_order (sort_order)
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
                """,
                cancellationToken);
            await EnsureColumnAsync(connection, "workspaces", "project_id", "VARCHAR(100) NOT NULL DEFAULT 'personal'", cancellationToken);
            await MarkMigrationAppliedAsync(connection, 15, "Add projects table and project_id to workspaces", cancellationToken);
        }

        if (appliedVersion < 16)
        {
            await DropColumnIfExistsAsync(connection, "workspaces", "project_id", cancellationToken);
            await ExecuteAsync(connection, "DROP TABLE IF EXISTS projects;", cancellationToken);
            await MarkMigrationAppliedAsync(connection, 16, "Remove project entity (projects table and project_id from workspaces)", cancellationToken);
        }

        if (appliedVersion < 17)
        {
            await EnsureColumnAsync(connection, "request_history", "response_status_text", "VARCHAR(255) NULL", cancellationToken);
            await EnsureColumnAsync(connection, "request_history", "response_duration_ms", "BIGINT NULL", cancellationToken);
            await EnsureColumnAsync(connection, "request_history", "response_headers", "MEDIUMTEXT NULL", cancellationToken);
            await EnsureColumnAsync(connection, "request_history", "response_body", "LONGTEXT NULL", cancellationToken);
            await EnsureColumnAsync(connection, "request_history", "response_is_base64", "TINYINT(1) NOT NULL DEFAULT 0", cancellationToken);
            await MarkMigrationAppliedAsync(connection, 17, "Capture response (status text, duration, headers, body) in request history", cancellationToken);
        }

        var finalVersion = await GetAppliedVersionAsync(connection, cancellationToken);
        if (finalVersion < CurrentSchemaVersion)
        {
            throw new InvalidOperationException($"Database schema version {finalVersion} is older than required version {CurrentSchemaVersion}.");
        }
    }

    private static async Task<int> GetAppliedVersionAsync(MySqlConnection connection, CancellationToken cancellationToken)
    {
        await using var command = new MySqlCommand("SELECT COALESCE(MAX(version), 0) FROM schema_migrations;", connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken));
    }

    private static async Task MarkMigrationAppliedAsync(MySqlConnection connection, int version, string description, CancellationToken cancellationToken)
    {
        await using var command = new MySqlCommand(
            """
            INSERT INTO schema_migrations (version, description)
            VALUES (@version, @description)
            ON DUPLICATE KEY UPDATE description = VALUES(description);
            """,
            connection);
        command.Parameters.AddWithValue("@version", version);
        command.Parameters.AddWithValue("@description", description);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task EnsureColumnAsync(
        MySqlConnection connection,
        string tableName,
        string columnName,
        string columnDefinition,
        CancellationToken cancellationToken)
    {
        var exists = await InformationSchemaExistsAsync(
            connection,
            "INFORMATION_SCHEMA.COLUMNS",
            "TABLE_SCHEMA = @databaseName AND TABLE_NAME = @tableName AND COLUMN_NAME = @columnName",
            command =>
            {
                command.Parameters.AddWithValue("@tableName", tableName);
                command.Parameters.AddWithValue("@columnName", columnName);
            },
            cancellationToken);

        if (exists)
        {
            return;
        }

        logger.LogInformation("Adding {ColumnName} column to {TableName}.", columnName, tableName);
        await ExecuteAsync(connection, $"ALTER TABLE {QuoteIdentifier(tableName)} ADD COLUMN {QuoteIdentifier(columnName)} {columnDefinition};", cancellationToken);
    }

    private async Task EnsureIndexAsync(
        MySqlConnection connection,
        string tableName,
        string indexName,
        string indexDefinition,
        CancellationToken cancellationToken)
    {
        var exists = await InformationSchemaExistsAsync(
            connection,
            "INFORMATION_SCHEMA.STATISTICS",
            "TABLE_SCHEMA = @databaseName AND TABLE_NAME = @tableName AND INDEX_NAME = @indexName",
            command =>
            {
                command.Parameters.AddWithValue("@tableName", tableName);
                command.Parameters.AddWithValue("@indexName", indexName);
            },
            cancellationToken);

        if (exists)
        {
            return;
        }

        logger.LogInformation("Adding {IndexName} index to {TableName}.", indexName, tableName);
        await ExecuteAsync(connection, $"CREATE INDEX {QuoteIdentifier(indexName)} ON {QuoteIdentifier(tableName)} ({indexDefinition});", cancellationToken);
    }

    private async Task DropColumnIfExistsAsync(
        MySqlConnection connection,
        string tableName,
        string columnName,
        CancellationToken cancellationToken)
    {
        var exists = await InformationSchemaExistsAsync(
            connection,
            "INFORMATION_SCHEMA.COLUMNS",
            "TABLE_SCHEMA = @databaseName AND TABLE_NAME = @tableName AND COLUMN_NAME = @columnName",
            command =>
            {
                command.Parameters.AddWithValue("@tableName", tableName);
                command.Parameters.AddWithValue("@columnName", columnName);
            },
            cancellationToken);

        if (!exists)
        {
            return;
        }

        logger.LogInformation("Dropping {ColumnName} column from {TableName}.", columnName, tableName);
        await ExecuteAsync(connection, $"ALTER TABLE {QuoteIdentifier(tableName)} DROP COLUMN {QuoteIdentifier(columnName)};", cancellationToken);
    }

    private async Task DropIndexIfExistsAsync(
        MySqlConnection connection,
        string tableName,
        string indexName,
        CancellationToken cancellationToken)
    {
        var exists = await InformationSchemaExistsAsync(
            connection,
            "INFORMATION_SCHEMA.STATISTICS",
            "TABLE_SCHEMA = @databaseName AND TABLE_NAME = @tableName AND INDEX_NAME = @indexName",
            command =>
            {
                command.Parameters.AddWithValue("@tableName", tableName);
                command.Parameters.AddWithValue("@indexName", indexName);
            },
            cancellationToken);

        if (!exists)
        {
            return;
        }

        logger.LogInformation("Dropping {IndexName} index from {TableName}.", indexName, tableName);
        await ExecuteAsync(connection, $"DROP INDEX {QuoteIdentifier(indexName)} ON {QuoteIdentifier(tableName)};", cancellationToken);
    }

    private async Task<bool> InformationSchemaExistsAsync(
        MySqlConnection connection,
        string source,
        string predicate,
        Action<MySqlCommand> configure,
        CancellationToken cancellationToken)
    {
        await using var command = new MySqlCommand(
            $"""
            SELECT COUNT(*)
            FROM {source}
            WHERE {predicate};
            """,
            connection);
        command.Parameters.AddWithValue("@databaseName", databaseName);
        configure(command);
        return Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken)) > 0;
    }

    private static async Task ExecuteAsync(MySqlConnection connection, string sql, CancellationToken cancellationToken)
    {
        await using var command = new MySqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static string QuoteIdentifier(string identifier)
    {
        return $"`{identifier.Replace("`", "``", StringComparison.Ordinal)}`";
    }
}
