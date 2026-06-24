namespace AccessibleApiTester.Desktop;

static class DesktopLog
{
    // Write to a per-user writable location. AppContext.BaseDirectory is the
    // install folder, which is read-only when installed under Program Files.
    private static readonly string LogPath = BuildLogPath();

    private static string BuildLogPath()
    {
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AccessibleApiTester");
        Directory.CreateDirectory(dir);
        return Path.Combine(dir, "desktop-host.log");
    }

    public static void Write(string message)
    {
        try
        {
            File.AppendAllText(LogPath, $"[{DateTimeOffset.Now:O}] {message}{Environment.NewLine}");
        }
        catch
        {
            // Startup logging must never prevent the desktop app from opening.
        }
    }
}
