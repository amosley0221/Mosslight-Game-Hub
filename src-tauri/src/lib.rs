use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const KEYRING_SERVICE: &str = "com.mosslightstudios.gamehub";

#[derive(Serialize)]
struct Entry {
    name: String,
    is_dir: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanResult {
    name: String,
    path: String,
    entries: Vec<Entry>,
    package_json: Option<String>,
}

#[derive(Serialize)]
struct ToolStatus {
    installed: bool,
    path: Option<String>,
}

/// Top-level listing of a folder, plus package.json contents when present.
#[tauri::command]
fn scan_folder(path: String) -> Result<ScanResult, String> {
    let dir = PathBuf::from(&path);
    let rd = std::fs::read_dir(&dir).map_err(|e| format!("Can't read {path}: {e}"))?;
    let mut entries = Vec::new();
    for e in rd.flatten() {
        let name = e.file_name().to_string_lossy().to_string();
        // .app bundles are directories on macOS but behave like launchable files.
        let is_dir = e.file_type().map(|t| t.is_dir()).unwrap_or(false) && !name.ends_with(".app");
        entries.push(Entry { name, is_dir });
    }
    let package_json = std::fs::read_to_string(dir.join("package.json")).ok();
    let name = dir.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or(path.clone());
    Ok(ScanResult { name, path, entries, package_json })
}

/// Writes the raw request body to the absolute path in the `x-path` header (URL-encoded).
#[tauri::command]
fn save_bytes(request: tauri::ipc::Request<'_>) -> Result<String, String> {
    let raw = request
        .headers()
        .get("x-path")
        .and_then(|v| v.to_str().ok())
        .ok_or("missing x-path header")?;
    let path = urlencoding::decode(raw).map_err(|e| e.to_string())?.to_string();
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected a raw byte body".into());
    };
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&p, bytes).map_err(|e| e.to_string())?;
    Ok(path)
}

/// Returns a file's bytes as a raw IPC response (used to upload APKs and images to sync).
#[tauri::command]
fn read_file_bytes(path: String, max: u64) -> Result<tauri::ipc::Response, String> {
    let len = std::fs::metadata(&path).map_err(|e| format!("Can't read {path}: {e}"))?.len();
    if len > max {
        return Err(format!("{path} is too large to sync ({} MB)", len / 1_048_576));
    }
    std::fs::read(&path).map(tauri::ipc::Response::new).map_err(|e| e.to_string())
}

#[tauri::command]
fn copy_file(src: String, dest: String) -> Result<String, String> {
    let d = PathBuf::from(&dest);
    if let Some(parent) = d.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::copy(&src, &d).map_err(|e| format!("Copy failed: {e}"))?;
    Ok(dest)
}

#[tauri::command]
fn remove_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.is_file() {
        std::fs::remove_file(p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn secret_get(name: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &name).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn secret_set(name: String, value: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &name).map_err(|e| e.to_string())?;
    if value.is_empty() {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    } else {
        entry.set_password(&value).map_err(|e| e.to_string())
    }
}

/// PATH plus the usual install locations GUI apps don't inherit (Homebrew, npm globals…).
fn search_path() -> String {
    let mut parts: Vec<String> = std::env::var("PATH").unwrap_or_default().split(if cfg!(windows) { ';' } else { ':' }).map(String::from).collect();
    if let Some(home) = dirs::home_dir() {
        let h = home.to_string_lossy().to_string();
        if cfg!(windows) {
            if let Ok(appdata) = std::env::var("APPDATA") {
                parts.push(format!("{appdata}\\npm"));
            }
            parts.push(format!("{h}\\.local\\bin"));
        } else {
            for p in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"] {
                parts.push(p.into());
            }
            for p in [".local/bin", ".npm-global/bin", ".claude/local", ".volta/bin", ".bun/bin"] {
                parts.push(format!("{h}/{p}"));
            }
        }
    }
    parts.join(if cfg!(windows) { ";" } else { ":" })
}

fn which_any(names: &[&str]) -> Option<PathBuf> {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let sp = search_path();
    names.iter().find_map(|n| which::which_in(n, Some(&sp), &cwd).ok())
}

/// First existing `<base>/<dir starting with prefix>/<suffix>`.
fn glob_first(base: &Path, prefix: &str, suffix: &str) -> Option<PathBuf> {
    let mut dirs: Vec<PathBuf> = std::fs::read_dir(base)
        .ok()?
        .flatten()
        .filter(|e| e.file_name().to_string_lossy().starts_with(prefix))
        .map(|e| e.path().join(suffix))
        .filter(|p| p.exists())
        .collect();
    dirs.sort();
    dirs.pop()
}

