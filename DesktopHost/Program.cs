using AccessibleApiTester;
using AccessibleApiTester.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;

namespace AccessibleApiTester.Desktop;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        try
        {
            Run(args);
        }
        catch (Exception ex)
        {
            DesktopLog.Write(ex.ToString());
            MessageBox.Show(
                $"Accessible API Tester could not start: {ex.Message}",
                "Accessible API Tester",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }

    private static void Run(string[] args)
    {
        ApplicationConfiguration.Initialize();
        var serverArgs = BuildServerArgs(args);
        using var singleInstance = SingleInstanceGuard.Acquire();
        if (!singleInstance.OwnsInstance)
        {
            MessageBox.Show(
                "Accessible API Tester is already running. Close the existing instance before starting another one.",
                "Accessible API Tester",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            return;
        }

        using var app = WebAppFactory.Create(serverArgs, FindWebContentRoot());
        app.StartAsync().GetAwaiter().GetResult();

        var address = GetListeningAddress(app) ?? "http://127.0.0.1:5090";
        DesktopLog.Write($"Started web host at {address}.");
        using var mainForm = new MainForm(address);
        Application.Run(mainForm);

        app.StopAsync().GetAwaiter().GetResult();
        DesktopLog.Write("Stopped web host.");
    }

    private static string[] BuildServerArgs(string[] args)
    {
        if (args.Any(arg =>
            string.Equals(arg, "--urls", StringComparison.OrdinalIgnoreCase) ||
            arg.StartsWith("--urls=", StringComparison.OrdinalIgnoreCase)))
        {
            return args;
        }

        return [.. args, "--urls", "http://127.0.0.1:5090"];
    }

    private static string? GetListeningAddress(WebApplication app)
    {
        var server = app.Services.GetRequiredService<IServer>();
        var addressFeature = server.Features.Get<IServerAddressesFeature>();
        return addressFeature?.Addresses.FirstOrDefault();
    }

    private static string FindWebContentRoot()
    {
        var current = AppContext.BaseDirectory;
        while (!string.IsNullOrWhiteSpace(current))
        {
            if (File.Exists(Path.Combine(current, "AccessibleApiTester.csproj")) &&
                Directory.Exists(Path.Combine(current, "wwwroot")))
            {
                return current;
            }

            var parent = Directory.GetParent(current)?.FullName;
            if (string.Equals(parent, current, StringComparison.OrdinalIgnoreCase))
            {
                break;
            }

            current = parent ?? string.Empty;
        }

        // In a published single-file build the exe extracts to a temp dir, so
        // AppContext.BaseDirectory won't contain wwwroot. Check the real exe location.
        var exeDirectory = Path.GetDirectoryName(Environment.ProcessPath);
        if (!string.IsNullOrWhiteSpace(exeDirectory) &&
            Directory.Exists(Path.Combine(exeDirectory, "wwwroot")))
        {
            return exeDirectory;
        }

        return Directory.GetCurrentDirectory();
    }
}
