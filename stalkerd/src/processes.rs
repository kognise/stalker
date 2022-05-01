use sysinfo::{ProcessExt, System, SystemExt};

pub fn collect_processes(system: &mut System) -> Vec<&'static str> {
    system.refresh_processes();

    let mut collected = vec![];
    for process in system.processes().values() {
        match process.name() {
            "Live" => collected.push("ableton"),
            "Terminal" => collected.push("terminal"),
            "mscore" => collected.push("musescore"),
            "Max" => collected.push("max"),
            "zoom.us" => collected.push("zoom"),
            "Figma" => collected.push("figma"),
            "studio" => collected.push("android-studio"),
            "Celeste" => collected.push("celeste"),
            "factorio" => collected.push("factorio"),
            "RimWorld by Ludeon Studios" => collected.push("rimworld"),
            "java" => {
                if process.cmd().iter().any(|c| c.contains("minecraft")) {
                    collected.push("minecraft")
                }
            }
            "Electron" => {
                if process
                    .exe()
                    .ends_with("Visual Studio Code.app/Contents/MacOS/Electron")
                {
                    collected.push("vscode");
                }
            }
            _ => {}
        }
    }
    collected
}
