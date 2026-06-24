using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace AccessibleApiTester.Desktop;

sealed class MainForm : Form
{
    private readonly string address;
    private readonly WebView2 webView = new()
    {
        Dock = DockStyle.Fill
    };

    public MainForm(string address)
    {
        this.address = address;

        Text = "Accessible API Tester";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(1024, 720);
        Width = 1280;
        Height = 860;

        Controls.Add(webView);
        Load += OnLoad;
    }

    private async void OnLoad(object? sender, EventArgs e)
    {
        try
        {
            // WebView2 defaults its cache to a folder next to the .exe. When the
            // app is installed under Program Files that location is read-only for
            // normal users and EnsureCoreWebView2Async fails with "Access denied".
            // Point the user-data folder at a writable per-user location instead.
            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "AccessibleApiTester",
                "WebView2");
            Directory.CreateDirectory(userDataFolder);
            var environment = await CoreWebView2Environment.CreateAsync(
                browserExecutableFolder: null,
                userDataFolder: userDataFolder,
                options: null);
            await webView.EnsureCoreWebView2Async(environment);
            webView.CoreWebView2.DocumentTitleChanged += (_, _) =>
            {
                var title = webView.CoreWebView2.DocumentTitle;
                Text = string.IsNullOrWhiteSpace(title)
                    ? "Accessible API Tester"
                    : title;
            };
            webView.CoreWebView2.Navigate(address);
        }
        catch (WebView2RuntimeNotFoundException)
        {
            DesktopLog.Write("WebView2 Runtime was not found.");
            MessageBox.Show(
                "Microsoft Edge WebView2 Runtime is required to run the desktop app. Install WebView2 Runtime, then start Accessible API Tester again.",
                "Accessible API Tester",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            Close();
        }
        catch (Exception ex)
        {
            DesktopLog.Write(ex.ToString());
            MessageBox.Show(
                $"Could not open Accessible API Tester: {ex.Message}",
                "Accessible API Tester",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            Close();
        }
    }
}