fn first_existing(paths: Vec<PathBuf>) -> Option<PathBuf> {
    paths.into_iter().find(|p| p.exists())
}

fn android_sdk() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("ANDROID_HOME").or_else(|_| std::env::var("ANDROID_SDK_ROOT")) {
        return Some(PathBuf::from(p));
    }
    let home = dirs::home_dir()?;
    let p = if cfg!(windows) {
        PathBuf::from(std::env::var("LOCALAPPDATA").ok()?).join("Android").join("Sdk")
    } else if cfg!(target_os = "macos") {
        home.join("Library/Android/sdk")
    } else {
        home.join("Android/Sdk")
    };
    p.exists().then_some(p)
}

fn find_adb() -> Option<PathBuf> {
    which_any(&["adb"]).or_else(|| {
        let exe = if cfg!(windows) { "adb.exe" } else { "adb" };
        first_existing(vec![android_sdk()?.join("platform-tools").join(exe)])
    })
}

fn find_aapt() -> Option<PathBuf> {
    let exe = if cfg!(windows) { "aapt.exe" } else { "aapt" };
    which_any(&["aapt"]).or_else(|| glob_first(&android_sdk()?.join("build-tools"), "", exe))
}

fn find_tool(id: &str) -> Option<PathBuf> {
    let home = dirs::home_dir().unwrap_or_default();
    if cfg!(windows) {
        let pf = PathBuf::from(std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".into()));
        match id {
            "unreal" => glob_first(&pf.join("Epic Games"), "UE_5", "Engine\\Binaries\\Win64\\UnrealEditor.exe"),
            "unity" => glob_first(&pf.join("Unity\\Hub\\Editor"), "", "Editor\\Unity.exe").or_else(|| first_existing(vec![pf.join("Unity Hub\\Unity Hub.exe")])),
            "godot" => which_any(&["godot", "godot4", "Godot"]),
            "web" => which_any(&["node"]),
            "blender" => glob_first(&pf.join("Blender Foundation"), "Blender", "blender.exe").or_else(|| which_any(&["blender"])),
            "aseprite" => which_any(&["aseprite"]).or_else(|| first_existing(vec![pf.join("Aseprite\\Aseprite.exe"), PathBuf::from("C:\\Program Files (x86)\\Steam\\steamapps\\common\\Aseprite\\Aseprite.exe")])),
            "krita" => first_existing(vec![pf.join("Krita (x64)\\bin\\krita.exe")]),
            "audacity" => first_existing(vec![pf.join("Audacity\\Audacity.exe")]),
            "substance" => glob_first(&pf.join("Adobe"), "Adobe Substance 3D Painter", "Adobe Substance 3D Painter.exe"),
            "adb" => find_adb(),
            "git" => which_any(&["git", "p4"]),
            "claude" => which_any(&["claude"]),
            "codex" => which_any(&["codex"]),
            _ => None,
        }
    } else {
        let apps = PathBuf::from("/Applications");
        match id {
            "unreal" => glob_first(Path::new("/Users/Shared/Epic Games"), "UE_5", "Engine/Binaries/Mac/UnrealEditor.app"),
            "unity" => glob_first(&apps.join("Unity/Hub/Editor"), "", "Unity.app").or_else(|| first_existing(vec![apps.join("Unity Hub.app")])),
            "godot" => first_existing(vec![apps.join("Godot.app"), apps.join("Godot_mono.app")]).or_else(|| which_any(&["godot", "godot4"])),
            "web" => which_any(&["node"]),
            "blender" => first_existing(vec![apps.join("Blender.app")]).or_else(|| which_any(&["blender"])),
            "aseprite" => first_existing(vec![apps.join("Aseprite.app"), home.join("Library/Application Support/Steam/steamapps/common/Aseprite/Aseprite.app")]),
            "krita" => first_existing(vec![apps.join("krita.app")]),
            "audacity" => first_existing(vec![apps.join("Audacity.app")]),
            "substance" => glob_first(&apps, "Adobe Substance 3D Painter", "Adobe Substance 3D Painter.app"),
            "adb" => find_adb(),
            "git" => which_any(&["git", "p4"]),
            "claude" => which_any(&["claude"]),
            "codex" => which_any(&["codex"]),
            _ => None,
        }
    }
}

#[tauri::command]
async fn detect_tools() -> HashMap<String, ToolStatus> {
    let ids = ["unreal", "unity", "godot", "web", "blender", "aseprite", "krita", "audacity", "substance", "adb", "git", "claude", "codex"];
    ids.iter()
        .map(|id| {
            let p = find_tool(id);
            (id.to_string(), ToolStatus { installed: p.is_some(), path: p.map(|p| p.to_string_lossy().to_string()) })
        })
        .collect()
}

fn command(program: &Path) -> Command {
    let mut c = Command::new(program);
    c.env("PATH", search_path());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        c.creation_flags(CREATE_NO_WINDOW);
    }
    c
}

