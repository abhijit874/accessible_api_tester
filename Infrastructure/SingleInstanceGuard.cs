using System.Diagnostics;

namespace AccessibleApiTester.Infrastructure;

public sealed class SingleInstanceGuard : IDisposable
{
    private readonly Mutex mutex;

    private SingleInstanceGuard(Mutex mutex, bool ownsInstance)
    {
        this.mutex = mutex;
        OwnsInstance = ownsInstance;
    }

    public bool OwnsInstance { get; }

    public static SingleInstanceGuard Acquire()
    {
        var mutex = new Mutex(true, "AccessibleApiTester.SingleInstance", out var ownsSingleInstance);
        if (!ownsSingleInstance)
        {
            var runningProcesses = Process.GetProcessesByName("AccessibleApiTester")
                .Where(process => process.Id != Environment.ProcessId)
                .Select(process => process.Id)
                .ToArray();
            var processText = runningProcesses.Length == 0
                ? "another process"
                : $"PID {string.Join(", PID ", runningProcesses)}";

            Console.Error.WriteLine($"Accessible API Tester is already running ({processText}). Use the existing desktop window or close it before starting another one.");
        }

        return new SingleInstanceGuard(mutex, ownsSingleInstance);
    }

    public void Dispose()
    {
        if (OwnsInstance)
        {
            mutex.ReleaseMutex();
        }

        mutex.Dispose();
    }
}
