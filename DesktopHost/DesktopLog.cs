namespace AccessibleApiTester.Desktop;

static class DesktopLog
{
    private static readonly string LogPath = Path.Combine(AppContext.BaseDirectory, "desktop-host.log");

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