fn run(program: &Path, args: &[&str]) -> Result<String, String> {
    let out = command(program).args(args).output().map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&out.stdout).to_string() + &String::from_utf8_lossy(&out.stderr);
    if out.status.success() {
        Ok(text)
    } else {
        Err(text.trim().to_string())
    }
}

/// `adb install -r <apk>`, then launch it using the package id from `aapt dump badging`.
#[tauri::command]
async fn adb_install(apk: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let adb = find_adb().ok_or("adb not found — install Android platform-tools")?;
        let devices = run(&adb, &["devices"])?;
        if !devices.lines().skip(1).any(|l| l.trim().ends_with("device")) {
            return Err("No Android device connected — plug in via USB or pair over Wi-Fi".into());
        }
        run(&adb, &["install", "-r", &apk])?;
        let pkg = find_aapt().and_then(|aapt| run(&aapt, &["dump", "badging", &apk]).ok()).and_then(|out| {
            out.lines()
                .find(|l| l.starts_with("package:"))
                .and_then(|l| l.split("name='").nth(1))
                .and_then(|s| s.split('\'').next())
                .map(String::from)
        });
        match pkg {
            Some(p) => {
                run(&adb, &["shell", "monkey", "-p", &p, "-c", "android.intent.category.LAUNCHER", "1"])?;
                Ok(format!("Installed and launched {p}"))
            }
            None => Ok("Installed — open it on the device (aapt not found to auto-launch)".into()),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Runs the local Claude Code or Codex CLI non-interactively; the prompt goes in on stdin.
#[tauri::command]
async fn run_agent_cli(program: String, args: Vec<String>, stdin: String, cwd: Option<String>) -> Result<String, String> {
    if program != "claude" && program != "codex" {
        return Err("Only the claude and codex CLIs can be run".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::Write;
        let exe = find_tool(&program).ok_or(format!("{program} CLI not found on PATH"))?;
        let mut cmd = command(&exe);
        cmd.args(&args).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
        if let Some(dir) = cwd.filter(|d| Path::new(d).is_dir()) {
            cmd.current_dir(dir);
        }
        let mut child = cmd.spawn().map_err(|e| format!("Couldn't start {program}: {e}"))?;
        if let Some(mut s) = child.stdin.take() {
            s.write_all(stdin.as_bytes()).map_err(|e| e.to_string())?;
        }
        let out = child.wait_with_output().map_err(|e| e.to_string())?;
        let stdout = String::from_utf8_lossy(&out.stdout).to_string();
        if out.status.success() {
            Ok(stdout)
        } else {
            let err = String::from_utf8_lossy(&out.stderr).to_string();
            Err(format!("{program} exited with {}: {}", out.status, if err.trim().is_empty() { stdout } else { err }).trim().to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Running local agent processes by run id, so the UI can stop them.
fn runs() -> &'static std::sync::Mutex<HashMap<String, u32>> {
    static RUNS: std::sync::OnceLock<std::sync::Mutex<HashMap<String, u32>>> = std::sync::OnceLock::new();
    RUNS.get_or_init(|| std::sync::Mutex::new(HashMap::new()))
}
fn cancelled() -> &'static std::sync::Mutex<std::collections::HashSet<String>> {
    static C: std::sync::OnceLock<std::sync::Mutex<std::collections::HashSet<String>>> = std::sync::OnceLock::new();
    C.get_or_init(|| std::sync::Mutex::new(std::collections::HashSet::new()))
}

#[derive(Serialize)]
struct StreamResult {
    ok: bool,
    code: i32,
    stdout: String,
    stderr: String,
    cancelled: bool,
}

/// Like run_agent_cli, but sends every stdout line to the UI as it arrives (live progress).
#[tauri::command]
async fn run_agent_cli_stream(
    program: String,
    args: Vec<String>,
    stdin: String,
    cwd: Option<String>,
    run_id: String,
    on_line: tauri::ipc::Channel<String>,
) -> Result<StreamResult, String> {
    if program != "claude" && program != "codex" {
        return Err("Only the claude and codex CLIs can be run".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::{BufRead, BufReader, Read, Write};
        let exe = find_tool(&program).ok_or(format!("{program} CLI not found on PATH"))?;
        let mut cmd = command(&exe);
        cmd.args(&args).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
        if let Some(dir) = cwd.filter(|d| Path::new(d).is_dir()) {
            cmd.current_dir(dir);
        }
        let mut child = cmd.spawn().map_err(|e| format!("Couldn't start {program}: {e}"))?;
        runs().lock().unwrap().insert(run_id.clone(), child.id());
        if let Some(mut s) = child.stdin.take() {
            let _ = s.write_all(stdin.as_bytes());
        }
        let mut err_pipe = child.stderr.take();
        let err_thread = std::thread::spawn(move || {
            let mut s = String::new();
            if let Some(e) = err_pipe.as_mut() {
                let _ = e.read_to_string(&mut s);
            }
            s
        });
        let mut all = String::new();
        if let Some(out) = child.stdout.take() {
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                all.push_str(&line);
                all.push('\n');
                let _ = on_line.send(line);
            }
        }
        let status = child.wait().map_err(|e| e.to_string())?;
        runs().lock().unwrap().remove(&run_id);
        let was_cancelled = cancelled().lock().unwrap().remove(&run_id);
        Ok(StreamResult {
            ok: status.success(),
            code: status.code().unwrap_or(-1),
            stdout: all,
            stderr: err_thread.join().unwrap_or_default(),
            cancelled: was_cancelled,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Stops a running local agent (and anything it started).
#[tauri::command]
fn cancel_agent_run(run_id: String) -> bool {
    let Some(pid) = runs().lock().unwrap().get(&run_id).copied() else { return false };
    cancelled().lock().unwrap().insert(run_id);
    let pid = pid.to_string();
    let mut kill = if cfg!(windows) {
        let mut c = Command::new("taskkill");
        c.args(["/PID", &pid, "/T", "/F"]);
        c
    } else {
        let mut c = Command::new("kill");
        c.args(["-TERM", &pid]);
        c
    };
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        kill.creation_flags(0x0800_0000);
    }
    kill.status().map(|s| s.success()).unwrap_or(false)
}

#[derive(Serialize)]
struct GitOutput {
    ok: bool,
    code: i32,
    stdout: String,
    stderr: String,
}

/// Runs git in `cwd`. When `auth` is given (an HTTP Authorization header value) it is passed
/// through GIT_CONFIG_* environment variables for github.com only — never on the command line
/// and never written into the repo's config.
#[tauri::command]
async fn run_git(args: Vec<String>, cwd: Option<String>, auth: Option<String>) -> Result<GitOutput, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let git = which_any(&["git"])
            .or_else(|| first_existing(vec![PathBuf::from(r"C:\Program Files\Git\cmd\git.exe"), PathBuf::from("/usr/bin/git")]))
            .ok_or("Git isn't installed — get it from https://git-scm.com")?;
        let mut cmd = command(&git);
        cmd.args(&args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
        cmd.env("GIT_TERMINAL_PROMPT", "0");
        if let Some(dir) = cwd.filter(|d| Path::new(d).is_dir()) {
            cmd.current_dir(dir);
        }
        if let Some(a) = auth {
            cmd.env("GIT_CONFIG_COUNT", "1")
                .env("GIT_CONFIG_KEY_0", "http.https://github.com/.extraheader")
                .env("GIT_CONFIG_VALUE_0", format!("AUTHORIZATION: {a}"));
        }
        let out = cmd.output().map_err(|e| format!("Couldn't run git: {e}"))?;
        Ok(GitOutput {
            ok: out.status.success(),
            code: out.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&out.stdout).to_string(),
            stderr: String::from_utf8_lossy(&out.stderr).to_string(),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Writes a small text file (e.g. .gitignore / .gitattributes) if it doesn't exist yet.
#[tauri::command]
fn write_text_if_missing(path: String, text: String) -> Result<bool, String> {
    let p = PathBuf::from(&path);
    if p.exists() {
        return Ok(false);
    }
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&p, text).map_err(|e| e.to_string())?;
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run_app() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            scan_folder,
            save_bytes,
            read_file_bytes,
            copy_file,
            remove_file,
            secret_get,
            secret_set,
            detect_tools,
            adb_install,
            run_agent_cli,
            run_git,
            run_agent_cli_stream,
            cancel_agent_run,
            write_text_if_missing
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mosslight");
}
